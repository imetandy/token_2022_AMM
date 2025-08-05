import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair,
  sendAndConfirmTransaction as solanaSendAndConfirm,
  SendTransactionError
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createInitializeMintInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { TOKEN_SETUP_PROGRAM_ID, COUNTER_HOOK_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '../config/program';
import { sendAndConfirmTransaction, TransactionResult } from './transaction-utils';

export class TokenSetupClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey(TOKEN_SETUP_PROGRAM_ID);
  }

  async createTokenWithHook(
    payer: Keypair,
    mintKeypair: Keypair,
    name: string,
    symbol: string,
    uri: string
  ): Promise<TransactionResult> {
    try {
      // Check if payer has sufficient SOL
      const balance = await this.connection.getBalance(payer.publicKey);
      if (balance < 0.01 * 1e9) { // Less than 0.01 SOL
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }

      const transaction = new Transaction();
      
      // Create mint account
      const mintRent = await this.connection.getMinimumBalanceForRentExemption(82);
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: 82, // Size for Token-2022 mint
          lamports: mintRent,
          programId: new PublicKey(TOKEN_2022_PROGRAM_ID)
        })
      );

      // Initialize mint with transfer hook
      transaction.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          6, // decimals
          payer.publicKey,
          payer.publicKey,
          new PublicKey(TOKEN_2022_PROGRAM_ID)
        )
      );

      // Create token with hook instruction
      const createTokenIx = {
        programId: this.programId,
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(COUNTER_HOOK_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createTokenWithHook
          186, 132, 153, 159, 183, 146, 10, 218,
          // Name length + name
          ...Array.from(Buffer.from([name.length])),
          ...Array.from(Buffer.from(name)),
          // Symbol length + symbol  
          ...Array.from(Buffer.from([symbol.length])),
          ...Array.from(Buffer.from(symbol)),
          // URI length + URI
          ...Array.from(Buffer.from([uri.length])),
          ...Array.from(Buffer.from(uri))
        ])
      };

      transaction.add(createTokenIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer, mintKeypair]
      );

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
    payer: Keypair,
    mint: PublicKey,
    amount: number
  ): Promise<TransactionResult> {
    try {
      // Check if payer has sufficient SOL
      const balance = await this.connection.getBalance(payer.publicKey);
      if (balance < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }

      const transaction = new Transaction();

      // Get or create associated token account
      const tokenAccount = getAssociatedTokenAddressSync(
        mint,
        payer.publicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      // Check if token account exists
      const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccount);
      if (!tokenAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            tokenAccount,
            payer.publicKey,
            mint,
            new PublicKey(TOKEN_2022_PROGRAM_ID)
          )
        );
      }

      // Mint tokens instruction
      const mintTokensIx = {
        programId: this.programId,
        keys: [
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: tokenAccount, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for mintTokens
          59, 132, 24, 246, 122, 39, 8, 243,
          // Amount (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer))
        ])
      };

      transaction.add(mintTokensIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer]
      );

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
    payer: Keypair,
    mint: PublicKey
  ): Promise<TransactionResult> {
    try {
      // Check if payer has sufficient SOL
      const balance = await this.connection.getBalance(payer.publicKey);
      if (balance < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }

      const transaction = new Transaction();

      // Derive extra account meta list PDA
      const [extraAccountMetaList] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('extra-account-metas'),
          mint.toBuffer()
        ],
        this.programId
      );

      // Derive mint trade counter PDA
      const [mintTradeCounter] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('mint-trade-counter'),
          mint.toBuffer()
        ],
        new PublicKey(COUNTER_HOOK_PROGRAM_ID)
      );

      const initializeMetaListIx = {
        programId: this.programId,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: extraAccountMetaList, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounter, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for initializeExtraAccountMetaList
          92, 197, 174, 197, 41, 124, 19, 3
        ])
      };

      transaction.add(initializeMetaListIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer]
      );

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