type Connection = any
import {
  createTransactionMessage,
  appendTransactionMessageInstructions,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  type IInstruction,
} from '@solana/kit'
import { createRpc, getBestRpcEndpoint } from '../config/rpc-config'
import { TransactionResult } from './transaction-utils'

export interface RetryOptions {
  maxRetries?: number
  retryDelayMs?: number
  timeoutMs?: number
}

export class TransactionRetryHandler {
  private connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async sendTransactionWithRetry(
    instructions: IInstruction[],
    feePayer: any,
    options: RetryOptions = {}
  ): Promise<TransactionResult> {
    const {
      maxRetries = 3,
      retryDelayMs = 1000,
      timeoutMs = 30000
    } = options

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Transaction attempt ${attempt}/${maxRetries}`)

        const rpc = createRpc()
        const { value: { blockhash, lastValidBlockHeight } } = await rpc.getLatestBlockhash().send()
        const msg0 = createTransactionMessage({ version: 0 } as any)
        const msg1 = appendTransactionMessageInstructions(msg0 as any, instructions as any)
        const msg2 = setTransactionMessageFeePayerSigner(msg1 as any, feePayer as any)
        const msg3 = setTransactionMessageLifetimeUsingBlockhash(msg2 as any, { blockhash, lastValidBlockHeight } as any)
        const signed = await signTransactionMessageWithSigners(msg3 as any, { signers: [feePayer] } as any)
        const { createSolanaRpcSubscriptions } = await import('@solana/kit')
        const rpcSubscriptions = createSolanaRpcSubscriptions(getBestRpcEndpoint() as any)
        const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any)
        const signature = await sendAndConfirm(signed as any, { commitment: 'confirmed', lastValidBlockHeight } as any)

        console.log(`Transaction sent with signature: ${signature}`)

        console.log(`✅ Transaction successful on attempt ${attempt}`)

        return {
          signature: typeof signature === 'string' ? signature : '',
          success: true,
          logs: []
        }

      } catch (error) {
        lastError = error as Error
        console.error(`Transaction attempt ${attempt} failed:`, error)

        // Check if this is the "already been processed" error
        if (this.isAlreadyProcessedError(error)) {
          console.log('Transaction was already processed, attempting to get signature...')
          
          try {
            // Try to extract signature from error message
            const signature = this.extractSignatureFromError(error)
            if (signature) {
              console.log(`✅ Transaction was already processed with signature: ${signature}`)
              
              return {
                signature,
                success: true,
                logs: ['Transaction was already processed successfully']
              }
            }
          } catch (extractError) {
            console.error('Failed to extract signature from error:', extractError)
          }
          
          // If we can't extract the signature but it was already processed, treat as success
          console.log('✅ Transaction was already processed (signature not available)')
          return {
            signature: '', // Empty signature since we can't extract it
            success: true,
            logs: ['Transaction was already processed successfully']
          }
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error(`All ${maxRetries} attempts failed`)
          break
        }

        // Wait before retrying
        console.log(`Waiting ${retryDelayMs}ms before retry...`)
        await this.sleep(retryDelayMs)
      }
    }

    // If we get here, all attempts failed
    if ((lastError as any)?.logs) {
      return {
        signature: '',
        success: false,
        error: `Transaction failed after ${maxRetries} attempts: ${(lastError as Error).message}`,
        logs: (lastError as any).logs || []
      }
    }

    return {
      signature: '',
      success: false,
      error: lastError?.message || `Transaction failed after ${maxRetries} attempts`,
      logs: []
    }
  }

  private isAlreadyProcessedError(error: any): boolean {
    const message = (error as any)?.message ?? ''
    return typeof message === 'string' && message.includes('already been processed')
  }

  private extractSignatureFromError(error: any): string | null {
    const message = (error as any)?.message ?? ''
    if (typeof message !== 'string') return null
    const match = message.match(/signature: ([A-Za-z0-9]+)/)
    return match ? match[1] : null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 