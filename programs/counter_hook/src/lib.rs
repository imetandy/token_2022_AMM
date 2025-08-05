use anchor_lang::prelude::*;

pub use errors::*;
pub mod errors;
pub use state::*;
pub mod state;
pub use contexts::*;
pub mod contexts;

declare_id!("EiAAboUH3o19cRw4wRo2f2erCcbGtRUtq9PgNS4RGgi");

#[program]
pub mod counter_hook {
    use super::*;

    pub fn initialize_mint_trade_counter(
        ctx: Context<InitializeMintTradeCounter>,
    ) -> Result<()> {
        ctx.accounts.initialize_mint_trade_counter()
    }

    pub fn update_mint_trade_counter(
        ctx: Context<UpdateMintTradeCounter>,
        amount: u64,
        source_owner: Pubkey,
        destination_owner: Pubkey,
    ) -> Result<()> {
        ctx.accounts.update_mint_trade_counter(amount, source_owner, destination_owner)
    }
} 