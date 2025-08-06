use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum CounterHookError {
    #[error("Invalid instruction")]
    InvalidInstruction,
    #[error("Invalid account data")]
    InvalidAccountData,
    #[error("Account not initialized")]
    AccountNotInitialized,
    #[error("Invalid mint")]
    InvalidMint,
    #[error("Invalid owner")]
    InvalidOwner,
}

impl From<CounterHookError> for ProgramError {
    fn from(e: CounterHookError) -> Self {
        ProgramError::Custom(e as u32)
    }
} 