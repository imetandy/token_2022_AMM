"use client"

import { useMemo } from "react"

type SfxType = "click" | "splash" | "reel" | "pluck"

export function useSfx() {
  const ctx = useMemo(() => {
    if (typeof window === "undefined") return null
    const AudioContextImpl = (window as any).AudioContext || (window as any).webkitAudioContext
    try {
      return new AudioContextImpl()
    } catch {
      return null
    }
  }, [])

  const play = (type: SfxType, volume = 0.2) => {
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type === "reel" ? "sawtooth" : type === "pluck" ? "triangle" : "sine"
    let startFreq = 440
    let endFreq = 220
    let dur = 0.2
    switch (type) {
      case "click":
        startFreq = 840
        endFreq = 840
        dur = 0.07
        break
      case "splash":
        startFreq = 520
        endFreq = 180
        dur = 0.35
        break
      case "reel":
        startFreq = 600
        endFreq = 820
        dur = 0.4
        break
      case "pluck":
        startFreq = 660
        endFreq = 330
        dur = 0.18
        break
    }
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + dur)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + dur + 0.02)
  }

  return { play }
}

