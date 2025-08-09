"use client"

import React, { useMemo } from "react"
import TokenCreationForm from "../TokenCreationForm"
import PoolCreationForm from "../PoolCreationForm"
import TradingInterface from "../TradingInterface"
import BalanceDisplay from "../BalanceDisplay"

type FishingWorkflowProps = {
  createdTokens: {
    tokenA: string | null
    tokenB: string | null
    userAccountA: string | null
    userAccountB: string | null
  }
  setCreatedTokens: (t: FishingWorkflowProps["createdTokens"]) => void
  createdPool: { amm: string | null; pool: string | null }
  setCreatedPool: (p: { amm: string | null; pool: string | null }) => void
  refreshTrigger: number
  setRefreshTrigger: (n: number) => void
}

export default function FishingWorkflow({
  createdTokens,
  setCreatedTokens,
  createdPool,
  setCreatedPool,
  refreshTrigger,
  setRefreshTrigger,
}: FishingWorkflowProps) {
  const canTrade = !!(createdPool.amm && createdPool.pool)

  const header = (
    <div className="hud-inner">
      <div className="badge">Devnet</div>
      <div className="title">Yokai Fisher AMM</div>
      <div className="subtitle">Token-2022 • Transfer Hooks</div>
    </div>
  )

  const left = (
    <div className="panel-card">
      <div className="panel-title">Mint Fish A & B</div>
      <TokenCreationForm
        onTokensSet={(a, b, ua, ub) => setCreatedTokens({ tokenA: a, tokenB: b, userAccountA: ua, userAccountB: ub })}
        createdTokens={createdTokens}
      />
    </div>
  )

  const center = (
    <div className="panel-card">
      <div className="panel-title">Create Pond (Pool)</div>
      <PoolCreationForm
        tokenA={createdTokens.tokenA}
        tokenB={createdTokens.tokenB}
        createdPool={createdPool}
        onPoolCreated={(amm, pool) => {
          setCreatedPool({ amm, pool })
          setRefreshTrigger(refreshTrigger + 1)
        }}
      />
    </div>
  )

  const right = (
    <div className="panel-card">
      <div className="panel-title">Trade (Cast Line)</div>
      <TradingInterface
        tokenA={createdTokens.tokenA}
        tokenB={createdTokens.tokenB}
        poolAddress={createdPool.pool}
        ammAddress={createdPool.amm}
        canTrade={canTrade}
        refreshTrigger={refreshTrigger}
      />
    </div>
  )

  const bottomCenter = (
    <div className="panel-card translucent">
      <div className="panel-title">Status</div>
      <div className="status-grid">
        <div className={`status ${createdTokens.tokenA && createdTokens.tokenB ? "ok" : ""}`}>Fish minted</div>
        <div className={`status ${createdPool.amm && createdPool.pool ? "ok" : ""}`}>Pond ready</div>
        <div className={`status ${canTrade ? "ok" : ""}`}>Ready to trade</div>
      </div>
    </div>
  )

  return (
    <div className="workflow-grid">
      <div className="workflow-header">{header}</div>
      <div className="workflow-left">{left}</div>
      <div className="workflow-center">{center}</div>
      <div className="workflow-right">{right}</div>
      <div className="workflow-bottom-center">{bottomCenter}</div>
    </div>
  )
}

