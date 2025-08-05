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
        mint_a: Pubkey, 
        mint_b: Pubkey,
        sol_fee: u64,
        sol_fee_collector: Pubkey,
    ) -> Result<()> {
        msg!("Instruction: CreateAmm");
        msg!("Mint A: {}", mint_a);
        msg!("Mint B: {}", mint_b);
        msg!("SOL fee: {}", sol_fee);
        msg!("SOL fee collector: {}", sol_fee_collector);
        msg!("AMM account key: {}", ctx.accounts.amm.key());
        msg!("Admin key: {}", ctx.accounts.admin.key());
        msg!("Authority key: {}", ctx.accounts.authority.key());
        
        // Validate SOL fee is within acceptable range (0-0.1 SOL)
        require!(sol_fee > 0 && sol_fee <= 100_000_000, AmmError::InvalidFee); // Max 0.1 SOL
        msg!("SOL fee validation passed");
        
        msg!("About to call create_amm on accounts");
        ctx.accounts.create_amm(mint_a, mint_b, sol_fee, sol_fee_collector)?;
        msg!("create_amm completed successfully");
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
        msg!("Instruction: CreatePool");
        msg!("Mint A: {}", ctx.accounts.mint_a.key());
        msg!("Mint B: {}", ctx.accounts.mint_b.key());
        msg!("Token program: {}", ctx.accounts.token_program.key());
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
        ctx.accounts.deposit_liquidity(amount_a, amount_b)
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