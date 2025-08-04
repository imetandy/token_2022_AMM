'use client'

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletNotConnectedError } from '@solana/wallet-adapter-base'
import { Keypair, PublicKey } from '@solana/web3.js'
import { createRpcClient, Token2022Amm } from '../config/program'
import { WalletClient } from '../utils/wallet-client'
import { TransactionResult } from '../utils/transaction-utils'
import TransactionResultComponent from './TransactionResult'

interface TokenCreationFormProps {
  tokenType: 'A' | 'B'
  onTokenCreated?: (address: string) => void
  createdToken?: string | null
}

export default function TokenCreationForm({ tokenType, onTokenCreated, createdToken }: TokenCreationFormProps) {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const { connection } = useConnection()
  
  const [tokenName, setTokenName] = useState(`Token ${tokenType}`)
  const [tokenSymbol, setTokenSymbol] = useState(`${tokenType}TK`)
  const [isLoading, setIsLoading] = useState(false)
  const [localCreatedToken, setLocalCreatedToken] = useState<string | null>(createdToken || null)
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null)

  const handleMint = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first')
      return
    }

    if (!signTransaction) {
      alert('Wallet does not support transaction signing')
      return
    }

    if (!tokenName.trim() || !tokenSymbol.trim()) {
      alert('Please enter both token name and symbol')
      return
    }

    setIsLoading(true)
    setTransactionResult(null)

    try {
      console.log(`Creating Token-2022 ${tokenType}:`, tokenName, tokenSymbol)
      console.log('Wallet address:', publicKey.toString())

      // Create Wallet client
      const walletClient = new WalletClient(connection)
      
      // Create token with hook using wallet
      const result = await walletClient.createTokenWithHook(
        publicKey,
        signTransaction,
        tokenName,
        tokenSymbol,
        `https://arweave.net/metadata-${tokenType.toLowerCase()}-${Date.now()}`
      )

      setTransactionResult(result)

      if (result.success && result.mintAddress) {
        const tokenAddress = result.mintAddress
        
        // Mint initial tokens to the wallet (1,000,000 tokens with 6 decimals)
        console.log('Minting 1,000,000 tokens to wallet...')
        console.log('Using mint address:', tokenAddress)
        const mintResult = await walletClient.mintTokens(
          publicKey,
          new PublicKey(tokenAddress),
          10000000000000, // Mint 1,000,000 tokens (1,000,000 * 10^6 for 6 decimals)
          signTransaction
        )
        
        if (mintResult.success) {
          console.log('Initial tokens minted successfully')
          setLocalCreatedToken(tokenAddress)
          onTokenCreated?.(tokenAddress)
          console.log(`Token ${tokenType} created and minted successfully:`, tokenAddress)
        } else {
          console.error('Failed to mint initial tokens:', mintResult.error)
          setTransactionResult(mintResult)
        }
      } else if (result.success && !result.mintAddress) {
        console.error('Token created but no mint address returned')
        setTransactionResult({
          signature: result.signature,
          success: false,
          error: 'Token created but no mint address returned'
        })
      } else {
        console.error('Failed to create token:', result.error)
        setTransactionResult(result)
      }
      
    } catch (error) {
      console.error('Error creating token:', error)
      setTransactionResult({
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // If token is already created, show the result
  if (localCreatedToken) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-xs">✓</span>
          </div>
          <span className="text-xs font-medium text-green-800">Token Created</span>
        </div>
        <p className="text-xs text-green-700 mb-1">Token Address:</p>
        <code className="block bg-green-100 p-2 rounded text-xs break-all text-green-800">
          {localCreatedToken}
        </code>
        <p className="text-xs text-green-600 mt-1">
          Name: {tokenName} | Symbol: {tokenSymbol}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Authority: {publicKey?.toString()}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={tokenName}
        onChange={(e) => setTokenName(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
        placeholder="Enter token name"
        required
      />

      <input
        type="text"
        value={tokenSymbol}
        onChange={(e) => setTokenSymbol(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
        placeholder="Enter token symbol"
        required
      />

      <button
        onClick={handleMint}
        disabled={isLoading || !publicKey || !signTransaction || !tokenName.trim() || !tokenSymbol.trim()}
        className="w-full bg-blue-600 text-white py-1.5 px-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
      >
        {isLoading ? 'Creating Token...' : 'Create Token'}
      </button>

      {/* Transaction Result */}
      {transactionResult && (
        <TransactionResultComponent 
          result={transactionResult}
          onClose={() => setTransactionResult(null)}
        />
      )}
    </div>
  )
} 