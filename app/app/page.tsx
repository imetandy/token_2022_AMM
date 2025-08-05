'use client'

import { useState, useCallback } from 'react'
import TokenCreationForm from './components/TokenCreationForm'
import TradingInterface from './components/TradingInterface'
import PoolCreationForm from './components/PoolCreationForm'
import TokenMintingComponent from './components/TokenMinting'
import { WalletConnectButton } from './components/WalletConnectButton'
import { Connection } from '@solana/web3.js'

export default function Home() {
  const [createdTokens, setCreatedTokens] = useState<{
    tokenA: string | null;
    tokenB: string | null;
  }>({ tokenA: null, tokenB: null })
  
  const [createdPool, setCreatedPool] = useState<{
    amm: string | null;
    pool: string | null;
  }>({ amm: null, pool: null })

  const handleTokensSet = useCallback((tokenA: string, tokenB: string) => {
    setCreatedTokens({ tokenA, tokenB });
  }, []);

  const handlePoolCreated = useCallback((amm: string, pool: string) => {
    setCreatedPool({ amm, pool });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">T</span>
              </div>
              <h1 className="text-base font-bold text-gray-900">
                Token-2022 AMM
              </h1>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                Transfer Hooks
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-xs text-gray-500">
                Devnet
              </div>
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Progress Steps */}
        <div className="mb-4">
          <div className="flex items-center justify-center space-x-2">
            <div className={`flex items-center space-x-1 ${createdTokens.tokenA && createdTokens.tokenB ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${createdTokens.tokenA && createdTokens.tokenB ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {createdTokens.tokenA && createdTokens.tokenB ? '✓' : '1'}
              </div>
              <span className="text-xs font-medium">Create Tokens</span>
            </div>
            <div className={`w-6 h-0.5 ${createdTokens.tokenA && createdTokens.tokenB ? 'bg-green-300' : 'bg-gray-200'}`}></div>
            <div className="flex items-center space-x-1 text-yellow-600">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium bg-yellow-100">
                1.5
              </div>
              <span className="text-xs font-medium">Mint Tokens</span>
            </div>
            <div className="w-6 h-0.5 bg-gray-200"></div>
            <div className={`flex items-center space-x-1 ${createdPool.amm && createdPool.pool ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${createdPool.amm && createdPool.pool ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {createdPool.amm && createdPool.pool ? '✓' : '2'}
              </div>
              <span className="text-xs font-medium">Pool & Liquidity</span>
            </div>
            <div className={`w-6 h-0.5 ${createdPool.amm && createdPool.pool ? 'bg-green-300' : 'bg-gray-200'}`}></div>
            <div className="flex items-center space-x-1 text-gray-400">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium bg-gray-100">
                3
              </div>
              <span className="text-xs font-medium">Trade</span>
            </div>
          </div>
        </div>

        {/* Main Forms Container */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Token Creation Component */}
          <div className="form-container flex-1">
            <div className="form-header">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">1</span>
              </div>
              <div>
                <h3 className="form-title">Create Token-2022</h3>
                <p className="form-subtitle">Create tokens with transfer hooks using counter_hook program</p>
              </div>
            </div>
            
            <TokenCreationForm 
              onTokensSet={handleTokensSet}
              createdTokens={createdTokens}
            />
          </div>

          {/* Token Minting Component */}
          <div className="form-container flex-1">
            <div className="form-header">
              <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 font-bold text-xs">1.5</span>
              </div>
              <div>
                <h3 className="form-title">Mint Test Tokens</h3>
                <p className="form-subtitle">Use CLI to mint tokens to your wallet</p>
              </div>
            </div>
            
            <TokenMintingComponent 
              connection={new Connection('https://api.devnet.solana.com')}
              tokenA={createdTokens.tokenA}
              tokenB={createdTokens.tokenB}
            />
          </div>

          {/* Pool Creation Form */}
          <div className="form-container flex-1">
            <div className="form-header">
              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs">2</span>
              </div>
              <div>
                <h3 className="form-title">Create Pool</h3>
                <p className="form-subtitle">Build liquidity pool with initial liquidity</p>
              </div>
            </div>
            
            <PoolCreationForm 
              tokenA={createdTokens.tokenA}
              tokenB={createdTokens.tokenB}
              onPoolCreated={handlePoolCreated}
              createdPool={createdPool}
            />
          </div>

          {/* Trading Form */}
          <div className="form-container flex-1">
            <div className="form-header">
              <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 font-bold text-xs">3</span>
              </div>
              <div>
                <h3 className="form-title">Trade Tokens</h3>
                <p className="form-subtitle">Swap with transfer hook validation</p>
              </div>
            </div>
            
            <TradingInterface 
              tokenA={createdTokens.tokenA}
              tokenB={createdTokens.tokenB}
              poolAddress={createdPool.pool}
              ammAddress={createdPool.amm}
              canTrade={!!(createdPool.amm && createdPool.pool)}
            />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-4 flex flex-col lg:flex-row gap-4">
          {/* Status Panel */}
          <div className="form-container lg:w-1/3">
            <h3 className="form-title mb-3">Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Wallet Connected</span>
                <span className="text-xs font-medium text-green-600">✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Tokens Created</span>
                <span className={`text-xs font-medium ${createdTokens.tokenA && createdTokens.tokenB ? 'text-green-600' : 'text-gray-400'}`}>
                  {createdTokens.tokenA && createdTokens.tokenB ? '✓' : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Initial Supply Minted</span>
                <span className={`text-xs font-medium ${createdTokens.tokenA && createdTokens.tokenB ? 'text-green-600' : 'text-yellow-600'}`}>
                  {createdTokens.tokenA && createdTokens.tokenB ? '✓' : 'Create Tokens'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Pool Created</span>
                <span className={`text-xs font-medium ${createdPool.amm && createdPool.pool ? 'text-green-600' : 'text-gray-400'}`}>
                  {createdPool.amm && createdPool.pool ? '✓' : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Liquidity Added</span>
                <span className={`text-xs font-medium ${createdPool.amm && createdPool.pool ? 'text-green-600' : 'text-gray-400'}`}>
                  {createdPool.amm && createdPool.pool ? '✓' : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Ready to Trade</span>
                <span className={`text-xs font-medium ${createdPool.amm && createdPool.pool ? 'text-green-600' : 'text-gray-400'}`}>
                  {createdPool.amm && createdPool.pool ? '✓' : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Counter Hook Info */}
          <div className="lg:w-1/3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4">
            <h3 className="form-title text-blue-900 mb-3">Counter Hook Integration</h3>
            <div className="space-y-2 text-xs text-blue-800">
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Tokens created with transfer hooks enabled</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Trade counters automatically initialized</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Counter_hook program tracks all transfers</span>
              </div>
            </div>
          </div>

          {/* Wallet Info */}
          <div className="lg:w-1/3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-4">
            <h3 className="form-title text-green-900 mb-3">Wallet Integration</h3>
            <div className="space-y-2 text-xs text-green-800">
              <div className="flex items-start space-x-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>Your wallet is the authority for all created tokens</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>Pool creation includes initial liquidity at 1:1 ratio</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>All transactions use your connected wallet</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 