"use client"

import React from "react"
import { useSfx } from "./useSfx"

type FishermanProps = { isActive?: boolean; onClick?: () => void }
export function Fisherman({ isActive = false, onClick }: FishermanProps) {
  const { play } = useSfx()
  return (
    <div
      className={`actor fisherman ${isActive ? "active" : ""}`}
      onMouseEnter={() => play('reel', 0.1)}
      onClick={onClick}
      role="button"
      aria-label="Fisherman (Create AMM & Pool)"
    >
      <svg width="120" height="160" viewBox="0 0 120 160" className="fisherman-svg" aria-hidden>
        <defs>
          <linearGradient id="kimono" x1="0" x2="1">
            <stop offset="0%" stopColor="#2f3e46"/>
            <stop offset="100%" stopColor="#354f52"/>
          </linearGradient>
        </defs>
        {/* body */}
        <rect x="20" y="40" width="80" height="90" rx="10" fill="url(#kimono)"/>
        {/* head */}
        <circle cx="60" cy="30" r="18" fill="#f1d6b8"/>
        {/* hat */}
        <ellipse cx="60" cy="18" rx="26" ry="8" fill="#b08968"/>
        <rect x="44" y="8" width="32" height="12" rx="2" fill="#7f5539"/>
        {/* rod */}
        <path d="M68 32 C 110 10, 112 80, 84 120" stroke="#525252" strokeWidth="3" fill="none"/>
        {/* line */}
        <path className="rod-line" d="M84 120 C 90 140, 76 150, 76 160" stroke="#3b82f6" strokeWidth="2" fill="none"/>
        {/* bobber */}
        <circle cx="76" cy="160" r="4" fill="#ef4444"/>
      </svg>
    </div>
  )
}

type FishProps = { color?: "red" | "blue"; swim?: boolean; x?: number; y?: number; onClick?: () => void }
export function Fish({ color = "red", swim = false, x = 50, y = 50, onClick }: FishProps) {
  const { play } = useSfx()
  return (
    <div
      className={`actor fish ${color} ${swim ? "swim" : ""}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onMouseEnter={() => play('pluck', 0.06)}
      onClick={onClick}
      role="button"
      aria-label={color === 'red' ? 'Red Fish (Mint Token A)' : 'Blue Fish (Mint Token B)'}
    >
      <svg width="80" height="40" viewBox="0 0 80 40" className="fish-svg" aria-hidden>
        <defs>
          <linearGradient id="fishRed" x1="0" x2="1">
            <stop offset="0%" stopColor="#fecaca"/>
            <stop offset="100%" stopColor="#ef4444"/>
          </linearGradient>
          <linearGradient id="fishBlue" x1="0" x2="1">
            <stop offset="0%" stopColor="#bfdbfe"/>
            <stop offset="100%" stopColor="#3b82f6"/>
          </linearGradient>
        </defs>
        <ellipse cx="34" cy="20" rx="26" ry="12" fill={color === 'red' ? 'url(#fishRed)' : 'url(#fishBlue)'} />
        <polygon points="60,20 78,10 78,30" fill={color === 'red' ? '#b91c1c' : '#1d4ed8'} opacity="0.85"/>
        <circle cx="22" cy="16" r="3" fill="#0f172a"/>
        <ellipse cx="36" cy="22" rx="6" ry="4" fill="rgba(255,255,255,.4)"/>
      </svg>
    </div>
  )
}

type SignProps = { title: string; children?: React.ReactNode }
export function WoodenSign({ title, children }: SignProps) {
  return (
    <div className="wooden-sign">
      <div className="sign-top" />
      <div className="sign-board">
        <div className="sign-title">{title}</div>
        {children}
      </div>
      <div className="sign-post" />
    </div>
  )
}

type BucketProps = { label: string; color?: "red" | "blue"; value?: number }
export function Bucket({ label, color = "red", value = 0 }: BucketProps) {
  return (
    <div className={`bucket ${color}`}>
      <div className="bucket-handle" />
      <div className="bucket-body">
        <div className="bucket-fill" style={{ height: `${Math.min(100, value)}%` }} />
      </div>
      <div className="bucket-label">{label}</div>
    </div>
  )
}

