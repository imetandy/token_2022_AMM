import { web3 } from '@coral-xyz/anchor'
import { Buffer } from 'buffer'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token'
import { TOKEN_SETUP_PROGRAM_ID, COUNTER_HOOK_PROGRAM_ID } from '../config/program'
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '../config/constants'
import { TransactionResult } from './transaction-utils'
import { waitForConfirmation } from './confirm'

export type Connection = web3.Connection

const textEncoder = new TextEncoder()

function findPda(seeds: (Buffer | Uint8Array)[], programId: web3.PublicKey): [web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(seeds.map((s) => Buffer.from(s)), programId)
}

export class TokenSetupClient {
  private connection: Connection
  private programId: web3.PublicKey

  constructor(connection: Connection) {
    this.connection = connection
    this.programId = new web3.PublicKey(TOKEN_SETUP_PROGRAM_ID)
  }

  async createTokenWithHook(
    walletPublicKey: string,
    sendTransaction: (tx: web3.Transaction | web3.VersionedTransaction, connection: web3.Connection, opts?: any) => Promise<string>,
    name: string,
    symbol: string,
    uri: string
  ): Promise<TransactionResult> {
    try {
      const balance = await this.connection.getBalance(new web3.PublicKey(walletPublicKey))
      if (Number(balance) < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${Number(balance) / 1e9} SOL`,
        }
      }

      // Mint signer
      const mintKeypair = web3.Keypair.generate()
      const mintPubkey = mintKeypair.publicKey

      // PDAs
      const [extraAccountMetaListPda] = findPda(
        [
          Buffer.from('extra-account-metas'),
          mintPubkey.toBuffer(),
        ],
        new web3.PublicKey(TOKEN_SETUP_PROGRAM_ID)
      )
      const [mintTradeCounterPda] = findPda(
        [Buffer.from('mint-trade-counter'), mintPubkey.toBuffer()],
        new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID)
      )

      // Anchor data: discriminator + 3 strings (name, symbol, uri)
      const discriminator = new Uint8Array([186, 132, 153, 159, 183, 146, 10, 218])
      const encodeU32LE = (n: number) => {
        const b = new Uint8Array(4)
        new DataView(b.buffer).setUint32(0, n, true)
        return b
      }
      const encodeString = (s: string) => {
        const bytes = textEncoder.encode(s)
        const out = new Uint8Array(4 + bytes.length)
        out.set(encodeU32LE(bytes.length), 0)
        out.set(bytes, 4)
        return out
      }
      const nameBytes = encodeString(name)
      const symbolBytes = encodeString(symbol)
      const uriBytes = encodeString(uri)
      const data = new Uint8Array(discriminator.length + nameBytes.length + symbolBytes.length + uriBytes.length)
      let off = 0
      data.set(discriminator, off), (off += discriminator.length)
      data.set(nameBytes, off), (off += nameBytes.length)
      data.set(symbolBytes, off), (off += symbolBytes.length)
      data.set(uriBytes, off), (off += uriBytes.length)

      const ix = new web3.TransactionInstruction({
        programId: new web3.PublicKey(TOKEN_SETUP_PROGRAM_ID),
        keys: [
          { pubkey: mintPubkey, isSigner: true, isWritable: true },
          { pubkey: new web3.PublicKey(walletPublicKey), isSigner: true, isWritable: false }, // authority
          { pubkey: new web3.PublicKey(walletPublicKey), isSigner: true, isWritable: true }, // payer
          { pubkey: new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true },
          { pubkey: mintTradeCounterPda, isSigner: false, isWritable: false },
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new web3.PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new web3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
        ],
        data: Buffer.from(data),
      })

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
      const msgV0 = new web3.TransactionMessage({
        payerKey: new web3.PublicKey(walletPublicKey),
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message()
      const tx = new web3.VersionedTransaction(msgV0)
      tx.sign([mintKeypair])
      console.log('[createTokenWithHook] sending tx...')
      const signature = await sendTransaction(tx, this.connection, { skipPreflight: true, maxRetries: 3 } as any)
      console.log('[createTokenWithHook] sig:', signature)
      const confirmation: any = await waitForConfirmation(this.connection, signature, 30000, 'confirmed')
      console.log('[createTokenWithHook] confirmation:', confirmation?.value)
      if (confirmation.value.err) {
        return { signature, success: false, error: 'Transaction failed', logs: [] }
      }

      const [extraAccountMetaList] = findPda(
        [
          Buffer.from('extra-account-metas'),
          mintPubkey.toBuffer(),
        ],
        new web3.PublicKey(TOKEN_SETUP_PROGRAM_ID)
      )
      const [mintTradeCounter] = findPda(
        [Buffer.from('mint-trade-counter'), mintPubkey.toBuffer()],
        new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID)
      )

      return {
        signature,
        success: true,
        error: null,
        logs: [],
        mintAddress: mintPubkey.toBase58(),
        extraAccountMetaListAddress: extraAccountMetaList.toBase58(),
        mintTradeCounterAddress: mintTradeCounter.toBase58(),
      }
    } catch (error) {
      console.error('Error creating token with hook:', error)
      return { signature: '', success: false, error: (error as Error)?.message ?? 'Unknown error' }
    }
  }

  async mintTokens(
    walletPublicKey: string,
    sendTransaction: (tx: web3.Transaction | web3.VersionedTransaction, connection: web3.Connection, opts?: any) => Promise<string>,
    mint: string,
    amount: number
  ): Promise<TransactionResult> {
    try {
      const balance = await this.connection.getBalance(new web3.PublicKey(walletPublicKey))
      if (Number(balance) < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${Number(balance) / 1e9} SOL`,
        }
      }

      const tokenAccount = getAssociatedTokenAddressSync(
        new web3.PublicKey(mint),
        new web3.PublicKey(walletPublicKey),
        true,
        new web3.PublicKey(TOKEN_2022_PROGRAM_ID)
      )
      const ixs: web3.TransactionInstruction[] = []
      const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccount)
      if (!tokenAccountInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            new web3.PublicKey(walletPublicKey),
            tokenAccount,
            new web3.PublicKey(walletPublicKey),
            new web3.PublicKey(mint),
            new web3.PublicKey(TOKEN_2022_PROGRAM_ID),
            new web3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID)
          )
        )
      }

      const disc = new Uint8Array([59, 132, 24, 246, 122, 39, 8, 243])
      const amountBuf = new Uint8Array(8)
      new DataView(amountBuf.buffer).setBigUint64(0, BigInt(amount), true)
      const data = new Uint8Array(disc.length + 8)
      data.set(disc, 0)
      data.set(amountBuf, disc.length)

      const mintIx = new web3.TransactionInstruction({
        programId: new web3.PublicKey(TOKEN_SETUP_PROGRAM_ID),
        keys: [
          // Mint must be writable for Token-2022 mint_to CPI inside the program
          { pubkey: new web3.PublicKey(mint), isSigner: false, isWritable: true },
          { pubkey: tokenAccount, isSigner: false, isWritable: true },
          { pubkey: new web3.PublicKey(walletPublicKey), isSigner: true, isWritable: true },
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: new web3.PublicKey(TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: false },
          { pubkey: new web3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
        ],
        data: Buffer.from(data),
      })

      const allIxs = [...ixs, mintIx]
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
      const msgV0 = new web3.TransactionMessage({
        payerKey: new web3.PublicKey(walletPublicKey),
        recentBlockhash: blockhash,
        instructions: allIxs,
      }).compileToV0Message()
      const tx = new web3.VersionedTransaction(msgV0)
      console.log('[mintTokens] sending tx... amount:', amount)
      const signature = await sendTransaction(tx, this.connection, { skipPreflight: true, maxRetries: 3 } as any)
      console.log('[mintTokens] sig:', signature)
      const confirmation: any = await waitForConfirmation(this.connection, signature, 30000, 'confirmed')
      console.log('[mintTokens] confirmation:', confirmation?.value)
      if (confirmation.value.err) {
        const txInfo = await this.connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
        return { signature, success: false, error: 'Transaction failed', logs: txInfo?.meta?.logMessages || [] }
      }

      return { signature, success: true, error: null, logs: [], userAccountAddress: tokenAccount.toBase58() }
    } catch (error) {
      console.error('Error minting tokens:', error)
      return { signature: '', success: false, error: (error as Error)?.message ?? 'Unknown error' }
    }
  }

  async initializeExtraAccountMetaList(
    walletPublicKey: string,
    sendTransaction: (tx: web3.Transaction | web3.VersionedTransaction, connection: web3.Connection, opts?: any) => Promise<string>,
    mint: string
  ): Promise<TransactionResult> {
    try {
      const balance = await this.connection.getBalance(new web3.PublicKey(walletPublicKey))
      if (Number(balance) < 0.01 * 1e9) {
        return {
          signature: '',
          success: false,
          error: `Insufficient SOL balance. Need at least 0.01 SOL, but have ${Number(balance) / 1e9} SOL`,
        }
      }

      // Call counter_hook to create EAML under hook ownership
      const disc = new Uint8Array([17, 18, 19, 20, 21, 22, 23, 24])
      const [extraAccountMetaListPda] = findPda(
        [Buffer.from('extra-account-metas'), new web3.PublicKey(mint).toBuffer()],
        new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID)
      )
      const ix = new web3.TransactionInstruction({
        programId: new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID),
        keys: [
          { pubkey: new web3.PublicKey(walletPublicKey), isSigner: true, isWritable: true },
          { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true },
          { pubkey: new web3.PublicKey(mint), isSigner: false, isWritable: false },
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(disc),
      })

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
      const msgV0 = new web3.TransactionMessage({
        payerKey: new web3.PublicKey(walletPublicKey),
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message()
      const tx = new web3.VersionedTransaction(msgV0)
      const signature = await sendTransaction(tx, this.connection, { skipPreflight: true, maxRetries: 3 } as any)
      const confirmation: any = await waitForConfirmation(this.connection, signature, 60000, 'confirmed')
      if (confirmation.value.err) {
        return { signature, success: false, error: 'Transaction failed', logs: [] }
      }
      return { signature, success: true, error: null, logs: [] }
    } catch (error) {
      console.error('Error initializing extra account meta list:', error)
      return { signature: '', success: false, error: (error as Error)?.message ?? 'Unknown error' }
    }
  }
} 