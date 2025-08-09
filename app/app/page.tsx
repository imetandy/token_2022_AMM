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
import AMMFishermanWidget from '@/widgets/AMMFishermanWidget'
import { TokenSetup } from './utils/token-setup'
import { AMM_PROGRAM_ID } from './config/program'
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
  }, [createdTokens.tokenA, createdTokens.tokenB])

  useEffect(() => { refreshCounters() }, [refreshTrigger, createdTokens.tokenA, createdTokens.tokenB])

  const handleDevnetFaucet = useCallback(async () => {
    try {
      setFaucetState((s) => ({ ...s, isLoading: true, error: null }))
      const { generateKeyPairSigner } = await import('@solana/kit')
      const kp: any = await generateKeyPairSigner()
      const address: string = kp.address ?? kp.publicKey?.toBase58()
      const secretKey: string = kp.secretKey ? bs58.encode(kp.secretKey) : ''
      setFaucetState((s) => ({ ...s, address, secretKey }))

      const lamports = BigInt('5000000000') as any
      let sig: string
      try {
        // Attempt with configured RPC (may be a provider that blocks airdrops)
        const rpc = createRpc()
        sig = (await rpc.requestAirdrop(address as any, lamports as any).send()) as any
        for (let i = 0; i < 15; i++) {
          const statuses = await rpc.getSignatureStatuses([sig as any]).send()
          const status = statuses.value?.[0]
          if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
            setFaucetState((s) => ({ ...s, signature: sig, isLoading: false }))
            return
          }
          await new Promise((r) => setTimeout(r, 1200))
        }
      } catch (err) {
        // Fallback to public devnet endpoint
        const { createSolanaRpc } = await import('@solana/kit')
        const fallbackRpc = createSolanaRpc('https://api.devnet.solana.com')
        sig = (await fallbackRpc.requestAirdrop(address as any, lamports as any).send()) as any
        for (let i = 0; i < 15; i++) {
          const statuses = await fallbackRpc.getSignatureStatuses([sig as any]).send()
          const status = statuses.value?.[0]
          if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
            setFaucetState((s) => ({ ...s, signature: sig, isLoading: false }))
            return
          }
          await new Promise((r) => setTimeout(r, 1200))
        }
      }

      setFaucetState((s) => ({ ...s, signature: sig, isLoading: false }))
    } catch (e: any) {
      setFaucetState((s) => ({ ...s, isLoading: false, error: e?.message ?? 'Faucet failed' }))
    }
  }, [])

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
            {({ mintA, mintB, createAmmAndPool, depositInitialLiquidity, swapAtoB, isBusy, errorMsg }) => (
              <div className="w-full flex flex-col items-center">
                {/* Controls header with faucet */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleDevnetFaucet}
                    disabled={faucetState.isLoading}
                    className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    title="Generate a new devnet keypair and airdrop 5 SOL"
                  >
                    {faucetState.isLoading ? 'Airdropping 5 SOL...' : 'Devnet Faucet (5 SOL)'}
                  </button>
                  {faucetState.secretKey && (
                    <button
                      onClick={() => {
                        setDevWalletSecretInStorage(faucetState.secretKey!)
                        if (typeof window !== 'undefined') {
                          try { window.localStorage.setItem('@solana/wallet-adapter-react:walletName', 'Dev Keypair') } catch {}
                          window.location.reload()
                        }
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-800"
                      title="Use the faucet keypair as the app's dev wallet"
                    >
                      Use As Dev Wallet
                    </button>
                  )}
                  {errorMsg && <span className="text-xs text-red-700 ml-2">{errorMsg}</span>}
                </div>

                {/* Centered AMM Fisherman widget */}
                <div className="mt-6 relative" style={{ width: 560, height: 560 }}>
                  <AMMFishermanWidget getReserves={getReserves} activation={activation} swapAnimation={swapAnim} counters={counters} />

                  {/* Click map overlays, enabled in order */}
                  {/* 1. Token A (left bucket) */}
                  <button
                    aria-label="Mint Token A"
                    className={`absolute left-[100px] top-[250px] w-[120px] h-[120px] ${(!createdTokens.tokenA ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent`}
                    disabled={!!createdTokens.tokenA || isBusy}
                    onClick={async ()=>{ console.log('Mint Token A…'); await mintA(); console.log('Mint Token A done'); setDemoReserves(r=>({tokenA: r.tokenA+1, tokenB: r.tokenB})); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="1. Mint Token A"
                  />
                  {/* 1. Token B (right bucket) */}
                  <button
                    aria-label="Mint Token B"
                    className={`absolute left-[420px] top-[250px] w-[120px] h-[120px] ${(!createdTokens.tokenB ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent`}
                    disabled={!!createdTokens.tokenB || isBusy}
                    onClick={async ()=>{ console.log('Mint Token B…'); await mintB(); console.log('Mint Token B done'); setDemoReserves(r=>({tokenA: r.tokenA, tokenB: r.tokenB+1})); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="1. Mint Token B"
                  />

                  {/* 2+3. Create AMM & Pool (fisherman area) */}
                  <button
                    aria-label="Create AMM and Pool"
                    className={`absolute left-[260px] top-[140px] w-[160px] h-[160px] ${(createdTokens.tokenA && createdTokens.tokenB && !(createdPool.amm && createdPool.pool) ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent`}
                    disabled={!(createdTokens.tokenA && createdTokens.tokenB) || !!(createdPool.amm && createdPool.pool) || isBusy}
                    onClick={async ()=>{ console.log('Create AMM & Pool…'); await createAmmAndPool(); console.log('Create AMM & Pool done'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="2. Create AMM, 3. Create Pool"
                  />

                  {/* 4. Deposit initial liquidity (pond area) */}
                  <button
                    aria-label="Deposit Liquidity"
                    className={`absolute left-[160px] top-[320px] w-[320px] h-[160px] ${(createdPool.pool && !depositDone ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent`}
                    disabled={!createdPool.pool || depositDone || isBusy}
                    onClick={async ()=>{ console.log('Deposit Liquidity…'); await depositInitialLiquidity(); console.log('Deposit Liquidity done'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="4. Deposit Liquidity"
                  />

                  {/* 5A. Swap A -> B (left after deposit) */}
                  <button
                    aria-label="Swap A to B"
                    className={`absolute left-[100px] top-[250px] w-[120px] h-[120px] ${(depositDone && createdPool.pool && createdPool.amm ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent`}
                    disabled={!depositDone || !createdPool.pool || !createdPool.amm || isBusy}
                    onClick={async ()=>{ console.log('Swap A→B…'); await swapAtoB('AtoB'); console.log('Swap A→B done'); setDemoReserves(r=>({tokenA: Math.max(0,r.tokenA-1), tokenB: r.tokenB+1})); bumpSwapAnim('AtoB'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="5A. Swap A → B"
                  />

                  {/* 5B. Swap B -> A (right after deposit) */}
                  <button
                    aria-label="Swap B to A"
                    className={`absolute left-[420px] top-[250px] w-[120px] h-[120px] ${(depositDone && createdPool.pool && createdPool.amm ? 'cursor-pointer' : 'pointer-events-none')} bg-transparent`}
                    disabled={!depositDone || !createdPool.pool || !createdPool.amm || isBusy}
                    onClick={async ()=>{ console.log('Swap B→A…'); await swapAtoB('BtoA'); console.log('Swap B→A done'); setDemoReserves(r=>({tokenA: r.tokenA+1, tokenB: Math.max(0,r.tokenB-1)})); bumpSwapAnim('BtoA'); setTimeout(()=>setRefreshTrigger(x=>x+1), 800) }}
                    title="5B. Swap B → A"
                  />
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