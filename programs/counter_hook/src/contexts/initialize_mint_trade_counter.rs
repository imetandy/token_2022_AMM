use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::state::MintTradeCounter;

#[derive(Accounts)]
pub struct InitializeMintTradeCounter<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The mint to track
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: Mint trade counter account
    #[account(
        init,
        seeds = [b"mint-trade-counter", mint.key().as_ref()],
        bump,
        payer = payer,
        space = MintTradeCounter::LEN
    )]
    pub mint_trade_counter: AccountInfo<'info>,
    
    /// CHECK: System Program
    #[account(address = anchor_lang::system_program::ID)]
    pub system_program: UncheckedAccount<'info>,
}

impl<'info> InitializeMintTradeCounter<'info> {
    pub fn initialize_mint_trade_counter(&mut self) -> Result<()> {
        msg!("=== Initializing Mint Trade Counter ===");
        msg!("Mint: {}", self.mint.key());
        msg!("Counter: {}", self.mint_trade_counter.key());
        
        // Initialize the counter with default values
        let counter_data = MintTradeCounter {
            mint: self.mint.key(),
            incoming_transfers: 0,
            outgoing_transfers: 0,
            total_incoming_volume: 0,
            total_outgoing_volume: 0,
            last_updated: Clock::get()?.unix_timestamp,
            hook_owner: self.payer.key(),
        };
        
        // Serialize and write to account
        counter_data.serialize(&mut &mut self.mint_trade_counter.data.borrow_mut()[..])?;
        
        msg!("Mint trade counter initialized successfully");
        msg!("Hook owner: {}", self.payer.key());
        msg!("=== Initialization Complete ===");
        
        Ok(())
    }
} 