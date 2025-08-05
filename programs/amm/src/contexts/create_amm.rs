use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::{constants::AMM_SEED, errors::*, state::Amm};

#[derive(Accounts)]
#[instruction(mint_a: Pubkey, mint_b: Pubkey, sol_fee: u64)]
pub struct CreateAmm<'info> {
    // The AMM account
    #[account(
        init_if_needed,
        payer = authority,
        space = Amm::LEN,
        seeds = [
            AMM_SEED,
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub amm: Box<Account<'info, Amm>>,

    /// The admin of the AMM
    #[account(
        constraint = admin.is_signer @ AmmError::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,

    /// SOL fee collector account
    /// CHECK: This is the account that will receive SOL fees
    pub sol_fee_collector: AccountInfo<'info>,

    // The account paying for all rents
    #[account(mut)]
    pub authority: Signer<'info>,
    
    // Token mints for the AMM
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,
    
    // Solana ecosystem accounts
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(new_admin: Pubkey)]
pub struct UpdateAmm<'info> {
    #[account(
        mut,
        seeds = [
            AMM_SEED,
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub amm: Account<'info, Amm>,
    
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        constraint = admin.is_signer @ AmmError::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(new_fee: u16)]
pub struct UpdateFee<'info> {
    #[account(
        mut,
        seeds = [
            AMM_SEED,
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub amm: Account<'info, Amm>,
    
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        constraint = admin.is_signer @ AmmError::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,
}

impl<'info> CreateAmm<'info> {
    pub fn create_amm(
        &mut self, 
        mint_a: Pubkey, 
        mint_b: Pubkey,
        sol_fee: u64,
        sol_fee_collector: Pubkey,
    ) -> Result<()> {
        msg!("Entering create_amm implementation");
        msg!("Mint A: {}", mint_a);
        msg!("Mint B: {}", mint_b);

        // Check if the AMM has already been created
        if self.amm.created {
            msg!("AMM has already been created, cannot create again");
            return Err(AmmError::PoolAlreadyExists.into());
        }
        
        msg!("AMM not created yet, proceeding with creation");
        msg!("About to create Amm struct");
        
        // Create a deterministic pool ID from the mints
        let pool_id = format!("{}-{}", mint_a, mint_b);
        let mut pool_id_array = [0u8; 64];
        let pool_id_bytes = pool_id.as_bytes();
        let copy_len = std::cmp::min(pool_id_bytes.len(), 64);
        pool_id_array[..copy_len].copy_from_slice(&pool_id_bytes[..copy_len]);
        
        let amm_struct = Amm {
            pool_id: pool_id_array,
            admin: self.admin.key(),
            sol_fee,
            sol_fee_collector,
            created: true,
            is_immutable: false, // Defaulting to false when created
        };
        
        msg!("Amm struct created successfully");
        msg!("About to call set_inner");
        msg!("AMM::LEN constant: {}", Amm::LEN);
        
        // set inner values of amm
        self.amm.set_inner(amm_struct);
        
        msg!("set_inner completed successfully");
        msg!("AMM Created, setting created state to True");
        
        Ok(())
    }
    
}

impl<'info> UpdateAmm<'info> {
    pub fn update_admin(
        &mut self,
        new_admin: Pubkey,
    ) -> Result<()> {
        
        // Check if the AMM has already been created
        if !self.amm.created {
            msg!("AMM has not been created, cannot update admin");
            return Err(AmmError::PoolDoesNotExist.into());
        }
        // Check if the AMM is immutable. If it is, then it cannot be updated.
        if self.amm.is_immutable {
            msg!("AMM Is now immutable. Cannot update.");
            return Err(AmmError::UnauthorizedAdmin.into());
        }

        // Add in a check for the admin's signature
        if !self.admin.is_signer {
            return Err(AmmError::NotSigner.into());
        }
        
        // Set the new admin
        self.amm.admin = new_admin;
        msg!("Admin Updated");
        Ok(())
    }

    // Function to make the AMM immutable
    pub fn make_immutable(&mut self) -> Result<()> {
        // Check if the current admin is the signer
        if self.admin.key() != self.amm.admin {
            msg!("Unauthorized Admin, Cannot make AMM immutable");
            return Err(AmmError::UnauthorizedAdmin.into());
        }

        // Set the AMM as immutable
        self.amm.is_immutable = true;
        msg!("AMM is now immutable");
        Ok(())
    }
}

impl<'info> UpdateFee<'info> {
    pub fn update_fee(
        &mut self,
        new_sol_fee: u64,
    ) -> Result<()> {
        
        // Check if the AMM has already been created
        if !self.amm.created {
            msg!("AMM has not been created, cannot update fee");
            return Err(AmmError::PoolDoesNotExist.into());
        }
        // Check if the AMM is immutable. If it is, then it cannot be updated.
        if self.amm.is_immutable {
            msg!("AMM Is now immutable. Cannot update.");
            return Err(AmmError::UnauthorizedAdmin.into());
        }

        // Add in a check for the admin's signature
        if !self.admin.is_signer {
            return Err(AmmError::NotSigner.into());
        }
        
        // Set the new SOL fee
        self.amm.sol_fee = new_sol_fee;
        msg!("SOL Fee Updated");
        Ok(())
    }

} 