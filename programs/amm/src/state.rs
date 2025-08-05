use anchor_lang::prelude::*;

#[account]
pub struct Amm {
    /// The unique pool identifier (fixed size array)
    pub pool_id: [u8; 64],
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

impl Default for Amm {
    fn default() -> Self {
        Self {
            pool_id: [0u8; 64],
            admin: Pubkey::default(),
            sol_fee: 0,
            sol_fee_collector: Pubkey::default(),
            created: false,
            is_immutable: false,
        }
    }
}

impl Amm {
    pub const LEN: usize = 8 + 64 + 32 + 8 + 32 + 1 + 1; // 8 (discriminator) + 64 (pool_id) + 32 (admin) + 8 (sol_fee) + 32 (sol_fee_collector) + 1 (created) + 1 (is_immutable)
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
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 32 + 8; // 8 (discriminator) + 32 (amm) + 32 (mint_a) + 32 (mint_b) + 32 (vault_a) + 32 (vault_b) + 32 (lp_mint) + 8 (total_liquidity)
} 