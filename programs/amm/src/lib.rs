use anchor_lang::prelude::*;

pub use errors::*;
pub mod errors;
pub use state::*;
pub mod state;
pub mod constants;

pub use contexts::*;
pub mod contexts;

declare_id!("H7dswT3BXcCEeVjjLWkfpBP2p5imuJy7Qaq9i5VCpoos");

#[program]
pub mod amm {
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
} 