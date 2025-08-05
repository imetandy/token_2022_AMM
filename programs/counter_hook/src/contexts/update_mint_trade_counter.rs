use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::state::MintTradeCounter;
use crate::errors::CounterHookError;

#[derive(Accounts)]
pub struct UpdateMintTradeCounter<'info> {
    /// The mint being transferred
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: Mint trade counter account
    #[account(
        mut,
        seeds = [b"mint-trade-counter", mint.key().as_ref()],
        bump
    )]
    pub mint_trade_counter: AccountInfo<'info>,
}

impl<'info> UpdateMintTradeCounter<'info> {
    pub fn update_mint_trade_counter(
        &self,
        amount: u64,
        _source_owner: Pubkey,
        _destination_owner: Pubkey,
    ) -> Result<()> {
        msg!("=== Updating Mint Trade Counter ===");
        msg!("Amount: {}", amount);
        msg!("Mint: {}", self.mint.key());
        msg!("Counter: {}", self.mint_trade_counter.key());
        
        // Basic validation
        if amount == 0 {
            msg!("ERROR: Invalid transfer amount (zero)");
            return Err(CounterHookError::InvalidAmount.into());
        }
        
        // Get the counter account data
        let mut counter_data = MintTradeCounter::try_deserialize(&mut &self.mint_trade_counter.data.borrow()[..])?;
        
        // Update counters based on transfer direction
        // For this mint, track incoming and outgoing transfers
        counter_data.outgoing_transfers += 1;
        counter_data.total_outgoing_volume += amount;
        
        // Note: We're tracking from the perspective of this mint
        // Outgoing = tokens leaving this mint's accounts
        // Incoming = tokens entering this mint's accounts
        
        msg!("Updated mint trade counter:");
        msg!("  Outgoing transfers: {}", counter_data.outgoing_transfers);
        msg!("  Total outgoing volume: {}", counter_data.total_outgoing_volume);
        msg!("  Mint: {}", counter_data.mint);
        
        counter_data.last_updated = Clock::get()?.unix_timestamp;
        
        // Serialize and write back to account
        counter_data.serialize(&mut &mut self.mint_trade_counter.data.borrow_mut()[..])?;
        
        msg!("=== Counter Update Complete ===");
        
        Ok(())
    }
} 