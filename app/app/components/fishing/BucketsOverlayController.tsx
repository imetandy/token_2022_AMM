"use client"

import React, { useEffect, useState } from "react"
import Overlays from "./Overlays"
import { useConnection } from "@solana/wallet-adapter-react"
import { TokenSetup } from "../../utils/token-setup"
import { AMM_PROGRAM_ID } from "../../config/program"
import { createRpc } from "../../config/rpc-config"
import { fetchPool } from "../../clients/amm/accounts/pool"
import { web3 } from '@coral-xyz/anchor'

type Props = {
  tokenA?: string | null
  tokenB?: string | null
  createdPool: { amm: string | null; pool: string | null }
  activeDirection?: 'AtoB' | 'BtoA'
  onChangeDirection?: (dir: 'AtoB' | 'BtoA') => void
  onClickFishA?: () => void
  onClickFishB?: () => void
  onClickFisherman?: () => void
  onSwap?: (dir: 'AtoB' | 'BtoA') => void
}

export default function BucketsOverlayController({ tokenA, tokenB, createdPool, activeDirection='AtoB', onChangeDirection, onClickFishA, onClickFishB, onClickFisherman, onSwap }: Props) {
  const { connection } = useConnection()
  const [bucketAFill, setBucketAFill] = useState(0)
  const [bucketBFill, setBucketBFill] = useState(0)
  const [poolStats, setPoolStats] = useState<{ totalLiquidity?: number; vaultA?: string; vaultB?: string } | null>(null)

  // Fetch transfer hook counters (must use COUNTER_HOOK program for PDA)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        if (!tokenA && !tokenB) return
        const setup = new TokenSetup(connection as any, new web3.PublicKey(AMM_PROGRAM_ID))
        if (tokenA) {
          const a = await setup.getTradeCounter(tokenA)
          if (!cancelled) setBucketAFill(Math.min(100, a?.totalTransfers ?? 0))
        }
        if (tokenB) {
          const b = await setup.getTradeCounter(tokenB)
          if (!cancelled) setBucketBFill(Math.min(100, b?.totalTransfers ?? 0))
        }
      } catch {
        // keep defaults
      }
    }
    run()
    const id = setInterval(run, 6000)
    return () => { cancelled = true; clearInterval(id) }
  }, [connection, tokenA, tokenB])

  // Fetch pool stats
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!createdPool.pool) { setPoolStats(null); return }
      try {
        const rpc = createRpc()
        const acct = await fetchPool(rpc as any, createdPool.pool as any)
        if (!cancelled) {
          setPoolStats({
            totalLiquidity: Number(acct.data.totalLiquidity),
            vaultA: acct.data.vaultA as string,
            vaultB: acct.data.vaultB as string,
          })
        }
      } catch {
        if (!cancelled) setPoolStats(null)
      }
    }
    run()
    const id = setInterval(run, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [createdPool.pool])

  return (
    <Overlays
      tokenALabel={tokenA ? "Fish A" : "Fish A"}
      tokenBLabel={tokenB ? "Fish B" : "Fish B"}
      bucketAFill={bucketAFill}
      bucketBFill={bucketBFill}
      activeDirection={activeDirection}
      onChangeDirection={onChangeDirection}
      poolStats={poolStats}
      onClickFishA={onClickFishA}
      onClickFishB={onClickFishB}
      onClickFisherman={onClickFisherman}
      onSwap={onSwap}
    />
  )
}

