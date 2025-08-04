import { 
  Connection, 
  PublicKey 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID
} from '@solana/spl-token';
import { PROGRAM_ID } from '../config/program';

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
    this.programId = new PublicKey(PROGRAM_ID);
  }

  async getUserTokenBalance(
    mintAddress: PublicKey,
    userAddress: PublicKey
  ): Promise<TokenBalance> {
    try {
      const tokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        userAddress,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
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
    mintAddress: PublicKey,
    poolAuthority: PublicKey
  ): Promise<TokenBalance> {
    try {
      const poolTokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
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
    ammAddress: PublicKey,
    poolAddress: PublicKey,
    tokenA: PublicKey,
    tokenB: PublicKey,
    userAddress: PublicKey
  ): Promise<PoolBalances> {
    try {
      // Derive pool authority PDA
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          ammAddress.toBuffer(),
          tokenA.toBuffer(),
          tokenB.toBuffer(),
          Buffer.from('pool-authority')
        ],
        this.programId
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
    ammAddress: PublicKey,
    tokenA: PublicKey,
    tokenB: PublicKey
  ): Promise<PublicKey> {
    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [
        ammAddress.toBuffer(),
        tokenA.toBuffer(),
        tokenB.toBuffer(),
        Buffer.from('pool-authority')
      ],
      this.programId
    );
    return poolAuthority;
  }
} 