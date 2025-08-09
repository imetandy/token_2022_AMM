"use client"

import React, { ReactNode, useEffect, useRef } from "react"
import { useStage } from "./stage"

type GameSceneProps = {
  header?: ReactNode
  leftPanel?: ReactNode
  centerPanel?: ReactNode
  rightPanel?: ReactNode
  bottomLeft?: ReactNode
  bottomCenter?: ReactNode
  bottomRight?: ReactNode
  overlays?: ReactNode
  onPondClick?: () => void
}

export default function GameScene({
  header,
  leftPanel,
  centerPanel,
  rightPanel,
  bottomLeft,
  bottomCenter,
  bottomRight,
  overlays,
  onPondClick,
}: GameSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const onMove = (e: MouseEvent) => {
      const rect = scene.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      scene.style.setProperty("--parallax-x", String(x))
      scene.style.setProperty("--parallax-y", String(y))
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  const { stage } = useStage()

  return (
    <div ref={sceneRef} className={`game-scene stage-${stage}`}>
      {/* Layers */}
      <div className="layer sky" />
      <div className="layer mountains" />
      <div className="layer trees" />

      {/* Content grid */}
      <div className="scene-grid">
        {/* Canvas inside postcard */}
        <div className="canvas-row">
          <div className="postcard-canvas">
            <div className="pond" onClick={onPondClick}>
              <div className="ripple ripple-1" />
              <div className="ripple ripple-2" />
            </div>
            {/* Free overlays (actors, signs, buckets, etc.) within postcard */}
            <div className="overlays">{overlays}</div>
          </div>
        </div>
        {/* Header / HUD */}
        <div className="hud">{header}</div>

        {/* Top panels */}
        <div className="panel left">{leftPanel}</div>
        <div className="panel center">{centerPanel}</div>
        <div className="panel right">{rightPanel}</div>

        {/* Bottom panels */}
        <div className="panel bottom-left">{bottomLeft}</div>
        <div className="panel bottom-center">{bottomCenter}</div>
        <div className="panel bottom-right">{bottomRight}</div>
      </div>

    </div>
  )
}

