import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export class TokenMinting {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get the associated token account address for a mint and owner
   */
  private async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const [associatedTokenAddress] = await PublicKey.findProgramAddress(
      [
        owner.toBuffer(),
        TOKEN_2022_PROGRAM_ID.toBuffer(),
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
      // First check if the token account exists
      const accountInfo = await this.connection.getAccountInfo(userTokenAccount);
      if (!accountInfo) {
        console.log(`Token account ${userTokenAccount.toString()} does not exist for mint ${mintAddress}`);
        return 0;
      }
      
      const balanceInfo = await this.connection.getTokenAccountBalance(userTokenAccount);
      return balanceInfo.value.uiAmount || 0;
    } catch (error) {
      console.log('Error getting token balance:', error);
      return 0;
    }
  }
} 