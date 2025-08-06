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
    pub counter_hook_program: UncheckedAccount<'info>,

    /// CHECK: Extra account meta list for the mint
    #[account(
        init_if_needed,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
        payer = payer,
        space = 32
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    /// CHECK: Mint trade counter for the mint
    #[account(
        init_if_needed,
        seeds = [b"mint-trade-counter", mint.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 32 // MintTradeCounter::LEN
    )]
    pub mint_trade_counter: AccountInfo<'info>,

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
        
        msg!("Step 4: Initializing transfer hook accounts");
        msg!("Extra account meta list: {}", self.extra_account_meta_list.key());
        msg!("Mint trade counter: {}", self.mint_trade_counter.key());
        
        // Initialize the extra account meta list
        let extra_account_meta_list_data = &mut self.extra_account_meta_list.data.borrow_mut();
        use spl_tlv_account_resolution::state::ExtraAccountMetaList;
        use anchor_spl::token_2022_extensions::spl_token_metadata_interface::state::TokenMetadata;
        
        ExtraAccountMetaList::init::<TokenMetadata>(
            extra_account_meta_list_data,
            &[],
        )?;
        
        // Initialize the mint trade counter
        let counter_data = counter_hook::state::MintTradeCounter::new(
            self.mint.key(),
            self.authority.key(),
        );
        
        counter_data.serialize(&mut &mut self.mint_trade_counter.data.borrow_mut()[..])?;
        
        msg!("Step 5: Transfer hook accounts initialized successfully");
        msg!("Extra account meta list initialized with 0 accounts");
        msg!("Mint trade counter initialized with default values");
        
        msg!("=== CreateTokenWithHook completed successfully ===");
        msg!("Token-2022 mint with Transfer Hook created successfully!");
        msg!("Mint address: {}", self.mint.key());
        msg!("Transfer hook accounts are ready for use");
        
        Ok(())
    }
} 