'use client'

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletNotConnectedError } from '@solana/wallet-adapter-base'
import { Keypair, PublicKey } from '@solana/web3.js'
import { createRpcClient, Token2022Amm } from '../config/program'
import { WalletClientNew } from '../utils/wallet-client-new'
import { TransactionResult } from '../utils/transaction-utils'
import TransactionResultComponent from './TransactionResult'

interface TokenCreationFormProps {
  onTokensSet: (tokenA: string, tokenB: string) => void
  createdTokens: {
    tokenA: string | null
    tokenB: string | null
  }
}

export default function TokenCreationForm({ onTokensSet, createdTokens }: TokenCreationFormProps) {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const { connection } = useConnection()
  
  const [tokenAName, setTokenAName] = useState('Token A')
  const [tokenASymbol, setTokenASymbol] = useState('TKA')
  const [tokenBName, setTokenBName] = useState('Token B')
  const [tokenBSymbol, setTokenBSymbol] = useState('TKB')
  const [isLoading, setIsLoading] = useState(false)
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null)

  const handleCreateTokens = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first')
      return
    }

    if (!signTransaction) {
      alert('Wallet does not support transaction signing')
      return
    }

    if (!tokenAName.trim() || !tokenASymbol.trim() || !tokenBName.trim() || !tokenBSymbol.trim()) {
      alert('Please enter both token names and symbols')
      return
    }

    setIsLoading(true)
    setTransactionResult(null)

    try {
      console.log('Creating Token-2022 tokens with counter_hook integration...')
      console.log('Wallet address:', publicKey.toString())

      // Create Wallet client
      const walletClient = new WalletClientNew(connection)
      
      let tokenAAddress: string | null = null
      let tokenBAddress: string | null = null

      // Create Token A with hook
      console.log('Creating Token A:', tokenAName, tokenASymbol)
      const resultA = await walletClient.createTokenWithHook(
        publicKey,
        signTransaction,
        tokenAName,
        tokenASymbol,
        `https://arweave.net/metadata-token-a-${Date.now()}`
      )

      if (resultA.success && resultA.mintAddress) {
        tokenAAddress = resultA.mintAddress
        console.log('Token A created:', tokenAAddress)
        
        // Mint initial tokens to the wallet (1,000,000 tokens with 6 decimals)
        console.log('Minting 1,000,000 Token A to wallet...')
        const mintResultA = await walletClient.mintTokens(
          publicKey,
          new PublicKey(tokenAAddress),
          10000000000000, // Mint 1,000,000 tokens (1,000,000 * 10^6 for 6 decimals)
          signTransaction
        )
        
        if (!mintResultA.success) {
          console.error('Failed to mint Token A:', mintResultA.error)
          setTransactionResult(mintResultA)
          return
        }
      } else {
        console.error('Failed to create Token A:', resultA.error)
        setTransactionResult(resultA)
        return
      }

      // Create Token B with hook
      console.log('Creating Token B:', tokenBName, tokenBSymbol)
      const resultB = await walletClient.createTokenWithHook(
        publicKey,
        signTransaction,
        tokenBName,
        tokenBSymbol,
        `https://arweave.net/metadata-token-b-${Date.now()}`
      )

      if (resultB.success && resultB.mintAddress) {
        tokenBAddress = resultB.mintAddress
        console.log('Token B created:', tokenBAddress)
        
        // Mint initial tokens to the wallet (1,000,000 tokens with 6 decimals)
        console.log('Minting 1,000,000 Token B to wallet...')
        const mintResultB = await walletClient.mintTokens(
          publicKey,
          new PublicKey(tokenBAddress),
          10000000000000, // Mint 1,000,000 tokens (1,000,000 * 10^6 for 6 decimals)
          signTransaction
        )
        
        if (!mintResultB.success) {
          console.error('Failed to mint Token B:', mintResultB.error)
          setTransactionResult(mintResultB)
          return
        }
      } else {
        console.error('Failed to create Token B:', resultB.error)
        setTransactionResult(resultB)
        return
      }

      // Both tokens created successfully
      if (tokenAAddress && tokenBAddress) {
        console.log('Both tokens created successfully!')
        console.log('Token A:', tokenAAddress)
        console.log('Token B:', tokenBAddress)
        
        // Update parent component
        onTokensSet(tokenAAddress, tokenBAddress)
        
        setTransactionResult({
          signature: resultB.signature,
          success: true,
          logs: [`Token A: ${tokenAAddress}`, `Token B: ${tokenBAddress}`]
        })
      }
      
    } catch (error) {
      console.error('Error creating tokens:', error)
      setTransactionResult({
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // If tokens are already created, show the results
  if (createdTokens.tokenA && createdTokens.tokenB) {
    return (
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs">✓</span>
            </div>
            <span className="text-xs font-medium text-green-800">Tokens Created</span>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-xs text-green-700 mb-1">Token A:</p>
              <code className="block bg-green-100 p-2 rounded text-xs break-all text-green-800">
                {createdTokens.tokenA}
              </code>
              <p className="text-xs text-green-600 mt-1">
                Name: {tokenAName} | Symbol: {tokenASymbol}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-green-700 mb-1">Token B:</p>
              <code className="block bg-green-100 p-2 rounded text-xs break-all text-green-800">
                {createdTokens.tokenB}
              </code>
              <p className="text-xs text-green-600 mt-1">
                Name: {tokenBName} | Symbol: {tokenBSymbol}
              </p>
            </div>
          </div>
          
          <p className="text-xs text-blue-600 mt-2">
            Authority: {publicKey?.toString()}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Token A Form */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Token A</h4>
        <input
          type="text"
          value={tokenAName}
          onChange={(e) => setTokenAName(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
          placeholder="Enter Token A name"
          required
        />

        <input
          type="text"
          value={tokenASymbol}
          onChange={(e) => setTokenASymbol(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
          placeholder="Enter Token A symbol"
          required
        />
      </div>

      {/* Token B Form */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Token B</h4>
        <input
          type="text"
          value={tokenBName}
          onChange={(e) => setTokenBName(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
          placeholder="Enter Token B name"
          required
        />

        <input
          type="text"
          value={tokenBSymbol}
          onChange={(e) => setTokenBSymbol(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
          placeholder="Enter Token B symbol"
          required
        />
      </div>

      <button
        onClick={handleCreateTokens}
        disabled={isLoading || !publicKey || !signTransaction || !tokenAName.trim() || !tokenASymbol.trim() || !tokenBName.trim() || !tokenBSymbol.trim()}
        className="w-full bg-blue-600 text-white py-1.5 px-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
      >
        {isLoading ? 'Creating Tokens...' : 'Create Both Tokens'}
      </button>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Counter Hook Integration</h4>
        <div className="space-y-1 text-xs text-blue-800">
          <p>• Tokens will be created with transfer hooks enabled</p>
          <p>• Trade counters will be automatically initialized</p>
          <p>• Each token will have 1,000,000 initial supply</p>
          <p>• Ready for AMM pool creation and trading</p>
        </div>
      </div>

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