import { PublicKey } from './kit';
type Connection = any;
type Transaction = any;
type Keypair = any;
class SendTransactionError extends Error { logs?: string[] }
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { TOKEN_SETUP_PROGRAM_ID, COUNTER_HOOK_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '../config/program';
import { TransactionResult } from './transaction-utils';
import { rpcGetAccountInfo, derivePdaAddressSync } from './kit';
import { Transaction as Web3Transaction, TransactionInstruction, PublicKey as Web3PublicKey, Keypair as Web3Keypair } from '@solana/web3.js';
import { waitForConfirmation } from './confirm';
import { AccountRole } from '@solana/kit';
import { getCreateTokenWithHookInstruction } from '../clients/token_setup/instructions/createTokenWithHook';
import { getMintTokensInstruction } from '../clients/token_setup/instructions/mintTokens';
import { getInitializeExtraAccountMetaListInstructionAsync } from '../clients/token_setup/instructions/initializeExtraAccountMetaList';

export class TokenSetupClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey(TOKEN_SETUP_PROGRAM_ID);
  }

  async createTokenWithHook(
    walletPublicKey: PublicKey,
    sendTransaction: (tx: any, connection: any, opts?: any) => Promise<string>,
    name: string,
    symbol: string,
    uri: string
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
      if (balance < 0.01 * 1e9) { // Less than 0.01 SOL
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }
      // Generate a new mint keypair (web3.js) for the token mint (must be a signer)
      const mintKeypair = Web3Keypair.generate();

      // Build instruction using kinobi client (will auto-derive PDAs)
      // Provide TransactionSigner-shaped objects so builder marks signers correctly
      const kitMintSigner = {
        address: mintKeypair.publicKey.toBase58(),
        signTransactions: async (txs: any[]) => txs,
        signMessages: async (msgs: any[]) => msgs,
      } as any;
      const kitWalletSigner = {
        address: walletPublicKey.toBase58(),
        signTransactions: async (txs: any[]) => txs,
        signMessages: async (msgs: any[]) => msgs,
      } as any;
      // Pre-derive PDAs to satisfy on-chain seeds exactly
      const extraAccountMetaListPda = derivePdaAddressSync([
        'extra-account-metas',
        mintKeypair.publicKey,
      ], TOKEN_SETUP_PROGRAM_ID);
      const mintTradeCounterPda = derivePdaAddressSync([
        'mint-trade-counter',
        mintKeypair.publicKey,
      ], TOKEN_SETUP_PROGRAM_ID);

      const ix = getCreateTokenWithHookInstruction(
        {
          mint: kitMintSigner,
          authority: kitWalletSigner,
          payer: kitWalletSigner,
          counterHookProgram: COUNTER_HOOK_PROGRAM_ID as any,
          // Explicitly provide PDAs to match seeds
          extraAccountMetaList: extraAccountMetaListPda.toBase58() as any,
          mintTradeCounter: mintTradeCounterPda.toBase58() as any,
          name,
          symbol,
          uri,
        } as any,
        { programAddress: TOKEN_SETUP_PROGRAM_ID as any }
      );

      // Convert to web3.js TransactionInstruction
      const web3Ix = new TransactionInstruction({
        programId: new Web3PublicKey(ix.programAddress),
        keys: ix.accounts.map((a: any) => {
          const pubkey = new Web3PublicKey(a.address);
          const role = a.role as AccountRole;
          const isWritable = role === AccountRole.WRITABLE || role === (AccountRole as any).WRITABLE_SIGNER;
          const isSigner = pubkey.equals(mintKeypair.publicKey) || pubkey.equals(walletPublicKey) || ('signer' in a && !!a.signer);
          return { pubkey, isSigner, isWritable };
        }),
        data: Buffer.from(ix.data),
      });

      // Build legacy transaction for wallet signing
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const tx = new Web3Transaction({ feePayer: walletPublicKey, recentBlockhash: blockhash });
      tx.add(web3Ix);

      // Partially sign with the mint keypair (required signer)
      tx.partialSign(mintKeypair);

      // Let the wallet sign and send
      const signature = await sendTransaction(tx, this.connection, { skipPreflight: true, maxRetries: 3 });
      const confirmation: any = await waitForConfirmation(this.connection, signature, 60000, 'confirmed');
      if (confirmation.value.err) {
        return { signature, success: false, error: 'Transaction failed', logs: [] };
      }

      const mintAddress = mintKeypair.publicKey.toBase58();
      const extraAccountMetaList = derivePdaAddressSync(['extra-account-metas', new PublicKey(mintAddress)], TOKEN_SETUP_PROGRAM_ID);
      const mintTradeCounter = derivePdaAddressSync(['mint-trade-counter', new PublicKey(mintAddress)], COUNTER_HOOK_PROGRAM_ID);

      return { signature, success: true, error: null, logs: [], mintAddress, extraAccountMetaListAddress: extraAccountMetaList.toBase58(), mintTradeCounterAddress: mintTradeCounter.toBase58() };

    } catch (error) {
      console.error('Error creating token with hook:', error);
      
      // Handle SendTransactionError specifically
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
        };
      }
      
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async mintTokens(
    walletPublicKey: PublicKey,
    sendTransaction: (tx: any, connection: any, opts?: any) => Promise<string>,
    mint: PublicKey,
    amount: number
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
      if (balance < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }
      // Derive ATA
      const tokenAccount = getAssociatedTokenAddressSync(
        mint,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );
      const ixs: TransactionInstruction[] = [];
      // Create ATA up front if it doesn't exist (avoids inner CPI failures)
      const tokenAccountInfo = (await rpcGetAccountInfo(tokenAccount)).value;
      if (!tokenAccountInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            walletPublicKey,
            tokenAccount,
            walletPublicKey,
            mint,
            new Web3PublicKey(TOKEN_2022_PROGRAM_ID),
            new Web3PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID as any)
          ) as any
        );
      }

      // Build mintTokens instruction via kinobi
      // Provide TransactionSigner-shaped authority so meta marks as signer
      const kitWalletSigner = {
        address: walletPublicKey.toBase58(),
        signTransactions: async (txs: any[]) => txs,
        signMessages: async (msgs: any[]) => msgs,
      } as any;
      const mintIx = getMintTokensInstruction(
        {
          mint: mint.toBase58() as any,
          tokenAccount: tokenAccount.toBase58() as any,
          authority: kitWalletSigner,
          amount: BigInt(amount) as any,
        } as any,
        { programAddress: TOKEN_SETUP_PROGRAM_ID as any }
      );

      const web3MintIx = new TransactionInstruction({
        programId: new Web3PublicKey(mintIx.programAddress),
        keys: mintIx.accounts.map((a: any) => {
          const pubkey = new Web3PublicKey(a.address);
          const role = a.role as AccountRole;
          let isWritable = role === AccountRole.WRITABLE || role === (AccountRole as any).WRITABLE_SIGNER;
          // Ensure mint is writable to avoid privilege escalation in CPI
          if (pubkey.equals(mint)) {
            isWritable = true;
          }
          const isSigner = pubkey.equals(walletPublicKey) || ('signer' in a && !!a.signer);
          return { pubkey, isSigner, isWritable };
        }),
        data: Buffer.from(mintIx.data),
      });
      ixs.push(web3MintIx);

      // Build and sign with wallet
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const tx = new Web3Transaction({ feePayer: walletPublicKey, recentBlockhash: blockhash });
      tx.add(...ixs);
      const signature = await sendTransaction(tx, this.connection, { skipPreflight: true, maxRetries: 3 });
      const confirmation: any = await waitForConfirmation(this.connection, signature, 60000, 'confirmed');
      if (confirmation.value.err) {
        const txInfo = await this.connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
        return { signature, success: false, error: 'Transaction failed', logs: txInfo?.meta?.logMessages || [] };
      }

      return { signature, success: true, error: null, logs: [], userAccountAddress: tokenAccount.toBase58() };

    } catch (error) {
      console.error('Error minting tokens:', error);
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
        };
      }
      
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async initializeExtraAccountMetaList(
    walletPublicKey: PublicKey,
    sendTransaction: (tx: any, connection: any, opts?: any) => Promise<string>,
    mint: PublicKey
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
      if (balance < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }
      // Build kinobi instruction (auto-derive accounts)
      const ix = await getInitializeExtraAccountMetaListInstructionAsync(
        {
          payer: walletPublicKey.toBase58() as any,
          mint: mint.toBase58() as any,
        } as any,
        { programAddress: TOKEN_SETUP_PROGRAM_ID as any }
      );

      const web3Ix = new TransactionInstruction({
        programId: new Web3PublicKey(ix.programAddress),
        keys: ix.accounts.map((a: any) => {
          const pubkey = new Web3PublicKey(a.address);
          const role = a.role as AccountRole;
          const isWritable = role === AccountRole.WRITABLE || role === (AccountRole as any).WRITABLE_SIGNER;
          const isSigner = pubkey.equals(walletPublicKey) || ('signer' in a && !!a.signer);
          return { pubkey, isSigner, isWritable };
        }),
        data: Buffer.from(ix.data),
      });

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const tx = new Web3Transaction({ feePayer: walletPublicKey, recentBlockhash: blockhash });
      tx.add(web3Ix);
      const signature = await sendTransaction(tx, this.connection, { skipPreflight: true, maxRetries: 3 });
      const confirmation: any = await waitForConfirmation(this.connection, signature, 60000, 'confirmed');
      if (confirmation.value.err) {
        return { signature, success: false, error: 'Transaction failed', logs: [] };
      }
      return { signature, success: true, error: null, logs: [] };

    } catch (error) {
      console.error('Error initializing extra account meta list:', error);
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
        };
      }
      
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 