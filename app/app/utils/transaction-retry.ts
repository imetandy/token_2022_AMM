import { Connection, Transaction, SendTransactionError } from '@solana/web3.js'
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
    originalTransaction: Transaction,
    signTransaction: (transaction: Transaction) => Promise<Transaction>,
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

        // Create a fresh transaction for each attempt to avoid signature conflicts
        const transaction = new Transaction()
        
        // Copy all instructions from the original transaction
        originalTransaction.instructions.forEach(instruction => {
          transaction.add(instruction)
        })

        // Get fresh blockhash for each attempt
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized')
        transaction.recentBlockhash = blockhash
        transaction.feePayer = originalTransaction.feePayer

        // Sign the transaction
        const signedTransaction = await signTransaction(transaction)

        // Send the transaction
        const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 1 // We handle retries ourselves
        })

        console.log(`Transaction sent with signature: ${signature}`)

        // Wait for confirmation with timeout
        const confirmation = await this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed')

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`)
        }

        // Get transaction details for logs
        const transactionResponse = await this.connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })

        console.log(`✅ Transaction successful on attempt ${attempt}`)

        return {
          signature,
          success: true,
          logs: transactionResponse?.meta?.logMessages || []
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
              
              // Get transaction details for logs
              const transactionResponse = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              })

              return {
                signature,
                success: true,
                logs: transactionResponse?.meta?.logMessages || ['Transaction was already processed successfully']
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
    if (lastError instanceof SendTransactionError) {
      return {
        signature: '',
        success: false,
        error: `Transaction failed after ${maxRetries} attempts: ${lastError.message}`,
        logs: lastError.logs || []
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
    if (error instanceof SendTransactionError) {
      return error.message.includes('already been processed')
    }
    return error?.message?.includes('already been processed') || false
  }

  private extractSignatureFromError(error: any): string | null {
    if (error instanceof SendTransactionError) {
      // Try to extract signature from error message
      const signatureMatch = error.message.match(/signature: ([A-Za-z0-9]+)/)
      return signatureMatch ? signatureMatch[1] : null
    }
    
    // Fallback for other error types
    const signatureMatch = error?.message?.match(/signature: ([A-Za-z0-9]+)/)
    return signatureMatch ? signatureMatch[1] : null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 