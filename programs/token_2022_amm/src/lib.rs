use anchor_lang::prelude::*;

pub use errors::*;
pub mod errors;
pub use state::*;
pub mod state;
mod constants;

pub use contexts::*;
pub mod contexts;

declare_id!("GYLAVXZXgZ22Bs9oGKnvTbc3AgxRFykABC5x6QzzLiYL");

#[program]
pub mod token_2022_amm {
    use super::*;

    pub fn create_amm(
        ctx: Context<CreateAmm>, 
        pool_id: String, 
        sol_fee: u64,
        sol_fee_collector: Pubkey,
    ) -> Result<()> {
        // Validate SOL fee is within acceptable range (0-0.1 SOL)
        require!(sol_fee > 0 && sol_fee <= 100_000_000, AmmError::InvalidFee); // Max 0.1 SOL
        ctx.accounts.create_amm(pool_id, sol_fee, sol_fee_collector)?;
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAmm>, new_admin: Pubkey) -> Result<()> {
        ctx.accounts.update_admin(new_admin)?;
        Ok(())
    }

    pub fn update_fee(ctx: Context<UpdateFee>, new_sol_fee: u64) -> Result<()> {
        ctx.accounts.update_fee(new_sol_fee)?;
        Ok(())
    }

    pub fn create_pool(
        ctx: Context<CreatePool>
    ) -> Result<()> {
        ctx.accounts.create_pool()?;
        Ok(())
    }

    pub fn create_token_accounts(
        ctx: Context<CreateTokenAccounts>
    ) -> Result<()> {
        ctx.accounts.create_token_accounts()?;
        Ok(())
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>, amount_a: u64, amount_b: u64
    ) -> Result<()> {
        ctx.accounts.deposit_liquidity(&ctx.bumps, amount_a, amount_b)
    }
    
    pub fn swap_exact_tokens_for_tokens(
        ctx: Context<SwapExactTokensForTokens>,
        swap_a: bool,
        input_amount: u64,
        min_output_amount: u64,
    ) -> Result<()> {
        ctx.accounts.swap_exact_tokens_for_tokens(
            swap_a,
            input_amount,
            min_output_amount,
            &ctx.bumps,
        )
    }

    pub fn transfer_hook(
        ctx: Context<TransferHook>,
        amount: u64,
        source_owner: Pubkey,
        destination_owner: Pubkey,
    ) -> Result<()> {
        ctx.accounts.process_transfer_hook(amount, source_owner, destination_owner)
    }

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        ctx.accounts.initialize_extra_account_meta_list()
    }

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
}
