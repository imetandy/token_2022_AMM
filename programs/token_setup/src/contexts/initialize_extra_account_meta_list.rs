use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use counter_hook;

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        init_if_needed,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
        space = 32, // Use a reasonable fixed size for ExtraAccountMetaList
        payer = payer
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    
    /// CHECK: Mint trade counter account (handled by counter_hook program)
    #[account(
        seeds = [b"mint-trade-counter", mint.key().as_ref()],
        bump,
        seeds::program = counter_hook::ID
    )]
    pub mint_trade_counter: AccountInfo<'info>,
    
    /// CHECK: System Program
    #[account(address = anchor_lang::system_program::ID)]
    pub system_program: UncheckedAccount<'info>,
}

impl<'info> InitializeExtraAccountMetaList<'info> {
    pub fn initialize_extra_account_meta_list(&mut self) -> Result<()> {
        msg!("=== Initializing Extra Account Meta List ===");
        msg!("Mint: {}", self.mint.key());
        msg!("Extra account meta list: {}", self.extra_account_meta_list.key());
        
        msg!("Step 1: Initializing ExtraAccountMetaList...");
        // Initialize an empty ExtraAccountMetaList
        // This means our transfer hook doesn't require any extra accounts
        use anchor_spl::token_2022_extensions::spl_token_metadata_interface::state::TokenMetadata;
        
        let extra_account_meta_list_data = &mut self.extra_account_meta_list.data.borrow_mut();
        msg!("Extra account meta list data length: {}", extra_account_meta_list_data.len());
        msg!("Expected size: 32 bytes");
        
        // Check if we have enough space
        if extra_account_meta_list_data.len() < 32 {
            msg!("ERROR: Not enough space for ExtraAccountMetaList");
            msg!("Required: 32 bytes, Available: {} bytes", extra_account_meta_list_data.len());
            return Err(anchor_lang::error::ErrorCode::AccountNotEnoughKeys.into());
        }
        
        msg!("Attempting to initialize ExtraAccountMetaList...");
        ExtraAccountMetaList::init::<TokenMetadata>(
            extra_account_meta_list_data,
            &[],
        )?;
        
        msg!("ExtraAccountMetaList initialized with 0 accounts (empty)");
        msg!("Hook owner: {}", self.payer.key());
        msg!("=== Initialization Complete ===");
        
        Ok(())
    }
} 