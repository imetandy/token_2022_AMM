'use client'

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { web3 as anchorWeb3 } from '@coral-xyz/anchor'
import { TransactionResult } from '../utils/transaction-utils'
import { createRpc } from '../config/rpc-config'
import { createFundedKeypair } from '../utils/devnet-utils'
import { AMM_PROGRAM_ID, COUNTER_HOOK_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '../config/program'
import TransactionResultComponent from './TransactionResult'
import { getDepositLiquidityInstruction } from '../clients/amm/instructions/depositLiquidity'
import {
  createTransactionMessage,
  appendTransactionMessageInstructions,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
} from '@solana/kit'
import { getBestRpcEndpoint } from '../config/rpc-config'

interface LiquidityFormProps {
  tokenA?: string | null
  tokenB?: string | null
  poolAddress?: string | null
  onLiquidityAdded?: () => void
}

export default function LiquidityForm({ tokenA, tokenB, poolAddress, onLiquidityAdded }: LiquidityFormProps) {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const rpc = createRpc()
  
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

      // Create a funded keypair for the payer (for demo purposes)
      console.log('Creating funded keypair for demo...')
      const payerKeypair = await createFundedKeypair()
      console.log('Payer keypair funded:', payerKeypair.publicKey.toString())
      
      // Convert amounts to proper format (assuming 6 decimals)
      const amountA = Math.floor(parseFloat(liquidityData.amountA) * 1e6)
      const amountB = Math.floor(parseFloat(liquidityData.amountB) * 1e6)
      
      // Get pool data to extract actual mint addresses
      const poolAccountInfo = await rpc.getAccountInfo(poolAddress as any).send();
      if (!poolAccountInfo.value) {
        throw new Error('Pool not found');
      }
      const [encoded, encoding] = poolAccountInfo.value.data as unknown as [string, 'base64' | 'base58']
      const poolData = Buffer.from(
        encoding === 'base64' ? encoded : Buffer.from(require('bs58').decode(encoded))
      );
      
      // Extract mint addresses from pool data
      // Pool structure: discriminator(8) + amm(32) + mint_a(32) + mint_b(32) + vault_a(32) + vault_b(32) + lp_mint(32) + total_liquidity(8)
      const poolMintA = new anchorWeb3.PublicKey(poolData.slice(8 + 32, 8 + 32 + 32));
      const poolMintB = new anchorWeb3.PublicKey(poolData.slice(8 + 32 + 32, 8 + 32 + 32 + 32));
      const lpMintAddress = new anchorWeb3.PublicKey(poolData.slice(8 + 32 + 32 + 32 + 32 + 32, 8 + 32 + 32 + 32 + 32 + 32 + 32));

      // Derive AMM ID using actual mint addresses from pool
      const [ammId] = anchorWeb3.PublicKey.findProgramAddressSync([
        Buffer.from('amm'),
        poolMintA.toBuffer(),
        poolMintB.toBuffer(),
      ], new anchorWeb3.PublicKey(AMM_PROGRAM_ID))

      // Derive pool authority PDA
      const [poolAuthorityPk] = anchorWeb3.PublicKey.findProgramAddressSync([
        new anchorWeb3.PublicKey(poolAddress as string).toBuffer(),
        poolMintA.toBuffer(),
        poolMintB.toBuffer(),
        Buffer.from('pool_authority')
      ], new anchorWeb3.PublicKey(AMM_PROGRAM_ID))

      // Derive correct ATAs using Associated Token Program + Token-2022 program
      const [poolAccountA] = anchorWeb3.PublicKey.findProgramAddressSync([
        poolAuthorityPk.toBuffer(),
        new anchorWeb3.PublicKey(TOKEN_2022_PROGRAM_ID).toBuffer(),
        poolMintA.toBuffer(),
      ], new anchorWeb3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID))
      const poolAccountAAddr = poolAccountA.toBase58()

      const [poolAccountB] = anchorWeb3.PublicKey.findProgramAddressSync([
        poolAuthorityPk.toBuffer(),
        new anchorWeb3.PublicKey(TOKEN_2022_PROGRAM_ID).toBuffer(),
        poolMintB.toBuffer(),
      ], new anchorWeb3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID))
      const poolAccountBAddr = poolAccountB.toBase58()

      const [poolLpAccount] = anchorWeb3.PublicKey.findProgramAddressSync([
        poolAuthorityPk.toBuffer(),
        new anchorWeb3.PublicKey(TOKEN_2022_PROGRAM_ID).toBuffer(),
        lpMintAddress.toBuffer(),
      ], new anchorWeb3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID))
      const poolLpAccountAddr = poolLpAccount.toBase58()

      const [userAccountA] = anchorWeb3.PublicKey.findProgramAddressSync([
        payerKeypair.publicKey.toBuffer(),
        new anchorWeb3.PublicKey(TOKEN_2022_PROGRAM_ID).toBuffer(),
        poolMintA.toBuffer(),
      ], new anchorWeb3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID))
      const userAccountAAddr = userAccountA.toBase58()

      const [userAccountB] = anchorWeb3.PublicKey.findProgramAddressSync([
        payerKeypair.publicKey.toBuffer(),
        new anchorWeb3.PublicKey(TOKEN_2022_PROGRAM_ID).toBuffer(),
        poolMintB.toBuffer(),
      ], new anchorWeb3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID))
      const userAccountBAddr = userAccountB.toBase58()

      const [userLpAccount] = anchorWeb3.PublicKey.findProgramAddressSync([
        payerKeypair.publicKey.toBuffer(),
        new anchorWeb3.PublicKey(TOKEN_2022_PROGRAM_ID).toBuffer(),
        lpMintAddress.toBuffer(),
      ], new anchorWeb3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID))
      const userLpAccountAddr = userLpAccount.toBase58()

      console.log('=== LIQUIDITY FORM DEBUG ===');
      console.log('Pool mint A (stored):', poolMintA.toString());
      console.log('Pool mint B (stored):', poolMintB.toString());
      console.log('Original token A:', tokenA);
      console.log('Original token B:', tokenB);
      console.log('AMM ID:', ammId.toString());
      console.log('LP mint address:', lpMintAddress.toString());
      console.log('Using original tokens as instruction parameters');



      // Build deposit liquidity instruction via generated builder
      const ix = getDepositLiquidityInstruction({
        amm: ammId.toBase58(),
        pool: poolAddress,
        poolAuthority: poolAuthorityPk.toBase58(),
        mintA: poolMintA.toBase58(),
        mintB: poolMintB.toBase58(),
        // Explicitly pass ATAs to satisfy on-chain associated constraints
        poolAccountA: poolAccountAAddr,
        poolAccountB: poolAccountBAddr,
        userAccountA: userAccountAAddr,
        userAccountB: userAccountBAddr,
        userLpAccount: userAccountAAddr,
        poolLpAccount: poolLpAccountAddr,
        lpMint: lpMintAddress.toBase58(),
        user: payerKeypair as any,
        // Token programs
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        extraAccountMetaListA: anchorWeb3.PublicKey.findProgramAddressSync([Buffer.from('extra-account-metas'), poolMintA.toBuffer()], new anchorWeb3.PublicKey(COUNTER_HOOK_PROGRAM_ID))[0].toBase58(),
        mintTradeCounterA: anchorWeb3.PublicKey.findProgramAddressSync([Buffer.from('mint-trade-counter'), poolMintA.toBuffer()], new anchorWeb3.PublicKey(COUNTER_HOOK_PROGRAM_ID))[0].toBase58(),
        extraAccountMetaListB: anchorWeb3.PublicKey.findProgramAddressSync([Buffer.from('extra-account-metas'), poolMintB.toBuffer()], new anchorWeb3.PublicKey(COUNTER_HOOK_PROGRAM_ID))[0].toBase58(),
        mintTradeCounterB: anchorWeb3.PublicKey.findProgramAddressSync([Buffer.from('mint-trade-counter'), poolMintB.toBuffer()], new anchorWeb3.PublicKey(COUNTER_HOOK_PROGRAM_ID))[0].toBase58(),
        transferHookProgramA: COUNTER_HOOK_PROGRAM_ID,
        transferHookProgramB: COUNTER_HOOK_PROGRAM_ID,
        amountA: amountA,
        amountB: amountB,
      } as any)

      // Add compute budget instructions to increase CU and price
      const cuLimitIx = anchorWeb3.ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }) as any
      const cuPriceIx = anchorWeb3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }) as any

      const { value: { blockhash, lastValidBlockHeight } } = await rpc.getLatestBlockhash().send()
      const message0 = createTransactionMessage({ version: 0 } as any)
      const message1 = appendTransactionMessageInstructions(message0 as any, [cuLimitIx, cuPriceIx, ix] as any)
      const message2 = setTransactionMessageFeePayerSigner(message1 as any, payerKeypair as any)
      const message3 = setTransactionMessageLifetimeUsingBlockhash(message2 as any, { blockhash, lastValidBlockHeight } as any)
      const signed = await signTransactionMessageWithSigners(message3 as any, { signers: [payerKeypair] } as any)
      const { createSolanaRpcSubscriptions } = await import('@solana/kit')
      const rpcSubscriptions = createSolanaRpcSubscriptions(getBestRpcEndpoint() as any)
      const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any)
      const signature = await sendAndConfirm(signed as any, { commitment: 'confirmed', lastValidBlockHeight } as any)

      setTransactionResult({ signature: typeof signature === 'string' ? signature : '', success: true, error: null } as TransactionResult)
      setLiquidityAdded(true)
      onLiquidityAdded?.()
      console.log('Liquidity added successfully:', signature)
      
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