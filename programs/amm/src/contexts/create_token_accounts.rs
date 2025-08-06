use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, TokenAccount, Mint},
};
use crate::{
    constants::{POOL_AUTHORITY_SEED, AMM_SEED},
    state::{Amm, Pool},
};

#[derive(Accounts)]
pub struct CreatePoolTokenAccounts<'info> {
    /// The account paying for the transaction
    #[account(mut)]
    pub payer: Signer<'info>,
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
        mut,
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: Pool authority PDA - doesn't need to be created, just derived
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
    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = lp_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_lp_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,
}

impl<'info> CreatePoolTokenAccounts<'info> {
    pub fn create_pool_token_accounts(&mut self) -> Result<()> {
        // Update the pool with the vault addresses
        let pool = &mut self.pool;
        pool.vault_a = self.pool_account_a.key();
        pool.vault_b = self.pool_account_b.key();

        msg!("Pool token accounts created successfully");
        msg!("Pool account A (vault_a): {}", self.pool_account_a.key());
        msg!("Pool account B (vault_b): {}", self.pool_account_b.key());
        msg!("Pool LP account: {}", self.pool_lp_account.key());
        msg!("Pool authority: {}", self.pool_authority.key());

        Ok(())
    }
} 