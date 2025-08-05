use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, TokenAccount},
};
use crate::errors::*;

#[derive(Accounts)]
pub struct CreateTokenAccounts<'info> {
    /// The token account to create
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint for the token account
    pub mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,

    /// The authority for the token account
    pub authority: Signer<'info>,

    /// The account paying for the transaction
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> CreateTokenAccounts<'info> {
    pub fn create_token_accounts(&mut self) -> Result<()> {
        msg!("Token accounts created successfully");
        Ok(())
    }
} 