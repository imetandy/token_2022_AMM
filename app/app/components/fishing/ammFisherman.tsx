"use client"

import React, { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * AMMFisherman
 * 2.5D retro Japanese pixel/print style scene rendered as SVG elements.
 * Represents an AMM metaphor: pool = swap pool, fish = tokens, buckets = reserves.
 *
 * Props let you control bucket balances and trigger a subtle swap animation.
 */

export type AMMFishermanProps = {
  width?: number | string; // e.g. 560 or "100%"
  height?: number | string; // e.g. 560 or "auto"
  className?: string;
  /** Two token balances (A=teal, B=vermillion) */
  tokenA?: number;
  tokenB?: number;
  /** Legacy subtle animation flag (unused if swapAnimation provided) */
  animateSwap?: boolean;
  /** Overall palette (max 8 shades). You may override any value. */
  palette?: Partial<ReturnType<typeof defaultPalette>>;
  /** Optional ARIA label */
  ariaLabel?: string;
  /** Activation flags: when false, that component renders greyed out */
  activation?: {
    fishA?: boolean;
    fishB?: boolean;
    fisherman?: boolean;
    pond?: boolean;
  };
  /** Opacity used when deactivated */
  deactivatedOpacity?: number;
  /** Swap animation trigger and direction (one-shot per trigger) */
  swapAnimation?: { direction: "AtoB" | "BtoA"; triggerId: number } | null;
  /** Optional transfer counter values to show on buckets */
  counters?: { a?: number | null; b?: number | null } | null;
};

const defaultPalette = () => ({
  paper: "#0b0b0b", // black-chain backdrop
  ink: "#1b1b1b", // deep outline
  poolRim: "#2a2a2a",
  poolWater: "#335c63", // muted teal
  foam: "#c9d6d1",
  wood: "#7a5a2a",
  woodDark: "#5a431f",
  cloth: "#5b4a3a",
  skin: "#d6c2a8",
  fishA: "#2b8c8f", // teal token
  fishB: "#d45733", // red/orange token
});

export default function AMMFisherman({
  width = 640,
  height = 640,
  className,
  tokenA = 6,
  tokenB = 6,
  animateSwap = false,
  palette: paletteOverride,
  ariaLabel = "AMM fisherman with two token buckets at a small round pool",
  activation,
  deactivatedOpacity = 0.45,
  swapAnimation,
  counters,
}: AMMFishermanProps) {
  const pal = useMemo(() => ({ ...defaultPalette(), ...paletteOverride }), [paletteOverride]);

  const isActive = {
    fishA: activation?.fishA ?? false,
    fishB: activation?.fishB ?? false,
    fisherman: activation?.fisherman ?? false,
    pond: activation?.pond ?? false,
  };

  const deactivatedStyle = (active: boolean) =>
    active
      ? undefined
      : ({ filter: "grayscale(1)", opacity: deactivatedOpacity } as React.CSSProperties);

  // Precomputed key points
  const poolCenter = { x: 320, y: 390 };
  const leftBucketTop = { x: 150, y: 280 };
  const rightBucketTop = { x: 490, y: 280 };

  // Keep within 8ish shades by reusing fills; outlines use one ink color.
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 640 640"
      width={width}
      height={height}
      className={"rounded-2xl shadow-xl " + (className ?? "")}
    >
      {/* Background */}
      <rect x="0" y="0" width="640" height="640" fill={pal.paper} />

      {/* Drop shadow oval for 2.5D feel */}
      <ellipse cx="320" cy="515" rx="220" ry="24" fill="#000" opacity="0.35" />

      {/* Pool base */}
      <g style={deactivatedStyle(isActive.pond)}>
        <ellipse cx="320" cy="400" rx="220" ry="100" fill={pal.poolRim} />
        <motion.ellipse
          cx="320"
          cy="390"
          rx="200"
          ry="85"
          fill={pal.poolWater}
          animate={{ y: [0, -1.2, 0, 1.2, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* water rings (subtle living movement) */}
        <motion.ellipse
          cx="320"
          cy="395"
          rx="48"
          ry="18"
          fill="none"
          stroke={pal.foam}
          strokeWidth={6}
          opacity={0.6}
          style={{ transformOrigin: "320px 395px" }}
          animate={{ scale: [1, 1.03, 1, 0.97, 1], opacity: [0.5, 0.65, 0.55, 0.6, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.ellipse
          cx="320"
          cy="392"
          rx="28"
          ry="10"
          fill="none"
          stroke={pal.foam}
          strokeWidth={5}
          opacity={0.6}
          style={{ transformOrigin: "320px 392px" }}
          animate={{ scale: [1, 0.98, 1.02, 1], opacity: [0.55, 0.65, 0.6, 0.55] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        />
      </g>

      {/* Buckets */}
      <g id="bucket-left" transform="translate(100,250)" style={deactivatedStyle(isActive.fishA)}>
        <ellipse cx="50" cy="180" rx="65" ry="18" fill="#000" opacity={0.35} />
        <path d="M-10,50 h120 v120 a60,24 0 0 1 -120,0 z" fill={pal.wood} stroke={pal.ink} strokeWidth={6} />
        <path d="M-10,50 a60,24 0 0 1 120,0 a60,24 0 0 1 -120,0 z" fill={pal.woodDark} stroke={pal.ink} strokeWidth={6} />
        {/* hoops */}
        <path d="M-10,110 h120" stroke={pal.ink} strokeWidth={6} opacity={0.7} />
        <path d="M-10,150 h120" stroke={pal.ink} strokeWidth={6} opacity={0.7} />
        {/* counter text */}
        {typeof (activation?.fishA ? 1 : 0) !== 'undefined' && (
          <text x="50" y="44" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="14" fill={pal.foam}>
            {(typeof (counters?.a) === 'number' ? counters?.a : (isActive.fishA ? tokenA : 0)) ?? 0}
          </text>
        )}
        {/* Single fish sticking out only when active */}
        {isActive.fishA && (
          <g transform="translate(10,34)">
            <Fish x={30} y={32} fill={pal.fishA} ink={pal.ink} />
          </g>
        )}
      </g>

      <g id="bucket-right" transform="translate(420,250)" style={deactivatedStyle(isActive.fishB)}>
        <ellipse cx="50" cy="180" rx="65" ry="18" fill="#000" opacity={0.35} />
        <path d="M-10,50 h120 v120 a60,24 0 0 1 -120,0 z" fill={pal.wood} stroke={pal.ink} strokeWidth={6} />
        <path d="M-10,50 a60,24 0 0 1 120,0 a60,24 0 0 1 -120,0 z" fill={pal.woodDark} stroke={pal.ink} strokeWidth={6} />
        {/* hoops */}
        <path d="M-10,110 h120" stroke={pal.ink} strokeWidth={6} opacity={0.7} />
        <path d="M-10,150 h120" stroke={pal.ink} strokeWidth={6} opacity={0.7} />
        {/* counter text */}
        {typeof (activation?.fishB ? 1 : 0) !== 'undefined' && (
          <text x="50" y="44" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="14" fill={pal.foam}>
            {(typeof (counters?.b) === 'number' ? counters?.b : (isActive.fishB ? tokenB : 0)) ?? 0}
          </text>
        )}
        {/* Single fish sticking out only when active */}
        {isActive.fishB && (
          <g transform="translate(8,30)">
            <Fish x={38} y={34} fill={pal.fishB} ink={pal.ink} />
          </g>
        )}
      </g>

      {/* Fisherman (stylized) */}
      <g id="fisherman" transform="translate(260,80)" style={deactivatedStyle(isActive.fisherman)}>
        {/* body */}
        <ellipse cx="70" cy="230" rx="70" ry="18" fill="#000" opacity={0.35} />
        <path d="M40,70 q30,-40 60,0 v80 h-60 z" fill={pal.cloth} stroke={pal.ink} strokeWidth={6} />
        <path d="M48,130 h44 v60 h-44 z" fill={pal.cloth} stroke={pal.ink} strokeWidth={6} />
        {/* head */}
        <circle cx="70" cy="58" r="26" fill={pal.skin} stroke={pal.ink} strokeWidth={6} />
        {/* hat */}
        <path d="M30,56 h80 l-18,-16 h-44 z" fill={pal.woodDark} stroke={pal.ink} strokeWidth={6} />
        <path d="M10,62 h120" stroke={pal.ink} strokeWidth={8} />
        {/* boots */}
        <path d="M44,190 h32 v34 h-32 z" fill={pal.ink} />
        <path d="M80,190 h32 v34 h-32 z" fill={pal.ink} />
        {/* simplified rod originating from body */}
        <path d="M90,118 C 170,92 230,110 260,114" stroke={pal.ink} strokeWidth={5} strokeLinecap="round" fill="none" />
        {/* line into pool (to pool center at global 320,390 => group 60,310) */}
        <path d="M260,114 C 220,180 140,240 60,310" stroke={pal.ink} strokeWidth={3.5} fill="none" />
        {/* bobber at line end */}
        <g transform="translate(60,310)">
          <circle r="6" fill="#ffffff" stroke={pal.ink} strokeWidth={1.5} />
          <circle cy="-2" r="3.5" fill="#ef4444" stroke={pal.ink} strokeWidth={1} />
        </g>
      </g>

      {/* fish in pool (hide during swap animation to keep scene clean) */}
      {!swapAnimation && (
        <g style={deactivatedStyle(isActive.pond)}>
          <Fish x={300} y={388} flip fill={pal.fishA} ink={pal.ink} />
          <Fish x={340} y={396} fill={pal.fishB} ink={pal.ink} />
        </g>
      )}

      {/* Directional swap animation: plays once per trigger */}
      {swapAnimation && (
        <g key={swapAnimation.triggerId}>
          {/* bigger splash ripples at pool center on swap */}
          <motion.circle
            cx={poolCenter.x}
            cy={poolCenter.y}
            r={16}
            fill="none"
            stroke={pal.foam}
            strokeWidth={4}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 2.2, opacity: [0.75, 0.45, 0] }}
            transition={{ duration: 1.0, ease: "easeOut", delay: 0.8 }}
            style={deactivatedStyle(isActive.pond)}
          />
          <motion.circle
            cx={poolCenter.x}
            cy={poolCenter.y}
            r={22}
            fill="none"
            stroke={pal.foam}
            strokeWidth={3}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.8, opacity: [0.6, 0.35, 0] }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.95 }}
            style={deactivatedStyle(isActive.pond)}
          />
          {swapAnimation.direction === "AtoB" ? (
            <>
              {/* A (blue/teal) leaves left bucket -> pool with bobbing at end */}
              <motion.g
                initial={{ x: leftBucketTop.x, y: leftBucketTop.y, opacity: 0 }}
                animate={{
                  x: [leftBucketTop.x, 260, 300, poolCenter.x, poolCenter.x],
                  y: [leftBucketTop.y, 240, 330, poolCenter.y - 3, poolCenter.y + 2],
                  opacity: [0.9, 1, 1, 1, 0],
                }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
                style={deactivatedStyle(isActive.pond)}
              >
                <Fish x={0} y={0} fill={pal.fishA} ink={pal.ink} />
              </motion.g>
              {/* then B (red) jumps pool -> right bucket */}
              <motion.g
                initial={{ x: poolCenter.x, y: poolCenter.y, opacity: 0 }}
                animate={{
                  x: [poolCenter.x, 360, 420, rightBucketTop.x],
                  y: [poolCenter.y, 330, 250, rightBucketTop.y],
                  opacity: [0.9, 1, 1, 0],
                }}
                transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                style={deactivatedStyle(isActive.pond)}
              >
                <Fish x={0} y={0} fill={pal.fishB} ink={pal.ink} />
              </motion.g>
            </>
          ) : (
            <>
              {/* B (red) leaves right bucket -> pool with bobbing at end */}
              <motion.g
                initial={{ x: rightBucketTop.x, y: rightBucketTop.y, opacity: 0 }}
                animate={{
                  x: [rightBucketTop.x, 380, 340, poolCenter.x, poolCenter.x],
                  y: [rightBucketTop.y, 240, 330, poolCenter.y - 3, poolCenter.y + 2],
                  opacity: [0.9, 1, 1, 1, 0],
                }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
                style={deactivatedStyle(isActive.pond)}
              >
                <Fish x={0} y={0} fill={pal.fishB} ink={pal.ink} />
              </motion.g>
              {/* then A (blue/teal) jumps pool -> left bucket */}
              <motion.g
                initial={{ x: poolCenter.x, y: poolCenter.y, opacity: 0 }}
                animate={{
                  x: [poolCenter.x, 280, 200, leftBucketTop.x],
                  y: [poolCenter.y, 330, 250, leftBucketTop.y],
                  opacity: [0.9, 1, 1, 0],
                }}
                transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                style={deactivatedStyle(isActive.pond)}
              >
                <Fish x={0} y={0} fill={pal.fishA} ink={pal.ink} />
              </motion.g>
            </>
          )}
        </g>
      )}

      {/* Legend (optional, tiny) */}
      <g transform="translate(20,24)">
        <rect x="0" y="0" width="210" height="38" rx="8" fill={pal.poolRim} opacity={0.6} />
        <circle cx="16" cy="18" r="6" fill={pal.fishA} />
        <text x="28" y="22" fontFamily="ui-monospace, monospace" fontSize="14" fill={pal.foam}>Token A</text>
        <circle cx="110" cy="18" r="6" fill={pal.fishB} />
        <text x="122" y="22" fontFamily="ui-monospace, monospace" fontSize="14" fill={pal.foam}>Token B</text>
      </g>
    </svg>
  );
}

/** Small fish glyph composed of a capsule + tail triangle + eye */
function Fish({ x, y, fill, ink, flip = false }: { x: number; y: number; fill: string; ink: string; flip?: boolean }) {
  const sx = flip ? -1 : 1;
  return (
    <g transform={`translate(${x},${y}) scale(${sx},1)`}>
      <path d="M0,0 h24 a18,10 0 1 1 -24,0 z" fill={fill} stroke={ink} strokeWidth={4} />
      <path d="M-8,10 l-10,-8 v16 z" fill={fill} stroke={ink} strokeWidth={4} />
      <circle cx="16" cy="6" r="2.4" fill={ink} />
    </g>
  );
}

/**
 * Usage:
 * <AMMFisherman
 *   width={560}
 *   height={560}
 *   tokenA={8}
 *   tokenB={5}
 *   animateSwap
 *   palette={{ paper: "#0a0a0a", fishA: "#2aa198", fishB: "#ff6b4a" }}
 * />
 */
