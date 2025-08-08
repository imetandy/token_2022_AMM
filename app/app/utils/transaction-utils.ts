import { Connection, PublicKey, TransactionSignature, TransactionResponse } from '@solana/web3.js';
import { createRpcClient, PROGRAM_ID } from '../config/program';

export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
  logs?: string[];
  mintAddress?: string;
  extraAccountMetaListAddress?: string;
  mintTradeCounterAddress?: string;
  userAccountAddress?: string;
}

export const getSolanaExplorerUrl = (signature: string, network: string = 'devnet') => {
  return `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
};

export const getAccountExplorerUrl = (address: string, network: string = 'devnet') => {
  return `https://explorer.solana.com/address/${address}?cluster=${network}`;
};

export const sendAndConfirmTransaction = async (
  connection: Connection,
  transaction: any,
  signers: any[],
  commitment: 'confirmed' | 'finalized' = 'confirmed'
): Promise<TransactionResult> => {
  try {
    // Send transaction
    const signature = await connection.sendTransaction(transaction, signers, {
      skipPreflight: true,
      maxRetries: 3
    });
    console.log('Transaction sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, commitment);
    
    if (confirmation.value.err) {
      return {
        signature,
        success: false,
        error: 'Transaction failed',
        logs: []
      };
    }

    // Get transaction details for logs
    const transactionResponse = await connection.getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0
    });

    return {
      signature,
      success: true,
      logs: transactionResponse?.meta?.logMessages || [],
      mintAddress: transactionResponse?.meta?.postTokenBalances?.[0]?.mint.toString()
    };

  } catch (error) {
    console.error('Transaction error:', error);
    return {
      signature: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const formatLogs = (logs: string[]): string[] => {
  return logs.map(log => {
    // Remove ANSI color codes and format nicely
    return log.replace(/\u001b\[[0-9;]*m/g, '');
  });
};

export const extractProgramLogs = (logs: string[], programId: string): string[] => {
  return logs.filter(log => 
    log.includes(`Program ${programId} log:`) ||
    log.includes(`Program ${programId} invoke`) ||
    log.includes(`Program ${programId} success`) ||
    log.includes(`Program ${programId} failed`)
  );
};

export const shortenAddress = (address: string, chars: number = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}; 