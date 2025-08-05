'use client'

import { useState, useRef } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletNotConnectedError } from '@solana/wallet-adapter-base'
import { Keypair, PublicKey } from '@solana/web3.js'
import { AMM_PROGRAM_ID, createRpcClient, Token2022Amm } from '../config/program'
import { WalletClientNew } from '../utils/wallet-client-new'
import { TransactionResult } from '../utils/transaction-utils'
import TransactionResultComponent from './TransactionResult'

interface PoolCreationFormProps {
  tokenA?: string | null
  tokenB?: string | null
  onPoolCreated?: (amm: string, pool: string) => void
  createdPool?: { amm: string | null; pool: string | null }
}

export default function PoolCreationForm({ tokenA, tokenB, onPoolCreated, createdPool }: PoolCreationFormProps) {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const { connection } = useConnection()
  
  const [isLoading, setIsLoading] = useState(false)
  const [localCreatedPool, setLocalCreatedPool] = useState<{ amm: string | null; pool: string | null }>(createdPool || { amm: null, pool: null })
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null)
  const [initialLiquidity, setInitialLiquidity] = useState('100000')
  const transactionInProgress = useRef(false)

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
      // Create Wallet client
      const walletClient = new WalletClientNew(connection)
      
      // Generate a unique pool ID
      const poolId = `pool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Derive AMM PDA using pool ID
      const [ammPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), Buffer.from(poolId)],
        new PublicKey(AMM_PROGRAM_ID)
      )
      
      // Derive pool PDA using AMM public key and token mints
      const [poolPda] = PublicKey.findProgramAddressSync(
        [
          ammPda.toBuffer(),
          new PublicKey(tokenA).toBuffer(),
          new PublicKey(tokenB).toBuffer()
        ],
        new PublicKey(AMM_PROGRAM_ID)
      )
      
      // Derive pool authority PDA
      const [poolAuthorityPda] = PublicKey.findProgramAddressSync(
        [
          ammPda.toBuffer(),
          new PublicKey(tokenA).toBuffer(),
          new PublicKey(tokenB).toBuffer(),
          Buffer.from('pool_authority')
        ],
        new PublicKey(AMM_PROGRAM_ID)
      )
      
      // Generate keypair for liquidity mint (this needs to be a signer)
      const mintLiquidityKeypair = Keypair.generate()
      
      // Create SOL fee collector (using wallet as fee collector)
      const solFeeCollector = publicKey
      const solFee = 50_000_000 // 0.05 SOL in lamports

      // Convert liquidity amount to proper format (assuming 6 decimals)
      const liquidityAmount = Math.floor(parseFloat(initialLiquidity) * 1e6)

      // Step 1: Create AMM
      console.log('Creating AMM with pool ID:', poolId)
      const ammResult = await walletClient.createAMM(
        publicKey,
        poolId,
        solFee,
        solFeeCollector,
        signTransaction
      )

      if (!ammResult.success) {
        setTransactionResult(ammResult)
        return
      }

      // Add a small delay to ensure the AMM transaction is fully processed
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 2: Create Pool
      console.log('Creating Pool...')
      const poolResult = await walletClient.createPoolWithLiquidity(
        publicKey,
        ammPda,
        new PublicKey(tokenA),
        new PublicKey(tokenB),
        poolPda, // Use the derived poolPda
        poolAuthorityPda, // Use the derived poolAuthorityPda
        mintLiquidityKeypair,
        liquidityAmount, // Token A amount
        liquidityAmount,  // Token B amount (1:1 ratio)
        signTransaction
      )

      if (!poolResult.success) {
        setTransactionResult(poolResult)
        return
      }

      // Add a small delay to ensure the pool transaction is fully processed
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 3: Add Initial Liquidity (1:1 ratio)
      console.log('Adding initial liquidity...')
      const liquidityResult = await walletClient.depositLiquidity(
        publicKey,
        ammPda,
        poolPda,
        new PublicKey(tokenA),
        new PublicKey(tokenB),
        mintLiquidityKeypair.publicKey, // Pass the liquidity mint account
        liquidityAmount, // Token A amount
        liquidityAmount,  // Token B amount (1:1 ratio)
        signTransaction
      )

      setTransactionResult(liquidityResult)

      if (liquidityResult.success) {
        const ammAddress = ammPda.toString()
        const poolAddress = poolPda.toString()
        
        setLocalCreatedPool({ amm: ammAddress, pool: poolAddress })
        onPoolCreated?.(ammAddress, poolAddress)
        
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