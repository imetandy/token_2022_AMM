'use client';

import React, { useState, useEffect } from 'react';

interface TokenInputProps {
  onTokensSet: (tokenA: string, tokenB: string) => void;
  createdTokens: {
    tokenA: string | null;
    tokenB: string | null;
  };
}

export default function TokenInputComponent({ onTokensSet, createdTokens }: TokenInputProps) {
  const [tokenA, setTokenA] = useState('E31Kcd8BXivsXnNYtVnE3X4RkbepZMYWVxpqeDmdcYhD');
  const [tokenB, setTokenB] = useState('4XRWdGKpTHjQm4wvBVSTEXc91ULUJf7VdsZV5sxumjKV');

  useEffect(() => {
    // Update parent when tokens change
    onTokensSet(tokenA, tokenB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenA, tokenB]); // onTokensSet is stable and doesn't need to be in deps

  const handleTokenAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenA(e.target.value);
  };

  const handleTokenBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenB(e.target.value);
  };

  const validatePublicKey = (address: string): boolean => {
    try {
      // Basic validation - check if it's a valid base58 string with correct length
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    } catch {
      return false;
    }
  };

  const isTokenAValid = validatePublicKey(tokenA);
  const isTokenBValid = validatePublicKey(tokenB);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Token A Mint Address
        </label>
        <input
          type="text"
          value={tokenA}
          onChange={handleTokenAChange}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isTokenAValid ? 'border-green-300' : 'border-red-300'
          }`}
          placeholder="Enter Token A mint address"
        />
        {!isTokenAValid && tokenA && (
          <p className="text-xs text-red-600 mt-1">Invalid public key format</p>
        )}
        {isTokenAValid && (
          <p className="text-xs text-green-600 mt-1">✓ Valid mint address</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Token B Mint Address
        </label>
        <input
          type="text"
          value={tokenB}
          onChange={handleTokenBChange}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isTokenBValid ? 'border-green-300' : 'border-red-300'
          }`}
          placeholder="Enter Token B mint address"
        />
        {!isTokenBValid && tokenB && (
          <p className="text-xs text-red-600 mt-1">Invalid public key format</p>
        )}
        {isTokenBValid && (
          <p className="text-xs text-green-600 mt-1">✓ Valid mint address</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Transfer Hook Tokens Ready</h4>
        <div className="space-y-1 text-xs text-blue-800">
          <p>• These tokens were created with transfer hooks enabled</p>
          <p>• Trade counters will be tracked automatically</p>
          <p>• Ready to use in AMM pools and trading</p>
        </div>
      </div>

      {isTokenAValid && isTokenBValid && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-green-900 mb-2">✓ Tokens Configured</h4>
          <div className="space-y-1 text-xs text-green-800">
            <p>• Token A: {tokenA.slice(0, 8)}...{tokenA.slice(-8)}</p>
            <p>• Token B: {tokenB.slice(0, 8)}...{tokenB.slice(-8)}</p>
            <p>• You can now create pools and trade</p>
          </div>
        </div>
      )}
    </div>
  );
} 