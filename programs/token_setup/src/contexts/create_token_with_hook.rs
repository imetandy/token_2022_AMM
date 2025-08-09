use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, Token2022},
    associated_token::AssociatedToken,
};
use counter_hook;
use crate::errors::TokenSetupError;

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct CreateTokenWithHook<'info> {
    /// CHECK: Mint to be created
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

    /// CHECK: Mint authority - can be any signer
    #[account(
        constraint = authority.is_signer @ TokenSetupError::NotSigner
    )]
    pub authority: Signer<'info>,

    /// CHECK: Payer for the transaction
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Counter hook program for transfer hooks
    pub counter_hook_program: UncheckedAccount<'info>,

    /// CHECK: Extra account meta list for mint
    #[account(
        init_if_needed,
        seeds = [b"extra-account-metas", mint.key().as_ref(), counter_hook_program.key().as_ref()],
        bump,
        payer = payer,
        space = 128 // Increased space for ExtraAccountMetaList with 1 account
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    /// CHECK: Mint trade counter for mint (created by counter_hook program; not initialized here)
    pub mint_trade_counter: AccountInfo<'info>,

    /// CHECK: Solana ecosystem accounts
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
        
        msg!("Step 4: Initializing transfer hook accounts");
        msg!("Extra account meta list: {}", self.extra_account_meta_list.key());
        msg!("Mint trade counter: {}", self.mint_trade_counter.key());
        
        // Initialize the extra account meta list with mint trade counter
        let extra_account_meta_list_data = &mut self.extra_account_meta_list.data.borrow_mut();
        use spl_tlv_account_resolution::state::ExtraAccountMetaList;
        use spl_tlv_account_resolution::account::ExtraAccountMeta;
        use spl_tlv_account_resolution::seeds::Seed;
        use anchor_spl::token_2022_extensions::spl_token_metadata_interface::state::TokenMetadata;
        
        // Create extra account meta for the mint trade counter
        let mint_trade_counter_meta = ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal { bytes: b"mint-trade-counter".to_vec() },
                Seed::AccountKey { index: 1 }, // mint account at position 1 in Execute instruction
            ],
            false, // not a signer
            true,  // is writable
        )?;
        
        ExtraAccountMetaList::init::<TokenMetadata>(
            extra_account_meta_list_data,
            &[mint_trade_counter_meta],
        )?;
        
        msg!("Step 5: Transfer hook accounts initialized successfully");
        msg!("Extra account meta list initialized with mint trade counter");
        msg!("Mint trade counter will be initialized by the counter hook program");
        
        msg!("=== CreateTokenWithHook completed successfully ===");
        msg!("Token-2022 mint with Transfer Hook created successfully!");
        msg!("Mint address: {}", self.mint.key());
        msg!("Transfer hook accounts are ready for use");
        
        Ok(())
    }
} 