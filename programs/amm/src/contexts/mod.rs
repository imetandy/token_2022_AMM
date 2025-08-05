use anchor_lang::prelude::*;

pub mod create_amm;
pub mod create_pool;
pub mod create_token_accounts;
pub mod deposit_liquidity;
pub mod swap_exact_tokens_for_tokens;
pub mod utils;

pub use create_amm::*;
pub use create_pool::*;
pub use create_token_accounts::*;
pub use deposit_liquidity::*;
pub use swap_exact_tokens_for_tokens::*;
pub use utils::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositLiquidityBumps {
    pub amm: u8,
    pub pool: u8,
    pub pool_authority: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SwapExactTokensForTokensBumps {
    pub amm: u8,
    pub pool: u8,
    pub pool_authority: u8,
} 