use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Amm {
    /// The unique pool identifier
    pub pool_id: String,
    /// Account that has admin authority over the AMM
    pub admin: Pubkey,
    /// The SOL fee taken on each trade, in lamports (e.g., 0.05 SOL = 50,000,000 lamports)
    pub sol_fee: u64,
    /// SOL fee collector account
    pub sol_fee_collector: Pubkey,
    /// The AMM has been created
    pub created: bool,
    /// Whether the AMM is immutable
    pub is_immutable: bool,
}

impl Amm {
    pub const LEN: usize = 8 + 64 + 32 + 8 + 32 + 1 + 1; // Updated for SOL fee
}

#[account()]
#[derive(Default)]
pub struct Pool {
    // Primary key of the AMM
    pub amm: Pubkey,
    /// Mint of token A
    pub mint_a: Pubkey,
    /// Mint of token B
    pub mint_b: Pubkey,
    /// Token A vault account
    pub vault_a: Pubkey,
    /// Token B vault account
    pub vault_b: Pubkey,
    /// LP token mint
    pub lp_mint: Pubkey,
    /// Total liquidity in the pool
    pub total_liquidity: u64,
}

impl Pool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 32 + 8;
}

