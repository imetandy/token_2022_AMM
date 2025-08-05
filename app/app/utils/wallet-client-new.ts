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
import { 
  TOKEN_SETUP_PROGRAM_ID, 
  AMM_PROGRAM_ID, 
  COUNTER_HOOK_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID 
} from '../config/program';
import { sendAndConfirmTransaction, TransactionResult } from './transaction-utils';
import { TransactionRetryHandler } from './transaction-retry';

export class WalletClientNew {
  private connection: Connection;
  private tokenSetupProgramId: PublicKey;
  private ammProgramId: PublicKey;
  private counterHookProgramId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.tokenSetupProgramId = new PublicKey(TOKEN_SETUP_PROGRAM_ID);
    this.ammProgramId = new PublicKey(AMM_PROGRAM_ID);
    this.counterHookProgramId = new PublicKey(COUNTER_HOOK_PROGRAM_ID);
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

      // Create token with hook instruction using token_setup program
      const createTokenIx = {
        programId: this.tokenSetupProgramId,
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: this.counterHookProgramId, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createTokenWithHook
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
        this.tokenSetupProgramId
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
        programId: this.tokenSetupProgramId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // payer
          { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true }, // extraAccountMetaList
          { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false }, // mint
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: false }, // mintTradeCounter
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // systemProgram
        ],
        data: Buffer.from([
          // Instruction discriminator for initializeExtraAccountMetaList
          92, 197, 174, 197, 41, 124, 19, 3
        ])
      };

      // Create initialize mint trade counter instruction
      const initMintTradeCounterIx = {
        programId: this.counterHookProgramId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // payer
          { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false }, // mint
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: true }, // mintTradeCounter
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // systemProgram
        ],
        data: Buffer.from([
          // Instruction discriminator for initializeMintTradeCounter
          22, 209, 170, 141, 84, 237, 5, 252
        ])
      };

      // Create the transaction
      const transaction = new Transaction()
      
      // Add create token instruction
      transaction.add(createTokenIx)
      
      // Add initialize extra account meta list instruction
      transaction.add(initExtraAccountMetaIx)
      
      // Add initialize mint trade counter instruction
      transaction.add(initMintTradeCounterIx)

      console.log('Transaction created with 3 instructions')
      console.log('1. Create token with hook')
      console.log('2. Initialize extra account meta list')
      console.log('3. Initialize mint trade counter')

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      // Add the mint keypair as a signer
      signedTransaction.partialSign(mintKeypair)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())
      console.log('Transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Transaction failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `Transaction failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('Token created successfully!')
      console.log('Mint address:', mintKeypair.publicKey.toString())
      console.log('Transaction signature:', signature)

      return {
        signature,
        success: true,
        mintAddress: mintKeypair.publicKey.toString(),
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error creating token with hook:', error)
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
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
      console.log('Initializing mint trade counter...')
      console.log('Mint address:', mintAddress.toString())

      // Generate the mint trade counter PDA for the mint
      const [mintTradeCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintAddress.toBuffer()],
        this.counterHookProgramId
      )

      console.log('Mint trade counter PDA:', mintTradeCounterPda.toString())

      // Create initialize mint trade counter instruction
      const initMintTradeCounterIx = {
        programId: this.counterHookProgramId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // payer
          { pubkey: mintAddress, isSigner: false, isWritable: false }, // mint
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: true }, // mintTradeCounter
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // systemProgram
        ],
        data: Buffer.from([
          // Instruction discriminator for initializeMintTradeCounter
          22, 209, 170, 141, 84, 237, 5, 252
        ])
      }

      const transaction = new Transaction()
      transaction.add(initMintTradeCounterIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())
      console.log('Initialize mint trade counter transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Initialize mint trade counter failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `Initialize mint trade counter failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('Mint trade counter initialized successfully!')
      console.log('Transaction signature:', signature)

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error initializing mint trade counter:', error)
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
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

      // Get or create associated token account
      const tokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Check if token account exists
      const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccount)
      const transaction = new Transaction()

      if (!tokenAccountInfo) {
        console.log('Creating associated token account...')
        transaction.add(
          createAssociatedTokenAccountInstruction(
            walletPublicKey,
            tokenAccount,
            walletPublicKey,
            mintAddress,
            new PublicKey(TOKEN_2022_PROGRAM_ID)
          )
        )
      }

      // Mint tokens instruction using token_setup program
      const mintTokensIx = {
        programId: this.tokenSetupProgramId,
        keys: [
          { pubkey: mintAddress, isSigner: false, isWritable: true }, // mint (writable)
          { pubkey: tokenAccount, isSigner: false, isWritable: true }, // tokenAccount (writable)
          { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // authority (signer, writable)
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false }, // tokenProgram
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false } // associatedTokenProgram
        ],
        data: Buffer.from([
          // Instruction discriminator for mintTokens
          59, 132, 24, 246, 122, 39, 8, 243,
          // Amount (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer))
        ])
      }

      transaction.add(mintTokensIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())
      console.log('Mint transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Mint transaction failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `Mint transaction failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('Tokens minted successfully!')
      console.log('Transaction signature:', signature)

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error minting tokens:', error)
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
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

  async createAMM(
    walletPublicKey: PublicKey,
    poolId: string,
    solFee: number,
    solFeeCollector: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Creating AMM...')
      console.log('Pool ID:', poolId)
      console.log('SOL fee:', solFee)

      // Derive AMM PDA
      const [ammId] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm'),
          Buffer.from(poolId)
        ],
        this.ammProgramId
      )

      const createAmmIx = {
        programId: this.ammProgramId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: solFeeCollector, isSigner: false, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
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
      }

      const transaction = new Transaction()
      transaction.add(createAmmIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())
      console.log('AMM creation transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('AMM creation failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `AMM creation failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('AMM created successfully!')
      console.log('AMM ID:', ammId.toString())
      console.log('Transaction signature:', signature)

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error creating AMM:', error)
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
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
      console.log('Creating pool with liquidity...')
      console.log('AMM ID:', ammId.toString())
      console.log('Mint A:', mintA.toString())
      console.log('Mint B:', mintB.toString())
      console.log('Initial liquidity A:', initialLiquidityA)
      console.log('Initial liquidity B:', initialLiquidityB)

      const transaction = new Transaction()

      // Get user token accounts
      const userAccountA = getAssociatedTokenAddressSync(
        mintA,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const userAccountB = getAssociatedTokenAddressSync(
        mintB,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Get pool token accounts
      const poolAccountA = getAssociatedTokenAddressSync(
        mintA,
        poolAuthorityPda,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const poolAccountB = getAssociatedTokenAddressSync(
        mintB,
        poolAuthorityPda,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Get user liquidity account (LP tokens)
      const userLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidityKeypair.publicKey,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Get pool liquidity account
      const poolLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidityKeypair.publicKey,
        poolAuthorityPda,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Create pool instruction
      const createPoolIx = {
        programId: this.ammProgramId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },
          { pubkey: poolPda, isSigner: false, isWritable: true },
          { pubkey: poolAuthorityPda, isSigner: false, isWritable: false },
          { pubkey: mintLiquidityKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createPool
          233, 146, 209, 142, 207, 104, 64, 188
        ])
      }

      // Deposit liquidity instruction
      const depositLiquidityIx = {
        programId: this.ammProgramId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },
          { pubkey: poolPda, isSigner: false, isWritable: true },
          { pubkey: poolAuthorityPda, isSigner: false, isWritable: false },
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: poolAccountA, isSigner: false, isWritable: true },
          { pubkey: poolAccountB, isSigner: false, isWritable: true },
          { pubkey: userAccountA, isSigner: false, isWritable: true },
          { pubkey: userAccountB, isSigner: false, isWritable: true },
          { pubkey: userLiquidityAccount, isSigner: false, isWritable: true },
          { pubkey: poolLiquidityAccount, isSigner: false, isWritable: true },
          { pubkey: mintLiquidityKeypair.publicKey, isSigner: false, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for depositLiquidity
          245, 99, 59, 25, 151, 71, 233, 249,
          // Amount A (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(initialLiquidityA)]).buffer)),
          // Amount B (u64)
          ...Array.from(new Uint8Array(new BigUint64Array([BigInt(initialLiquidityB)]).buffer))
        ])
      }

      transaction.add(createPoolIx)
      transaction.add(depositLiquidityIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      // Add the liquidity mint keypair as a signer
      signedTransaction.partialSign(mintLiquidityKeypair)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())
      console.log('Pool creation transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Pool creation failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `Pool creation failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('Pool created successfully!')
      console.log('Pool address:', poolPda.toString())
      console.log('Transaction signature:', signature)

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error creating pool with liquidity:', error)
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
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

  async depositLiquidity(
    walletPublicKey: PublicKey,
    ammId: PublicKey,
    poolAddress: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    mintLiquidity: PublicKey,
    amountA: number,
    amountB: number,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Depositing liquidity...')
      console.log('Amount A:', amountA)
      console.log('Amount B:', amountB)

      // Derive pool authority
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          ammId.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.ammProgramId
      )

      // Get user token accounts
      const userAccountA = getAssociatedTokenAddressSync(
        mintA,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const userAccountB = getAssociatedTokenAddressSync(
        mintB,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Get pool token accounts
      const poolAccountA = getAssociatedTokenAddressSync(
        mintA,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const poolAccountB = getAssociatedTokenAddressSync(
        mintB,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Get user liquidity account (LP tokens)
      const userLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidity,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Get pool liquidity account
      const poolLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidity,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const depositLiquidityIx = {
        programId: this.ammProgramId,
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
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
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
      }

      const transaction = new Transaction()
      transaction.add(depositLiquidityIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())
      console.log('Deposit liquidity transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Deposit liquidity failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `Deposit liquidity failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('Liquidity deposited successfully!')
      console.log('Transaction signature:', signature)

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error depositing liquidity:', error)
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
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
      console.log('Swapping tokens...')
      console.log('Swap A:', swapA)
      console.log('Input amount:', inputAmount)
      console.log('Min output amount:', minOutputAmount)

      // Derive pool authority
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          ammId.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.ammProgramId
      )

      // Get trader accounts
      const traderAccountA = getAssociatedTokenAddressSync(
        mintA,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const traderAccountB = getAssociatedTokenAddressSync(
        mintB,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Get pool accounts
      const poolAccountA = getAssociatedTokenAddressSync(
        mintA,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const poolAccountB = getAssociatedTokenAddressSync(
        mintB,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      const swapIx = {
        programId: this.ammProgramId,
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
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
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
      }

      const transaction = new Transaction()
      transaction.add(swapIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize())
      console.log('Swap transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Swap failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `Swap failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('Swap completed successfully!')
      console.log('Transaction signature:', signature)

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error swapping tokens:', error)
      
      if (error instanceof SendTransactionError) {
        return {
          signature: '',
          success: false,
          error: `Transaction failed: ${error.message}`,
          logs: error.logs || []
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
} 