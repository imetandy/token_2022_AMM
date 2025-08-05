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
import { TransactionRetryHandler } from './transaction-retry';


export class WalletClient {
  private connection: Connection;
  private programId: PublicKey;
  private counterHookProgramId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey(PROGRAM_ID);
    this.counterHookProgramId = new PublicKey('EiAAboUH3o19cRw4wRo2f2erCcbGtRUtq9PgNS4RGgi');
  }

  async createTokenWithHook(
    walletPublicKey: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>,
    name: string,
    symbol: string,
    uri: string
  ): Promise<TransactionResult> {
    try {
      console.log('Creating Token-2022 mint with transfer hook setup...')
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
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
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

      // Generate the extra account meta list PDA for the new mint
      const [extraAccountMetaListPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintKeypair.publicKey.toBuffer()],
        this.programId
      );

      // Generate the mint trade counter PDA for the new mint
      const [mintTradeCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintKeypair.publicKey.toBuffer()],
        this.counterHookProgramId
      );

      console.log('Extra account meta list PDA:', extraAccountMetaListPda.toString());
      console.log('Mint trade counter PDA:', mintTradeCounterPda.toString());

      // Create initialize extra account meta list instruction
      const initExtraAccountMetaIx = {
        programId: this.programId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true },
          { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: true },
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for initialize_extra_account_meta_list
          92, 197, 174, 197, 41, 124, 19, 3
        ])
      };

      // Step 1: Create the token
      console.log('Step 1: Creating token...');
      const createTokenTransaction = new Transaction();
      createTokenTransaction.add(createTokenIx);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      createTokenTransaction.recentBlockhash = blockhash;
      createTokenTransaction.feePayer = walletPublicKey;

      // Create a custom sign function that handles both mint keypair and wallet
      const signWithMintKeypair = async (transaction: Transaction) => {
        // Add mint keypair signature to the transaction
        transaction.sign(mintKeypair);
        // Then let wallet sign for remaining signers
        return await signTransaction(transaction);
      };

      // Send create token transaction with retry handler
      console.log('Sending create token transaction...');
      const retryHandler = new TransactionRetryHandler(this.connection);
      const createTokenResult = await retryHandler.sendTransactionWithRetry(createTokenTransaction, signWithMintKeypair, {
        maxRetries: 3,
        retryDelayMs: 1000
      });
      
      if (!createTokenResult.success) {
        throw new Error(`Create token transaction failed: ${createTokenResult.error}`);
      }
      
      const createTokenSignature = createTokenResult.signature;
      console.log('Create token transaction sent:', createTokenSignature);

      console.log('✅ Token created successfully!');

      // Step 2: Initialize extra account meta list
      console.log('Step 2: Initializing extra account meta list...');
      const initTransaction = new Transaction();
      initTransaction.add(initExtraAccountMetaIx);

      // Get new blockhash
      const { blockhash: newBlockhash } = await this.connection.getLatestBlockhash();
      initTransaction.recentBlockhash = newBlockhash;
      initTransaction.feePayer = walletPublicKey;

      // Transaction ready to send
      console.log('Init transaction ready to send');

      // Send init transaction with retry handler
      console.log('Sending init transaction...');
      const initRetryHandler = new TransactionRetryHandler(this.connection);
      const initResult = await initRetryHandler.sendTransactionWithRetry(initTransaction, signTransaction, {
        maxRetries: 3,
        retryDelayMs: 1000
      });
      
      if (!initResult.success) {
        throw new Error(`Init transaction failed: ${initResult.error}`);
      }
      
      const initSignature = initResult.signature;
      console.log('Init transaction sent:', initSignature);

      console.log('✅ Extra account meta list initialized successfully!');
      console.log('Mint address:', mintKeypair.publicKey.toString());
      console.log('Extra account meta list:', extraAccountMetaListPda.toString());
      console.log('Mint trade counter:', mintTradeCounterPda.toString());

      // Get transaction details for logs
      let createTokenResponse = null;
      let initResponse = null;
      
      if (createTokenSignature) {
        try {
          createTokenResponse = await this.connection.getTransaction(createTokenSignature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
        } catch (error) {
          console.log('Could not fetch create token transaction details:', error);
        }
      }

      if (initSignature) {
        try {
          initResponse = await this.connection.getTransaction(initSignature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
        } catch (error) {
          console.log('Could not fetch init transaction details:', error);
        }
      }

      const allLogs = [
        ...(createTokenResponse?.meta?.logMessages || []),
        ...(initResponse?.meta?.logMessages || [])
      ];

      return {
        signature: createTokenSignature,
        success: true,
        logs: allLogs,
        mintAddress: mintKeypair.publicKey.toString(),
        extraAccountMetaListAddress: extraAccountMetaListPda.toString(),
        mintTradeCounterAddress: mintTradeCounterPda.toString()
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
      console.log('Minting tokens...')
      console.log('Mint address:', mintAddress.toString())
      console.log('Amount:', amount)
      console.log('Wallet:', walletPublicKey.toString())

      // Get the associated token account for the wallet
      const tokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        walletPublicKey,
        false,
        new PublicKey(TOKEN_2022_PROGRAM_ID),
        ASSOCIATED_TOKEN_PROGRAM_ID
      )

      console.log('Token account:', tokenAccount.toString())

      // Create mint instruction
      const mintIx = {
        programId: this.programId,
        keys: [
          { pubkey: mintAddress, isSigner: false, isWritable: true },
          { pubkey: tokenAccount, isSigner: false, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for mint_tokens
          59, 132, 24, 246, 122, 39, 8, 243,
          // amount (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer))
        ])
      };

      const transaction = new Transaction()
      transaction.add(mintIx)

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = walletPublicKey

      // Sign with wallet
      const signedTx = await signTransaction(transaction)

      // Send transaction
      const signature = await this.connection.sendRawTransaction(signedTx.serialize())
      console.log('Transaction sent:', signature)

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`)
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      return {
        signature,
        success: true,
        mintAddress: mintAddress.toString(),
        logs: transactionResponse?.meta?.logMessages || []
      }

    } catch (error) {
      console.error('Error minting tokens:', error)
      
      // Handle "already processed" error as success
      if (error instanceof Error && error.message.includes('already been processed')) {
        // Extract signature from error message if possible
        const signatureMatch = error.message.match(/signature: ([A-Za-z0-9]+)/)
        const signature = signatureMatch ? signatureMatch[1] : 'unknown'
        
        return {
          signature,
          success: true,
          mintAddress: mintAddress.toString(),
          logs: ['Transaction was already processed successfully']
        }
      }
      
      if (error instanceof Error && 'logs' in error) {
        return {
          signature: '',
          success: false,
          error: error.message,
          logs: (error as any).logs || []
        }
      }

      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: []
      }
    }
  }

  async initializeExtraAccountMetaList(
    walletPublicKey: PublicKey,
    mintAddress: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Initializing extra account meta list for transfer hook...')
      console.log('Mint address:', mintAddress.toString())
      console.log('Wallet:', walletPublicKey.toString())

      // Generate the extra account meta list PDA
      const [extraAccountMetaListPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintAddress.toBuffer()],
        this.programId
      )

      // Generate the mint trade counter PDA
      const [mintTradeCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintAddress.toBuffer()],
        this.counterHookProgramId
      )

      console.log('Extra account meta list PDA:', extraAccountMetaListPda.toString())
      console.log('Mint trade counter PDA:', mintTradeCounterPda.toString())

      // Create initialize extra account meta list instruction
      const initExtraAccountMetaIx = {
        programId: this.programId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true },
          { pubkey: mintAddress, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for initialize_extra_account_meta_list
          92, 197, 174, 197, 41, 124, 19, 3
        ])
      };

      const transaction = new Transaction()
      transaction.add(initExtraAccountMetaIx)

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = walletPublicKey

      // Sign with wallet
      const signedTx = await signTransaction(transaction)

      // Send transaction
      const signature = await this.connection.sendRawTransaction(signedTx.serialize())
      console.log('Transaction sent:', signature)

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`)
      }

      // Get transaction details for logs
      const transactionResponse = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      return {
        signature,
        success: true,
        logs: transactionResponse?.meta?.logMessages || []
      }

    } catch (error) {
      console.error('Error initializing extra account meta list:', error)
      
      // Handle "already processed" error as success
      if (error instanceof Error && error.message.includes('already been processed')) {
        // Extract signature from error message if possible
        const signatureMatch = error.message.match(/signature: ([A-Za-z0-9]+)/)
        const signature = signatureMatch ? signatureMatch[1] : 'unknown'
        
        return {
          signature,
          success: true,
          logs: ['Transaction was already processed successfully']
        }
      }
      
      if (error instanceof Error && 'logs' in error) {
        return {
          signature: '',
          success: false,
          error: error.message,
          logs: (error as any).logs || []
        }
      }

      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: []
      }
    }
  }

  async initializeMintTradeCounter(
    walletPublicKey: PublicKey,
    mintAddress: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Initializing mint trade counter for:', mintAddress.toString());

      // Derive the trade counter PDA
      const [mintTradeCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintAddress.toBuffer()],
        this.counterHookProgramId
      );

      console.log('Trade counter PDA:', mintTradeCounterPda.toString());

      // Create the initialization instruction
      const initInstruction = {
        programId: this.counterHookProgramId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: mintAddress, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: true },
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for initialize_mint_trade_counter
          22, 209, 170, 141, 84, 237, 5, 252
        ])
      };

      const transaction = new Transaction();
      transaction.add(initInstruction);

      // Get the latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      console.log('Transaction created, signing...');
      
      // Use the retry handler for robust transaction sending
      const retryHandler = new TransactionRetryHandler(this.connection);
      return await retryHandler.sendTransactionWithRetry(transaction, signTransaction, {
        maxRetries: 3,
        retryDelayMs: 1000
      });

    } catch (error) {
      console.error('Error initializing mint trade counter:', error);
      
      if (error instanceof Error && error.message.includes('already been processed')) {
        const signatureMatch = error.message.match(/signature: ([A-Za-z0-9]+)/);
        const signature = signatureMatch ? signatureMatch[1] : 'unknown';
        
        return {
          signature,
          success: true,
          logs: ['Mint trade counter was already initialized successfully']
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

      // Set recent blockhash and fee payer
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Add the mintLiquidityKeypair as a signer to the transaction
      transaction.sign(mintLiquidityKeypair);
      
      // Use the retry handler for robust transaction sending
      const retryHandler = new TransactionRetryHandler(this.connection);
      return await retryHandler.sendTransactionWithRetry(transaction, signTransaction, {
        maxRetries: 3,
        retryDelayMs: 1000
      });

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

      // Generate transfer hook accounts for mint A
      const [extraAccountMetaListA] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintA.toBuffer()],
        this.programId
      );

      const [mintTradeCounterA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintA.toBuffer()],
        this.counterHookProgramId
      );

      // Generate transfer hook accounts for mint B
      const [extraAccountMetaListB] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintB.toBuffer()],
        this.programId
      );

      const [mintTradeCounterB] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintB.toBuffer()],
        this.counterHookProgramId
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
          // Transfer hook accounts for mint A
          { pubkey: extraAccountMetaListA, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterA, isSigner: false, isWritable: true },
          // Transfer hook accounts for mint B
          { pubkey: extraAccountMetaListB, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterB, isSigner: false, isWritable: true },
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

      // Generate transfer hook accounts for mint A
      const [extraAccountMetaListA] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintA.toBuffer()],
        this.programId
      );

      const [mintTradeCounterA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintA.toBuffer()],
        this.counterHookProgramId
      );

      // Generate transfer hook accounts for mint B
      const [extraAccountMetaListB] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintB.toBuffer()],
        this.programId
      );

      const [mintTradeCounterB] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintB.toBuffer()],
        this.counterHookProgramId
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
          // Transfer hook accounts for mint A
          { pubkey: extraAccountMetaListA, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterA, isSigner: false, isWritable: true },
          // Transfer hook accounts for mint B
          { pubkey: extraAccountMetaListB, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterB, isSigner: false, isWritable: true },
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