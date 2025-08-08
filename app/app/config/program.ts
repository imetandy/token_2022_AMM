// Program IDs for the three-program architecture
export const TOKEN_SETUP_PROGRAM_ID = "Ba93wuicukbNB6djDoUkvMpDUxTw4Gzo3VH1oLfq9HBp";
export const AMM_PROGRAM_ID = "H7dswT3BXcCEeVjjLWkfpBP2p5imuJy7Qaq9i5VCpoos";
export const COUNTER_HOOK_PROGRAM_ID = "GwLhrTbEzTY91MphjQyA331P63yQDq31Frw5uvZ1umdQ";

// Legacy program ID for backward compatibility
export const PROGRAM_ID = "GYLAVXZXgZ22Bs9oGKnvTbc3AgxRFykABC5x6QzzLiYL";

// Network configuration
export const NETWORK = "devnet";
export const RPC_ENDPOINT = "https://api.devnet.solana.com";

// Import RPC configuration
import { getBestRpcEndpoint, createOptimizedConnection } from './rpc-config';

// AMM configuration
export const AMM_ID = "AMM2022TokenSwapProgram";
export const DEFAULT_FEE = 30; // 0.3% in basis points

// Seeds
export const AMM_SEED = "amm";
export const POOL_AUTHORITY_SEED = "pool_authority";

// Token program IDs
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// Import Solana Kit utilities
import { createSolanaRpc } from '@solana/rpc';

// Create RPC client instance
export const createRpcClient = () => {
  return createSolanaRpc(getBestRpcEndpoint());
};

// Create optimized connection instance
export const createConnection = () => {
  return createOptimizedConnection();
};

