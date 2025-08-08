"use client"

import bs58 from 'bs58'
import { Keypair, PublicKey, Transaction, Connection, VersionedTransaction } from '@solana/web3.js'
import {
  BaseMessageSignerWalletAdapter,
  WalletAdapterNetwork,
  WalletName,
  WalletReadyState,
} from '@solana/wallet-adapter-base'

type Commitment = 'processed' | 'confirmed' | 'finalized'

function parseSecretKeyFromEnvOrStorage(): Uint8Array | null {
  // Prefer build-time env for CI/local .env
  const envSecret = process.env.NEXT_PUBLIC_DEV_WALLET_SECRET_KEY
  const envEnabled = process.env.NEXT_PUBLIC_USE_DEV_WALLET === 'true'

  let raw: string | null = null
  if (envEnabled && envSecret && envSecret.trim().length > 0) {
    raw = envSecret.trim()
  } else if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('DEV_WALLET_SECRET_KEY')
    if (stored && stored.trim().length > 0) raw = stored.trim()
  }

  if (!raw) return null

  try {
    // Accept either bs58 or JSON array formats
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw) as number[]
      return Uint8Array.from(arr)
    }
    return Uint8Array.from(bs58.decode(raw))
  } catch {
    return null
  }
}

class DevKeypairWalletAdapter extends BaseMessageSignerWalletAdapter {
  readonly name: WalletName = 'Dev Keypair' as WalletName
  readonly url = 'https://github.com/anza-xyz/kit'
  readonly icon = 'data:image/svg+xml;base64,' // empty icon
  readonly supportedTransactionVersions = null as any
  readonly network: WalletAdapterNetwork | null = null

  private keypair: Keypair | null = null
  private _publicKey: PublicKey | null = null
  private _connecting = false
  private _readyState: WalletReadyState = WalletReadyState.Loadable

  get publicKey(): PublicKey | null {
    return this._publicKey
  }

  get connecting(): boolean {
    return this._connecting
  }

  get connected(): boolean {
    return !!this._publicKey
  }

  get readyState(): WalletReadyState {
    return this._readyState
  }

  async connect(): Promise<void> {
    if (this.connected || this._connecting) return
    this._connecting = true
    try {
      let secret = parseSecretKeyFromEnvOrStorage()
      if (!secret && typeof window !== 'undefined') {
        const input = window.prompt('Enter Dev Wallet secret key (bs58 or JSON array):')
        if (input && input.trim().length > 0) {
          try {
            const parsed = input.trim().startsWith('[')
              ? Uint8Array.from(JSON.parse(input.trim()))
              : Uint8Array.from(bs58.decode(input.trim()))
            window.localStorage.setItem('DEV_WALLET_SECRET_KEY', input.trim())
            secret = parsed
          } catch (e) {
            throw new Error('Invalid secret format. Provide bs58 or JSON array')
          }
        }
      }
      if (!secret) throw new Error('Dev wallet secret key not provided')
      this.keypair = Keypair.fromSecretKey(secret)
      this._publicKey = this.keypair.publicKey
      this.emit('connect', this._publicKey)
    } catch (e) {
      this.emit('error', e as any)
      throw e
    } finally {
      this._connecting = false
    }
  }

  async disconnect(): Promise<void> {
    this.keypair = null
    this._publicKey = null
    this.emit('disconnect')
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: { preflightCommitment?: Commitment; skipPreflight?: boolean; maxRetries?: number }
  ): Promise<string> {
    if (!this.keypair || !this._publicKey) throw new Error('Wallet not connected')

    if (transaction instanceof VersionedTransaction) {
      transaction.sign([this.keypair])
      const sig = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: options?.skipPreflight ?? true,
        maxRetries: options?.maxRetries ?? 3,
      })
      return sig
    } else {
      if (!transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash(options?.preflightCommitment ?? 'confirmed')
        transaction.recentBlockhash = blockhash
      }
      if (!transaction.feePayer) transaction.feePayer = this._publicKey
      transaction.partialSign(this.keypair)
      const sig = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: options?.skipPreflight ?? true,
        maxRetries: options?.maxRetries ?? 3,
      })
      return sig
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this.keypair) throw new Error('Wallet not connected')
    if (transaction instanceof VersionedTransaction) {
      transaction.sign([this.keypair])
      return transaction as T
    } else {
      transaction.partialSign(this.keypair)
      return transaction as T
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    if (!this.keypair) throw new Error('Wallet not connected')
    return transactions.map((tx) => {
      if (tx instanceof VersionedTransaction) {
        tx.sign([this.keypair!])
        return tx as T
      } else {
        tx.partialSign(this.keypair!)
        return tx as T
      }
    })
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.keypair) throw new Error('Wallet not connected')
    // web3.js Keypair does not expose sign directly; use nacl via tweetnacl
    const { sign } = await import('tweetnacl')
    const signed = sign.detached(message, this.keypair.secretKey)
    return signed
  }
}

export function createDevKeypairAdapter(): DevKeypairWalletAdapter {
  return new DevKeypairWalletAdapter()
}

export function setDevWalletSecretInStorage(secret: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('DEV_WALLET_SECRET_KEY', secret)
}

