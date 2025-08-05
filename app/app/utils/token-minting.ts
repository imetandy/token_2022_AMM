import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface TokenMintingResult {
  mintAddress: string;
  userTokenAccount: string;
  signature: string;
  amount: string;
}

export class TokenMinting {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Mint tokens to a user's wallet for testing
   */
  async mintTokensToUser(
    mintAddress: string,
    userWallet: PublicKey,
    amount: number = 1000000000, // 1 token with 9 decimals
    decimals: number = 9
  ): Promise<TokenMintingResult> {
    console.log(`Minting ${amount} tokens (${amount / Math.pow(10, decimals)} tokens) to user wallet`);

    const mintPubkey = new PublicKey(mintAddress);
    
    // Get the user's associated token account
    const userTokenAccount = await this.getAssociatedTokenAddress(mintPubkey, userWallet);
    
    console.log('User token account:', userTokenAccount.toString());

    // Create mint instruction
    const mintInstruction = {
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        { pubkey: userWallet, isSigner: true, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }
      ],
      data: Buffer.from([
        // Instruction discriminator for mint_to
        7,
        // Amount (little endian)
        ...new Uint8Array(new Uint32Array([amount]).buffer),
        // Decimals
        decimals
      ])
    };

    const transaction = new Transaction();
    transaction.add(mintInstruction);

    // Get the latest blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    console.log('Transaction created, sending...');
    
    // Send the transaction
    const signature = await this.connection.sendRawTransaction(transaction.serialize());
    console.log('Transaction sent with signature:', signature);

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed:', confirmation);

    return {
      mintAddress,
      userTokenAccount: userTokenAccount.toString(),
      signature,
      amount: (amount / Math.pow(10, decimals)).toString()
    };
  }

  /**
   * Get the associated token account address for a mint and owner
   */
  private async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const [associatedTokenAddress] = await PublicKey.findProgramAddress(
      [
        owner.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );
    return associatedTokenAddress;
  }

  /**
   * Check token balance for a user
   */
  async getTokenBalance(mintAddress: string, userWallet: PublicKey): Promise<number> {
    const mintPubkey = new PublicKey(mintAddress);
    const userTokenAccount = await this.getAssociatedTokenAddress(mintPubkey, userWallet);
    
    try {
      const accountInfo = await this.connection.getTokenAccountBalance(userTokenAccount);
      return accountInfo.value.uiAmount || 0;
    } catch (error) {
      console.log('No token account found or error getting balance:', error);
      return 0;
    }
  }
} 