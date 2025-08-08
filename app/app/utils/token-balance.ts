import { PublicKey } from './kit';
type Connection = any;
import { createRpc } from '../config/rpc-config';
import { toAddress } from './kit';

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export class TokenMinting {
  private connection: Connection;
  private rpc = createRpc();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get the associated token account address for a mint and owner
   */
  private async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const [associatedTokenAddress] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
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
      // Fast-read via Kit RPC; fallback to web3.js if needed
      const accountInfo = await this.rpc.getAccountInfo(toAddress(userTokenAccount)).send();
      if (!accountInfo.value) {
        console.log(`Token account ${userTokenAccount.toString()} does not exist for mint ${mintAddress}`);
        return 0;
      }
      
      const balanceInfo = await this.connection.getTokenAccountBalance(userTokenAccount);
      return balanceInfo.value.uiAmount ?? 0;
    } catch (error) {
      console.log('Error getting token balance:', error);
      return 0;
    }
  }
} 