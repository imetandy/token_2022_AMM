import { web3 } from '@coral-xyz/anchor';
type Connection = any;
import { createRpc } from '../config/rpc-config';
import type { Address } from '@solana/addresses';

const TOKEN_2022_PROGRAM_ID = new web3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export class TokenMinting {
  private connection: Connection;
  private rpc = createRpc();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get the associated token account address for a mint and owner
   */
  private async getAssociatedTokenAddress(mint: web3.PublicKey, owner: web3.PublicKey): Promise<web3.PublicKey> {
    const [associatedTokenAddress] = web3.PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );
    return associatedTokenAddress;
  }

  /**
   * Check token balance for a user
   */
  async getTokenBalance(mintAddress: string, userWallet: web3.PublicKey): Promise<number> {
    const mintPubkey = new web3.PublicKey(mintAddress);
    const userTokenAccount = await this.getAssociatedTokenAddress(mintPubkey, userWallet);
    
    try {
      // Fast-read via Kit RPC; fallback to web3.js if needed
      const accountInfo = await this.rpc.getAccountInfo(userTokenAccount.toBase58() as unknown as Address).send();
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