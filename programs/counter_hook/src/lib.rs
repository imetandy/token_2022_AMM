use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    clock::Clock,
    sysvar::Sysvar,
    program::invoke_signed,
};
use solana_program::entrypoint; // import macro for native entrypoint
#[allow(deprecated)]
use solana_program::system_instruction;
use spl_transfer_hook_interface::instruction::TransferHookInstruction;
use borsh::{BorshDeserialize, BorshSerialize};
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;
use solana_program::sysvar::rent::Rent;

pub use errors::*;
pub mod errors;
pub use state::*;
pub mod state;

// Program ID - actual deployed program ID
solana_program::declare_id!("4476u1WA3X8iHbLnhKsmRVTBp4cynRMopq9WB8nSs3M9");

// Instruction discriminators for our custom instructions
pub const INITIALIZE_MINT_TRADE_COUNTER_DISCRIMINATOR: [u8; 8] = [1, 2, 3, 4, 5, 6, 7, 8];
pub const UPDATE_MINT_TRADE_COUNTER_DISCRIMINATOR: [u8; 8] = [9, 10, 11, 12, 13, 14, 15, 16];
pub const INITIALIZE_EXTRA_ACCOUNT_META_LIST_DISCRIMINATOR: [u8; 8] = [17, 18, 19, 20, 21, 22, 23, 24];

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
        } else if discriminator == INITIALIZE_EXTRA_ACCOUNT_META_LIST_DISCRIMINATOR {
            return initialize_extra_account_meta_list(program_id, accounts);
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
    let mint_trade_counter_info = next_account_info(account_info_iter)?; // PDA writable
    let mint_info = next_account_info(account_info_iter)?; // readonly mint
    let hook_owner_info = next_account_info(account_info_iter)?; // readonly
    let payer_info = next_account_info(account_info_iter)?; // signer
    let system_program_info = next_account_info(account_info_iter)?;
    
    // Validate accounts
    if !mint_trade_counter_info.is_writable {
        msg!("Error: mint_trade_counter must be writable");
        return Err(ProgramError::InvalidAccountData);
    }

    // Create PDA if needed
    if mint_trade_counter_info.data_is_empty() {
        let (expected_pda, bump) = Pubkey::find_program_address(&[b"mint-trade-counter", mint_info.key.as_ref()], program_id);
        if expected_pda != *mint_trade_counter_info.key {
            msg!("Counter PDA mismatch");
            return Err(ProgramError::InvalidSeeds);
        }
        let space: u64 = MintTradeCounter::LEN as u64;
        let lamports = Rent::get()?.minimum_balance(space as usize);
        #[allow(deprecated)]
        let create_ix = system_instruction::create_account(
            payer_info.key,
            mint_trade_counter_info.key,
            lamports,
            space,
            program_id,
        );
        let seeds: &[&[u8]] = &[b"mint-trade-counter", mint_info.key.as_ref(), &[bump]];
        invoke_signed(
            &create_ix,
            &[payer_info.clone(), mint_trade_counter_info.clone(), system_program_info.clone()],
            &[seeds],
        )?;
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
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    // Accounts (per spl-transfer-hook Execute):
    // 0: source token, 1: mint, 2: destination token, 3: owner, ...extra resolved accounts...
    msg!("=== TRANSFER HOOK EXECUTE (counter update) ===");
    msg!("Amount: {}", amount);
    if accounts.len() < 5 {
        msg!("No extra accounts resolved; skipping counter update");
        return Ok(());
    }
    // Take the first extra as our mint trade counter PDA
    let mint_trade_counter_info = &accounts[4];
    if !mint_trade_counter_info.is_writable {
        msg!("Counter PDA not writable; skipping");
        return Ok(());
    }
    if *mint_trade_counter_info.owner != *program_id {
        msg!("Counter PDA not owned by hook program; skipping");
        return Ok(());
    }

    // Update the counter (outgoing as default)
    let mut data = mint_trade_counter_info.data.borrow_mut();
    if data.len() < MintTradeCounter::LEN {
        msg!("Counter PDA size too small; skipping");
        return Ok(());
    }
    let mut counter = MintTradeCounter::try_from_slice(&data)?;
    counter.outgoing_transfers = counter.outgoing_transfers.saturating_add(1);
    counter.total_outgoing_volume = counter.total_outgoing_volume.saturating_add(amount);
    counter.last_updated = Clock::get()?.unix_timestamp;
    counter.serialize(&mut &mut data[..])?;
    msg!("Counter updated: outgoing_transfers={}, total_outgoing_volume={}", counter.outgoing_transfers, counter.total_outgoing_volume);
    Ok(())
}

fn initialize_extra_account_meta_list(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer_info = next_account_info(account_info_iter)?; // signer
    let eaml_info = next_account_info(account_info_iter)?; // writable PDA
    let mint_info = next_account_info(account_info_iter)?; // readonly mint
    let system_program_info = next_account_info(account_info_iter)?;

    // Derive PDA and bump
    let (expected_pda, bump) = Pubkey::find_program_address(&[b"extra-account-metas", mint_info.key.as_ref()], program_id);
    if expected_pda != *eaml_info.key {
        msg!("EAML PDA mismatch");
        return Err(ProgramError::InvalidSeeds);
    }

    // Create account if not already allocated
    if eaml_info.data_is_empty() {
        let space: u64 = 128;
        let lamports = Rent::get()?.minimum_balance(space as usize);
        #[allow(deprecated)]
        let create_ix = system_instruction::create_account(
            payer_info.key,
            eaml_info.key,
            lamports,
            space,
            program_id,
        );
        let seeds: &[&[u8]] = &[b"extra-account-metas", mint_info.key.as_ref(), &[bump]];
        invoke_signed(
            &create_ix,
            &[payer_info.clone(), eaml_info.clone(), system_program_info.clone()],
            &[seeds],
        )?;
    }

    // Initialize ExtraAccountMetaList for ExecuteInstruction with mint-trade-counter meta
    let mut data = eaml_info.data.borrow_mut();
    let meta = ExtraAccountMeta::new_with_seeds(
        &[
            Seed::Literal { bytes: b"mint-trade-counter".to_vec() },
            Seed::AccountKey { index: 1 }, // mint account index in Execute (source,mint,dest,owner)
        ],
        false,
        true,
    )?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &[meta])?;
    msg!("Initialized EAML for mint {}", mint_info.key);
    Ok(())
}