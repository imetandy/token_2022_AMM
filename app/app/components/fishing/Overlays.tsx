"use client"

import React from "react"
import { Fisherman, Fish, WoodenSign, Bucket } from "./Actors"

type OverlaysProps = {
  showFisherman?: boolean
  showFishA?: boolean
  showFishB?: boolean
  tokenALabel?: string
  tokenBLabel?: string
  bucketAFill?: number
  bucketBFill?: number
  activeDirection?: 'AtoB' | 'BtoA'
  onChangeDirection?: (dir: 'AtoB' | 'BtoA') => void
  poolStats?: {
    totalLiquidity?: number
    vaultA?: string
    vaultB?: string
  } | null
  onClickFishA?: () => void
  onClickFishB?: () => void
  onClickFisherman?: () => void
  onSwap?: (dir: 'AtoB' | 'BtoA') => void
}

export default function Overlays({
  showFisherman = true,
  showFishA = true,
  showFishB = true,
  tokenALabel = "Fish A",
  tokenBLabel = "Fish B",
  bucketAFill = 0,
  bucketBFill = 0,
  activeDirection = 'AtoB',
  onChangeDirection,
  poolStats,
  onClickFishA,
  onClickFishB,
  onClickFisherman,
  onSwap,
}: OverlaysProps) {
  return (
    <div className="overlay-root">
      {showFisherman && <Fisherman isActive onClick={onClickFisherman} />}

      {/* Fish representing tokens */}
      {showFishA && <Fish color="red" swim x={42} y={58} onClick={onClickFishA} />}
      {showFishB && <Fish color="blue" swim x={58} y={54} onClick={onClickFishB} />}

      {/* Buckets for transfer hook counters with direction controls */}
      <div className="buckets">
        <div className={`bucket-wrap ${activeDirection==='AtoB' ? 'active' : ''}`} onClick={() => { onChangeDirection?.('AtoB'); onSwap?.('AtoB') }}>
          <Bucket label={tokenALabel} color="red" value={bucketAFill} />
          <div className="bucket-dir iui">bait →</div>
        </div>
        <div className={`bucket-wrap ${activeDirection==='BtoA' ? 'active' : ''}`} onClick={() => { onChangeDirection?.('BtoA'); onSwap?.('BtoA') }}>
          <Bucket label={tokenBLabel} color="blue" value={bucketBFill} />
          <div className="bucket-dir iui">← bait</div>
        </div>
      </div>

      {/* Wooden sign with pool stats */}
      <div className="sign-wrapper">
        <WoodenSign title="Pond Stats">
          {poolStats ? (
            <div className="sign-stats">
              <div>
                Liquidity: <strong>{poolStats.totalLiquidity?.toLocaleString?.() ?? 0}</strong>
              </div>
              <div className="mono">A Vault: {short(poolStats.vaultA)}</div>
              <div className="mono">B Vault: {short(poolStats.vaultB)}</div>
            </div>
          ) : (
            <div className="sign-stats">No pond yet</div>
          )}
        </WoodenSign>
      </div>
    </div>
  )
}

function short(addr?: string) {
  if (!addr) return "—"
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

