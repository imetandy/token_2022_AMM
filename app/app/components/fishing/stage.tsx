"use client"

import React, { createContext, useContext, useMemo, useState } from "react"

export type GameStage = "start" | "minted" | "amm" | "pool" | "deposit" | "swap"

type StageContextValue = {
  stage: GameStage
  setStage: (s: GameStage) => void
}

const StageContext = createContext<StageContextValue | null>(null)

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStageState] = useState<GameStage>("start")
  const value = useMemo(() => ({ stage, setStage: setStageState }), [stage])
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>
}

export function useStage() {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error("useStage must be used within StageProvider")
  return ctx
}

