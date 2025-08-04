'use client'

import { useState } from 'react'
import type { TransactionResult } from '../utils/transaction-utils'
import { getSolanaExplorerUrl, formatLogs, extractProgramLogs, shortenAddress } from '../utils/transaction-utils'
import { PROGRAM_ID } from '../config/program'

interface TransactionResultProps {
  result: TransactionResult | null
  onClose?: () => void
}

export default function TransactionResult({ result, onClose }: TransactionResultProps) {
  const [showLogs, setShowLogs] = useState(false)

  if (!result) return null

  const explorerUrl = result.signature ? getSolanaExplorerUrl(result.signature) : null
  const programLogs = result.logs ? extractProgramLogs(result.logs, PROGRAM_ID) : []
  const formattedLogs = result.logs ? formatLogs(result.logs) : []

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
            result.success ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <span className={`text-xs font-bold ${
              result.success ? 'text-green-600' : 'text-red-600'
            }`}>
              {result.success ? '✓' : '✗'}
            </span>
          </div>
          <span className={`text-sm font-medium ${
            result.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {result.success ? 'Transaction Successful' : 'Transaction Failed'}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Transaction Signature */}
      {result.signature && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-1">Transaction Signature:</p>
          <div className="flex items-center space-x-2">
            <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
              {shortenAddress(result.signature, 8)}
            </code>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                View on Explorer →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {result.error && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-1">Error:</p>
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
            {result.error}
          </p>
        </div>
      )}

      {/* Program Logs */}
      {result.logs && result.logs.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-600">
              Program Logs ({formattedLogs.length})
            </p>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showLogs ? 'Hide' : 'Show'} Logs
            </button>
          </div>
          
          {showLogs && (
            <div className="bg-gray-50 border rounded p-3 max-h-40 overflow-y-auto">
              <div className="space-y-1">
                {formattedLogs.map((log, index) => (
                  <div key={index} className="text-xs font-mono">
                    <span className="text-gray-500">[{index + 1}]</span>{' '}
                    <span className={log.includes('Program') ? 'text-blue-600' : 'text-gray-700'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Program-Specific Logs */}
      {programLogs.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-1">
            AMM Program Logs ({programLogs.length}):
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 max-h-32 overflow-y-auto">
            <div className="space-y-1">
              {programLogs.map((log, index) => (
                <div key={index} className="text-xs font-mono text-blue-800">
                  {formatLogs([log])[0]}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 