use anchor_lang::prelude::*;

#[error_code]
pub enum TokenSetupError {
    #[msg("Not a signer")]
    NotSigner,
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,
    #[msg("Invalid metadata")]
    InvalidMetadata,
    #[msg("Mint authority mismatch")]
    MintAuthorityMismatch,
} 