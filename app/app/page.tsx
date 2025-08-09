'use client'

import { useState, useCallback, useEffect } from 'react'
import bs58 from 'bs58'
import { createRpc } from './config/rpc-config'
import { setDevWalletSecretInStorage } from './utils/dev-wallet-adapter'
// legacy forms removed from postcard UI

import { WalletConnectButton } from './components/WalletConnectButton'
import Orchestrator from './components/fishing/Orchestrator'
import { StageProvider } from './components/fishing/stage'
import ConsoleOverlay from './components/fishing/ConsoleOverlay'
import AMMFishermanWidget from './widgets/AMMFishermanWidget' 
import { TokenSetup } from './utils/token-setup'
import { AMM_PROGRAM_ID } from './config/program'
import { createSolanaRpc } from '@solana/rpc'

type Connection = any

export default function Home() {
  const [createdTokens, setCreatedTokens] = useState<{
    tokenA: string | null;
    tokenB: string | null;
    userAccountA: string | null;
    userAccountB: string | null;
  }>({ tokenA: null, tokenB: null, userAccountA: null, userAccountB: null })
  
  const [createdPool, setCreatedPool] = useState<{
    amm: string | null;
    pool: string | null;
  }>({ amm: null, pool: null })

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [depositDone, setDepositDone] = useState(false)

  // Simple demo reserves for the AMMFishermanWidget
  const [demoReserves, setDemoReserves] = useState<{ tokenA: number; tokenB: number }>({ tokenA: 6, tokenB: 6 })
  const getReserves = useCallback(() => demoReserves, [demoReserves])

  const [faucetState, setFaucetState] = useState<{
    address: string | null;
    secretKey: string | null;
    signature: string | null;
    isLoading: boolean;
    error: string | null;
  }>({ address: null, secretKey: null, signature: null, isLoading: false, error: null })

  // One-shot swap animation trigger state
  const [swapAnim, setSwapAnim] = useState<{ direction: 'AtoB' | 'BtoA'; triggerId: number } | null>(null)
  const bumpSwapAnim = (direction: 'AtoB' | 'BtoA') => setSwapAnim(prev => ({ direction, triggerId: (prev?.triggerId ?? 0) + 1 }))

  // Live counter display
  const [counters, setCounters] = useState<{ a?: number | null; b?: number | null }>({ a: null, b: null })
  const refreshCounters = useCallback(async () => {
    try {
      if (!depositDone) return
      if (!createdTokens.tokenA && !createdTokens.tokenB) return
      const { web3 } = await import('@coral-xyz/anchor')
      const setup = new TokenSetup((window as any).solanaConnection ?? ({} as any), new web3.PublicKey(AMM_PROGRAM_ID))
      const [a, b] = await Promise.all([
        createdTokens.tokenA ? setup.getTradeCounter(createdTokens.tokenA) : Promise.resolve(null),
        createdTokens.tokenB ? setup.getTradeCounter(createdTokens.tokenB) : Promise.resolve(null),
      ])
      setCounters({ a: a?.totalTransfers ?? 0, b: b?.totalTransfers ?? 0 })
    } catch {
      // ignore
    }
  }, [createdTokens.tokenA, createdTokens.tokenB, depositDone])

  useEffect(() => { refreshCounters() }, [refreshTrigger, createdTokens.tokenA, createdTokens.tokenB])

  const handleTokensSet = useCallback((tokenA: string, tokenB: string, userAccountA: string, userAccountB: string) => {
    setCreatedTokens({ tokenA, tokenB, userAccountA, userAccountB });
    setTimeout(() => setRefreshTrigger(x=>x+1), 500)
  }, []);

  const handlePoolCreated = useCallback((amm: string, pool: string) => {
    setCreatedPool({ amm, pool });
    // Trigger a refresh when pool is created (which includes liquidity)
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Activation flags: all start deactivated and flip to active after success
  const activation = {
    fishA: !!createdTokens.tokenA,
    fishB: !!createdTokens.tokenB,
    fisherman: !!(createdTokens.tokenA && createdTokens.tokenB && createdPool.amm && createdPool.pool),
    pond: !!(createdPool.pool && depositDone),
  };

  return (
    <div className={`min-h-screen bg-white`}>
      {/* Fixed top-right wallet connect */}
      <div className="wallet-fixed">
        <WalletConnectButton />
      </div>
      <main className="px-0 py-0">
        <StageProvider>
          <Orchestrator
            createdTokens={createdTokens}
            onTokensCreated={(a,b,ua,ub)=>{ 
              setCreatedTokens({tokenA:a, tokenB:b, userAccountA:ua, userAccountB:ub});
              console.log('Minted tokens', { a, b });
              setTimeout(() => setRefreshTrigger(x=>x+1), 500);
            }}
            createdPool={createdPool}
            onPoolCreated={(amm,pool)=>{ 
              setCreatedPool({amm,pool});
              console.log('Created AMM/Pool', { amm, pool })
            }}
            onLiquidityAdded={()=>{ 
              setDepositDone(true); 
              setRefreshTrigger(x=>x+1);
              console.log('Deposited initial liquidity')
            }}
          >
            {({ mintA, mintB, createAmmAndPool, depositInitialLiquidity, swapAtoB, isBusy }) => (
              <div className="w-full h-full justify-center flex flex-col items-center" style={{ height: '100vh' }}>
                {/* Centered AMM Fisherman widget */}
                <div className="mt-6 relative" style={{ width: 560, height: 560 }}>
                  <AMMFishermanWidget getReserves={getReserves} activation={activation} swapAnimation={swapAnim} counters={counters} className="pointer-events-none" />

                  {/* Click map overlays, enabled in order */}
                  <div className="overlays overlay-root">
                  {/* 1. Token A (left bucket) */}
                  <button
                    aria-label="Mint Token A"
                    className={`absolute left-[100px] top-[250px] w-[120px] h-[120px] ${(!createdTokens.tokenA ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent z-30 pointer-events-auto`}
                    disabled={!!createdTokens.tokenA || isBusy}
                    onClick={async ()=>{ console.log('Mint Token A…'); await mintA(); console.log('Mint Token A done'); setDemoReserves(r=>({tokenA: r.tokenA+1, tokenB: r.tokenB})); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="1. Mint Token A"
                  />
                  {/* 1. Token B (right bucket) */}
                  <button
                    aria-label="Mint Token B"
                    className={`absolute left-[420px] top-[250px] w-[120px] h-[120px] ${(!createdTokens.tokenB ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent z-30 pointer-events-auto`}
                    disabled={!!createdTokens.tokenB || isBusy}
                    onClick={async ()=>{ console.log('Mint Token B…'); await mintB(); console.log('Mint Token B done'); setDemoReserves(r=>({tokenA: r.tokenA, tokenB: r.tokenB+1})); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="1. Mint Token B"
                  />

                  {/* 2+3. Create AMM & Pool (fisherman area) */}
                  <button
                    aria-label="Create AMM and Pool"
                    className={`absolute left-[260px] top-[140px] w-[160px] h-[160px] ${(createdTokens.tokenA && createdTokens.tokenB && !(createdPool.amm && createdPool.pool) ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent z-30 pointer-events-auto`}
                    disabled={!(createdTokens.tokenA && createdTokens.tokenB) || !!(createdPool.amm && createdPool.pool) || isBusy}
                    onClick={async ()=>{ console.log('Create AMM & Pool…'); await createAmmAndPool(); console.log('Create AMM & Pool done'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="2. Create AMM, 3. Create Pool"
                  />

                  {/* 4. Deposit initial liquidity (pond area) */}
                  <button
                    aria-label="Deposit Liquidity"
                    className={`absolute left-[160px] top-[320px] w-[320px] h-[160px] ${(createdPool.pool && !depositDone ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent z-30 pointer-events-auto`}
                    disabled={!createdPool.pool || depositDone || isBusy}
                    onClick={async ()=>{ console.log('Deposit Liquidity…'); await depositInitialLiquidity(); console.log('Deposit Liquidity done'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="4. Deposit Liquidity"
                  />

                  {/* 5A. Swap A -> B (left after deposit) */}
                  <button
                    aria-label="Swap A to B"
                    className={`absolute left-[100px] top-[250px] w-[120px] h-[120px] ${(depositDone && createdPool.pool && createdPool.amm ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent z-30 pointer-events-auto`}
                    disabled={!depositDone || !createdPool.pool || !createdPool.amm || isBusy}
                    onClick={async ()=>{ console.log('Swap A→B…'); await swapAtoB('AtoB'); console.log('Swap A→B done'); setDemoReserves(r=>({tokenA: Math.max(0,r.tokenA-1), tokenB: r.tokenB+1})); bumpSwapAnim('AtoB'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="5A. Swap A → B"
                  />

                  {/* 5B. Swap B -> A (right after deposit) */}
                  <button
                    aria-label="Swap B to A"
                    className={`absolute left-[420px] top-[250px] w-[120px] h-[120px] ${(depositDone && createdPool.pool && createdPool.amm ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent z-30 pointer-events-auto`}
                    disabled={!depositDone || !createdPool.pool || !createdPool.amm || isBusy}
                    onClick={async ()=>{ console.log('Swap B→A…'); await swapAtoB('BtoA'); console.log('Swap B→A done'); setDemoReserves(r=>({tokenA: r.tokenA+1, tokenB: Math.max(0,r.tokenB-1)})); bumpSwapAnim('BtoA'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="5B. Swap B → A"
                  />
                  </div>

                  {/* Guided clickable tooltips */}
                  <div className="absolute inset-0 z-40 pointer-events-none select-none">
                    {/* Step 1A: Mint Token A */}
                    {!createdTokens.tokenA && (
                      <button
                        className="pointer-events-auto absolute left-[110px] top-[195px] px-2 py-1 text-[11px] rounded-md bg-black text-white shadow-lg hover:bg-gray-900"
                        onClick={async ()=>{ console.log('Guide: Mint Token A'); await mintA(); setDemoReserves(r=>({tokenA: r.tokenA+1, tokenB: r.tokenB})); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                      >
                        1. Click to Mint Token A
                      </button>
                    )}

                    {/* Step 1B: Mint Token B (only after A) */}
                    {createdTokens.tokenA && !createdTokens.tokenB && (
                      <button
                        className="pointer-events-auto absolute left-[430px] top-[195px] px-2 py-1 text-[11px] rounded-md bg-black text-white shadow-lg hover:bg-gray-900"
                        onClick={async ()=>{ console.log('Guide: Mint Token B'); await mintB(); setDemoReserves(r=>({tokenA: r.tokenA, tokenB: r.tokenB+1})); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                      >
                        2. Click to Mint Token B
                      </button>
                    )}

                    {/* Step 2/3: Create AMM + Pool (after both tokens exist) */}
                    {createdTokens.tokenA && createdTokens.tokenB && !(createdPool.amm && createdPool.pool) && (
                      <button
                        className="pointer-events-auto absolute left-[250px] top-[110px] px-2 py-1 text-[11px] rounded-md bg-black text-white shadow-lg hover:bg-gray-900"
                        onClick={async ()=>{ console.log('Guide: Create AMM & Pool'); await createAmmAndPool(); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                      >
                        3. Create AMM + Pool
                      </button>
                    )}

                    {/* Step 4: Deposit initial liquidity (after pool exists) */}
                    {createdPool.pool && !(depositDone) && (
                      <button
                        className="pointer-events-auto absolute left-[180px] top-[300px] px-2 py-1 text-[11px] rounded-md bg-black text-white shadow-lg hover:bg-gray-900"
                        onClick={async ()=>{ console.log('Guide: Deposit Liquidity'); await depositInitialLiquidity(); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                      >
                        4. Deposit Liquidity
                      </button>
                    )}

                    {/* Step 5: Swap (after deposit) */}
                    {depositDone && createdPool.pool && createdPool.amm && (
                      <button
                        className="pointer-events-auto absolute left-[210px] top-[215px] px-2 py-1 text-[11px] rounded-md bg-black text-white shadow-lg hover:bg-gray-900"
                        onClick={async ()=>{ console.log('Guide: Swap A→B'); await swapAtoB('AtoB'); setDemoReserves(r=>({tokenA: Math.max(0,r.tokenA-1), tokenB: r.tokenB+1})); bumpSwapAnim('AtoB'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                      >
                        5. Swap A → B
                      </button>
                    )}
                  </div>
                </div>

                {/* Live console */}
                <ConsoleOverlay />

                {/* Helper text */}
                <div className="mt-3 text-xs text-gray-700">Order: Token A & B → AMM/Pool → Deposit → Swap.</div>
              </div>
            )}
          </Orchestrator>
        </StageProvider>
      </main>
    </div>
  )
} 