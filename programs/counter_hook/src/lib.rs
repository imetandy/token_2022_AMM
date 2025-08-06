use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    clock::Clock,
    sysvar::Sysvar,
};
use spl_transfer_hook_interface::instruction::TransferHookInstruction;
use borsh::{BorshDeserialize, BorshSerialize};

pub use errors::*;
pub mod errors;
pub use state::*;
pub mod state;

// Program ID - actual deployed program ID
solana_program::declare_id!("GwLhrTbEzTY91MphjQyA331P63yQDq31Frw5uvZ1umdQ");

// Instruction discriminators for our custom instructions
pub const INITIALIZE_MINT_TRADE_COUNTER_DISCRIMINATOR: [u8; 8] = [1, 2, 3, 4, 5, 6, 7, 8];
pub const UPDATE_MINT_TRADE_COUNTER_DISCRIMINATOR: [u8; 8] = [9, 10, 11, 12, 13, 14, 15, 16];

// Entry point for the program
#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Check if this is a transfer hook call from Token-2022
    if instruction_data.len() >= 8 {
        // Check if this is a transfer hook instruction
        match TransferHookInstruction::unpack(instruction_data) {
            Ok(transfer_hook_instruction) => {
                match transfer_hook_instruction {
                    TransferHookInstruction::Execute { amount } => {
                        return execute_transfer_hook(program_id, accounts, amount);
                    }
                    TransferHookInstruction::InitializeExtraAccountMetaList { .. } | 
                    TransferHookInstruction::UpdateExtraAccountMetaList { .. } => {
                        return Err(ProgramError::InvalidInstructionData);
                    }
                }
            }
            Err(_) => {
                // Not a transfer hook instruction
            }
        }
        
        // Check for our custom instruction discriminators
        let discriminator = &instruction_data[0..8];
        if discriminator == INITIALIZE_MINT_TRADE_COUNTER_DISCRIMINATOR {
            return initialize_mint_trade_counter(program_id, accounts, &instruction_data[8..]);
        } else if discriminator == UPDATE_MINT_TRADE_COUNTER_DISCRIMINATOR {
            return update_mint_trade_counter(program_id, accounts, &instruction_data[8..]);
        }
    }

    Err(ProgramError::InvalidInstructionData)
}

fn initialize_mint_trade_counter(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let mint_trade_counter_info = next_account_info(account_info_iter)?;
    let mint_info = next_account_info(account_info_iter)?;
    let hook_owner_info = next_account_info(account_info_iter)?;
    let _payer_info = next_account_info(account_info_iter)?;
    let _system_program_info = next_account_info(account_info_iter)?;
    
    // Validate accounts
    if !mint_trade_counter_info.is_writable {
        msg!("Error: mint_trade_counter account must be writable");
        return Err(ProgramError::InvalidAccountData);
    }
    
    if mint_trade_counter_info.owner != program_id {
        msg!("Error: mint_trade_counter account must be owned by this program");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create new counter
    let counter = MintTradeCounter::new(*mint_info.key, *hook_owner_info.key);
    
    // Serialize and write to account
    let mut account_data = mint_trade_counter_info.data.borrow_mut();
    counter.serialize(&mut &mut account_data[..])?;
    
    msg!("Initialized mint trade counter for mint: {}", mint_info.key);
    msg!("Hook owner: {}", hook_owner_info.key);
    
    Ok(())
}

fn update_mint_trade_counter(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let mint_trade_counter_info = next_account_info(account_info_iter)?;
    
    // Validate account
    if !mint_trade_counter_info.is_writable {
        msg!("Error: mint_trade_counter account must be writable");
        return Err(ProgramError::InvalidAccountData);
    }
    
    if mint_trade_counter_info.owner != program_id {
        msg!("Error: mint_trade_counter account must be owned by this program");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Parse instruction data
    if instruction_data.len() < 24 {
        msg!("Error: insufficient instruction data");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    let amount = u64::from_le_bytes(instruction_data[0..8].try_into().unwrap());
    let source_owner = Pubkey::new_from_array(instruction_data[8..40].try_into().unwrap());
    let destination_owner = Pubkey::new_from_array(instruction_data[40..72].try_into().unwrap());
    
    // Deserialize counter
    let mut account_data = mint_trade_counter_info.data.borrow_mut();
    let mut counter = MintTradeCounter::try_from_slice(&account_data)?;
    
    // Update counter
    counter.outgoing_transfers += 1;
    counter.total_outgoing_volume += amount;
    counter.last_updated = Clock::get()?.unix_timestamp;
    
    msg!("Updated mint trade counter:");
    msg!("  Outgoing transfers: {}", counter.outgoing_transfers);
    msg!("  Total outgoing volume: {}", counter.total_outgoing_volume);
    msg!("  Amount: {}", amount);
    msg!("  Source owner: {}", source_owner);
    msg!("  Destination owner: {}", destination_owner);
    
    // Serialize and write back
    counter.serialize(&mut &mut account_data[..])?;
    
    Ok(())
}

fn execute_transfer_hook(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _amount: u64,
) -> ProgramResult {
    // Minimal transfer hook - just return success for now
    // This proves the transfer hook flow works without compute overhead
    Ok(())
} 