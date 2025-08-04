import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair,
  SendTransactionError
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '../config/program';
import { sendAndConfirmTransaction, TransactionResult } from './transaction-utils';

export class WalletClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey(PROGRAM_ID);
  }

  async createTokenWithHook(
    walletPublicKey: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>,
    name: string,
    symbol: string,
    uri: string
  ): Promise<TransactionResult> {
    try {
      console.log('Creating Token-2022 mint...')
      console.log('Wallet public key:', walletPublicKey.toString())
      console.log('Name:', name)
      console.log('Symbol:', symbol)
      console.log('URI:', uri)

      // Generate a new keypair for the mint
      const mintKeypair = Keypair.generate()
      console.log('Mint keypair generated:', mintKeypair.publicKey.toString())

      // Create token with hook instruction
      const createTokenIx = {
        programId: this.programId,
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for create_token_with_hook
          186, 132, 153, 159, 183, 146, 10, 218,
          // name (string)
          ...Array.from(new Uint8Array([name.length, 0, 0, 0])), // length as u32
          ...Array.from(new TextEncoder().encode(name)),
          // symbol (string)
          ...Array.from(new Uint8Array([symbol.length, 0, 0, 0])), // length as u32
          ...Array.from(new TextEncoder().encode(symbol)),
          // uri (string)
          ...Array.from(new Uint8Array([uri.length, 0, 0, 0])), // length as u32
          ...Array.from(new TextEncoder().encode(uri))
        ])
      };

      const transaction = new Transaction();
      transaction.add(createTokenIx);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Sign with mint keypair first
      transaction.sign(mintKeypair);

      // Sign with wallet
      const signedTx = await signTransaction(transaction);

      // Send and confirm transaction using raw transaction
      const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });
      
      console.log('Transaction sent:', signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || [],
        mintAddress: mintKeypair.publicKey.toString()
      };

    } catch (error) {
      console.error('Error creating token with hook:', error);
      
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

  async mintTokens(
    walletPublicKey: PublicKey,
    mintAddress: PublicKey,
    amount: number,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
      if (balance < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }

      const transaction = new Transaction();
      
      // Derive the associated token account address
      const tokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );
      
      const mintTokensIx = {
        programId: this.programId,
        keys: [
          { pubkey: mintAddress, isSigner: false, isWritable: true },
          { pubkey: tokenAccount, isSigner: false, isWritable: true }, // Use the derived token account
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for mintTokens
          59, 132, 24, 246, 122, 39, 8, 243,
          // Amount (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer))
        ])
      };

      transaction.add(mintTokensIx);

      // Set recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Sign with wallet
      const signedTransaction = await signTransaction(transaction);

      // Send transaction with retry logic
      let signature: string;
      try {
        signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });
      } catch (sendError) {
        console.error('Error sending transaction:', sendError);
        throw sendError;
      }
      
      // Wait for confirmation with timeout
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: 'Transaction failed',
          logs: []
        };
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || []
      };

    } catch (error) {
      console.error('Error minting tokens:', error);
      
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
    walletPublicKey: PublicKey,
    ammPda: PublicKey,
    poolId: string,
    solFee: number, // SOL fee in lamports (e.g., 0.05 SOL = 50,000,000 lamports)
    solFeeCollector: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
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
          { pubkey: ammPda, isSigner: false, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: solFeeCollector, isSigner: false, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createAMM
          242, 91, 21, 170, 5, 68, 125, 64,
          // Pool ID (string)
          ...Array.from(new Uint8Array([poolId.length, 0, 0, 0])), // length as u32
          ...Array.from(new TextEncoder().encode(poolId)),
          // SOL fee (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(solFee)]).buffer)),
          // SOL fee collector
          ...Array.from(solFeeCollector.toBuffer())
        ])
      };

      transaction.add(createAmmIx);

      // Get a fresh blockhash to ensure transaction uniqueness
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Sign with wallet
      const signedTransaction = await signTransaction(transaction);

      // Send transaction with retry logic
      let signature: string;
      try {
        signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });
      } catch (sendError) {
        console.error('Error sending transaction:', sendError);
        throw sendError;
      }
      
      // Wait for confirmation with timeout
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: 'Transaction failed',
          logs: []
        };
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || []
      };

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
    walletPublicKey: PublicKey,
    ammId: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    poolPda: PublicKey,
    poolAuthorityPda: PublicKey,
    mintLiquidityKeypair: Keypair,
    initialLiquidityA: number,
    initialLiquidityB: number,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
      if (balance < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${balance / 1e9} SOL`
        };
      }

      const transaction = new Transaction();

      // Use the passed pool authority PDA
      const poolAuthority = poolAuthorityPda;

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
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const userAccountB = getAssociatedTokenAddressSync(
        mintB,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const userLiquidityAccount = getAssociatedTokenAddressSync(
        poolPda, // Using pool address as liquidity mint
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const createPoolIx = {
        programId: this.programId,
        keys: [
          // amm
          { pubkey: ammId, isSigner: false, isWritable: false },
          // pool
          { pubkey: poolPda, isSigner: false, isWritable: true },
          // pool_authority
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          // mint_liquidity
          { pubkey: mintLiquidityKeypair.publicKey, isSigner: true, isWritable: true },
          // mint_a
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          // pool_account_a
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          // pool_account_b
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          // payer
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          // system_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          // associated_token_program
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          // token_program
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createPool
          233, 146, 209, 142, 207, 104, 64, 188
        ])
      };

      transaction.add(createPoolIx);

      // Set recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Sign with mintLiquidityKeypair first
      transaction.sign(mintLiquidityKeypair);

      // Sign with wallet
      const signedTransaction = await signTransaction(transaction);

      // Send transaction with retry logic
      let signature: string;
      try {
        signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });
      } catch (sendError) {
        console.error('Error sending transaction:', sendError);
        throw sendError;
      }
      
      // Wait for confirmation with timeout
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: 'Transaction failed',
          logs: []
        };
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || []
      };

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

  async depositLiquidity(
    walletPublicKey: PublicKey,
    ammId: PublicKey,
    poolAddress: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    mintLiquidity: PublicKey, // Add this parameter for the liquidity mint
    amountA: number,
    amountB: number,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
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
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const userAccountB = getAssociatedTokenAddressSync(
        mintB,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const userLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidity, // Using the passed mintLiquidity account
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const depositLiquidityIx = {
        programId: this.programId,
        keys: [
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: mintLiquidity, isSigner: false, isWritable: true }, // mintLiquidity
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
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amountA)]).buffer)),
          // Amount B (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amountB)]).buffer))
        ])
      };

      transaction.add(depositLiquidityIx);

      // Set recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Sign with wallet
      const signedTransaction = await signTransaction(transaction);

      // Send transaction with retry logic
      let signature: string;
      try {
        signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });
      } catch (sendError) {
        console.error('Error sending transaction:', sendError);
        throw sendError;
      }
      
      // Wait for confirmation with timeout
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: 'Transaction failed',
          logs: []
        };
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || []
      };

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
    walletPublicKey: PublicKey,
    ammId: PublicKey,
    poolAddress: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    swapA: boolean,
    inputAmount: number,
    minOutputAmount: number,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      // Check if wallet has sufficient SOL
      const balance = await this.connection.getBalance(walletPublicKey);
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
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      const traderAccountB = getAssociatedTokenAddressSync(
        mintB,
        walletPublicKey,
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

      // SOL fees are handled directly in the program

      const swapIx = {
        programId: this.programId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },
          { pubkey: poolAuthority, isSigner: false, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: traderAccountA, isSigner: false, isWritable: true },
          { pubkey: traderAccountB, isSigner: false, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: walletPublicKey, isSigner: false, isWritable: true }, // SOL fee collector (using wallet for now)
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

      // Set recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Sign with wallet
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: 'Transaction failed',
          logs: []
        };
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || []
      };

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

  // Helper method to wait for transaction confirmation and then refresh balances
  async waitForTransactionAndRefresh(
    signature: string,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    try {
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      return !confirmation.value.err;
    } catch (error) {
      console.error('Error waiting for transaction confirmation:', error);
      return false;
    }
  }

  async testCreateAmm(
    walletPublicKey: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Testing create_amm instruction...')
      console.log('Wallet public key:', walletPublicKey.toString())

      // Derive AMM PDA
      const [ammPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), walletPublicKey.toBuffer()],
        this.programId
      )

      console.log('AMM PDA:', ammPda.toString())

      // Create AMM instruction
      const createAmmIx = {
        programId: this.programId,
        keys: [
          { pubkey: ammPda, isSigner: false, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: walletPublicKey, isSigner: false, isWritable: false },
          { pubkey: walletPublicKey, isSigner: false, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for create_amm
          242, 91, 21, 170, 5, 68, 125, 64,
          // id (wallet public key)
          ...Array.from(walletPublicKey.toBuffer()),
          // fee (u16 = 500 = 0.5%)
          ...Array.from(new Uint8Array([244, 1, 0, 0])),
          // fee_collector_a (wallet public key)
          ...Array.from(walletPublicKey.toBuffer()),
          // fee_collector_b (wallet public key)
          ...Array.from(walletPublicKey.toBuffer())
        ])
      };

      const transaction = new Transaction();
      transaction.add(createAmmIx);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Sign with wallet
      const signedTx = await signTransaction(transaction);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(signedTx.serialize());
      console.log('Transaction sent:', signature);

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || []
      };

    } catch (error) {
      console.error('Error creating token with hook:', error);
      
      // Handle "already processed" error as success
      if (error instanceof Error && error.message.includes('already been processed')) {
        // Extract signature from error message if possible
        const signatureMatch = error.message.match(/signature: ([A-Za-z0-9]+)/);
        const signature = signatureMatch ? signatureMatch[1] : 'unknown';
        
        return {
          signature,
          success: true,
          logs: ['Transaction was already processed successfully']
        };
      }
      
      if (error instanceof Error && 'logs' in error) {
        return {
          signature: '',
          success: false,
          error: error.message,
          logs: (error as any).logs || []
        };
      }

      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: []
      };
    }
  }
} 