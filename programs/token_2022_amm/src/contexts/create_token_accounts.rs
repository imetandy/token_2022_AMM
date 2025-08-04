use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{TokenAccount, Mint, Token2022},
};

use crate::{
    constants::{AMM_SEED, POOL_AUTHORITY_SEED},
    state::Amm,
};

#[derive(Accounts)]
pub struct CreateTokenAccounts<'info> {
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
    
    /// CHECK:
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

    #[account(
        seeds = [
            AMM_SEED,
            amm.pool_id.as_bytes()
        ],
        bump,
    )]
    pub amm: Box<Account<'info, Amm>>,

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,

    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    /// The account paying for all rents
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,
}

impl<'info> CreateTokenAccounts<'info> {
    pub fn create_token_accounts(&mut self) -> Result<()> {
        // Token accounts are created via the associated_token_program
        // No additional logic needed here
        Ok(())
    }
} 