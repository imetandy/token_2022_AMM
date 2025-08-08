'use client'

import { useEffect, useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '../utils/kit'
import { BalanceUtils, PoolBalances } from '../utils/balance-utils'

interface BalanceDisplayProps {
  tokenA?: string | null
  tokenB?: string | null
  poolAddress?: string | null
  ammAddress?: string | null
  refreshTrigger?: number // This will trigger a refresh when changed
  isSwapInProgress?: boolean // Show when a swap is happening
}

export default function BalanceDisplay({ 
  tokenA, 
  tokenB, 
  poolAddress, 
  ammAddress, 
  refreshTrigger,
  isSwapInProgress = false
}: BalanceDisplayProps) {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [balances, setBalances] = useState<PoolBalances | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = async () => {
    if (!publicKey || !tokenA || !tokenB || !poolAddress || !ammAddress) {
      setBalances(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const balanceUtils = new BalanceUtils(connection)
      const poolBalances = await balanceUtils.getPoolBalances(
        new PublicKey(ammAddress),
        new PublicKey(poolAddress),
        new PublicKey(tokenA),
        new PublicKey(tokenB),
        new PublicKey(publicKey.toBase58())
      )
      setBalances(poolBalances)
    } catch (err) {
      console.error('Error fetching balances:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch balances')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch balances on mount and when dependencies change
  useEffect(() => {
    fetchBalances()
  }, [publicKey, tokenA, tokenB, poolAddress, ammAddress, refreshTrigger])

  if (!publicKey) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-gray-600 text-xs">Connect wallet to view balances</p>
      </div>
    )
  }

  if (!tokenA || !tokenB || !poolAddress || !ammAddress) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-gray-600 text-xs">Create tokens and pool to view balances</p>
      </div>
    )
  }

  if (isLoading || isSwapInProgress) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-gray-600 text-xs">
          {isSwapInProgress ? 'Updating balances after swap...' : 'Loading balances...'}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-red-600 text-xs">Error: {error}</p>
        <button 
          onClick={fetchBalances}
          className="mt-1 text-red-500 hover:text-red-700 text-xs underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!balances) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-gray-600 text-xs">No balance data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* User Balances */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h3 className="text-blue-800 font-medium text-xs mb-2">Your Balances</h3>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-blue-700">Token 1:</span>
            <span className="text-blue-900 font-mono">
              {balances.userTokenABalance.uiAmount.toFixed(6)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-700">Token 2:</span>
            <span className="text-blue-900 font-mono">
              {balances.userTokenBBalance.uiAmount.toFixed(6)}
            </span>
          </div>
        </div>
      </div>

      {/* Pool Balances */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <h3 className="text-green-800 font-medium text-xs mb-2">Pool Balances</h3>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-green-700">Token 1:</span>
            <span className="text-green-900 font-mono">
              {balances.tokenABalance.uiAmount.toFixed(6)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-700">Token 2:</span>
            <span className="text-green-900 font-mono">
              {balances.tokenBBalance.uiAmount.toFixed(6)}
            </span>
          </div>
        </div>
      </div>

      {/* Token Addresses */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <h3 className="text-gray-800 font-medium text-xs mb-2">Token Addresses</h3>
        <div className="space-y-1">
          <div className="text-xs">
            <span className="text-gray-600">Token 1: </span>
            <span className="text-gray-800 font-mono text-xs">
              {balances.userTokenABalance.mint.slice(0, 8)}...{balances.userTokenABalance.mint.slice(-8)}
            </span>
          </div>
          <div className="text-xs">
            <span className="text-gray-600">Token 2: </span>
            <span className="text-gray-800 font-mono text-xs">
              {balances.userTokenBBalance.mint.slice(0, 8)}...{balances.userTokenBBalance.mint.slice(-8)}
            </span>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <button 
        onClick={fetchBalances}
        disabled={isLoading}
        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Refreshing...' : 'Refresh Balances'}
      </button>
    </div>
  )
} 