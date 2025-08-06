use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

/// Mint-specific trade counter that tracks trades for each mint
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct MintTradeCounter {
    /// The mint this counter belongs to
    pub mint: Pubkey,
    /// Number of incoming transfers (tokens received)
    pub incoming_transfers: u64,
    /// Number of outgoing transfers (tokens sent)
    pub outgoing_transfers: u64,
    /// Total volume of incoming transfers
    pub total_incoming_volume: u64,
    /// Total volume of outgoing transfers
    pub total_outgoing_volume: u64,
    /// Last time the counter was updated
    pub last_updated: i64,
    /// Owner of the transfer hook (can be anyone)
    pub hook_owner: Pubkey,
}

impl MintTradeCounter {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8 + 8 + 32;
    
    pub fn new(mint: Pubkey, hook_owner: Pubkey) -> Self {
        Self {
            mint,
            incoming_transfers: 0,
            outgoing_transfers: 0,
            total_incoming_volume: 0,
            total_outgoing_volume: 0,
            last_updated: 0,
            hook_owner,
        }
    }
} 