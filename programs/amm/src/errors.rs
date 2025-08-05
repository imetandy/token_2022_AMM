use anchor_lang::prelude::*;

#[error_code]
pub enum AmmError {
    #[msg("Invalid fee amount")]
    InvalidFee,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,
    #[msg("Pool already exists")]
    PoolAlreadyExists,
    #[msg("Pool does not exist")]
    PoolDoesNotExist,
    #[msg("Invalid pool")]
    InvalidPool,
    #[msg("Not a signer")]
    NotSigner,
} 