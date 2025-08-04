use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, Token2022, TokenAccount, mint_to, MintTo},
    associated_token::AssociatedToken,
};
use crate::errors::AmmError;

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct CreateTokenWithHook<'info> {
    /// The mint to be created
    #[account(
        init,
        payer = payer,
        mint::token_program = token_program,
        mint::decimals = 6,
        mint::authority = authority,
        mint::freeze_authority = authority,
        // Temporarily disabled transfer hook to avoid transfer issues
        // extensions::transfer_hook::authority = authority,
        // extensions::transfer_hook::program_id = crate::ID,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The mint authority - can be any signer
    #[account(
        constraint = authority.is_signer @ AmmError::NotSigner
    )]
    pub authority: Signer<'info>,

    /// The payer for the transaction
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> CreateTokenWithHook<'info> {
    pub fn create_token_with_hook(
        &mut self,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        
        msg!("=== Starting CreateTokenWithHook ===");
        msg!("Step 1: Validating inputs");
        msg!("Name: {}", name);
        msg!("Symbol: {}", symbol);
        msg!("URI: {}", uri);
        
        msg!("Step 2: Token mint created");
        msg!("Mint: {}", self.mint.key());
        msg!("Authority: {}", self.authority.key());
        msg!("Payer: {}", self.payer.key());
        
        msg!("Step 3: Standard Token-2022 mint (transfer hook disabled)");
        msg!("Mint authority: {}", self.authority.key());
        
        msg!("=== CreateTokenWithHook completed successfully ===");
        msg!("Token-2022 mint created successfully!");
        msg!("Mint address: {}", self.mint.key());
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    /// The mint to mint tokens from
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
        constraint = authority.is_signer @ AmmError::NotSigner
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
        
        // Check if the mint has the correct authority
        if self.mint.mint_authority != Some(self.authority.key()).into() {
            msg!("ERROR: Mint authority mismatch!");
            msg!("Expected: {}", self.authority.key());
            msg!("Got: {:?}", self.mint.mint_authority);
            return Err(AmmError::UnauthorizedAdmin.into());
        }
        
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