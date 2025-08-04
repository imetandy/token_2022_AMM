use anchor_lang::prelude::*;
use crate::{constants::AMM_SEED, errors::*, state::Amm};

#[derive(Accounts)]
#[instruction(pool_id: String, sol_fee: u64)]
pub struct CreateAmm<'info> {
    // The AMM account
    #[account(
        init,
        payer = authority,
        space = Amm::LEN,
        seeds = [
            AMM_SEED,
            pool_id.as_bytes(),
        ],
        bump,
        constraint = sol_fee > 0 && sol_fee <= 100_000_000 @ AmmError::InvalidFee, // Max 0.1 SOL
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
            amm.pool_id.as_bytes()
        ],
        bump,
    )]
    pub amm: Account<'info, Amm>,

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
            amm.pool_id.as_bytes()
        ],
        bump,
    )]
    pub amm: Account<'info, Amm>,

    #[account(
        constraint = admin.is_signer @ AmmError::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,
}



impl<'info> CreateAmm<'info> {
    pub fn create_amm(
        &mut self, 
        pool_id: String, 
        sol_fee: u64,
        sol_fee_collector: Pubkey,
    ) -> Result<()> {

        // Check if the AMM has already been created
        if self.amm.created {
            msg!("AMM has already been created, cannot create again");
            return Err(AmmError::AlreadyCreated.into());
        } else {

            // set inner values of amm
            self.amm.set_inner(
                Amm {
                    pool_id,
                    admin: self.admin.key(),
                    sol_fee,
                    sol_fee_collector,
                    created: true,
                    is_immutable: false, // Defaulting to false when created
                }
            );
            
            msg!("AMM Created, setting created state to True");
        
            Ok(())
        
        }
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
            return Err(AmmError::NotCreated.into());
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
        if self.admin.key() != self.admin.key() {
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
            return Err(AmmError::NotCreated.into());
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