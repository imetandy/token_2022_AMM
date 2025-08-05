'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenMinting } from '../utils/token-minting';
import { Connection, PublicKey } from '@solana/web3.js';

interface TokenBalanceProps {
  connection: Connection;
  tokenA: string | null;
  tokenB: string | null;
}

export default function TokenBalanceComponent({ connection, tokenA, tokenB }: TokenBalanceProps) {
  const { publicKey, signTransaction } = useWallet();
  const [balances, setBalances] = useState<{ tokenA: number; tokenB: number }>({ tokenA: 0, tokenB: 0 });
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);



  const handleCheckBalances = async () => {
    if (!publicKey || !tokenA || !tokenB) return;

    try {
      const tokenMinting = new TokenMinting(connection);
      
      const [balanceA, balanceB] = await Promise.all([
        tokenMinting.getTokenBalance(tokenA, publicKey),
        tokenMinting.getTokenBalance(tokenB, publicKey)
      ]);
      
      setBalances({ tokenA: balanceA, tokenB: balanceB });
      
      // Provide user feedback based on results
      if (balanceA === 0 && balanceB === 0) {
        console.log('No tokens found. You may need to create token accounts or mint tokens first.');
      }
    } catch (err) {
      console.error('Error checking balances:', err);
    }
  };

  const handleCreateTokenAccounts = async () => {
    if (!publicKey || !signTransaction || !tokenA || !tokenB) return;

    setIsCreatingAccounts(true);
    try {
      const tokenMinting = new TokenMinting(connection);
      
      console.log('Creating token accounts for your wallet...');
      
      const [accountA, accountB] = await Promise.all([
        tokenMinting.createAssociatedTokenAccount(tokenA, publicKey, signTransaction),
        tokenMinting.createAssociatedTokenAccount(tokenB, publicKey, signTransaction)
      ]);
      
      console.log('Token accounts created:', { accountA, accountB });
      
      // Check balances after creating accounts
      await handleCheckBalances();
      
    } catch (err) {
      console.error('Error creating token accounts:', err);
    } finally {
      setIsCreatingAccounts(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💰 Token Balance Management</h4>
        <div className="space-y-1 text-xs text-blue-800">
          <p>• Check your current token balances</p>
          <p>• Create token accounts if they don't exist</p>
          <p>• Tokens are automatically minted during creation</p>
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
        
        <button
          onClick={handleCreateTokenAccounts}
          disabled={!publicKey || !signTransaction || !tokenA || !tokenB || isCreatingAccounts}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            !publicKey || !signTransaction || !tokenA || !tokenB || isCreatingAccounts
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isCreatingAccounts ? 'Creating...' : 'Create Token Accounts'}
        </button>
      </div>



      {/* Balances */}
      {(balances.tokenA > 0 || balances.tokenB > 0) ? (
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
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-yellow-900 mb-2">⚠️ No Token Balances Found</h4>
          <div className="space-y-1 text-xs text-yellow-800">
            <p>• Token accounts don't exist for these tokens in your wallet</p>
            <p>• Click "Create Token Accounts" to create the necessary accounts</p>
            <p>• Then you can mint tokens to your wallet</p>
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