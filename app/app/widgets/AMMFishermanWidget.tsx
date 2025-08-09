// src/widgets/AMMFishermanWidget.tsx
import React, { useEffect, useRef, useState } from "react";
import AMMFisherman from "@/components/AMMFisherman";

/**
 * AMMFishermanWidget
 * Generic adapter between your AMM state and the visualization.
 *
 * Props:
 *  - getReserves: () => { tokenA: number; tokenB: number }
 *    A function you provide that returns current reserves
 *    (pull from Redux/Zustand/tRPC/SDK/etc).
 *
 *  - pollMs?: number           // how often to poll for changes (fallback if no events)
 *  - onFrame?: () => void      // optional hook called on each render
 *  - width/height/className    // standard passthrough
 */
export type AMMFishermanWidgetProps = {
  getReserves: () => { tokenA: number; tokenB: number };
  pollMs?: number;
  onFrame?: () => void;
  width?: number | string;
  height?: number | string;
  className?: string;
  /** Activation flags propagated to the scene */
  activation?: {
    fishA?: boolean;
    fishB?: boolean;
    fisherman?: boolean;
    pond?: boolean;
  };
  /** Optional swap animation trigger to play once */
  swapAnimation?: { direction: "AtoB" | "BtoA"; triggerId: number } | null;
  /** Optional bucket counters to display */
  counters?: { a?: number | null; b?: number | null } | null;
};

export default function AMMFishermanWidget({
  getReserves,
  pollMs = 800, // gentle default
  onFrame,
  width = 560,
  height = 560,
  className,
  activation,
  swapAnimation,
  counters,
}: AMMFishermanWidgetProps) {
  const [{ tokenA, tokenB }, setLocal] = useState(getReserves());
  const prev = useRef({ tokenA, tokenB });
  const [animateSwap, setAnimateSwap] = useState(false);

  // Polling fallback if you don't have events
  useEffect(() => {
    let mounted = true;
    const tick = () => {
      const next = getReserves();
      if (!mounted) return;
      const changed = next.tokenA !== prev.current.tokenA || next.tokenB !== prev.current.tokenB;
      if (changed) {
        setLocal(next);
        setAnimateSwap(false); // restart animation
        // next tick -> re-enable for a clean replay
        requestAnimationFrame(() => requestAnimationFrame(() => setAnimateSwap(true)));
        prev.current = next;
      }
    };
    const id = setInterval(tick, pollMs);
    tick(); // initial
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [getReserves, pollMs]);

  useEffect(() => {
    if (onFrame) onFrame();
  });

  return (
    <AMMFisherman
      width={width}
      height={height}
      className={className}
      tokenA={tokenA}
      tokenB={tokenB}
      animateSwap={false}
      // END Corp styling example (dark bg + accent)
      palette={{
        paper: "#ffffff",
        fishA: "#2aa198",
        fishB: "#ff6b4a",
        poolWater: "#3aa1b1",
      }}
      ariaLabel="AMM swap metaphor: fisherman moving tokens between buckets"
      activation={activation}
      swapAnimation={swapAnimation}
      counters={counters}
    />
  );
}

