import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { Program, AnchorProvider, web3, BN, utils } from '@coral-xyz/anchor'
import * as AMM_IDL from '../types/amm.json'

import { 
  TOKEN_2022_PROGRAM, 
  ASSOCIATED_TOKEN_PROGRAM, 
  TOKEN_SETUP_PROGRAM,
  POOL_AUTHORITY_SEED,
  EXTRA_ACCOUNT_METAS_SEED,
  MINT_TRADE_COUNTER_SEED
} from '../config/constants'

export class AnchorClient {
  private connection: Connection
  private program: Program
  private provider: AnchorProvider

  constructor(connection: Connection, wallet: any) {
    this.connection = connection
    
    // Create provider
    this.provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    )

    // Create program instance with proper typing
    this.program = new Program(AMM_IDL as any, this.provider)
  }

  async swapTokens(
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
  ) {
    try {
      // Derive pool authority using Anchor's utils
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [
          poolAddress.toBuffer(),
          mintA.toBuffer(),
          mintB.toBuffer(),
          Buffer.from(POOL_AUTHORITY_SEED)
        ],
        this.program.programId
      )

      // Derive pool accounts using manual ATA derivation with Token-2022 seeds
      const [poolAccountA] = PublicKey.findProgramAddressSync(
        [
          poolAuthority.toBuffer(),
          TOKEN_2022_PROGRAM.toBuffer(),
          mintA.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM
      )

      const [poolAccountB] = PublicKey.findProgramAddressSync(
        [
          poolAuthority.toBuffer(),
          TOKEN_2022_PROGRAM.toBuffer(),
          mintB.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM
      )

      // Derive user accounts using manual ATA derivation with Token-2022 seeds
      const [userAccountA] = PublicKey.findProgramAddressSync(
        [
          this.provider.wallet.publicKey.toBuffer(),
          TOKEN_2022_PROGRAM.toBuffer(),
          mintA.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM
      )

      const [userAccountB] = PublicKey.findProgramAddressSync(
        [
          this.provider.wallet.publicKey.toBuffer(),
          TOKEN_2022_PROGRAM.toBuffer(),
          mintB.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM
      )

      console.log('Using manual ATA derivation (Token-2022):')
      console.log('Pool Account A:', poolAccountA.toString())
      console.log('Pool Account B:', poolAccountB.toString())
      console.log('User Account A:', userAccountA.toString())
      console.log('User Account B:', userAccountB.toString())

      // Derive transfer hook accounts using Anchor's utils
      const [extraAccountMetaListA] = PublicKey.findProgramAddressSync(
        [Buffer.from(EXTRA_ACCOUNT_METAS_SEED), mintA.toBuffer()],
        TOKEN_SETUP_PROGRAM
      )

      const [mintTradeCounterA] = PublicKey.findProgramAddressSync(
        [Buffer.from(MINT_TRADE_COUNTER_SEED), mintA.toBuffer()],
        TOKEN_SETUP_PROGRAM
      )

      const [extraAccountMetaListB] = PublicKey.findProgramAddressSync(
        [Buffer.from(EXTRA_ACCOUNT_METAS_SEED), mintB.toBuffer()],
        TOKEN_SETUP_PROGRAM
      )

      const [mintTradeCounterB] = PublicKey.findProgramAddressSync(
        [Buffer.from(MINT_TRADE_COUNTER_SEED), mintB.toBuffer()],
        TOKEN_SETUP_PROGRAM
      )

      // Use Anchor's generated instruction with proper account mapping
      const tx = await this.program.methods
        .swap(swapA, new BN(inputAmount), new BN(minOutputAmount))
        .accounts({
          amm: ammId,
          pool: poolAddress,
          poolAuthority,
          mintA,
          mintB,
          poolAccountA,
          poolAccountB,
          userAccountA,
          userAccountB,
          user: this.provider.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
          tokenProgram: TOKEN_2022_PROGRAM,
          extraAccountMetaListA,
          mintTradeCounterA,
          extraAccountMetaListB,
          mintTradeCounterB,
          transferHookProgramA: transferHookProgramIdA,
          transferHookProgramB: transferHookProgramIdB,
        })
        .transaction()

      // Sign and send transaction using Anchor's provider
      const latestBlockhash = await this.connection.getLatestBlockhash()
      tx.recentBlockhash = latestBlockhash.blockhash
      tx.feePayer = this.provider.wallet.publicKey

      const signedTx = await signTransaction(tx)
      const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })

      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      
      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: `Swap failed: ${confirmation.value.err}`,
          logs: []
        }
      }

      return {
        signature,
        success: true,
        error: null,
        logs: []
      }

    } catch (error) {
      console.error('Error in swapTokens:', error)
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: []
      }
    }
  }
} 