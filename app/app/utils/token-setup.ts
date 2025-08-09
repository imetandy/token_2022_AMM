import { web3 } from '@coral-xyz/anchor';
type Connection = any;
type Transaction = any;
type Keypair = any;
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { createRpc, getBestRpcEndpoint } from '../config/rpc-config';
import { createTransactionMessage, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, sendAndConfirmTransactionFactory } from '@solana/kit';
import type { Address } from '@solana/addresses';

export interface TokenSetupResult {
  mintAddress: string;
  signature: string;
  tradeCounterAddress: string;
}

export class TokenSetup {
  private connection: Connection;
  private ammProgramId: web3.PublicKey;
  private counterHookProgramId: web3.PublicKey;
  private rpc = createRpc();

  constructor(connection: Connection, ammProgramId: web3.PublicKey) {
    this.connection = connection;
    this.ammProgramId = ammProgramId;
    this.counterHookProgramId = new web3.PublicKey('GwLhrTbEzTY91MphjQyA331P63yQDq31Frw5uvZ1umdQ');
  }

  /**
   * Initialize transfer hook accounts for a token that was created with SPL Token CLI
   */
  async initializeTransferHookAccounts(
    mintAddress: string,
    walletPublicKey: web3.PublicKey
  ): Promise<TokenSetupResult> {
    console.log('Initializing transfer hook accounts for mint:', mintAddress);

    const mintPubkey = new web3.PublicKey(mintAddress);

          // Derive the trade counter PDA
      const [tradeCounterPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintPubkey.toBuffer()],
        this.counterHookProgramId
      );

    console.log('Trade counter PDA:', tradeCounterPda.toString());

    // Create the initialization instruction
    const initInstruction = {
      programId: this.counterHookProgramId,
      keys: [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: tradeCounterPda, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: new web3.PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }
      ],
      data: Buffer.from([
        // Instruction discriminator for initialize_mint_trade_counter
        92, 197, 174, 197, 41, 124, 19, 3
      ])
    };

    const { value: { blockhash, lastValidBlockHeight } } = await this.rpc.getLatestBlockhash().send();
    let message = createTransactionMessage({ version: 0, instructions: [initInstruction as any] } as any) as any;
    message = setTransactionMessageFeePayerSigner(message as any, walletPublicKey as any) as any;
    message = setTransactionMessageLifetimeUsingBlockhash(message as any, { blockhash, lastValidBlockHeight } as any) as any;
    const signed = await signTransactionMessageWithSigners(message as any, {} as any);
    const { createSolanaRpcSubscriptions } = await import('@solana/kit');
    const rpcSubscriptions = createSolanaRpcSubscriptions(getBestRpcEndpoint() as any);
    const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc: this.rpc, rpcSubscriptions } as any);
    const signature = await sendAndConfirm(signed as any, { commitment: 'confirmed', lastValidBlockHeight } as any);
    const signatureStr = typeof signature === 'string' ? signature : '';

    return {
      mintAddress,
      signature: signatureStr,
      tradeCounterAddress: tradeCounterPda.toString()
    };
  }

  /**
   * Get trade counter data for a mint
   */
  async getTradeCounter(mintAddress: string): Promise<{
    mint: string;
    incomingTransfers: number;
    outgoingTransfers: number;
    totalIncomingVolume: number;
    totalOutgoingVolume: number;
    totalTransfers: number;
    totalVolume: number;
    lastUpdated: number;
    hookOwner: string;
  } | null> {
    try {
      const mintPubkey = new web3.PublicKey(mintAddress);
      
          // Derive the trade counter PDA
    const [tradeCounterPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('mint-trade-counter'), mintPubkey.toBuffer()],
      this.counterHookProgramId
    );

      console.log('Trade counter PDA:', tradeCounterPda.toString());

      // Get the account data
      const accountInfo = await this.rpc.getAccountInfo(tradeCounterPda.toBase58() as unknown as Address).send();
      
      const account = accountInfo.value;
      if (!account) {
        console.log('Trade counter account not found');
        return null;
      }

      // Decode borsh-serialized MintTradeCounter (no discriminator)
      const encData = account.data as unknown as [string, 'base64' | 'base58'];
      const [encoded, encoding] = encData;
      const data = encoding === 'base64' ? Buffer.from(encoded, 'base64') : Buffer.from(bs58.decode(encoded));

      // Layout:
      // 0..32   mint Pubkey
      // 32..40  incoming_transfers u64
      // 40..48  outgoing_transfers u64
      // 48..56  total_incoming_volume u64
      // 56..64  total_outgoing_volume u64
      // 64..72  last_updated i64
      // 72..104 hook_owner Pubkey
      const mint = new web3.PublicKey(data.slice(0, 32));
      const incomingTransfers = Number(data.readBigUInt64LE(32));
      const outgoingTransfers = Number(data.readBigUInt64LE(40));
      const totalIncomingVolume = Number(data.readBigUInt64LE(48));
      const totalOutgoingVolume = Number(data.readBigUInt64LE(56));
      const lastUpdated = Number(data.readBigInt64LE(64));
      const hookOwner = new web3.PublicKey(data.slice(72, 104)).toString();

      return {
        mint: mint.toString(),
        incomingTransfers,
        outgoingTransfers,
        totalIncomingVolume,
        totalOutgoingVolume,
        totalTransfers: incomingTransfers + outgoingTransfers,
        totalVolume: totalIncomingVolume + totalOutgoingVolume,
        lastUpdated,
        hookOwner,
      };
    } catch (error) {
      console.error('Error getting trade counter:', error);
      return null;
    }
  }

  /**
   * Create a complete token setup workflow
   */
  async createTokenWithHook(
    walletPublicKey: web3.PublicKey,
    tokenName: string,
    tokenSymbol: string
  ): Promise<TokenSetupResult> {
    console.log('Starting complete token setup workflow...');
    console.log('Token Name:', tokenName);
    console.log('Token Symbol:', tokenSymbol);

    // Step 1: Create token using SPL Token CLI (this would be done manually or via script)
    console.log('Step 1: Please create the token using SPL Token CLI:');
    console.log(`spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --decimals 9 --enable-transfer-hook --transfer-hook-program-id ${this.ammProgramId.toString()}`);
    
    // For now, we'll assume the token is created and return a placeholder
    // In a real implementation, you'd parse the CLI output or have the mint address
    throw new Error('Please create the token using SPL Token CLI first, then call initializeTransferHookAccounts with the mint address');
  }
} 