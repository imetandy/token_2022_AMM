'use client';

import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { WalletClient } from '../utils/wallet-client';
import { useWallet, useConnection } from '@solana/wallet-adapter-react'

interface MintTradeCounterProps {
  mintAddress: string;
  walletClient: WalletClient;
}

interface TradeCounterData {
  incomingTransfers: number;
  outgoingTransfers: number;
  totalIncomingVolume: number;
  totalOutgoingVolume: number;
  lastUpdated: number;
  hookOwner: string;
}

export default function MintTradeCounter({
  mintAddress,
  walletClient
}: MintTradeCounterProps) {
  const { publicKey, signTransaction } = useWallet();
  const [counterData, setCounterData] = useState<TradeCounterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counterExists, setCounterExists] = useState(false);

  const initializeCounter = async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await walletClient.initializeExtraAccountMetaList(
        publicKey,
        new PublicKey(mintAddress),
        signTransaction
      );

      if (result.success) {
        console.log('Mint trade counter initialized successfully');
        setCounterExists(true);
        // Refresh counter data
        await fetchCounterData();
      } else {
        setError(result.error || 'Failed to initialize counter');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCounterData = async () => {
    if (!publicKey) return;

    try {
      // In a real implementation, you'd fetch the counter data from the blockchain
      // For now, we'll use placeholder data
      const mockData: TradeCounterData = {
        incomingTransfers: Math.floor(Math.random() * 100),
        outgoingTransfers: Math.floor(Math.random() * 100),
        totalIncomingVolume: Math.floor(Math.random() * 1000000),
        totalOutgoingVolume: Math.floor(Math.random() * 1000000),
        lastUpdated: Date.now(),
        hookOwner: publicKey.toString(),
      };

      setCounterData(mockData);
      setCounterExists(true);
    } catch (err) {
      console.error('Error fetching counter data:', err);
      setCounterExists(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      fetchCounterData();
    }
  }, [publicKey, mintAddress]);

  if (!publicKey) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Mint Trade Counter</h3>
        <p className="text-gray-600">Connect your wallet to view trade counters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Mint Trade Counter</h3>
        {!counterExists && (
          <button
            onClick={initializeCounter}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm"
          >
            {loading ? 'Initializing...' : 'Initialize Counter'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gray-600">Mint Address</p>
        <p className="text-sm font-mono break-all">{mintAddress}</p>
      </div>

      {!counterExists && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Counter Not Initialized
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  The trade counter for this mint hasn't been initialized yet. 
                  Initialize it to start tracking transfers and view statistics.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {counterData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Incoming Transfers</h4>
              <p className="text-2xl font-bold text-green-600">
                {counterData.incomingTransfers}
              </p>
              <p className="text-xs text-gray-500">transfers received</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Outgoing Transfers</h4>
              <p className="text-2xl font-bold text-blue-600">
                {counterData.outgoingTransfers}
              </p>
              <p className="text-xs text-gray-500">transfers sent</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Total Incoming Volume</h4>
              <p className="text-lg font-bold">
                {counterData.totalIncomingVolume.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">tokens received</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Total Outgoing Volume</h4>
              <p className="text-lg font-bold">
                {counterData.totalOutgoingVolume.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">tokens sent</p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Hook Owner</h4>
            <p className="text-sm font-mono break-all">{counterData.hookOwner}</p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Last updated: {new Date(counterData.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
      ) : counterExists ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading counter data...</p>
        </div>
      ) : null}
    </div>
  );
} 