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
import { PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '../config/program';
import { sendAndConfirmTransaction, TransactionResult } from './transaction-utils';

export class AMMClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey(PROGRAM_ID);
  }

  async createTokenWithHook(
    payer: Keypair,
    mintKeypair: Keypair,
    name: string,
    symbol: string,
    uri: string
  ): Promise<TransactionResult> {
    try {
      // Check if payer has sufficient SOL
      const balance = await this.connection.getBalance(payer.publicKey);
      if (balance < 0.01 * 1e9) { // Less than 0.01 SOL
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }

      const transaction = new Transaction();
      
      // Create mint account
      const mintRent = await this.connection.getMinimumBalanceForRentExemption(82);
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: 82, // Size for Token-2022 mint
          lamports: mintRent,
          programId: new PublicKey(TOKEN_2022_PROGRAM_ID)
        })
      );

      // Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          6, // decimals
          payer.publicKey,
          payer.publicKey,
          new PublicKey(TOKEN_2022_PROGRAM_ID)
        )
      );

      // Create token with hook instruction
      const createTokenIx = {
        programId: this.programId,
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createTokenWithHook
          186, 132, 153, 159, 183, 146, 10, 218,
          // Name length + name
          ...Array.from(Buffer.from([name.length])),
          ...Array.from(Buffer.from(name)),
          // Symbol length + symbol  
          ...Array.from(Buffer.from([symbol.length])),
          ...Array.from(Buffer.from(symbol)),
          // URI length + URI
          ...Array.from(Buffer.from([uri.length])),
          ...Array.from(Buffer.from(uri))
        ])
      };

      transaction.add(createTokenIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer, mintKeypair]
      );

    } catch (error) {
      console.error('Error creating token with hook:', error);
      
      // Handle SendTransactionError specifically
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

  async createAMM(
    payer: Keypair,
    ammId: PublicKey,
    fee: number,
    feeCollectorA: PublicKey,
    feeCollectorB: PublicKey
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
      
      const createAmmIx = {
        programId: this.programId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: feeCollectorA, isSigner: false, isWritable: false },
          { pubkey: feeCollectorB, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createAmm
          242, 91, 21, 170, 5, 68, 125, 64,
          // AMM ID
          ...Array.from(ammId.toBytes()),
          // Fee (u16)
          ...Array.from(new Uint8Array(new Uint16Array([fee]).buffer)),
          // Fee collector A
          ...Array.from(feeCollectorA.toBytes()),
          // Fee collector B
          ...Array.from(feeCollectorB.toBytes())
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

  async createPoolWithLiquidity(
    payer: Keypair,
    ammId: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    poolKeypair: Keypair,
    poolAuthorityKeypair: Keypair,
    mintLiquidityKeypair: Keypair,
    initialLiquidityA: number,
    initialLiquidityB: number
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
          Buffer.from('pool-authority')
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

      const userLiquidityAccount = getAssociatedTokenAddressSync(
        poolKeypair.publicKey, // Using pool address as liquidity mint
        payer.publicKey,
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
          { pubkey: userAccountA, isSigner: false, isWritable: true },
          { pubkey: userAccountB, isSigner: false, isWritable: true },
          { pubkey: userLiquidityAccount, isSigner: false, isWritable: true },
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

      // Add initial liquidity instruction
      const depositLiquidityIx = {
        programId: this.programId,
        keys: [
          { pubkey: poolKeypair.publicKey, isSigner: false, isWritable: true },
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: poolKeypair.publicKey, isSigner: false, isWritable: true }, // mintLiquidity
          { pubkey: mintA, isSigner: false, isWritable: true },
          { pubkey: mintB, isSigner: false, isWritable: true },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: userAccountA, isSigner: false, isWritable: true },
          { pubkey: userAccountB, isSigner: false, isWritable: true },
          { pubkey: userLiquidityAccount, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for depositLiquidity
          245, 99, 59, 25, 151, 71, 233, 249,
          // Amount A (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(initialLiquidityA)]).buffer)),
          // Amount B (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(initialLiquidityB)]).buffer))
        ])
      };

      transaction.add(depositLiquidityIx);

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer, mintLiquidityKeypair]
      );

    } catch (error) {
      console.error('Error creating pool with liquidity:', error);
      
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
          Buffer.from('pool-authority')
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
          { pubkey: poolAuthority, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: traderAccountA, isSigner: false, isWritable: true },
          { pubkey: traderAccountB, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
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

  async depositLiquidity(
    payer: Keypair,
    poolAddress: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
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

      // Get pool data to find AMM ID
      const poolAccountInfo = await this.connection.getAccountInfo(poolAddress);
      if (!poolAccountInfo) {
        return {
          signature: '',
          success: false,
          error: 'Pool not found'
        };
      }

      // For now, we'll need to derive the AMM ID from the pool address
      // This is a simplified approach - in a real implementation, you'd want to store/retrieve the AMM ID
      const [ammId] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm'),
          payer.publicKey.toBuffer()
        ],
        this.programId
      );

      // Derive pool authority
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          ammId.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool-authority')
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
        poolAddress, // Using pool address as liquidity mint
        payer.publicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const depositLiquidityIx = {
        programId: this.programId,
        keys: [
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: poolAddress, isSigner: false, isWritable: true }, // mintLiquidity
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: userAccountA, isSigner: false, isWritable: true },
          { pubkey: userAccountB, isSigner: false, isWritable: true },
          { pubkey: userLiquidityAccount, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
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
} 