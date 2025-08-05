use anchor_lang::prelude::*;

#[error_code]
pub enum CounterHookError {
    #[msg("Invalid transfer amount")]
    InvalidAmount,
    #[msg("Counter not initialized")]
    CounterNotInitialized,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid mint")]
    InvalidMint,
} 