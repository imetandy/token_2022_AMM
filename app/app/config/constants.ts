import type { Address } from '@solana/addresses'
import { web3 } from '@coral-xyz/anchor'

// Program IDs (addresses as strings)
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address
export const TOKEN_SETUP_PROGRAM_ID = 'Ba93wuicukbNB6djDoUkvMpDUxTw4Gzo3VH1oLfq9HBp' as Address

// Anchor/web3 PublicKey instances (for Anchor-based code)
export const TOKEN_2022_PROGRAM = new web3.PublicKey(TOKEN_2022_PROGRAM_ID)
export const ASSOCIATED_TOKEN_PROGRAM = new web3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID)
export const TOKEN_SETUP_PROGRAM = new web3.PublicKey(TOKEN_SETUP_PROGRAM_ID)

// Seeds
export const POOL_AUTHORITY_SEED = 'pool_authority'
export const EXTRA_ACCOUNT_METAS_SEED = 'extra-account-metas'
export const MINT_TRADE_COUNTER_SEED = 'mint-trade-counter'