import { PublicKey } from '@solana/web3.js'

// Program IDs
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
export const TOKEN_SETUP_PROGRAM_ID = 'Ba93wuicukbNB6djDoUkvMpDUxTw4Gzo3VH1oLfq9HBp'

// PublicKey instances
export const TOKEN_2022_PROGRAM = new PublicKey(TOKEN_2022_PROGRAM_ID)
export const ASSOCIATED_TOKEN_PROGRAM = new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID)
export const TOKEN_SETUP_PROGRAM = new PublicKey(TOKEN_SETUP_PROGRAM_ID)

// Seeds
export const POOL_AUTHORITY_SEED = 'pool_authority'
export const EXTRA_ACCOUNT_METAS_SEED = 'extra-account-metas'
export const MINT_TRADE_COUNTER_SEED = 'mint-trade-counter' 