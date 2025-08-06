'use client'

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
  import { PublicKey } from '@solana/web3.js'
import { TransactionResult } from '../utils/transaction-utils'
import { createFundedKeypair } from '../utils/devnet-utils'
import { AMM_PROGRAM_ID, COUNTER_HOOK_PROGRAM_ID } from '../config/program'
import TransactionResultComponent from './TransactionResult'
import { WalletClientNew } from '../utils/wallet-client-new'

interface LiquidityFormProps {
  tokenA?: string | null
  tokenB?: string | null
  poolAddress?: string | null
  onLiquidityAdded?: () => void
}

export default function LiquidityForm({ tokenA, tokenB, poolAddress, onLiquidityAdded }: LiquidityFormProps) {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  
  const [liquidityData, setLiquidityData] = useState({
    amountA: '1000',
    amountB: '1000',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null)
  const [liquidityAdded, setLiquidityAdded] = useState(false)

  const handleAddLiquidity = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first')
      return
    }
    
    if (!tokenA || !tokenB || !poolAddress) {
      alert('Please create tokens and pool first')
      return
    }

    if (!liquidityData.amountA || !liquidityData.amountB || 
        parseFloat(liquidityData.amountA) <= 0 || parseFloat(liquidityData.amountB) <= 0) {
      alert('Please enter valid amounts')
      return
    }

    setIsLoading(true)
    setTransactionResult(null)

    try {
      console.log('Adding liquidity:', liquidityData)
      console.log('Wallet address:', publicKey.toString())
      console.log('Pool address:', poolAddress)
      console.log('Token A:', tokenA)
      console.log('Token B:', tokenB)

      // Create AMM client
      const ammClient = new WalletClientNew(connection)
      
      // Create a funded keypair for the payer (for demo purposes)
      console.log('Creating funded keypair for demo...')
      const payerKeypair = await createFundedKeypair()
      console.log('Payer keypair funded:', payerKeypair.publicKey.toString())
      
      // Convert amounts to proper format (assuming 6 decimals)
      const amountA = Math.floor(parseFloat(liquidityData.amountA) * 1e6)
      const amountB = Math.floor(parseFloat(liquidityData.amountB) * 1e6)
      
      // Get pool data to extract actual mint addresses
      const poolAccountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
      if (!poolAccountInfo) {
        throw new Error('Pool not found');
      }
      const poolData = poolAccountInfo.data;
      
      // Extract mint addresses from pool data
      // Pool structure: discriminator(8) + amm(32) + mint_a(32) + mint_b(32) + vault_a(32) + vault_b(32) + lp_mint(32) + total_liquidity(8)
      const poolMintA = new PublicKey(poolData.slice(8 + 32, 8 + 32 + 32));
      const poolMintB = new PublicKey(poolData.slice(8 + 32 + 32, 8 + 32 + 32 + 32));
      const lpMintAddress = new PublicKey(poolData.slice(8 + 32 + 32 + 32 + 32 + 32, 8 + 32 + 32 + 32 + 32 + 32 + 32));

      // Derive AMM ID using actual mint addresses from pool
      const [ammId] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm'),
          poolMintA.toBuffer(),
          poolMintB.toBuffer()
        ],
        new PublicKey(AMM_PROGRAM_ID)
      );

      console.log('=== LIQUIDITY FORM DEBUG ===');
      console.log('Pool mint A (stored):', poolMintA.toString());
      console.log('Pool mint B (stored):', poolMintB.toString());
      console.log('Original token A:', tokenA);
      console.log('Original token B:', tokenB);
      console.log('AMM ID:', ammId.toString());
      console.log('LP mint address:', lpMintAddress.toString());
      console.log('Using original tokens as instruction parameters');



      // Add liquidity
      // Use the pool's stored mint addresses as instruction parameters (mint_a, mint_b)
      // The Rust program expects the instruction parameters to match the pool's stored mints
      const result = await ammClient.depositLiquidity(
        payerKeypair.publicKey,
        ammId, // Pass the AMM ID
        new PublicKey(poolAddress),
        poolMintA, // Use pool's stored mint A
        poolMintB, // Use pool's stored mint B
        lpMintAddress,
        BigInt(amountA),
        BigInt(amountB),
        new PublicKey(COUNTER_HOOK_PROGRAM_ID), // Transfer hook program ID for mint A
        new PublicKey(COUNTER_HOOK_PROGRAM_ID), // Transfer hook program ID for mint B
        async (transaction) => {
          // For demo purposes, we're using a funded keypair, so we don't need to sign
          return transaction
        }
      )

      setTransactionResult(result)

      if (result.success) {
        setLiquidityAdded(true)
        onLiquidityAdded?.()
        console.log('Liquidity added successfully:', result.signature)
      } else {
        console.error('Failed to add liquidity:', result.error)
      }
      
    } catch (error) {
      console.error('Error adding liquidity:', error)
      setTransactionResult({
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Check if we can add liquidity
  const canAddLiquidity = publicKey && tokenA && tokenB && poolAddress && !liquidityAdded

  if (liquidityAdded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-xs">✓</span>
          </div>
          <span className="text-xs font-medium text-green-800">Liquidity Added</span>
        </div>
        <p className="text-xs text-green-700">
          Pool is now ready for trading!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!canAddLiquidity && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
          <p className="text-yellow-800 text-xs">
            Create tokens and pool first
          </p>
        </div>
      )}

      {/* Liquidity Interface */}
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Token 1 Amount</label>
          <input
            type="number"
            value={liquidityData.amountA}
            onChange={(e) => setLiquidityData({ ...liquidityData, amountA: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs"
            placeholder="1000"
            min="0"
            step="0.01"
            required
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Token 2 Amount</label>
          <input
            type="number"
            value={liquidityData.amountB}
            onChange={(e) => setLiquidityData({ ...liquidityData, amountB: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs"
            placeholder="1000"
            min="0"
            step="0.01"
            required
          />
        </div>
      </div>

      {/* Add Liquidity */}
      <button
        onClick={handleAddLiquidity}
        disabled={isLoading || !canAddLiquidity}
        className="w-full bg-green-600 text-white py-1.5 px-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
      >
        {isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
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