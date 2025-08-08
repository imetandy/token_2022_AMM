import React from 'react'

interface PoolData {
  amm: string
  mintA: string
  mintB: string
  vaultA: string
  vaultB: string
  lpMint: string
  totalLiquidity: number
  poolAuthorityBump: number
  poolTokenABalance?: number
  poolTokenBBalance?: number
}

interface PoolDataDisplayProps {
  poolData: PoolData | null
  poolAddress: string | null
  isLoading?: boolean
}

export default function PoolDataDisplay({ poolData, poolAddress, isLoading = false }: PoolDataDisplayProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pool Data</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
        </div>
      </div>
    )
  }

  if (!poolData || !poolAddress) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pool Data</h3>
        <p className="text-gray-500">No pool data available</p>
      </div>
    )
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Pool Data</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pool Address */}
        <div className="col-span-full">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pool Address</h4>
            <div className="flex items-center justify-between">
              <code className="text-sm text-gray-900 font-mono">{poolAddress}</code>
              <button
                onClick={() => copyToClipboard(poolAddress)}
                className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* AMM Address */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">AMM Address</h4>
          <div className="flex items-center justify-between">
            <code className="text-sm text-gray-900 font-mono">{formatAddress(poolData.amm)}</code>
            <button
              onClick={() => copyToClipboard(poolData.amm)}
              className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Mint A */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Mint A</h4>
          <div className="flex items-center justify-between">
            <code className="text-sm text-gray-900 font-mono">{formatAddress(poolData.mintA)}</code>
            <button
              onClick={() => copyToClipboard(poolData.mintA)}
              className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Mint B */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Mint B</h4>
          <div className="flex items-center justify-between">
            <code className="text-sm text-gray-900 font-mono">{formatAddress(poolData.mintB)}</code>
            <button
              onClick={() => copyToClipboard(poolData.mintB)}
              className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Vault A */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Vault A</h4>
          <div className="flex items-center justify-between">
            <code className="text-sm text-gray-900 font-mono">{formatAddress(poolData.vaultA)}</code>
            <button
              onClick={() => copyToClipboard(poolData.vaultA)}
              className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Vault B */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Vault B</h4>
          <div className="flex items-center justify-between">
            <code className="text-sm text-gray-900 font-mono">{formatAddress(poolData.vaultB)}</code>
            <button
              onClick={() => copyToClipboard(poolData.vaultB)}
              className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        {/* LP Mint */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">LP Mint</h4>
          <div className="flex items-center justify-between">
            <code className="text-sm text-gray-900 font-mono">{formatAddress(poolData.lpMint)}</code>
            <button
              onClick={() => copyToClipboard(poolData.lpMint)}
              className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Pool Authority Bump */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Pool Authority Bump</h4>
          <code className="text-sm text-gray-900 font-mono">{poolData.poolAuthorityBump}</code>
        </div>

        {/* Total Liquidity */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Total Liquidity</h4>
          <code className="text-sm text-gray-900 font-mono">{poolData.totalLiquidity.toLocaleString()}</code>
        </div>

        {/* Pool Token Balances */}
        {poolData.poolTokenABalance !== undefined && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pool Token A Balance</h4>
            <code className="text-sm text-gray-900 font-mono">{poolData.poolTokenABalance.toLocaleString()}</code>
          </div>
        )}

        {poolData.poolTokenBBalance !== undefined && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pool Token B Balance</h4>
            <code className="text-sm text-gray-900 font-mono">{poolData.poolTokenBBalance.toLocaleString()}</code>
          </div>
        )}
      </div>

      {/* Full Addresses Section */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Full Addresses</h4>
        <div className="space-y-2 text-xs">
          <div><span className="font-medium">AMM:</span> <code className="text-gray-600">{poolData.amm}</code></div>
          <div><span className="font-medium">Mint A:</span> <code className="text-gray-600">{poolData.mintA}</code></div>
          <div><span className="font-medium">Mint B:</span> <code className="text-gray-600">{poolData.mintB}</code></div>
          <div><span className="font-medium">Vault A:</span> <code className="text-gray-600">{poolData.vaultA}</code></div>
          <div><span className="font-medium">Vault B:</span> <code className="text-gray-600">{poolData.vaultB}</code></div>
          <div><span className="font-medium">LP Mint:</span> <code className="text-gray-600">{poolData.lpMint}</code></div>
        </div>
      </div>
    </div>
  )
} 