use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, TokenAccount, Mint, mint_to, MintTo, transfer, Transfer},
};
use crate::{
    constants::{POOL_AUTHORITY_SEED, AMM_SEED},
    errors::*,
    state::{Amm, Pool},
};

#[derive(Accounts)]
#[instruction(amount_a: u64, amount_b: u64)]
pub struct DepositLiquidity<'info> {
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
        constraint = pool_account_a.mint == pool.mint_a @ AmmError::InvalidPool,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = pool_account_b.mint == pool.mint_b @ AmmError::InvalidPool,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_account_a.mint == pool.mint_a @ AmmError::InvalidPool,
        associated_token::mint = mint_a,
        associated_token::authority = user,
    )]
    pub user_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_account_b.mint == pool.mint_b @ AmmError::InvalidPool,
        associated_token::mint = mint_b,
        associated_token::authority = user,
    )]
    pub user_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = user,
    )]
    pub user_lp_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_lp_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = user.is_signer @ AmmError::NotSigner
    )]
    pub user: Signer<'info>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,
}

impl<'info> DepositLiquidity<'info> {
    pub fn deposit_liquidity(
        &mut self,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        msg!("Depositing liquidity: {} token A, {} token B", amount_a, amount_b);
        
        // Transfer tokens from user to pool
        self.transfer_tokens_to_pool(amount_a, amount_b)?;
        
        // Mint LP tokens to user
        self.mint_lp_tokens(amount_a, amount_b)?;
        
        msg!("Liquidity deposited successfully");
        Ok(())
    }
    
    fn transfer_tokens_to_pool(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Transfer token A
        if amount_a > 0 {
            let cpi_accounts = Transfer {
                from: self.user_account_a.to_account_info(),
                to: self.pool_account_a.to_account_info(),
                authority: self.user.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                self.token_program.to_account_info(),
                cpi_accounts,
            );
            transfer(cpi_ctx, amount_a)?;
        }
        
        // Transfer token B
        if amount_b > 0 {
            let cpi_accounts = Transfer {
                from: self.user_account_b.to_account_info(),
                to: self.pool_account_b.to_account_info(),
                authority: self.user.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                self.token_program.to_account_info(),
                cpi_accounts,
            );
            transfer(cpi_ctx, amount_b)?;
        }
        
        Ok(())
    }
    
    fn mint_lp_tokens(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Calculate LP tokens to mint (simplified calculation)
        let lp_amount = (amount_a + amount_b) / 2; // Simplified for now
        
        let cpi_accounts = MintTo {
            mint: self.lp_mint.to_account_info(),
            to: self.user_lp_account.to_account_info(),
            authority: self.pool_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            cpi_accounts,
        );
        mint_to(cpi_ctx, lp_amount)?;
        
        Ok(())
    }
} 