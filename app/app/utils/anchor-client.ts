import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor'
type Connection = any; type Transaction = any;
import * as AMM_IDL from '../types/amm.json'
import { createRpc } from '../config/rpc-config'
// Replace custom kit helpers with web3 derivations
import { waitForConfirmation } from './confirm'

import { 
  TOKEN_2022_PROGRAM, 
  ASSOCIATED_TOKEN_PROGRAM, 
  TOKEN_SETUP_PROGRAM,
  POOL_AUTHORITY_SEED,
  EXTRA_ACCOUNT_METAS_SEED,
  MINT_TRADE_COUNTER_SEED
} from '../config/constants'
import { COUNTER_HOOK_PROGRAM_ID } from '../config/program'

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
    console.log('[signAndSend] submitted tx:', `https://explorer.solana.com/tx/${sig}?cluster=devnet`)
    const conf = await waitForConfirmation(this.connection, sig, 60000, 'confirmed')
    if (conf.value.err) {
      console.error('[signAndSend] tx failed:', conf.value.err)
      try {
        const txInfo = await this.connection.getTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
        console.error('[signAndSend] logs:', txInfo?.meta?.logMessages)
      } catch {}
    }
    return { signature: sig, err: conf.value.err }
  }

  async createAmm(
    mintA: web3.PublicKey,
    mintB: web3.PublicKey,
    solFeeLamports: number,
    solFeeCollector: web3.PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const [amm] = web3.PublicKey.findProgramAddressSync([
      Buffer.from('amm'), mintA.toBuffer(), mintB.toBuffer()
    ], this.program.programId)
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
    mintA: web3.PublicKey,
    mintB: web3.PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const [amm] = web3.PublicKey.findProgramAddressSync([Buffer.from('amm'), mintA.toBuffer(), mintB.toBuffer()], this.program.programId)
    const [pool] = web3.PublicKey.findProgramAddressSync([amm.toBuffer(), mintA.toBuffer(), mintB.toBuffer()], this.program.programId)
    const [poolAuthority] = web3.PublicKey.findProgramAddressSync([pool.toBuffer(), mintA.toBuffer(), mintB.toBuffer(), Buffer.from(POOL_AUTHORITY_SEED)], this.program.programId)
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
    mintA: web3.PublicKey,
    mintB: web3.PublicKey,
    lpMint: web3.PublicKey,
    pool: web3.PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const [amm] = web3.PublicKey.findProgramAddressSync([Buffer.from('amm'), mintA.toBuffer(), mintB.toBuffer()], this.program.programId)
    const [poolAuthority] = web3.PublicKey.findProgramAddressSync([pool.toBuffer(), mintA.toBuffer(), mintB.toBuffer(), Buffer.from(POOL_AUTHORITY_SEED)], this.program.programId)
    const [poolAccountA] = web3.PublicKey.findProgramAddressSync([poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintA.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)
    const [poolAccountB] = web3.PublicKey.findProgramAddressSync([poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintB.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)
    const [poolLpAccount] = web3.PublicKey.findProgramAddressSync([poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), lpMint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)

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
    mintA: web3.PublicKey,
    mintB: web3.PublicKey,
    pool: web3.PublicKey,
    lpMint: web3.PublicKey,
    amountA: number,
    amountB: number,
    transferHookProgramId: web3.PublicKey,
    signTransaction: (t: Transaction) => Promise<Transaction>
  ) {
    const [amm] = web3.PublicKey.findProgramAddressSync([Buffer.from('amm'), mintA.toBuffer(), mintB.toBuffer()], this.program.programId)
    const [poolAuthority] = web3.PublicKey.findProgramAddressSync([pool.toBuffer(), mintA.toBuffer(), mintB.toBuffer(), Buffer.from(POOL_AUTHORITY_SEED)], this.program.programId)
    const user = this.provider.wallet.publicKey
    const [userAccountA] = web3.PublicKey.findProgramAddressSync([user.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintA.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)
    const [userAccountB] = web3.PublicKey.findProgramAddressSync([user.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintB.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)
    const [userLpAccount] = web3.PublicKey.findProgramAddressSync([user.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), lpMint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)
    // Fetch pool state and use recorded vaults to satisfy Anchor associated constraints
    const poolState = await (this.program.account as any).pool.fetch(pool)
    const poolAccountA = new web3.PublicKey(poolState.vaultA ?? poolState.vault_a)
    const poolAccountB = new web3.PublicKey(poolState.vaultB ?? poolState.vault_b)
    const [poolLpAccount] = web3.PublicKey.findProgramAddressSync([poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), lpMint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)

    console.log('[depositLiquidity] amm:', amm.toBase58())
    console.log('[depositLiquidity] pool:', pool.toBase58())
    console.log('[depositLiquidity] poolAuthority:', poolAuthority.toBase58())
    console.log('[depositLiquidity] mintA:', mintA.toBase58())
    console.log('[depositLiquidity] mintB:', mintB.toBase58())
    console.log('[depositLiquidity] poolState.vaultA:', new web3.PublicKey(poolState.vaultA ?? poolState.vault_a).toBase58())
    console.log('[depositLiquidity] poolState.vaultB:', new web3.PublicKey(poolState.vaultB ?? poolState.vault_b).toBase58())
    console.log('[depositLiquidity] derived poolAccountA:', poolAccountA.toBase58())
    console.log('[depositLiquidity] derived poolAccountB:', poolAccountB.toBase58())
    console.log('[depositLiquidity] derived poolLpAccount:', poolLpAccount.toBase58())
    console.log('[depositLiquidity] userAccountA:', userAccountA.toBase58())
    console.log('[depositLiquidity] userAccountB:', userAccountB.toBase58())
    console.log('[depositLiquidity] userLpAccount:', userLpAccount.toBase58())
    console.log('[depositLiquidity] tokenProgram (Token-2022):', TOKEN_2022_PROGRAM.toBase58())
    console.log('[depositLiquidity] associatedTokenProgram:', ASSOCIATED_TOKEN_PROGRAM.toBase58())

    const COUNTER_HOOK_PROGRAM = new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID)
    const [extraAccountMetaListA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(EXTRA_ACCOUNT_METAS_SEED), mintA.toBuffer(), COUNTER_HOOK_PROGRAM.toBuffer()],
      TOKEN_SETUP_PROGRAM
    )
    const [extraAccountMetaListB] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(EXTRA_ACCOUNT_METAS_SEED), mintB.toBuffer(), COUNTER_HOOK_PROGRAM.toBuffer()],
      TOKEN_SETUP_PROGRAM
    )
    const [mintTradeCounterA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_TRADE_COUNTER_SEED), mintA.toBuffer()],
      COUNTER_HOOK_PROGRAM
    )
    const [mintTradeCounterB] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_TRADE_COUNTER_SEED), mintB.toBuffer()],
      COUNTER_HOOK_PROGRAM
    )

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

    console.log('[depositLiquidity] sending transaction...')
    const res = await this.signAndSend(tx, signTransaction)
    return { signature: res.signature, success: !res.err }
  }
  async swapTokens(
    ammId: web3.PublicKey,
    poolAddress: web3.PublicKey,
    mintA: web3.PublicKey,
    mintB: web3.PublicKey,
    swapA: boolean,
    inputAmount: number,
    minOutputAmount: number,
    transferHookProgramIdA: web3.PublicKey,
    transferHookProgramIdB: web3.PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ) {
    try {
      // Derive pool authority using Anchor's utils
      const [poolAuthority] = web3.PublicKey.findProgramAddressSync([
        poolAddress.toBuffer(), mintA.toBuffer(), mintB.toBuffer(), Buffer.from(POOL_AUTHORITY_SEED)
      ], this.program.programId)

      // Derive pool accounts using manual ATA derivation with Token-2022 seeds
      const [poolAccountA] = web3.PublicKey.findProgramAddressSync([
        poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintA.toBuffer()
      ], ASSOCIATED_TOKEN_PROGRAM)

      const [poolAccountB] = web3.PublicKey.findProgramAddressSync([
        poolAuthority.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintB.toBuffer()
      ], ASSOCIATED_TOKEN_PROGRAM)

      // Derive user accounts using manual ATA derivation with Token-2022 seeds
      const [userAccountA] = web3.PublicKey.findProgramAddressSync([
        this.provider.wallet.publicKey.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintA.toBuffer()
      ], ASSOCIATED_TOKEN_PROGRAM)

      const [userAccountB] = web3.PublicKey.findProgramAddressSync([
        this.provider.wallet.publicKey.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mintB.toBuffer()
      ], ASSOCIATED_TOKEN_PROGRAM)

      console.log('Using manual ATA derivation (Token-2022):')
      console.log('Pool Account A:', poolAccountA.toString())
      console.log('Pool Account B:', poolAccountB.toString())
      console.log('User Account A:', userAccountA.toString())
      console.log('User Account B:', userAccountB.toString())

      // Derive transfer hook accounts using kit PDA helper
      const COUNTER_HOOK_PROGRAM = new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID)
      const [extraAccountMetaListA] = web3.PublicKey.findProgramAddressSync([
        Buffer.from(EXTRA_ACCOUNT_METAS_SEED),
        mintA.toBuffer(),
        COUNTER_HOOK_PROGRAM.toBuffer(),
      ], TOKEN_SETUP_PROGRAM)

      const [mintTradeCounterA] = web3.PublicKey.findProgramAddressSync([
        Buffer.from(MINT_TRADE_COUNTER_SEED),
        mintA.toBuffer(),
      ], COUNTER_HOOK_PROGRAM)

      const [extraAccountMetaListB] = web3.PublicKey.findProgramAddressSync([
        Buffer.from(EXTRA_ACCOUNT_METAS_SEED),
        mintB.toBuffer(),
        COUNTER_HOOK_PROGRAM.toBuffer(),
      ], TOKEN_SETUP_PROGRAM)

      const [mintTradeCounterB] = web3.PublicKey.findProgramAddressSync([
        Buffer.from(MINT_TRADE_COUNTER_SEED),
        mintB.toBuffer(),
      ], COUNTER_HOOK_PROGRAM)

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