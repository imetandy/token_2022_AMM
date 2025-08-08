import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair,
  SendTransactionError,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,  
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { 
  TOKEN_SETUP_PROGRAM_ID, 
  AMM_PROGRAM_ID, 
  COUNTER_HOOK_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID 
} from '../config/program';
import { 
  TOKEN_2022_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  TOKEN_SETUP_PROGRAM
} from '../config/constants';
import { TransactionResult } from './transaction-utils';

import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { Amm } from '../types/amm';

// Pool data structure interface (matches programs/amm/src/state.rs Pool)
interface PoolData {
  amm: string;
  mintA: string;
  mintB: string;
  vaultA: string;
  vaultB: string;
  lpMint: string;
  totalLiquidity: number;
  poolAuthorityBump: number;
  poolTokenABalance?: number;
  poolTokenBBalance?: number;
}

// Extended transaction result with pool data
interface PoolTransactionResult extends TransactionResult {
  poolData?: PoolData;
}

// Function to deserialize pool data
function deserializePoolData(data: Uint8Array): PoolData | null {
  try {
    // Skip the 8-byte discriminator
    const dataWithoutDiscriminator = data.slice(8);
    
    if (dataWithoutDiscriminator.length < 193) { // 32+32+32+32+32+32+8+1 = 193 bytes
      console.log('Pool data too short:', dataWithoutDiscriminator.length, 'bytes');
      return null;
    }

    let offset = 0;
    
    // Read amm (32 bytes)
    const amm = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;
    
    // Read mint_a (32 bytes)
    const mintA = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;
    
    // Read mint_b (32 bytes)
    const mintB = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;
    
    // Read vault_a (32 bytes)
    const vaultA = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;
    
    // Read vault_b (32 bytes)
    const vaultB = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;
    
    // Read lp_mint (32 bytes)
    const lpMint = new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32));
    offset += 32;
    
    // Read total_liquidity (8 bytes, little-endian)
    const totalLiquidityBytes = dataWithoutDiscriminator.slice(offset, offset + 8);
    const totalLiquidity = Number(BigInt.asUintN(64, BigInt('0x' + Array.from(totalLiquidityBytes).reverse().map(b => b.toString(16).padStart(2, '0')).join(''))));
    offset += 8;
    
    // Read pool_authority_bump (1 byte)
    const poolAuthorityBump = dataWithoutDiscriminator[offset];
    
    return {
      amm: amm.toString(),
      mintA: mintA.toString(),
      mintB: mintB.toString(),
      vaultA: vaultA.toString(),
      vaultB: vaultB.toString(),
      lpMint: lpMint.toString(),
      totalLiquidity,
      poolAuthorityBump
    };
  } catch (error) {
    console.log('Error deserializing pool data:', error);
    return null;
  }
}


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

      // Generate the extra account meta list PDA for the new mint
      const [extraAccountMetaListPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintKeypair.publicKey.toBuffer()],
        this.tokenSetupProgramId
      );

      // Generate the mint trade counter PDA for the new mint  
      const [mintTradeCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintKeypair.publicKey.toBuffer()],
        this.tokenSetupProgramId
      );

      // Create token with hook instruction using token_setup program
      const createTokenIx = {
        programId: this.tokenSetupProgramId,
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
          { pubkey: this.counterHookProgramId, isSigner: false, isWritable: false },
          { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true },
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_2022_PROGRAM, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM, isSigner: false, isWritable: false }
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



      // Create the transaction
      const transaction = new Transaction()
      
      // Add create token instruction (now includes transfer hook account initialization)
      transaction.add(createTokenIx)

      console.log('Transaction created with 1 instruction')
      console.log('1. Create token with hook (includes transfer hook account initialization)')

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      // Add the mint keypair as a signer
      signedTransaction.partialSign(mintKeypair)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
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

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
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

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
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
      console.log('User account address:', tokenAccount.toString())

      return {
        signature,
        success: true,
        error: null,
        logs: [],
        userAccountAddress: tokenAccount.toString()
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
    mintA: PublicKey,
    mintB: PublicKey,
    solFee: number,
    solFeeCollector: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Creating AMM...')
      console.log('Mint A:', mintA.toString())
      console.log('Mint B:', mintB.toString())
      console.log('SOL fee:', solFee)

      // Derive AMM PDA using mints as seeds
      const [ammId] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm'),
          mintA.toBuffer(),
          mintB.toBuffer()
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
          { pubkey: mintA, isSigner: false, isWritable: false },
          { pubkey: mintB, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for createAmm
          242, 91, 21, 170, 5, 68, 125, 64,
          // Mint A (Pubkey)
          ...Array.from(mintA.toBytes()),
          // Mint B (Pubkey)
          ...Array.from(mintB.toBytes()),
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

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
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

  async createPool(
    walletPublicKey: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    mintLiquidityKeypair: Keypair,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('=== CREATE POOL METHOD CALLED ===')
      console.log('Creating pool...')
      console.log('Mint A:', mintA.toString())
      console.log('Mint B:', mintB.toString())
      console.log('LP Mint:', mintLiquidityKeypair.publicKey.toString())

      // Derive AMM PDA deterministically
      const [ammId] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm'),
          mintA.toBuffer(),
          mintB.toBuffer()
        ],
        this.ammProgramId
      )
      console.log('AMM Address:', ammId.toString())

      // Derive pool PDA
      const [poolAddress] = PublicKey.findProgramAddressSync(
        [
          ammId.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer()
        ],
        this.ammProgramId
      )
      console.log('Pool PDA:', poolAddress.toString())

      // Derive pool authority PDA using pool key instead of AMM key
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          poolAddress.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.ammProgramId
      )
      console.log('Pool Authority:', poolAuthority.toString())



      // Create Anchor provider and program
      const provider = new AnchorProvider(
        this.connection,
        {
          publicKey: walletPublicKey,
          signTransaction: async (tx: any) => signTransaction(tx) as any,
          signAllTransactions: async (txs: any[]) => {
            const signedTxs = [];
            for (const tx of txs) {
              signedTxs.push(await signTransaction(tx));
            }
            return signedTxs;
          }
        },
        { commitment: 'confirmed' }
      );

      const idl = require('../types/amm.json');
      const program = new Program(idl, provider);

      // Create the pool instruction manually with correct account order (payer first)
      const createPoolIx = {
        programId: this.ammProgramId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },           // 0: payer (first account)
          { pubkey: ammId, isSigner: false, isWritable: false },                   // 1: amm
          { pubkey: poolAddress, isSigner: false, isWritable: true },                  // 2: pool (init - PDA)
          { pubkey: poolAuthority, isSigner: false, isWritable: false },          // 3: pool_authority
          { pubkey: mintLiquidityKeypair.publicKey, isSigner: true, isWritable: true }, // 4: mint_liquidity (init)
          { pubkey: mintA, isSigner: false, isWritable: false },                  // 5: mint_a
          { pubkey: mintB, isSigner: false, isWritable: false },                  // 6: mint_b
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7: system_program
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }, // 8: associated_token_program
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false } // 9: token_program
        ],
        data: Buffer.from([
          // Instruction discriminator for createPool
          233, 146, 209, 142, 207, 104, 64, 188
        ])
      };

      // Create and send transaction manually
      const transaction = new Transaction();
      transaction.add(createPoolIx);

      // Debug: Log the transaction details
      console.log('=== TRANSACTION DEBUG ===');
      console.log('Number of instructions:', transaction.instructions.length);
      console.log('Instruction accounts:', createPoolIx.keys.map((key, index) => `${index}: ${key.pubkey.toString()} (signer: ${key.isSigner}, writable: ${key.isWritable})`));
      console.log('Payer (account 0):', walletPublicKey.toString());
      console.log('Liquidity mint (account 4):', mintLiquidityKeypair.publicKey.toString());

      // Set fee payer and recent blockhash
      transaction.feePayer = walletPublicKey;
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

      // Add the liquidity mint keypair as a signer to the transaction
      transaction.partialSign(mintLiquidityKeypair);
      
      // Sign with wallet using signAllTransactions to ensure proper signing
      const signedTransactions = await provider.wallet.signAllTransactions([transaction]);
      const signedTransaction = signedTransactions[0];

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      });

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        console.error('Pool creation failed:', confirmation.value.err);
        
        // Get detailed transaction logs for debugging
        const transactionResponse = await this.connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        console.error('Transaction logs:', transactionResponse?.meta?.logMessages);
        
        return {
          signature,
          success: false,
          error: `Pool creation failed: ${confirmation.value.err}`,
          logs: transactionResponse?.meta?.logMessages || []
        };
      }

      console.log('Pool created successfully!')
      console.log('Transaction signature:', signature)

      // Fetch and log pool data
      try {
        const poolAccountInfo = await this.connection.getAccountInfo(poolAddress);
        if (poolAccountInfo) {
          console.log('=== POOL DATA ===');
          console.log('Pool Address:', poolAddress.toString());
          console.log('Pool Account Size:', poolAccountInfo.data.length, 'bytes');
          console.log('Pool Account Owner:', poolAccountInfo.owner.toString());
          console.log('Pool Account Lamports:', poolAccountInfo.lamports);
          console.log('Pool Account Executable:', poolAccountInfo.executable);
          console.log('Pool Account Rent Epoch:', poolAccountInfo.rentEpoch);
          
          // Try to deserialize the pool data
          try {
            const poolData = deserializePoolData(poolAccountInfo.data);
            if (poolData) {
              console.log('=== POOL DATA (DESERIALIZED) ===');
              console.log('AMM Address:', poolData.amm);
              console.log('Mint A:', poolData.mintA);
              console.log('Mint B:', poolData.mintB);
              console.log('Vault A:', poolData.vaultA);
              console.log('Vault B:', poolData.vaultB);
              console.log('LP Mint:', poolData.lpMint);
              console.log('Total Liquidity:', poolData.totalLiquidity);
              console.log('Pool Authority Bump:', poolData.poolAuthorityBump);
            } else {
              console.log('Pool Data (raw bytes):', Array.from(poolAccountInfo.data));
            }
          } catch (deserializeError) {
            console.log('Could not deserialize pool data:', deserializeError);
            console.log('Pool Data (raw bytes):', Array.from(poolAccountInfo.data));
          }
        } else {
          console.log('Pool account not found after creation');
        }
      } catch (fetchError) {
        console.log('Error fetching pool data:', fetchError);
      }

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error creating pool:', error)
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async createPoolTokenAccounts(
    walletPublicKey: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    lpMint: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Creating pool token accounts...')
      console.log('Mint A:', mintA.toString())
      console.log('Mint B:', mintB.toString())
      console.log('LP Mint:', lpMint.toString())

      // Derive AMM account
      const [ammAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm'),
          mintA.toBuffer(),
          mintB.toBuffer()
        ],
        this.ammProgramId
      )
      console.log('AMM Address:', ammAddress.toString())

      // Derive pool address
      const [poolAddress] = PublicKey.findProgramAddressSync(
        [
          ammAddress.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer()
        ],
        this.ammProgramId
      )
      console.log('Pool Address:', poolAddress.toString())

      // Derive pool authority using pool key instead of AMM key
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          poolAddress.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.ammProgramId
      )
      console.log('Pool Authority:', poolAuthority.toString())

      // Derive associated token accounts for the pool
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

      const poolLpAccount = getAssociatedTokenAddressSync(
        lpMint,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );

      console.log('Pool Account A:', poolAccountA.toString());
      console.log('Pool Account B:', poolAccountB.toString());
      console.log('Pool LP Account:', poolLpAccount.toString());

      const instruction = {
        programId: this.ammProgramId,
        keys: [
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },        // 0: payer
          { pubkey: ammAddress, isSigner: false, isWritable: false },           // 1: amm
          { pubkey: poolAddress, isSigner: false, isWritable: true },           // 2: pool
          { pubkey: poolAuthority, isSigner: false, isWritable: false },        // 3: pool_authority
          { pubkey: mintA, isSigner: false, isWritable: false },                // 4: mint_a
          { pubkey: mintB, isSigner: false, isWritable: false },                // 5: mint_b
          { pubkey: lpMint, isSigner: false, isWritable: false },               // 6: lp_mint
          { pubkey: poolAccountA, isSigner: false, isWritable: true },          // 7: pool_account_a
          { pubkey: poolAccountB, isSigner: false, isWritable: true },          // 8: pool_account_b
          { pubkey: poolLpAccount, isSigner: false, isWritable: true },         // 9: pool_lp_account
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 10: system_program
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }, // 11: associated_token_program
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false } // 12: token_program
        ],
        data: Buffer.from([
          // Instruction discriminator for createPoolTokenAccounts
          121, 90, 65, 202, 12, 119, 182, 213
        ])
      }

      const transaction = new Transaction().add(instruction)

      console.log('Sending createPoolTokenAccounts transaction...')
      
      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction with the wallet
      const signedTransaction = await signTransaction(transaction)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
      console.log('Pool token accounts transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Pool token accounts creation failed:', confirmation.value.err)
        return {
          signature,
          success: false,
          error: `Pool token accounts creation failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      console.log('Pool token accounts created successfully!')
      console.log('Transaction signature:', signature)

      // Fetch and log pool data after token accounts are created
      try {
        // Derive pool address to fetch its data
        const [ammId] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('amm'),
            mintA.toBuffer(),
            mintB.toBuffer()
          ],
          this.ammProgramId
        )
        
        const [poolAddress] = PublicKey.findProgramAddressSync(
          [
            ammId.toBuffer(),
            mintA.toBuffer(),
            mintB.toBuffer()
          ],
          this.ammProgramId
        )

        const poolAccountInfo = await this.connection.getAccountInfo(poolAddress);
        if (poolAccountInfo) {
          console.log('=== POOL DATA AFTER TOKEN ACCOUNTS CREATION ===');
          console.log('Pool Address:', poolAddress.toString());
          console.log('Pool Account Size:', poolAccountInfo.data.length, 'bytes');
          console.log('Pool Account Owner:', poolAccountInfo.owner.toString());
          console.log('Pool Account Lamports:', poolAccountInfo.lamports);
          console.log('Pool Account Executable:', poolAccountInfo.executable);
          console.log('Pool Account Rent Epoch:', poolAccountInfo.rentEpoch);
          
          // Try to deserialize the pool data
          try {
            const poolData = deserializePoolData(poolAccountInfo.data);
            if (poolData) {
              console.log('=== POOL DATA AFTER TOKEN ACCOUNTS (DESERIALIZED) ===');
              console.log('AMM Address:', poolData.amm);
              console.log('Mint A:', poolData.mintA);
              console.log('Mint B:', poolData.mintB);
              console.log('Vault A:', poolData.vaultA);
              console.log('Vault B:', poolData.vaultB);
              console.log('LP Mint:', poolData.lpMint);
              console.log('Total Liquidity:', poolData.totalLiquidity);
              console.log('Pool Authority Bump:', poolData.poolAuthorityBump);
            } else {
              console.log('Pool Data (raw bytes):', Array.from(poolAccountInfo.data));
            }
          } catch (deserializeError) {
            console.log('Could not deserialize pool data:', deserializeError);
            console.log('Pool Data (raw bytes):', Array.from(poolAccountInfo.data));
          }
        } else {
          console.log('Pool account not found after token accounts creation');
        }
      } catch (fetchError) {
        console.log('Error fetching pool data after token accounts creation:', fetchError);
      }

      return {
        signature,
        success: true,
        error: null
      }

    } catch (error) {
      console.error('Error creating pool token accounts:', error)
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async createPoolWithLiquidity(
    walletPublicKey: PublicKey,
    ammId: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    poolPda: PublicKey,
    mintLiquidityKeypair: Keypair,
    initialLiquidityA: number,
    initialLiquidityB: number,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('=== CREATE POOL WITH LIQUIDITY METHOD CALLED ===')
      console.log('Creating pool with liquidity...')
      console.log('AMM ID:', ammId.toString())
      console.log('Mint A:', mintA.toString())
      console.log('Mint B:', mintB.toString())
      console.log('Initial liquidity A:', initialLiquidityA)
      console.log('Initial liquidity B:', initialLiquidityB)

      // Check token balances before proceeding
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

      try {
        const balanceA = await this.connection.getTokenAccountBalance(userAccountA)
        const balanceB = await this.connection.getTokenAccountBalance(userAccountB)
        
        console.log('User token A balance:', balanceA.value.uiAmount)
        console.log('User token B balance:', balanceB.value.uiAmount)
        console.log('Required token A amount:', initialLiquidityA / 1e6)
        console.log('Required token B amount:', initialLiquidityB / 1e6)
        
        if (balanceA.value.uiAmount! < initialLiquidityA / 1e6) {
          return {
            signature: '',
            success: false,
            error: `Insufficient token A balance. Have: ${balanceA.value.uiAmount}, Need: ${initialLiquidityA / 1e6}`,
            logs: []
          }
        }
        
        if (balanceB.value.uiAmount! < initialLiquidityB / 1e6) {
          return {
            signature: '',
            success: false,
            error: `Insufficient token B balance. Have: ${balanceB.value.uiAmount}, Need: ${initialLiquidityB / 1e6}`,
            logs: []
          }
        }
      } catch (error) {
        console.log('Could not check token balances, proceeding anyway:', error)
      }

      const transaction = new Transaction()

      // Get user token accounts (already defined above)

      console.log('Mint A:', mintA.toString())
      console.log('Mint B:', mintB.toString())
      
      // Verify program ownership of mint accounts
      try {
        const mintAAccount = await this.connection.getAccountInfo(mintA)
        const mintBAccount = await this.connection.getAccountInfo(mintB)
        
        console.log('Mint A owner:', mintAAccount?.owner.toString())
        console.log('Mint B owner:', mintBAccount?.owner.toString())
        console.log('Expected owner (Token-2022):', new PublicKey(TOKEN_2022_PROGRAM_ID).toString())
        
        if (mintAAccount?.owner.toString() !== new PublicKey(TOKEN_2022_PROGRAM_ID).toString()) {
          console.error('Mint A is not owned by Token-2022 program!')
        }
        if (mintBAccount?.owner.toString() !== new PublicKey(TOKEN_2022_PROGRAM_ID).toString()) {
          console.error('Mint B is not owned by Token-2022 program!')
        }
      } catch (error) {
        console.log('Could not verify mint account ownership:', error)
      }

      // Get user liquidity account (LP tokens)
      const userLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidityKeypair.publicKey,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )



      // Derive pool authority PDA using pool key instead of AMM key
      const [poolAuthorityPda] = PublicKey.findProgramAddressSync(
        [
          poolPda.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.ammProgramId
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

      // Create pool instruction
      const createPoolIx = {
        programId: this.ammProgramId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },                    // 0: amm
          { pubkey: poolPda, isSigner: false, isWritable: true },                    // 1: pool (init - PDA)
          { pubkey: poolAuthorityPda, isSigner: false, isWritable: false },         // 2: pool_authority
          { pubkey: mintLiquidityKeypair.publicKey, isSigner: true, isWritable: true }, // 3: mint_liquidity (init)
          { pubkey: mintA, isSigner: false, isWritable: false },                    // 4: mint_a
          { pubkey: mintB, isSigner: false, isWritable: false },                    // 5: mint_b
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },            // 6: payer
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // 7: system_program
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }, // 8: associated_token_program
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false } // 9: token_program
        ],
        data: Buffer.from([
          // Instruction discriminator for createPool
          233, 146, 209, 142, 207, 104, 64, 188
        ])
      }

      // Get pool LP account
      const poolLpAccount = getAssociatedTokenAddressSync(
        mintLiquidityKeypair.publicKey,
        poolAuthorityPda,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Deposit liquidity instruction - CORRECTED ACCOUNT ORDER
      const depositLiquidityIx = {
        programId: this.ammProgramId,
        keys: [
          { pubkey: ammId, isSigner: false, isWritable: false },                    // 0: amm
          { pubkey: poolPda, isSigner: false, isWritable: true },                   // 1: pool
          { pubkey: poolAuthorityPda, isSigner: false, isWritable: false },        // 2: pool_authority
          { pubkey: mintA, isSigner: false, isWritable: false },                   // 3: mint_a
          { pubkey: mintB, isSigner: false, isWritable: false },                   // 4: mint_b
          { pubkey: poolAccountA, isSigner: false, isWritable: true },             // 5: pool_account_a
          { pubkey: poolAccountB, isSigner: false, isWritable: true },             // 6: pool_account_b
          { pubkey: userAccountA, isSigner: false, isWritable: true },             // 7: user_account_a
          { pubkey: userAccountB, isSigner: false, isWritable: true },             // 8: user_account_b
          { pubkey: userLiquidityAccount, isSigner: false, isWritable: true },     // 9: user_lp_account
          { pubkey: poolLpAccount, isSigner: false, isWritable: true },            // 10: pool_lp_account
          { pubkey: mintLiquidityKeypair.publicKey, isSigner: false, isWritable: true }, // 11: lp_mint
          { pubkey: walletPublicKey, isSigner: true, isWritable: false },          // 12: user
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 13: system_program
          { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }, // 14: associated_token_program
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false } // 15: token_program
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

      // Set higher compute unit limit for transfer hook calls
      const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000 // Increase from default 200,000 to handle transfer hooks
      })
      transaction.add(setComputeUnitLimitIx)
      
      // First transaction: Create the pool
      transaction.add(createPoolIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction with the wallet first (payer must be first signer)
      const signedTransaction = await signTransaction(transaction)
      
      // Then add the liquidity mint keypair as additional signer
      signedTransaction.partialSign(mintLiquidityKeypair)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
      console.log('Pool creation transaction sent:', signature)

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        console.error('Pool creation failed:', confirmation.value.err)
        
        // Get detailed error information
        let errorMessage = 'Unknown error'
        if (confirmation.value.err) {
          if (typeof confirmation.value.err === 'object') {
            errorMessage = JSON.stringify(confirmation.value.err, null, 2)
          } else {
            errorMessage = confirmation.value.err.toString()
          }
        }
        
        // Get transaction logs for debugging
        const transactionResponse = await this.connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
        
        console.error('Transaction logs:', transactionResponse?.meta?.logMessages)
        
        return {
          signature,
          success: false,
          error: `Pool creation failed: ${errorMessage}`,
          logs: transactionResponse?.meta?.logMessages || []
        }
      }

      console.log('Pool created successfully!')
      console.log('Pool address:', poolPda.toString())
      console.log('Transaction signature:', signature)

      // Second transaction: Deposit initial liquidity
      console.log('Now depositing initial liquidity...')
      
      // Debug the deposit liquidity instruction
      console.log('=== DEPOSIT LIQUIDITY DEBUG ===');
      console.log('AMM ID:', ammId.toString());
      console.log('Pool PDA:', poolPda.toString());
      console.log('Pool Authority PDA:', poolAuthorityPda.toString());
      console.log('Mint A:', mintA.toString());
      console.log('Mint B:', mintB.toString());
      console.log('Pool Account A:', poolAccountA.toString());
      console.log('Pool Account B:', poolAccountB.toString());
      console.log('User Account A:', userAccountA.toString());
      console.log('User Account B:', userAccountB.toString());
      console.log('User Liquidity Account:', userLiquidityAccount.toString());
      console.log('Pool LP Account:', poolLpAccount.toString());
      console.log('Mint Liquidity:', mintLiquidityKeypair.publicKey.toString());
      
      // Verify the account derivation
      console.log('=== ACCOUNT DERIVATION VERIFICATION ===');
      console.log('Pool Authority derivation seeds:');
      console.log('  AMM ID:', ammId.toString());
      console.log('  Mint A:', mintA.toString());
      console.log('  Mint B:', mintB.toString());
      console.log('  Pool authority seed: pool_authority');
      console.log('  Derived pool authority:', poolAuthorityPda.toString());
      
      // Verify associated token account derivation
      const expectedPoolAccountA = getAssociatedTokenAddressSync(
        mintA,
        poolAuthorityPda,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      );
      console.log('Expected Pool Account A:', expectedPoolAccountA.toString());
      console.log('Actual Pool Account A:', poolAccountA.toString());
      console.log('Match:', expectedPoolAccountA.equals(poolAccountA));
      
      const liquidityTransaction = new Transaction()
      liquidityTransaction.add(depositLiquidityIx)

      // Set fee payer and recent blockhash for liquidity transaction
      liquidityTransaction.feePayer = walletPublicKey
      liquidityTransaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the liquidity transaction with the wallet
      const signedLiquidityTransaction = await signTransaction(liquidityTransaction)

      const liquiditySignature = await this.connection.sendRawTransaction(signedLiquidityTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
      console.log('Initial liquidity deposit transaction sent:', liquiditySignature)

      // Wait for liquidity transaction confirmation
      const liquidityConfirmation = await this.connection.confirmTransaction(liquiditySignature, 'confirmed')
      
      if (liquidityConfirmation.value.err) {
        console.error('Initial liquidity deposit failed:', liquidityConfirmation.value.err)
        
        // Get detailed error information for liquidity transaction
        let liquidityErrorMessage = 'Unknown error'
        if (liquidityConfirmation.value.err) {
          if (typeof liquidityConfirmation.value.err === 'object') {
            liquidityErrorMessage = JSON.stringify(liquidityConfirmation.value.err, null, 2)
            console.error('Detailed error object:', liquidityConfirmation.value.err)
          } else {
            liquidityErrorMessage = liquidityConfirmation.value.err.toString()
          }
        }
        
        // Get transaction logs for debugging
        const liquidityTransactionResponse = await this.connection.getTransaction(liquiditySignature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
        
        console.error('Liquidity transaction logs:', liquidityTransactionResponse?.meta?.logMessages)
        
        return {
          signature: liquiditySignature,
          success: false,
          error: `Initial liquidity deposit failed: ${liquidityErrorMessage}`,
          logs: liquidityTransactionResponse?.meta?.logMessages || []
        }
      }

      console.log('Initial liquidity deposited successfully!')
      console.log('Liquidity transaction signature:', liquiditySignature)

      return {
        signature: liquiditySignature,
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
    amountA: bigint,
    amountB: bigint,
    transferHookProgramIdA: PublicKey,
    transferHookProgramIdB: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<PoolTransactionResult> {
    try {
      console.log('Depositing liquidity...')
      console.log('Amount A:', amountA)
      console.log('Amount B:', amountB)

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

      // Get user liquidity account (LP tokens)
      const userLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidity,
        walletPublicKey,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Derive pool authority using pool key instead of AMM key
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          poolAddress.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.ammProgramId
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

      const poolLiquidityAccount = getAssociatedTokenAddressSync(
        mintLiquidity,
        poolAuthority,
        true,
        new PublicKey(TOKEN_2022_PROGRAM_ID)
      )

      // Derive transfer hook accounts for mint A
      const [extraAccountMetaListA] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintA.toBuffer()],
        this.tokenSetupProgramId
      )

      const [mintTradeCounterA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintA.toBuffer()],
        this.tokenSetupProgramId
      )

      // Derive transfer hook accounts for mint B
      const [extraAccountMetaListB] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintB.toBuffer()],
        this.tokenSetupProgramId
      )

      const [mintTradeCounterB] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintB.toBuffer()],
        this.tokenSetupProgramId
      )

      // Get the instruction definition from the IDL
      const idl = require('../types/amm.json')
      const depositLiquidityInstruction = idl.instructions.find(
        (ix: any) => ix.name === 'deposit_liquidity'
      )

      // Add transfer hook program accounts to the keys array
      const keys = [
        { pubkey: ammId, isSigner: false, isWritable: false },
        { pubkey: poolAddress, isSigner: false, isWritable: false },
        { pubkey: poolAuthority, isSigner: false, isWritable: false },
        { pubkey: mintA, isSigner: false, isWritable: false },
        { pubkey: mintB, isSigner: false, isWritable: false },
        { pubkey: poolAccountA, isSigner: false, isWritable: true },
        { pubkey: poolAccountB, isSigner: false, isWritable: true },
        { pubkey: userAccountA, isSigner: false, isWritable: true },
        { pubkey: userAccountB, isSigner: false, isWritable: true },
        { pubkey: userLiquidityAccount, isSigner: false, isWritable: true },
        { pubkey: poolLiquidityAccount, isSigner: false, isWritable: true },
        { pubkey: mintLiquidity, isSigner: false, isWritable: true },
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
        { pubkey: extraAccountMetaListA, isSigner: false, isWritable: false },
        { pubkey: mintTradeCounterA, isSigner: false, isWritable: true },
        { pubkey: extraAccountMetaListB, isSigner: false, isWritable: false },
        { pubkey: mintTradeCounterB, isSigner: false, isWritable: true },
        { pubkey: transferHookProgramIdA, isSigner: false, isWritable: false },
        { pubkey: transferHookProgramIdB, isSigner: false, isWritable: false },
      ]

      if (!depositLiquidityInstruction) {
        throw new Error('deposit_liquidity instruction not found in IDL')
      }

      const depositLiquidityIx = {
        programId: this.ammProgramId,
        keys: keys,
        data: Buffer.concat([
          Buffer.from(depositLiquidityInstruction.discriminator),
          // Amount A (u64)
          Buffer.from(new Uint8Array(new BigUint64Array([amountA]).buffer)),
          // Amount B (u64)
          Buffer.from(new Uint8Array(new BigUint64Array([amountB]).buffer))
        ])
      }

      const transaction = new Transaction()
      
      // Set higher compute unit limit for transfer hook calls
      const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000 // Increase from default 200,000 to handle transfer hooks
      })
      transaction.add(setComputeUnitLimitIx)
      
      transaction.add(depositLiquidityIx)

      // Set fee payer and recent blockhash before signing
      transaction.feePayer = walletPublicKey
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
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

      // Fetch pool data & balances
      let finalPoolData: PoolData | undefined;
      try {
        const poolAccountInfo = await this.connection.getAccountInfo(poolAddress);
        if (poolAccountInfo) {
          const poolData = deserializePoolData(poolAccountInfo.data);
          if (poolData) {
            const poolAccountABalance = await this.connection.getTokenAccountBalance(poolAccountA);
            const poolAccountBBalance = await this.connection.getTokenAccountBalance(poolAccountB);
            finalPoolData = {
              ...poolData,
              poolTokenABalance: poolAccountABalance.value.uiAmount || 0,
              poolTokenBBalance: poolAccountBBalance.value.uiAmount || 0
            };
          }
        }
      } catch (error) {
        console.log('Error getting final pool data:', error);
      }

      return {
        signature,
        success: true,
        error: null,
        logs: [],
        poolData: finalPoolData,
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
    transferHookProgramIdA: PublicKey,
    transferHookProgramIdB: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TransactionResult> {
    try {
      console.log('Swapping tokens...')
      console.log('Swap A:', swapA)
      console.log('Input amount:', inputAmount)
      console.log('Min output amount:', minOutputAmount)

      // Derive pool authority using pool key instead of AMM key
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          poolAddress.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from('pool_authority')
        ],
        this.ammProgramId
      )

      console.log('=== SWAP DEBUG ===')
      console.log('Pool Authority derived:', poolAuthority.toString())
      console.log('Pool Address:', poolAddress.toString())
      console.log('Mint A:', mintA.toString())
      console.log('Mint B:', mintB.toString())

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

      console.log('Pool Account A derived:', poolAccountA.toString())
      console.log('Pool Account B derived:', poolAccountB.toString())

      // Derive transfer hook accounts for mint A
      const [extraAccountMetaListA] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintA.toBuffer()],
        this.tokenSetupProgramId
      )

      const [mintTradeCounterA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintA.toBuffer()],
        this.tokenSetupProgramId
      )

      // Derive transfer hook accounts for mint B
      const [extraAccountMetaListB] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mintB.toBuffer()],
        this.tokenSetupProgramId
      )

      const [mintTradeCounterB] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint-trade-counter'), mintB.toBuffer()],
        this.tokenSetupProgramId
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
          { pubkey: new PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: extraAccountMetaListA, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterA, isSigner: false, isWritable: true },
          { pubkey: extraAccountMetaListB, isSigner: false, isWritable: false },
          { pubkey: mintTradeCounterB, isSigner: false, isWritable: true },
          { pubkey: transferHookProgramIdA, isSigner: false, isWritable: false },
          { pubkey: transferHookProgramIdB, isSigner: false, isWritable: false }
        ],
        data: Buffer.from([
          // Instruction discriminator for swap
          248, 198, 158, 145, 225, 117, 135, 200,
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

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })
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