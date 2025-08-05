'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenMinting } from '../utils/token-minting';
import { Connection, PublicKey } from '@solana/web3.js';

interface TokenMintingProps {
  connection: Connection;
  tokenA: string | null;
  tokenB: string | null;
}

export default function TokenMintingComponent({ connection, tokenA, tokenB }: TokenMintingProps) {
  const { publicKey } = useWallet();
  const [balances, setBalances] = useState<{ tokenA: number; tokenB: number }>({ tokenA: 0, tokenB: 0 });



  const handleCheckBalances = async () => {
    if (!publicKey || !tokenA || !tokenB) return;

    try {
      const tokenMinting = new TokenMinting(connection);
      
      const [balanceA, balanceB] = await Promise.all([
        tokenMinting.getTokenBalance(tokenA, publicKey),
        tokenMinting.getTokenBalance(tokenB, publicKey)
      ]);
      
      setBalances({ tokenA: balanceA, tokenB: balanceB });
    } catch (err) {
      console.error('Error checking balances:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">⚠️ Testing Setup Required</h4>
        <div className="space-y-1 text-xs text-yellow-800">
          <p>• You need tokens to test the AMM pool</p>
          <p>• Use the CLI script to mint tokens to your wallet</p>
          <p>• Copy your wallet address and run the command below</p>
        </div>
      </div>

      {publicKey && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">📋 Your Wallet Address</h4>
          <div className="flex items-center space-x-2">
            <code className="text-xs bg-white px-2 py-1 rounded border flex-1 font-mono">
              {publicKey.toString()}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(publicKey.toString())}
              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
        <h4 className="text-sm font-medium text-gray-900 mb-2">🔧 Alternative: Create New Tokens</h4>
        <div className="space-y-2">
          <p className="text-xs text-gray-700">Since the existing tokens don't have accessible mint authority, create new tokens:</p>
          <div className="bg-black text-green-400 p-3 rounded font-mono text-xs">
            <div>cd /Users/andrew/Documents/projects/token_2022_AMM</div>
            <div>./scripts/create-token-with-hook.sh "Test Token A" "TTA" 9</div>
            <div>./scripts/create-token-with-hook.sh "Test Token B" "TTB" 2</div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            This will create new tokens with transfer hooks and your wallet as mint authority.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Quick Setup</h4>
        <div className="space-y-1 text-xs text-blue-800">
          <p>• Create new tokens with CLI (recommended)</p>
          <p>• Use your wallet as mint authority</p>
          <p>• Transfer hooks will be enabled automatically</p>
          <p>• You can then mint tokens directly from the frontend</p>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={handleCheckBalances}
          disabled={!publicKey || !tokenA || !tokenB}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            !publicKey || !tokenA || !tokenB
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          Check Balances
        </button>
      </div>



      {/* Balances */}
      {(balances.tokenA > 0 || balances.tokenB > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💰 Current Balances</h4>
          <div className="space-y-1 text-xs text-blue-800">
            <p>• Token A: {balances.tokenA} tokens</p>
            <p>• Token B: {balances.tokenB} tokens</p>
            {balances.tokenA >= 1 && balances.tokenB >= 1 && (
              <p className="text-green-600 font-medium">✓ Ready to create AMM pool!</p>
            )}
          </div>
        </div>
      )}

      {!publicKey && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <p className="text-sm text-gray-600">Please connect your wallet to mint test tokens</p>
        </div>
      )}
    </div>
  );
} 