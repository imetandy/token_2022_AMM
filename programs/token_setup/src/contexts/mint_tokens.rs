use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, Token2022, TokenAccount, mint_to, MintTo},
    associated_token::AssociatedToken,
};
use crate::errors::TokenSetupError;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    /// The mint to mint tokens from
    #[account(mut)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The token account to mint to
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint authority - can be any signer
    #[account(
        mut,
        constraint = authority.is_signer @ TokenSetupError::NotSigner
    )]
    pub authority: Signer<'info>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> MintTokens<'info> {
    pub fn mint_tokens(&mut self, amount: u64) -> Result<()> {
        msg!("=== Starting MintTokens ===");
        msg!("Minting {} tokens to {}", amount, self.authority.key());
        msg!("Mint address: {}", self.mint.key());
        msg!("Token account: {}", self.token_account.key());
        msg!("Authority: {}", self.authority.key());
        
        // Note: The mint authority is set during CreateTokenWithHook to `authority` signer
        
        let cpi_accounts = MintTo {
            mint: self.mint.to_account_info(),
            to: self.token_account.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        msg!("Calling mint_to CPI with amount: {}", amount);
        mint_to(cpi_ctx, amount)?;
        
        msg!("=== MintTokens completed successfully ===");
        msg!("Minted {} tokens to {}", amount, self.token_account.key());
        
        Ok(())
    }
} 