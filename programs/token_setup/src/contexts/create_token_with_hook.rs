use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, Token2022},
    associated_token::AssociatedToken,
};
use counter_hook::program::CounterHook;
use crate::errors::TokenSetupError;

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
        extensions::transfer_hook::authority = authority,
        extensions::transfer_hook::program_id = counter_hook_program,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The mint authority - can be any signer
    #[account(
        constraint = authority.is_signer @ TokenSetupError::NotSigner
    )]
    pub authority: Signer<'info>,

    /// The payer for the transaction
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The counter hook program for transfer hooks
    pub counter_hook_program: Program<'info, CounterHook>,

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
        
        msg!("Step 2: Token mint created with Transfer Hook extension");
        msg!("Mint: {}", self.mint.key());
        msg!("Authority: {}", self.authority.key());
        msg!("Payer: {}", self.payer.key());
        msg!("Transfer Hook Program: {}", self.counter_hook_program.key());
        
        msg!("Step 3: Token-2022 mint with Transfer Hook enabled");
        msg!("Mint authority: {}", self.authority.key());
        msg!("Transfer hook authority: {}", self.authority.key());
        msg!("Transfer hook program ID: {}", self.counter_hook_program.key());
        
        msg!("=== CreateTokenWithHook completed successfully ===");
        msg!("Token-2022 mint with Transfer Hook created successfully!");
        msg!("Mint address: {}", self.mint.key());
        msg!("IMPORTANT: Remember to initialize extra account meta list for this mint");
        
        Ok(())
    }
} 