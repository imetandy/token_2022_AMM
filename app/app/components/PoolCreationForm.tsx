'use client'

import { useState, useRef, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '../utils/kit'
type Keypair = any;
import { AMM_PROGRAM_ID, COUNTER_HOOK_PROGRAM_ID } from '../config/program'
import { AnchorClient } from '../utils/anchor-client'
// WalletClientNew removed; using generated builders + Kit pipeline directly
import { TransactionResult } from '../utils/transaction-utils'
import TransactionResultComponent from './TransactionResult'
import PoolDataDisplay from './PoolDataDisplay'
import { createRpc } from '../config/rpc-config'
import { fetchPool } from '../clients/amm/accounts/pool'

interface PoolData {
  amm: string
  mintA: string
  mintB: string
  vaultA: string
  vaultB: string
  lpMint: string
  totalLiquidity: number
  poolAuthorityBump: number
  poolTokenABalance?: number
  poolTokenBBalance?: number
}

interface PoolCreationFormProps {
  tokenA?: string | null
  tokenB?: string | null
  onPoolCreated?: (amm: string, pool: string) => void
  createdPool?: { amm: string | null; pool: string | null }
}

export default function PoolCreationForm({ tokenA, tokenB, onPoolCreated, createdPool }: PoolCreationFormProps) {
  const { publicKey, signTransaction } = useWallet()
  const { connection } = useConnection()
  
  const [isLoading, setIsLoading] = useState(false)
  const [localCreatedPool, setLocalCreatedPool] = useState<{ amm: string | null; pool: string | null }>(createdPool || { amm: null, pool: null })
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null)
  const [initialLiquidity, setInitialLiquidity] = useState('100000')
  const [poolData, setPoolData] = useState<PoolData | null>(null)
  const transactionInProgress = useRef(false)

  // Load pool account data and balances once a pool exists
  useEffect(() => {
    const loadPool = async () => {
      if (!localCreatedPool.pool) return
      try {
        setIsLoading(true)
        const rpc = createRpc()
        const poolAccount = await fetchPool(rpc as any, localCreatedPool.pool as any)

        // Map account data into UI shape
        const basePoolData: PoolData = {
          amm: poolAccount.data.amm as string,
          mintA: poolAccount.data.mintA as string,
          mintB: poolAccount.data.mintB as string,
          vaultA: poolAccount.data.vaultA as string,
          vaultB: poolAccount.data.vaultB as string,
          lpMint: poolAccount.data.lpMint as string,
          totalLiquidity: Number(poolAccount.data.totalLiquidity),
          poolAuthorityBump: poolAccount.data.poolAuthorityBump,
        }

        // Optionally fetch live balances of the pool vaults
        try {
          const [balA, balB] = await Promise.all([
            connection.getTokenAccountBalance(new PublicKey(basePoolData.vaultA)),
            connection.getTokenAccountBalance(new PublicKey(basePoolData.vaultB)),
          ])
          setPoolData({
            ...basePoolData,
            poolTokenABalance: balA?.value?.uiAmount ?? 0,
            poolTokenBBalance: balB?.value?.uiAmount ?? 0,
          })
        } catch {
          setPoolData(basePoolData)
        }
      } catch (e) {
        // If fetch fails, keep previous state
        console.error('Failed to load pool data', e)
      } finally {
        setIsLoading(false)
      }
    }

    loadPool()
  }, [localCreatedPool.pool, connection])

  const handleCreatePool = async () => {
    if (!publicKey || !signTransaction || !tokenA || !tokenB || !initialLiquidity) {
      alert('Please connect wallet and fill in all fields')
      return
    }

    // Prevent multiple simultaneous calls
    if (transactionInProgress.current) {
      console.log('Pool creation already in progress...')
      return
    }

    transactionInProgress.current = true
    setIsLoading(true)
    setTransactionResult(null)

    try {
      // Use Anchor client to build and send txs instead of crafting messages manually
      const client = new AnchorClient(connection, { publicKey, signTransaction } as any)

      const solFeeCollector = publicKey
      const solFee = 50_000_000

      console.log('Creating AMM with mints:', tokenA, tokenB)
      console.log('Token A address:', new PublicKey(tokenA).toString())
      console.log('Token B address:', new PublicKey(tokenB).toString())
      const ammRes = await client.createAmm(new PublicKey(tokenA), new PublicKey(tokenB), solFee, solFeeCollector as any, signTransaction)
      if (!ammRes.success) throw new Error('createAmm failed')

      const poolRes = await client.createPool(new PublicKey(tokenA), new PublicKey(tokenB), signTransaction)
      if (!poolRes.success) throw new Error('createPool failed')

      const cptaRes = await client.createPoolTokenAccounts(new PublicKey(tokenA), new PublicKey(tokenB), poolRes.lpMint as any, poolRes.pool as any, signTransaction)
      if (!cptaRes.success) throw new Error('createPoolTokenAccounts failed')

      const liquidityAmount = Math.floor(parseFloat(initialLiquidity) * 1e6)
      const depRes = await client.depositLiquidity(
        new PublicKey(tokenA),
        new PublicKey(tokenB),
        poolRes.pool as any,
        poolRes.lpMint as any,
        liquidityAmount,
        liquidityAmount,
        new PublicKey(COUNTER_HOOK_PROGRAM_ID),
        signTransaction
      )

      const liquidityResult = { signature: depRes.signature, success: depRes.success, error: depRes.success ? null : 'deposit failed', logs: [] } as TransactionResult

      setTransactionResult(liquidityResult)

      if (liquidityResult.success) {
        const ammAddress = ammRes.amm.toString()
        const poolAddress = poolRes.pool.toString()
        
        setLocalCreatedPool({ amm: ammAddress, pool: poolAddress })
        onPoolCreated?.(ammAddress, poolAddress)
        
        // Pool data fetch can be implemented later via rpc
        
        console.log('Pool created successfully with liquidity:', { ammAddress, poolAddress, liquidityAmount })
      } else {
        console.error('Failed to add liquidity:', liquidityResult.error)
      }
      
    } catch (error) {
      console.error('Error creating pool:', error)
      setTransactionResult({
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
      transactionInProgress.current = false
    }
  }

  // If pool is already created, show the result
  if (localCreatedPool.amm && localCreatedPool.pool) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs">✓</span>
            </div>
            <span className="text-xs font-medium text-green-800">Pool Created</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-green-700">AMM Address:</p>
            <code className="block bg-green-100 p-2 rounded text-xs break-all text-green-800">
              {localCreatedPool.amm}
            </code>
            <p className="text-xs text-green-700">Pool Address:</p>
            <code className="block bg-green-100 p-2 rounded text-xs break-all text-green-800">
              {localCreatedPool.pool}
            </code>
            <p className="text-xs text-green-600 mt-1">
              Initial Liquidity: {initialLiquidity} tokens each (1:1 ratio)
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Pool Creator: {publicKey?.toString()}
            </p>
          </div>
        </div>
        
        {/* Display Pool Data */}
        <PoolDataDisplay 
          poolData={poolData} 
          poolAddress={localCreatedPool.pool} 
          isLoading={isLoading}
        />
      </div>
    )
  }

  return (
          <div className="space-y-2">
        {(!tokenA || !tokenB) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <p className="text-yellow-800 text-xs">
              Mint both tokens first
            </p>
          </div>
        )}

        {/* Show pool data display during loading */}
        {isLoading && (
          <PoolDataDisplay 
            poolData={null} 
            poolAddress={null} 
            isLoading={true}
          />
        )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Initial Liquidity (1:1 ratio)</label>
        <input
          type="number"
          value={initialLiquidity}
          onChange={(e) => setInitialLiquidity(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs"
          placeholder="100000"
          min="0"
          step="0.01"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Amount of each token to add as initial liquidity (e.g., 100000 = 100,000 tokens)
        </p>
      </div>

      <button
        onClick={handleCreatePool}
        disabled={isLoading || !publicKey || !signTransaction || !tokenA || !tokenB || !initialLiquidity || parseFloat(initialLiquidity) <= 0}
        className="w-full bg-purple-600 text-white py-1.5 px-2 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
      >
        {isLoading ? 'Creating Pool...' : 'Create Pool with Liquidity'}
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