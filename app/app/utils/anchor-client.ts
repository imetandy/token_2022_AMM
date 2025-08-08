import { PublicKey } from '../utils/kit'
type Connection = any; type Transaction = any;
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor'
import * as AMM_IDL from '../types/amm.json'
import { createRpc } from '../config/rpc-config'
import { derivePdaAddressSync, deriveAtaAddressSync } from './kit'
import { waitForConfirmation } from './confirm'

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
  private rpc = createRpc()

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

  private toWeb3Keypair(kitSigner: any): any {
    const secretKey = kitSigner?.secretKey ?? kitSigner?.privateKey;
    if (!secretKey) return null;
    const secretArray = secretKey instanceof Uint8Array ? secretKey : Uint8Array.from(secretKey);
    return web3.Keypair.fromSecretKey(secretArray);
  }

  private async signAndSend(
    tx: Transaction,
    signTransaction: (t: Transaction) => Promise<Transaction>,
    additionalSigners: any[] = []
  ): Promise<{ signature: string; err: any }> {
    const { value: { blockhash } } = await this.rpc.getLatestBlockhash().send()
    tx.recentBlockhash = blockhash
    tx.feePayer = this.provider.wallet.publicKey
    if (additionalSigners.length > 0) tx.partialSign(...additionalSigners)
    const signed = await signTransaction(tx)
    const sig = await this.connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    })
    const conf = await waitForConfirmation(this.connection, sig, 60000, 'confirmed')
    return { signature: sig, err: conf.value.err }
  }

  async createAmm(
    mintA: PublicKey,
    mintB: PublicKey,
    solFeeLamports: number,
    solFeeCollector: PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const amm = derivePdaAddressSync(['amm', mintA, mintB], this.program.programId.toBase58())
    const tx = await this.program.methods
      .createAmm(mintA, mintB, new BN(solFeeLamports), solFeeCollector)
      .accounts({
        amm,
        admin: this.provider.wallet.publicKey,
        solFeeCollector,
        authority: this.provider.wallet.publicKey,
        mintA,
        mintB,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction()

    const res = await this.signAndSend(tx, signTransaction)
    return { signature: res.signature, success: !res.err, amm }
  }

  async createPool(
    mintA: PublicKey,
    mintB: PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const amm = derivePdaAddressSync(['amm', mintA, mintB], this.program.programId.toBase58())
    const pool = derivePdaAddressSync([amm, mintA, mintB], this.program.programId.toBase58())
    const poolAuthority = derivePdaAddressSync([pool, mintA, mintB, POOL_AUTHORITY_SEED], this.program.programId.toBase58())
    const lpKeypair = web3.Keypair.generate()
    const lpPubkey = lpKeypair.publicKey

    const tx = await this.program.methods
      .createPool()
      .accounts({
        payer: this.provider.wallet.publicKey,
        amm,
        pool,
        poolAuthority,
        mintLiquidity: lpPubkey,
        mintA,
        mintB,
        systemProgram: web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
        tokenProgram: TOKEN_2022_PROGRAM,
      })
      .signers([lpKeypair])
      .transaction()

    const res = await this.signAndSend(tx, signTransaction, [lpKeypair])
    return { signature: res.signature, success: !res.err, amm, pool, poolAuthority, lpMint: lpPubkey }
  }

  async createPoolTokenAccounts(
    mintA: PublicKey,
    mintB: PublicKey,
    lpMint: PublicKey,
    pool: PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const amm = derivePdaAddressSync(['amm', mintA, mintB], this.program.programId.toBase58())
    const poolAuthority = derivePdaAddressSync([pool, mintA, mintB, POOL_AUTHORITY_SEED], this.program.programId.toBase58())
    const poolAccountA = deriveAtaAddressSync({ owner: poolAuthority, mint: mintA, tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(), associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58() })
    const poolAccountB = deriveAtaAddressSync({ owner: poolAuthority, mint: mintB, tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(), associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58() })
    const poolLpAccount = deriveAtaAddressSync({ owner: poolAuthority, mint: lpMint, tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(), associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58() })

    console.log('[createPoolTokenAccounts] poolAuthority:', poolAuthority.toBase58())
    console.log('[createPoolTokenAccounts] expected poolAccountA:', poolAccountA.toBase58())
    console.log('[createPoolTokenAccounts] expected poolAccountB:', poolAccountB.toBase58())
    console.log('[createPoolTokenAccounts] expected poolLpAccount:', poolLpAccount.toBase58())

    const tx = await this.program.methods
      .createPoolTokenAccounts()
      .accounts({
        payer: this.provider.wallet.publicKey,
        amm,
        pool,
        poolAuthority,
        mintA,
        mintB,
        lpMint,
        poolAccountA,
        poolAccountB,
        poolLpAccount,
        systemProgram: web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
        tokenProgram: TOKEN_2022_PROGRAM,
      })
      .transaction()

    const res = await this.signAndSend(tx, signTransaction)
    return { signature: res.signature, success: !res.err, poolAccountA, poolAccountB, poolLpAccount }
  }

  async depositLiquidity(
    mintA: PublicKey,
    mintB: PublicKey,
    pool: PublicKey,
    lpMint: PublicKey,
    amountA: number,
    amountB: number,
    transferHookProgramId: PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const amm = derivePdaAddressSync(['amm', mintA, mintB], this.program.programId.toBase58())
    const poolAuthority = derivePdaAddressSync([pool, mintA, mintB, POOL_AUTHORITY_SEED], this.program.programId.toBase58())
    const user = this.provider.wallet.publicKey
    const userAccountA = deriveAtaAddressSync({ owner: user, mint: mintA, tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(), associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58() })
    const userAccountB = deriveAtaAddressSync({ owner: user, mint: mintB, tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(), associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58() })
    const userLpAccount = deriveAtaAddressSync({ owner: user, mint: lpMint, tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(), associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58() })
    // Fetch pool state and use recorded vaults to satisfy Anchor associated constraints
    const poolState = await (this.program.account as any).pool.fetch(pool)
    const poolAccountA = new PublicKey(poolState.vaultA ?? poolState.vault_a)
    const poolAccountB = new PublicKey(poolState.vaultB ?? poolState.vault_b)
    const poolLpAccount = deriveAtaAddressSync({ owner: poolAuthority, mint: lpMint, tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(), associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58() })

    console.log('[depositLiquidity] amm:', amm.toBase58())
    console.log('[depositLiquidity] pool:', pool.toBase58())
    console.log('[depositLiquidity] poolAuthority:', poolAuthority.toBase58())
    console.log('[depositLiquidity] mintA:', mintA.toBase58())
    console.log('[depositLiquidity] mintB:', mintB.toBase58())
    console.log('[depositLiquidity] poolState.vaultA:', new PublicKey(poolState.vaultA ?? poolState.vault_a).toBase58())
    console.log('[depositLiquidity] poolState.vaultB:', new PublicKey(poolState.vaultB ?? poolState.vault_b).toBase58())
    console.log('[depositLiquidity] derived poolAccountA:', poolAccountA.toBase58())
    console.log('[depositLiquidity] derived poolAccountB:', poolAccountB.toBase58())
    console.log('[depositLiquidity] derived poolLpAccount:', poolLpAccount.toBase58())
    console.log('[depositLiquidity] userAccountA:', userAccountA.toBase58())
    console.log('[depositLiquidity] userAccountB:', userAccountB.toBase58())
    console.log('[depositLiquidity] userLpAccount:', userLpAccount.toBase58())
    console.log('[depositLiquidity] tokenProgram (Token-2022):', TOKEN_2022_PROGRAM.toBase58())
    console.log('[depositLiquidity] associatedTokenProgram:', ASSOCIATED_TOKEN_PROGRAM.toBase58())

    const extraAccountMetaListA = derivePdaAddressSync([EXTRA_ACCOUNT_METAS_SEED, mintA], TOKEN_SETUP_PROGRAM.toBase58())
    const extraAccountMetaListB = derivePdaAddressSync([EXTRA_ACCOUNT_METAS_SEED, mintB], TOKEN_SETUP_PROGRAM.toBase58())
    const mintTradeCounterA = derivePdaAddressSync([MINT_TRADE_COUNTER_SEED, mintA], TOKEN_SETUP_PROGRAM.toBase58())
    const mintTradeCounterB = derivePdaAddressSync([MINT_TRADE_COUNTER_SEED, mintB], TOKEN_SETUP_PROGRAM.toBase58())

    const tx = await this.program.methods
      .depositLiquidity(new BN(amountA), new BN(amountB))
      .accounts({
        amm,
        pool,
        poolAuthority,
        mintA,
        mintB,
        poolAccountA,
        poolAccountB,
        userAccountA,
        userAccountB,
        userLpAccount,
        poolLpAccount,
        lpMint,
        user,
        systemProgram: web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
        tokenProgram: TOKEN_2022_PROGRAM,
        extraAccountMetaListA,
        mintTradeCounterA,
        extraAccountMetaListB,
        mintTradeCounterB,
        transferHookProgramA: transferHookProgramId,
        transferHookProgramB: transferHookProgramId,
      })
      .transaction()

    const res = await this.signAndSend(tx, signTransaction)
    return { signature: res.signature, success: !res.err }
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
      const poolAuthority = derivePdaAddressSync([
        poolAddress,
        mintA,
        mintB,
        POOL_AUTHORITY_SEED,
      ], this.program.programId.toBase58())

      // Derive pool accounts using manual ATA derivation with Token-2022 seeds
      const poolAccountA = deriveAtaAddressSync({
        owner: poolAuthority,
        mint: mintA,
        tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
        associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
      })

      const poolAccountB = deriveAtaAddressSync({
        owner: poolAuthority,
        mint: mintB,
        tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
        associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
      })

      // Derive user accounts using manual ATA derivation with Token-2022 seeds
      const userAccountA = deriveAtaAddressSync({
        owner: this.provider.wallet.publicKey,
        mint: mintA,
        tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
        associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
      })

      const userAccountB = deriveAtaAddressSync({
        owner: this.provider.wallet.publicKey,
        mint: mintB,
        tokenProgramAddressBase58: TOKEN_2022_PROGRAM.toBase58(),
        associatedTokenProgramAddressBase58: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
      })

      console.log('Using manual ATA derivation (Token-2022):')
      console.log('Pool Account A:', poolAccountA.toString())
      console.log('Pool Account B:', poolAccountB.toString())
      console.log('User Account A:', userAccountA.toString())
      console.log('User Account B:', userAccountB.toString())

      // Derive transfer hook accounts using Anchor's utils
      const extraAccountMetaListA = derivePdaAddressSync([
        EXTRA_ACCOUNT_METAS_SEED,
        mintA,
      ], TOKEN_SETUP_PROGRAM.toBase58())

      const mintTradeCounterA = derivePdaAddressSync([
        MINT_TRADE_COUNTER_SEED,
        mintA,
      ], TOKEN_SETUP_PROGRAM.toBase58())

      const extraAccountMetaListB = derivePdaAddressSync([
        EXTRA_ACCOUNT_METAS_SEED,
        mintB,
      ], TOKEN_SETUP_PROGRAM.toBase58())

      const mintTradeCounterB = derivePdaAddressSync([
        MINT_TRADE_COUNTER_SEED,
        mintB,
      ], TOKEN_SETUP_PROGRAM.toBase58())

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
      const { value: blockhashRes } = await this.rpc.getLatestBlockhash().send()
      tx.recentBlockhash = blockhashRes.blockhash
      tx.feePayer = this.provider.wallet.publicKey

      const signedTx = await signTransaction(tx)
      const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      })

      const confirmation = await waitForConfirmation(this.connection, signature, 60000, 'confirmed')
      
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