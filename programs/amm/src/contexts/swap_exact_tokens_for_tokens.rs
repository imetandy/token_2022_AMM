use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, TokenAccount, Mint, transfer, Transfer},
};
use crate::{
    constants::{POOL_AUTHORITY_SEED, AMM_SEED},
    errors::*,
    state::{Amm, Pool},
};

#[derive(Accounts)]
#[instruction(swap_a: bool, input_amount: u64, min_output_amount: u64)]
pub struct Swap<'info> {
    #[account(
        seeds = [
            AMM_SEED,
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub amm: Box<Account<'info, Amm>>,

    #[account(
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: Pool authority PDA
    #[account(
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            POOL_AUTHORITY_SEED,
        ],
        bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = user,
    )]
    pub user_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = user,
    )]
    pub user_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = user.is_signer @ AmmError::NotSigner
    )]
    pub user: Signer<'info>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,
}

impl<'info> Swap<'info> {
    pub fn swap(
        &mut self,
        swap_a: bool,
        input_amount: u64,
        min_output_amount: u64,
        _bumps: &SwapBumps,
    ) -> Result<()> {
        msg!("Swapping {} tokens", input_amount);
        msg!("Swap direction: {}", if swap_a { "A to B" } else { "B to A" });
        
        // Calculate output amount (simplified constant product formula)
        let output_amount = self.calculate_output_amount(swap_a, input_amount)?;
        
        // Check slippage
        require!(output_amount >= min_output_amount, AmmError::SlippageExceeded);
        
        // Execute the swap
        self.execute_swap(swap_a, input_amount, output_amount)?;
        
        msg!("Swap completed successfully. Output: {}", output_amount);
        Ok(())
    }
    
    fn calculate_output_amount(&self, swap_a: bool, input_amount: u64) -> Result<u64> {
        // Simplified constant product formula: (x + dx) * (y - dy) = x * y
        // where dx is input_amount and dy is output_amount
        
        let (reserve_in, reserve_out) = if swap_a {
            (self.pool_account_a.amount, self.pool_account_b.amount)
        } else {
            (self.pool_account_b.amount, self.pool_account_a.amount)
        };
        
        // Calculate output using constant product formula
        let output_amount = (input_amount * reserve_out) / (reserve_in + input_amount);
        
        Ok(output_amount)
    }
    
    fn execute_swap(&self, swap_a: bool, input_amount: u64, output_amount: u64) -> Result<()> {
        if swap_a {
            // Swap A to B: user sends A to pool, pool sends B to user
            self.transfer_from_user_to_pool(input_amount, true)?;
            self.transfer_from_pool_to_user(output_amount, false)?;
        } else {
            // Swap B to A: user sends B to pool, pool sends A to user
            self.transfer_from_user_to_pool(input_amount, false)?;
            self.transfer_from_pool_to_user(output_amount, true)?;
        }
        
        Ok(())
    }
    
    fn transfer_from_user_to_pool(&self, amount: u64, is_token_a: bool) -> Result<()> {
        let (from, to) = if is_token_a {
            (self.user_account_a.to_account_info(), self.pool_account_a.to_account_info())
        } else {
            (self.user_account_b.to_account_info(), self.pool_account_b.to_account_info())
        };
        
        let cpi_accounts = Transfer {
            from,
            to,
            authority: self.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            cpi_accounts,
        );
        transfer(cpi_ctx, amount)?;
        
        Ok(())
    }
    
    fn transfer_from_pool_to_user(&self, amount: u64, is_token_a: bool) -> Result<()> {
        let (from, to) = if is_token_a {
            (self.pool_account_a.to_account_info(), self.user_account_a.to_account_info())
        } else {
            (self.pool_account_b.to_account_info(), self.user_account_b.to_account_info())
        };
        
        let cpi_accounts = Transfer {
            from,
            to,
            authority: self.pool_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            cpi_accounts,
        );
        transfer(cpi_ctx, amount)?;
        
        Ok(())
    }
} 