// Simple RPC Configuration - Just switch to Helius
export const RPC_ENDPOINT = "https://devnet.helius-rpc.com/?api-key=52e2a914-28ac-4bd4-a222-1d44168db946";

// Simple function to get the endpoint
export function getBestRpcEndpoint(): string {
  console.log("🚀 Using Helius RPC endpoint");
  return RPC_ENDPOINT;
}

// Simple connection creation with optimized settings
export function createOptimizedConnection(): import('@solana/web3.js').Connection {
  const { Connection } = require('@solana/web3.js');
  console.log(`🔌 Creating connection to Helius: ${RPC_ENDPOINT}`);
  return new Connection(RPC_ENDPOINT, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000, // 30 seconds instead of 60
    disableRetryOnRateLimit: false,
    httpHeaders: {
      'Content-Type': 'application/json',
    }
  });
} 