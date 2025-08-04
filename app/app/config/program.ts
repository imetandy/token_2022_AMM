// Program configuration for Token-2022 AMM
import { Token2022Amm } from '../types';

export const PROGRAM_ID = "GYLAVXZXgZ22Bs9oGKnvTbc3AgxRFykABC5x6QzzLiYL";

// Network configuration
export const NETWORK = "devnet";
export const RPC_ENDPOINT = "https://api.devnet.solana.com";

// AMM configuration
export const AMM_ID = "AMM2022TokenSwapProgram";
export const DEFAULT_FEE = 30; // 0.3% in basis points

// Seeds
export const AMM_SEED = "amm";
export const POOL_AUTHORITY_SEED = "pool-authority";

// Token program IDs
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// Import Solana Kit utilities
import { createSolanaRpc } from '@solana/rpc';

// Create RPC client instance
export const createRpcClient = () => {
  return createSolanaRpc(RPC_ENDPOINT);
};

// Export the program types
export type { Token2022Amm }; 