use anchor_lang::prelude::*;

pub use errors::*;
pub mod errors;
pub use state::*;
pub mod state;

pub use contexts::*;
pub mod contexts;

declare_id!("Ba93wuicukbNB6djDoUkvMpDUxTw4Gzo3VH1oLfq9HBp");

#[program]
pub mod token_setup {
    use super::*;

    pub fn create_token_with_hook(
        ctx: Context<CreateTokenWithHook>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        ctx.accounts.create_token_with_hook(name, symbol, uri)
    }

    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.mint_tokens(amount)
    }

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        ctx.accounts.initialize_extra_account_meta_list()
    }
} 