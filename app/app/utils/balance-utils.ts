import { PublicKey, derivePdaAddressSync, deriveAtaAddressSync } from './kit';
type Connection = any;
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { AMM_PROGRAM_ID } from '../config/program';
import { rpcGetAccountInfo, toAddress } from './kit';

export interface TokenBalance {
  mint: string;
  amount: number;
  uiAmount: number;
  decimals: number;
}

export interface PoolBalances {
  tokenABalance: TokenBalance;
  tokenBBalance: TokenBalance;
  userTokenABalance: TokenBalance;
  userTokenBBalance: TokenBalance;
}

export class BalanceUtils {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey(AMM_PROGRAM_ID);
  }

  /**
   * Helper function to derive pool authority using findProgramAddressSync
   */
  private getPoolAuthorityInternal(
    poolAddress: PublicKey,
    tokenA: PublicKey,
    tokenB: PublicKey
  ): [PublicKey, number] {
    // Use findProgramAddressSync to get the canonical bump
    const poolAuthority = derivePdaAddressSync([
      poolAddress,
      tokenA,
      tokenB,
      'pool_authority',
    ], this.programId.toBase58());
    return [poolAuthority, 0];
  }



  async getUserTokenBalance(
    mintAddress: PublicKey,
    userAddress: PublicKey
  ): Promise<TokenBalance> {
    try {
      const tokenAccount = deriveAtaAddressSync({
        owner: userAddress,
        mint: mintAddress,
        tokenProgramAddressBase58: TOKEN_2022_PROGRAM_ID.toBase58 ? TOKEN_2022_PROGRAM_ID.toBase58() : String(TOKEN_2022_PROGRAM_ID),
        associatedTokenProgramAddressBase58: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      });

      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
      
      if (!accountInfo.value) {
        return {
          mint: mintAddress.toString(),
          amount: 0,
          uiAmount: 0,
          decimals: 6
        };
      }

      return {
        mint: mintAddress.toString(),
        amount: Number(accountInfo.value.amount),
        uiAmount: accountInfo.value.uiAmount || 0,
        decimals: accountInfo.value.decimals
      };
    } catch (error) {
      // If account doesn't exist, return zero balance
      if (error instanceof Error && error.message.includes('could not find account')) {
        return {
          mint: mintAddress.toString(),
          amount: 0,
          uiAmount: 0,
          decimals: 6
        };
      }
      console.error('Error fetching user token balance:', error);
      return {
        mint: mintAddress.toString(),
        amount: 0,
        uiAmount: 0,
        decimals: 6
      };
    }
  }

  async getPoolTokenBalance(
    mintAddress: PublicKey,
    poolAuthority: PublicKey
  ): Promise<TokenBalance> {
    try {
      const poolTokenAccount = deriveAtaAddressSync({
        owner: poolAuthority,
        mint: mintAddress,
        tokenProgramAddressBase58: TOKEN_2022_PROGRAM_ID.toBase58 ? TOKEN_2022_PROGRAM_ID.toBase58() : String(TOKEN_2022_PROGRAM_ID),
        associatedTokenProgramAddressBase58: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      });

      const accountInfo = await this.connection.getTokenAccountBalance(poolTokenAccount);
      
      if (!accountInfo.value) {
        return {
          mint: mintAddress.toString(),
          amount: 0,
          uiAmount: 0,
          decimals: 6
        };
      }

      return {
        mint: mintAddress.toString(),
        amount: Number(accountInfo.value.amount),
        uiAmount: accountInfo.value.uiAmount || 0,
        decimals: accountInfo.value.decimals
      };
    } catch (error) {
      // If account doesn't exist, return zero balance
      if (error instanceof Error && error.message.includes('could not find account')) {
        return {
          mint: mintAddress.toString(),
          amount: 0,
          uiAmount: 0,
          decimals: 6
        };
      }
      console.error('Error fetching pool token balance:', error);
      return {
        mint: mintAddress.toString(),
        amount: 0,
        uiAmount: 0,
        decimals: 6
      };
    }
  }

  async getPoolBalances(
    ammAddress: PublicKey,
    poolAddress: PublicKey,
    tokenA: PublicKey,
    tokenB: PublicKey,
    userAddress: PublicKey
  ): Promise<PoolBalances> {
    try {
      // Derive pool authority using findProgramAddressSync
      const [poolAuthority] = this.getPoolAuthorityInternal(
        poolAddress,
        tokenA,
        tokenB,
      );

      // Fetch all balances in parallel
      const [
        poolTokenABalance,
        poolTokenBBalance,
        userTokenABalance,
        userTokenBBalance
      ] = await Promise.all([
        this.getPoolTokenBalance(tokenA, poolAuthority),
        this.getPoolTokenBalance(tokenB, poolAuthority),
        this.getUserTokenBalance(tokenA, userAddress),
        this.getUserTokenBalance(tokenB, userAddress)
      ]);

      return {
        tokenABalance: poolTokenABalance,
        tokenBBalance: poolTokenBBalance,
        userTokenABalance,
        userTokenBBalance
      };
    } catch (error) {
      console.error('Error fetching pool balances:', error);
      throw error;
    }
  }

  async getPoolAuthority(
    poolAddress: PublicKey,
    tokenA: PublicKey,
    tokenB: PublicKey
  ): Promise<PublicKey> {
    const [poolAuthority] = this.getPoolAuthorityInternal(poolAddress, tokenA, tokenB);
    return poolAuthority;
  }
} 