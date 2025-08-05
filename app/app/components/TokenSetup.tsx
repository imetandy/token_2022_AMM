'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenSetup } from '../utils/token-setup';
import { Connection, PublicKey } from '@solana/web3.js';

interface TokenSetupProps {
  connection: Connection;
  ammProgramId: PublicKey;
}

export default function TokenSetupComponent({ connection, ammProgramId }: TokenSetupProps) {
  const { publicKey } = useWallet();
  const [mintAddress, setMintAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ signature: string; tradeCounterAddress: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tradeCounterData, setTradeCounterData] = useState<any>(null);

  const handleInitializeAccounts = async () => {
    if (!publicKey) {
      setError('Wallet not connected');
      return;
    }

    if (!mintAddress) {
      setError('Please enter a mint address');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const tokenSetup = new TokenSetup(connection, ammProgramId);
      
      const result = await tokenSetup.initializeTransferHookAccounts(
        mintAddress,
        publicKey
      );

      setResult(result);
      console.log('Transfer hook accounts initialized:', result);
    } catch (err) {
      console.error('Error initializing accounts:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGetTradeCounter = async () => {
    if (!mintAddress) {
      setError('Please enter a mint address');
      return;
    }

    try {
      const tokenSetup = new TokenSetup(connection, ammProgramId);
      const data = await tokenSetup.getTradeCounter(mintAddress);
      setTradeCounterData(data);
      setError(null);
    } catch (err) {
      console.error('Error getting trade counter:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Token Setup with Transfer Hooks</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mint Address (from SPL Token CLI)
          </label>
          <input
            type="text"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter mint address from SPL Token CLI"
          />
        </div>

        <div className="space-y-2">
          <button
            onClick={handleInitializeAccounts}
            disabled={loading || !publicKey}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Initializing...' : 'Initialize Transfer Hook Accounts'}
          </button>

          <button
            onClick={handleGetTradeCounter}
            disabled={!mintAddress}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Get Trade Counter Data
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded-md">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="text-sm space-y-1">
            <li>1. Create token using SPL Token CLI:</li>
            <li className="ml-4 font-mono text-xs bg-gray-200 p-2 rounded">
              spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --decimals 9 --enable-transfer-hook --transfer-hook-program-id {ammProgramId.toString()}
            </li>
            <li>2. Copy the mint address from the CLI output</li>
            <li>3. Paste it above and click "Initialize Transfer Hook Accounts"</li>
            <li>4. Use the token in your AMM for testing</li>
          </ol>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {result && (
          <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
            <h3 className="font-semibold mb-2">Transfer Hook Accounts Initialized!</h3>
            <p className="text-sm mb-1">
              <strong>Trade Counter Address:</strong> {result.tradeCounterAddress}
            </p>
            <p className="text-sm mb-1">
              <strong>Transaction:</strong> {result.signature}
            </p>
            <p className="text-sm">
              <strong>Explorer:</strong>{' '}
              <a
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-800"
              >
                View on Explorer
              </a>
            </p>
          </div>
        )}

        {tradeCounterData && (
          <div className="p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-md">
            <h3 className="font-semibold mb-2">Trade Counter Data:</h3>
            <p className="text-sm mb-1">
              <strong>Mint:</strong> {tradeCounterData.mint}
            </p>
            <p className="text-sm mb-1">
              <strong>Total Transfers:</strong> {tradeCounterData.totalTransfers}
            </p>
            <p className="text-sm mb-1">
              <strong>Total Volume:</strong> {tradeCounterData.totalVolume}
            </p>
            <p className="text-sm">
              <strong>Last Updated:</strong> {new Date(tradeCounterData.lastUpdated * 1000).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 