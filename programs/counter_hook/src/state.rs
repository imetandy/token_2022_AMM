use anchor_lang::prelude::*;

/// Mint-specific trade counter that tracks trades for each mint
#[account]
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
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 32;
} 