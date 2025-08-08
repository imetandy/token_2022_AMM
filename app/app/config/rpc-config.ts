// Centralized RPC configuration using Kit
export const RPC_ENDPOINT = "https://devnet.helius-rpc.com/?api-key=52e2a914-28ac-4bd4-a222-1d44168db946";

export function getBestRpcEndpoint(): string {
  return RPC_ENDPOINT;
}

import { createSolanaRpc } from '@solana/kit';

export const createRpc = () => createSolanaRpc(getBestRpcEndpoint());

// Legacy Connection is no longer used; kept as a stub to avoid import churn during migration
export function createOptimizedConnection(): any {
  return null as any;
}