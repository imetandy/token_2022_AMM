'use client'

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletNotConnectedError } from '@solana/wallet-adapter-base'
import { Keypair, PublicKey } from '@solana/web3.js'
import { createRpcClient, Token2022Amm } from '../config/program'
import { WalletClientNew } from '../utils/wallet-client-new'
import { TransactionResult } from '../utils/transaction-utils'
import TransactionResultComponent from './TransactionResult'
import BalanceDisplay from './BalanceDisplay'

interface TradingInterfaceProps {
  tokenA?: string | null
  tokenB?: string | null
  poolAddress?: string | null
  ammAddress?: string | null
  canTrade?: boolean
}

export default function TradingInterface({ tokenA, tokenB, poolAddress, ammAddress, canTrade }: TradingInterfaceProps) {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const { connection } = useConnection()
  
  const [swapData, setSwapData] = useState({
    amount: '1000',
    direction: 'AtoB' as 'AtoB' | 'BtoA',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSwap = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first')
      return
    }

    if (!signTransaction) {
      alert('Wallet does not support transaction signing')
      return
    }
    
    if (!tokenA || !tokenB || !poolAddress || !ammAddress) {
      alert('Please create tokens and pool first')
      return
    }

    if (!canTrade) {
      alert('Please add liquidity to the pool first')
      return
    }

    if (!swapData.amount || parseFloat(swapData.amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setIsLoading(true)
    setTransactionResult(null)

    try {
      console.log('Executing swap:', swapData)
      console.log('Wallet address:', publicKey.toString())
      console.log('Pool address:', poolAddress)
      console.log('AMM address:', ammAddress)
      console.log('Token A:', tokenA)
      console.log('Token B:', tokenB)
      console.log('Amount:', swapData.amount)
      console.log('Direction:', swapData.direction)

      // Create Wallet client
      const walletClient = new WalletClientNew(connection)
      
      // Convert amount to proper format (assuming 6 decimals)
      const inputAmount = Math.floor(parseFloat(swapData.amount) * 1e6)
      const minOutputAmount = Math.floor(inputAmount * 0.95) // 5% slippage tolerance
      
      // Execute swap
      const result = await walletClient.swapTokens(
        publicKey,
        new PublicKey(ammAddress),
        new PublicKey(poolAddress),
        new PublicKey(tokenA),
        new PublicKey(tokenB),
        swapData.direction === 'AtoB', // swapA
        inputAmount,
        minOutputAmount,
        signTransaction
      )

      setTransactionResult(result)

      if (result.success) {
        console.log('Swap executed successfully:', result.signature)
        // Wait a bit for blockchain state to update, then refresh balances
        setTimeout(() => {
          setRefreshTrigger(prev => prev + 1)
        }, 2000) // 2 second delay
      } else {
        console.error('Failed to execute swap:', result.error)
      }
      
    } catch (error) {
      console.error('Error executing swap:', error)
      setTransactionResult({
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Check if we can trade
  const canExecuteTrade = publicKey && signTransaction && tokenA && tokenB && poolAddress && ammAddress && canTrade

  return (
    <div className="space-y-4">
      {/* Balance Display */}
      <BalanceDisplay
        tokenA={tokenA}
        tokenB={tokenB}
        poolAddress={poolAddress}
        ammAddress={ammAddress}
        refreshTrigger={refreshTrigger}
        isSwapInProgress={isLoading}
      />

      {!canExecuteTrade && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
          <p className="text-yellow-800 text-xs">
            Complete previous steps to enable trading
          </p>
        </div>
      )}

      {/* Swap Interface */}
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
          <select
            value={swapData.direction}
            onChange={(e) => setSwapData({ ...swapData, direction: e.target.value as 'AtoB' | 'BtoA' })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-xs"
          >
            <option value="AtoB">Token 1 → Token 2</option>
            <option value="BtoA">Token 2 → Token 1</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
          <input
            type="number"
            value={swapData.amount}
            onChange={(e) => setSwapData({ ...swapData, amount: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-xs"
            placeholder="100"
            min="0"
            step="0.01"
            required
          />
        </div>
      </div>

      {/* Execute Swap */}
      <button
        onClick={handleSwap}
        disabled={isLoading || !canExecuteTrade}
        className="w-full bg-orange-600 text-white py-1.5 px-2 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
      >
        {isLoading ? 'Swapping...' : 'Execute Swap'}
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