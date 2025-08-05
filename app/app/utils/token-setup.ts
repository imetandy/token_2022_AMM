import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

export interface TokenSetupResult {
  mintAddress: string;
  signature: string;
  tradeCounterAddress: string;
}

export class TokenSetup {
  private connection: Connection;
  private ammProgramId: PublicKey;
  private counterHookProgramId: PublicKey;

  constructor(connection: Connection, ammProgramId: PublicKey) {
    this.connection = connection;
    this.ammProgramId = ammProgramId;
    this.counterHookProgramId = new PublicKey('EiAAboUH3o19cRw4wRo2f2erCcbGtRUtq9PgNS4RGgi');
  }

  /**
   * Initialize transfer hook accounts for a token that was created with SPL Token CLI
   */
  async initializeTransferHookAccounts(
    mintAddress: string,
    walletPublicKey: PublicKey
  ): Promise<TokenSetupResult> {
    console.log('Initializing transfer hook accounts for mint:', mintAddress);

    const mintPubkey = new PublicKey(mintAddress);

          // Derive the trade counter PDA
      const [tradeCounterPda] = PublicKey.findProgramAddressSync(
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
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }
      ],
      data: Buffer.from([
        // Instruction discriminator for initialize_mint_trade_counter
        92, 197, 174, 197, 41, 124, 19, 3
      ])
    };

    const transaction = new Transaction();
    transaction.add(initInstruction);

    // Get the latest blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    console.log('Transaction created, sending...');
    
    // Send the transaction
    const signature = await this.connection.sendRawTransaction(transaction.serialize());
    console.log('Transaction sent with signature:', signature);

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed:', confirmation);

    return {
      mintAddress,
      signature,
      tradeCounterAddress: tradeCounterPda.toString()
    };
  }

  /**
   * Get trade counter data for a mint
   */
  async getTradeCounter(mintAddress: string): Promise<{
    mint: string;
    totalTransfers: number;
    totalVolume: number;
    lastUpdated: number;
  } | null> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      
          // Derive the trade counter PDA
    const [tradeCounterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint-trade-counter'), mintPubkey.toBuffer()],
      this.counterHookProgramId
    );

      console.log('Trade counter PDA:', tradeCounterPda.toString());

      // Get the account data
      const accountInfo = await this.connection.getAccountInfo(tradeCounterPda);
      
      if (!accountInfo) {
        console.log('Trade counter account not found');
        return null;
      }

      // Parse the account data
      const data = accountInfo.data;
      
      // Skip discriminator (8 bytes)
      const mint = new PublicKey(data.slice(8, 40));
      const totalTransfers = data.readBigUInt64LE(40);
      const totalVolume = data.readBigUInt64LE(48);
      const lastUpdated = data.readBigInt64LE(56);

      return {
        mint: mint.toString(),
        totalTransfers: Number(totalTransfers),
        totalVolume: Number(totalVolume),
        lastUpdated: Number(lastUpdated)
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
    walletPublicKey: PublicKey,
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