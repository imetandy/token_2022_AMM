import { web3 } from '@coral-xyz/anchor';
type Connection = any;
import { AMM_PROGRAM_ID } from '../config/program';
import { TOKEN_2022_PROGRAM, ASSOCIATED_TOKEN_PROGRAM } from '../config/constants';

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
  private programId: web3.PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new web3.PublicKey(AMM_PROGRAM_ID);
  }

  /**
   * Helper function to derive pool authority using findProgramAddressSync
   */
  private getPoolAuthorityInternal(
    poolAddress: web3.PublicKey,
    tokenA: web3.PublicKey,
    tokenB: web3.PublicKey
  ): [web3.PublicKey, number] {
    const [pda, bump] = web3.PublicKey.findProgramAddressSync(
      [poolAddress.toBuffer(), tokenA.toBuffer(), tokenB.toBuffer(), Buffer.from('pool_authority')],
      this.programId
    );
    return [pda, bump];
  }



  async getUserTokenBalance(
    mintAddress: web3.PublicKey,
    userAddress: web3.PublicKey
  ): Promise<TokenBalance> {
    try {
      const [tokenAccount] = web3.PublicKey.findProgramAddressSync(
        [userAddress.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintAddress.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM
      );

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
    mintAddress: web3.PublicKey,
    poolAuthority: web3.PublicKey
  ): Promise<TokenBalance> {
    try {
      const [poolTokenAccount] = web3.PublicKey.findProgramAddressSync(
        [poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintAddress.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM
      );

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
    ammAddress: web3.PublicKey,
    poolAddress: web3.PublicKey,
    tokenA: web3.PublicKey,
    tokenB: web3.PublicKey,
    userAddress: web3.PublicKey
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
    poolAddress: web3.PublicKey,
    tokenA: web3.PublicKey,
    tokenB: web3.PublicKey
  ): Promise<web3.PublicKey> {
    const [poolAuthority] = this.getPoolAuthorityInternal(poolAddress, tokenA, tokenB);
    return poolAuthority;
  }
} 