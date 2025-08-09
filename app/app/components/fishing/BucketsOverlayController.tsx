"use client"

import React, { useEffect, useState } from "react"
import Overlays from "./Overlays"
import { Buffer } from 'buffer'
import { useConnection } from "@solana/wallet-adapter-react"
import { TokenSetup } from "../../utils/token-setup"
import { AMM_PROGRAM_ID } from "../../config/program"
import { createRpc } from "../../config/rpc-config"
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
        const info = await rpc.getAccountInfo(createdPool.pool as any).send()
        if (!info.value) { if (!cancelled) setPoolStats(null); return }
        const [encoded, encoding] = info.value.data as unknown as [string, 'base64' | 'base58']
        const data = Buffer.from(encoding === 'base64' ? encoded : Buffer.from(require('bs58').decode(encoded)))
        let off = 8
        const readPk = () => { const pk = new web3.PublicKey(data.slice(off, off+32)); off += 32; return pk }
        /* const amm = */ readPk()
        /* const mintA = */ readPk()
        /* const mintB = */ readPk()
        const vaultA = readPk()
        const vaultB = readPk()
        /* const lpMint = */ readPk()
        const totalLiquidity = Number(data.readBigUInt64LE(off))
        if (!cancelled) {
          setPoolStats({
            totalLiquidity,
            vaultA: vaultA.toBase58(),
            vaultB: vaultB.toBase58(),
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

