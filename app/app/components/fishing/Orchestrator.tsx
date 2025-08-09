"use client"

import React, { useCallback, useState } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { useSfx } from "./useSfx"
import { TokenSetupClient } from "../../utils/token-setup-client"
import { AnchorClient } from "../../utils/anchor-client"
import { COUNTER_HOOK_PROGRAM_ID } from "../../config/program"
import { useStage } from "./stage"
import { web3 } from '@coral-xyz/anchor'

type Props = {
  createdTokens: {
    tokenA: string | null
    tokenB: string | null
    userAccountA: string | null
    userAccountB: string | null
  }
  onTokensCreated: (a: string, b: string, ua: string, ub: string) => void
  createdPool: { amm: string | null; pool: string | null }
  onPoolCreated: (amm: string, pool: string) => void
  onLiquidityAdded?: () => void
  children?: (handlers: {
    mintA: () => Promise<void>
    mintB: () => Promise<void>
    createAmmAndPool: () => Promise<void>
    depositInitialLiquidity: () => Promise<void>
    swapAtoB: (dir: 'AtoB' | 'BtoA') => Promise<void>
    isBusy: boolean
    errorMsg: string | null
  }) => React.ReactNode
}

export default function Orchestrator({ createdTokens, onTokensCreated, createdPool, onPoolCreated, onLiquidityAdded, children }: Props) {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const { connection } = useConnection()
  const { play } = useSfx()
  const { setStage } = useStage()

  const [isBusy, setIsBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lpMintCached, setLpMintCached] = useState<string | null>(null)
  const [direction, setDirection] = useState<'AtoB'|'BtoA'>('AtoB')

  const createBothTokens = useCallback(async () => {
    if (!publicKey || !sendTransaction || !signTransaction) return
    setIsBusy(true)
    play('click')
    try {
      const client = new TokenSetupClient(connection)
      const a = await client.createTokenWithHook(publicKey.toBase58() as any, sendTransaction, 'Red Koi', 'KOI', `https://arweave.net/koi-${Date.now()}`)
      if (!a.success || !a.mintAddress) {
        console.error('Token A failed', a)
        setErrorMsg(a.error || 'Token A failed')
        return
      }
      if (a.signature) console.log('Create Token A tx:', `https://explorer.solana.com/tx/${a.signature}?cluster=devnet`)
      const mintA = a.mintAddress
      const mintAR = await client.mintTokens(publicKey.toBase58() as any, sendTransaction, mintA as any, 10000000000000)
      if (!mintAR.success) {
        console.error('Mint A failed', mintAR)
        setErrorMsg(mintAR.error || 'Mint A failed')
        return
      }
      if (mintAR.signature) console.log('Mint A tx:', `https://explorer.solana.com/tx/${mintAR.signature}?cluster=devnet`)
      const ua = mintAR.userAccountAddress!

      const b = await client.createTokenWithHook(publicKey.toBase58() as any, sendTransaction, 'Blue Koi', 'KOI-B', `https://arweave.net/koib-${Date.now()}`)
      if (!b.success || !b.mintAddress) {
        console.error('Token B failed', b)
        setErrorMsg(b.error || 'Token B failed')
        return
      }
      if (b.signature) console.log('Create Token B tx:', `https://explorer.solana.com/tx/${b.signature}?cluster=devnet`)
      const mintB = b.mintAddress
      const mintBR = await client.mintTokens(publicKey.toBase58() as any, sendTransaction, mintB as any, 10000000000000)
      if (!mintBR.success) {
        console.error('Mint B failed', mintBR)
        setErrorMsg(mintBR.error || 'Mint B failed')
        return
      }
      if (mintBR.signature) console.log('Mint B tx:', `https://explorer.solana.com/tx/${mintBR.signature}?cluster=devnet`)
      const ub = mintBR.userAccountAddress!

      onTokensCreated(mintA, mintB, ua, ub)
      setStage('minted')
      play('pluck')
      setErrorMsg(null)
    } catch (e: any) {
      console.error('Create tokens error', e)
      setErrorMsg(e?.message ?? 'Create tokens failed')
    } finally {
      setIsBusy(false)
    }
  }, [publicKey, sendTransaction, signTransaction, connection, onTokensCreated, play])

  const mintAOnly = useCallback(async () => {
    if (!publicKey || !sendTransaction || !signTransaction) return
    setIsBusy(true)
    play('click')
    try {
      const client = new TokenSetupClient(connection)
      const a = await client.createTokenWithHook(publicKey.toBase58() as any, sendTransaction, 'Red Koi', 'KOI', `https://arweave.net/koi-${Date.now()}`)
      if (!a.success || !a.mintAddress) throw new Error(a.error || 'Token A failed')
      if (a.signature) console.log('Create Token A tx:', `https://explorer.solana.com/tx/${a.signature}?cluster=devnet`)
      const mintA = a.mintAddress
      const mintAR = await client.mintTokens(publicKey.toBase58() as any, sendTransaction, mintA as any, 10000000000000)
      if (!mintAR.success) throw new Error(mintAR.error || 'Mint A failed')
      if (mintAR.signature) console.log('Mint A tx:', `https://explorer.solana.com/tx/${mintAR.signature}?cluster=devnet`)
      const ua = mintAR.userAccountAddress!
      onTokensCreated(mintA, createdTokens.tokenB ?? null as any, ua, createdTokens.userAccountB ?? null as any)
      setStage('minted')
      play('pluck')
      setErrorMsg(null)
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Mint A failed')
    } finally {
      setIsBusy(false)
    }
  }, [publicKey, sendTransaction, signTransaction, connection, onTokensCreated, play, createdTokens])

  const mintBOnly = useCallback(async () => {
    if (!publicKey || !sendTransaction || !signTransaction) return
    setIsBusy(true)
    play('click')
    try {
      const client = new TokenSetupClient(connection)
      const b = await client.createTokenWithHook(publicKey.toBase58() as any, sendTransaction, 'Blue Koi', 'KOI-B', `https://arweave.net/koib-${Date.now()}`)
      if (!b.success || !b.mintAddress) throw new Error(b.error || 'Token B failed')
      if (b.signature) console.log('Create Token B tx:', `https://explorer.solana.com/tx/${b.signature}?cluster=devnet`)
      const mintB = b.mintAddress
      const mintBR = await client.mintTokens(publicKey.toBase58() as any, sendTransaction, mintB as any, 10000000000000)
      if (!mintBR.success) throw new Error(mintBR.error || 'Mint B failed')
      if (mintBR.signature) console.log('Mint B tx:', `https://explorer.solana.com/tx/${mintBR.signature}?cluster=devnet`)
      const ub = mintBR.userAccountAddress!
      onTokensCreated(createdTokens.tokenA ?? null as any, mintB, createdTokens.userAccountA ?? null as any, ub)
      setStage('minted')
      play('pluck')
      setErrorMsg(null)
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Mint B failed')
    } finally {
      setIsBusy(false)
    }
  }, [publicKey, sendTransaction, signTransaction, connection, onTokensCreated, play, createdTokens])

  const createAmmAndPool = useCallback(async () => {
    if (!publicKey || !signTransaction || !createdTokens.tokenA || !createdTokens.tokenB) return
    setIsBusy(true)
    play('click')
    try {
      const client = new AnchorClient(connection, { publicKey, signTransaction } as any)
      const solFeeCollector = publicKey
      const solFee = 50_000_000
      const ammRes = await client.createAmm(new web3.PublicKey(createdTokens.tokenA as string), new web3.PublicKey(createdTokens.tokenB as string), solFee, solFeeCollector as any, signTransaction)
      if (!ammRes.success) {
        setErrorMsg('createAmm failed')
        return
      }
      if (ammRes.signature) console.log('Create AMM tx:', `https://explorer.solana.com/tx/${ammRes.signature}?cluster=devnet`)
      setStage('amm')

      const poolRes = await client.createPool(new web3.PublicKey(createdTokens.tokenA as string), new web3.PublicKey(createdTokens.tokenB as string), signTransaction)
      if (!poolRes.success) {
        setErrorMsg('createPool failed')
        return
      }
      if (poolRes.signature) console.log('Create Pool tx:', `https://explorer.solana.com/tx/${poolRes.signature}?cluster=devnet`)
      // Create pool token accounts so pool vaults are set in state
      const cpta = await client.createPoolTokenAccounts(new web3.PublicKey(createdTokens.tokenA as string), new web3.PublicKey(createdTokens.tokenB as string), poolRes.lpMint as any, poolRes.pool as any, signTransaction)
      if (!cpta.success) {
        setErrorMsg('createPoolTokenAccounts failed')
        return
      }
      if (cpta.signature) console.log('Create Pool Token Accounts tx:', `https://explorer.solana.com/tx/${cpta.signature}?cluster=devnet`)

      setLpMintCached(poolRes.lpMint.toBase58())
      onPoolCreated(ammRes.amm.toString(), poolRes.pool.toString())
      setStage('pool')
      play('reel')
      setErrorMsg(null)
    } catch (e: any) {
      console.error('Create AMM/Pool error', e)
      setErrorMsg(e?.message ?? 'Create AMM/Pool failed')
    } finally {
      setIsBusy(false)
    }
  }, [publicKey, signTransaction, createdTokens.tokenA, createdTokens.tokenB, connection, onPoolCreated, play])

  const depositInitialLiquidity = useCallback(async () => {
    if (!publicKey || !signTransaction || !createdTokens.tokenA || !createdTokens.tokenB || !createdPool.pool) return
    setIsBusy(true)
    play('splash')
    try {
      const client = new AnchorClient(connection, { publicKey, signTransaction } as any)
      const liquidityAmount = Math.floor(100000 * 1e6)
      // Use cached lpMint captured during pool creation
      const lpMintPk = new web3.PublicKey(lpMintCached as string)
      const depRes = await client.depositLiquidity(
        new web3.PublicKey(createdTokens.tokenA as string),
        new web3.PublicKey(createdTokens.tokenB as string),
        new web3.PublicKey(createdPool.pool as string),
        lpMintPk,
        liquidityAmount,
        liquidityAmount,
        new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID),
        signTransaction
      )
      if (!depRes.success) {
        setErrorMsg('deposit failed')
        return
      }
      if (depRes.signature) console.log('Deposit Liquidity tx:', `https://explorer.solana.com/tx/${depRes.signature}?cluster=devnet`)
      onLiquidityAdded?.()
      // small delay then trigger counter refresh via parent
      setStage('deposit')
      setErrorMsg(null)
    } catch (e: any) {
      console.error('Deposit error', e)
      setErrorMsg(e?.message ?? 'Deposit failed')
    } finally {
      setIsBusy(false)
    }
  }, [publicKey, signTransaction, createdTokens.tokenA, createdTokens.tokenB, createdPool.pool, lpMintCached, connection, onLiquidityAdded, play])

  const swapAtoB = useCallback(async (dir: 'AtoB'|'BtoA' = 'AtoB') => {
    if (!publicKey || !signTransaction || !createdTokens.tokenA || !createdTokens.tokenB || !createdPool.pool || !createdPool.amm) return
    setIsBusy(true)
    play('pluck')
    try {
      const client = new AnchorClient(connection, { publicKey, signTransaction } as any)
      const inMint = dir==='AtoB' ? createdTokens.tokenA : createdTokens.tokenB
      const outMint = dir==='AtoB' ? createdTokens.tokenB : createdTokens.tokenA
      const mintAInfo = await connection.getParsedAccountInfo(new web3.PublicKey(inMint as string))
      const decimals = (mintAInfo?.value as any)?.data?.parsed?.info?.decimals ?? 6
      const scale = Math.pow(10, decimals)
      const inputAmount = Math.floor(500 * scale)
      const minOutputAmount = Math.floor(inputAmount * 0.95)
      const res = await client.swapTokens(
        new web3.PublicKey(createdPool.amm as string),
        new web3.PublicKey(createdPool.pool as string),
        new web3.PublicKey(createdTokens.tokenA as string),
        new web3.PublicKey(createdTokens.tokenB as string),
        dir==='AtoB',
        inputAmount,
        minOutputAmount,
        new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID),
        new web3.PublicKey(COUNTER_HOOK_PROGRAM_ID),
        signTransaction
      )
      if (!res.success) throw new Error('swap failed')
      if (res.signature) console.log(`Swap ${dir==='AtoB'?'A→B':'B→A'} tx:`, `https://explorer.solana.com/tx/${res.signature}?cluster=devnet`)
      play('splash')
      setStage('swap')
    } finally {
      setIsBusy(false)
    }
  }, [publicKey, signTransaction, createdTokens, createdPool, connection, play])

  if (children) {
    return (
      <>
        {children({
          mintA: mintAOnly,
          mintB: mintBOnly,
          createAmmAndPool,
          depositInitialLiquidity,
          swapAtoB: async (d) => swapAtoB(d),
          isBusy,
          errorMsg,
        })}
      </>
    )
  }

  return (
    <div className="orchestrator">
      {errorMsg && (
        <div style={{background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', padding:'8px 10px', borderRadius:8}}>
          {errorMsg}
        </div>
      )}
      <button className="game-btn" onClick={createBothTokens} disabled={isBusy || !!(createdTokens.tokenA && createdTokens.tokenB)}>
        1. Create Fish (Tokens)
      </button>
      <button className="game-btn" onClick={createAmmAndPool} disabled={isBusy || !(createdTokens.tokenA && createdTokens.tokenB) || !!(createdPool.amm && createdPool.pool)}>
        2. Create Fisherman & Pond (AMM/Pool)
      </button>
      <button className="game-btn" onClick={depositInitialLiquidity} disabled={isBusy || !(createdPool.pool && lpMintCached)}>
        3. Add Fish to Pond (Deposit)
      </button>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <button className="game-btn" onClick={()=>{setDirection('AtoB'); swapAtoB('AtoB')}} disabled={isBusy || !(createdPool.pool && createdPool.amm)}>
          4A. Red → Blue
        </button>
        <button className="game-btn" onClick={()=>{setDirection('BtoA'); swapAtoB('BtoA')}} disabled={isBusy || !(createdPool.pool && createdPool.amm)}>
          4B. Blue → Red
        </button>
      </div>
    </div>
  )
}

