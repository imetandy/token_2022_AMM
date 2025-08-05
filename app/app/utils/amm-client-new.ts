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
import { AMM_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '../config/program';
import { sendAndConfirmTransaction, TransactionResult } from './transaction-utils';

export class AMMClientNew {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey(AMM_PROGRAM_ID);
  }

  async createAMM(
    payer: Keypair,
    poolId: string,
    solFee: number,
    solFeeCollector: PublicKey
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
      
      // Derive AMM PDA
      const [ammId] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm'),
          Buffer.from(poolId)
        ],
        this.programId
      );

      const createAmmIx = {
        programId: this.programId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: solFeeCollector, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createAmm
          242, 91, 21, 170, 5, 68, 125, 64,
          // Pool ID length + pool ID
          ...Array.from(Buffer.from([poolId.length])),
          ...Array.from(Buffer.from(poolId)),
          // SOL fee (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(solFee)]).buffer)),
          // SOL fee collector
          ...Array.from(solFeeCollector.toBytes())
        ])
      };

      transaction.add(createAmmIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer]
      );

    } catch (error) {
      console.error('Error creating AMM:', error);
      
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

  async createPool(
    payer: Keypair,
    ammId: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    poolKeypair: Keypair,
    poolAuthorityKeypair: Keypair,
    mintLiquidityKeypair: Keypair
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

      // Derive pool authority PDA
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          ammId.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.programId
      );

      // Derive pool accounts
      const poolAccountA = getAssociatedTokenAddressSync(
        mintA,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const poolAccountB = getAssociatedTokenAddressSync(
        mintB,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const createPoolIx = {
        programId: this.programId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },
          { pubkey: poolKeypair.publicKey, isSigner: false, isWritable: true },
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          { pubkey: mintLiquidityKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createPool
          233, 146, 209, 142, 207, 104, 64, 188
        ])
      };

      transaction.add(createPoolIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer, mintLiquidityKeypair]
      );

    } catch (error) {
      console.error('Error creating pool:', error);
      
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

  async depositLiquidity(
    payer: Keypair,
    ammId: PublicKey,
    poolAddress: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    mintLiquidity: PublicKey,
    amountA: number,
    amountB: number
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

      // Derive pool authority
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          ammId.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.programId
      );

      // Get user token accounts
      const userAccountA = getAssociatedTokenAddressSync(
        mintA,
        payer.publicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const userAccountB = getAssociatedTokenAddressSync(
        mintB,
        payer.publicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      // Get pool token accounts
      const poolAccountA = getAssociatedTokenAddressSync(
        mintA,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const poolAccountB = getAssociatedTokenAddressSync(
        mintB,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      // Get user liquidity account (LP tokens)
      const userLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidity,
        payer.publicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      // Get pool liquidity account
      const poolLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidity,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const depositLiquidityIx = {
        programId: this.programId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: userAccountA, isSigner: false, isWritable: true },
          { pubkey: userAccountB, isSigner: false, isWritable: true },
          { pubkey: userLiquidityAccount, isSigner: false, isWritable: true },
          { pubkey: poolLiquidityAccount, isSigner: false, isWritable: true },
          { pubkey: mintLiquidity, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for depositLiquidity
          245, 99, 59, 25, 151, 71, 233, 249,
          // Amount A (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amountA)]).buffer)),
          // Amount B (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amountB)]).buffer))
        ])
      };

      transaction.add(depositLiquidityIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer]
      );

    } catch (error) {
      console.error('Error depositing liquidity:', error);
      
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

  async swapTokens(
    payer: Keypair,
    ammId: PublicKey,
    poolAddress: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    swapA: boolean,
    inputAmount: number,
    minOutputAmount: number
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

      // Derive pool authority
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          ammId.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.programId
      );

      // Get trader accounts
      const traderAccountA = getAssociatedTokenAddressSync(
        mintA,
        payer.publicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const traderAccountB = getAssociatedTokenAddressSync(
        mintB,
        payer.publicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      // Get pool accounts
      const poolAccountA = getAssociatedTokenAddressSync(
        mintA,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const poolAccountB = getAssociatedTokenAddressSync(
        mintB,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const swapIx = {
        programId: this.programId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: traderAccountA, isSigner: false, isWritable: true },
          { pubkey: traderAccountB, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for swapExactTokensForTokens
          249, 86, 253, 50, 177, 221, 73, 162,
          // Swap A (bool)
          swapA ? 1 : 0,
          // Input amount (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(inputAmount)]).buffer)),
          // Min output amount (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(minOutputAmount)]).buffer))
        ])
      };

      transaction.add(swapIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer]
      );

    } catch (error) {
      console.error('Error swapping tokens:', error);
      
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