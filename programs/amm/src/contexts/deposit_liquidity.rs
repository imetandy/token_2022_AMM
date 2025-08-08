use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Token2022, TokenAccount, Mint, mint_to, MintTo},
};
use anchor_spl::token_interface::spl_token_2022;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_spl::associated_token::spl_associated_token_account;
use std::str::FromStr;

use crate::{
    constants::{POOL_AUTHORITY_SEED, AMM_SEED},
    errors::AmmError,
    state::{Amm, Pool},
};

#[derive(Accounts)]
#[instruction(amount_a: u64, amount_b: u64)]
pub struct DepositLiquidity<'info> {
    #[account(
        seeds = [
            AMM_SEED,
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub amm: Box<Account<'info, Amm>>,

    #[account(
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
        ],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: Pool authority PDA
    #[account(
        seeds = [
            pool.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            POOL_AUTHORITY_SEED,
        ],
        bump = pool.pool_authority_bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
    )]
    pub pool_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
    )]
    pub pool_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_a,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_b,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_lp_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: Pool LP account - will be validated manually
    pub pool_lp_account: AccountInfo<'info>,

    #[account(mut)]
    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = user.is_signer @ AmmError::NotSigner
    )]
    pub user: Signer<'info>,

    /// Solana ecosystem accounts
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,

    /// Transfer hook accounts for mint A
    /// CHECK: Extra account meta list for mint A
    pub extra_account_meta_list_a: AccountInfo<'info>,

    /// CHECK: Mint trade counter for mint A
    #[account(mut)]
    pub mint_trade_counter_a: AccountInfo<'info>,

    /// Transfer hook accounts for mint B
    /// CHECK: Extra account meta list for mint B
    pub extra_account_meta_list_b: AccountInfo<'info>,

    /// CHECK: Mint trade counter for mint B
    #[account(mut)]
    pub mint_trade_counter_b: AccountInfo<'info>,

    /// CHECK: Transfer hook program for mint A
    pub transfer_hook_program_a: AccountInfo<'info>,

    /// CHECK: Transfer hook program for mint B
    pub transfer_hook_program_b: AccountInfo<'info>,
}

impl<'info> DepositLiquidity<'info> {
    pub fn deposit_liquidity(
        &mut self,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        
        // Verify the pool authority derivation
        let expected_pool_authority = Pubkey::create_program_address(
            &[
                self.pool.key().as_ref(),
                self.mint_a.key().as_ref(),
                self.mint_b.key().as_ref(),
                POOL_AUTHORITY_SEED.as_ref(),
                &[self.pool.pool_authority_bump],
            ],
            &crate::ID,
        ).map_err(|_| AmmError::InvalidPoolAuthority)?;
        
        // Derive pool accounts on-chain using Token-2022 program
        let token_2022_program_id = Pubkey::from_str("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb").unwrap();
        
        // Manually derive associated token addresses to match TypeScript getAssociatedTokenAddressSync with allowOwnerOffCurve = true
        // This is equivalent to: getAssociatedTokenAddressSync(mint, owner, true, program_id)
        // The TypeScript version uses: findProgramAddressSync([owner.toBuffer(), programId.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID)
        let associated_token_program_id = spl_associated_token_account::ID;
        
        let (expected_pool_account_a, _) = Pubkey::find_program_address(
            &[
                self.pool_authority.key().as_ref(),
                token_2022_program_id.as_ref(),
                self.mint_a.key().as_ref(),
            ],
            &associated_token_program_id,
        );
        
        let (expected_pool_account_b, _) = Pubkey::find_program_address(
            &[
                self.pool_authority.key().as_ref(),
                token_2022_program_id.as_ref(),
                self.mint_b.key().as_ref(),
            ],
            &associated_token_program_id,
        );
        
        let (expected_pool_lp_account, _) = Pubkey::find_program_address(
            &[
                self.pool_authority.key().as_ref(),
                token_2022_program_id.as_ref(),
                self.lp_mint.key().as_ref(),
            ],
            &associated_token_program_id,
        );
        
        // Validate that the provided accounts match the derived ones
        if expected_pool_account_a != self.pool_account_a.key() {
            msg!("ERROR: Pool account A mismatch!");
            return Err(AmmError::InvalidPoolAuthority.into());
        }
        if expected_pool_account_b != self.pool_account_b.key() {
            msg!("ERROR: Pool account B mismatch!");
            return Err(AmmError::InvalidPoolAuthority.into());
        }
        if expected_pool_lp_account != self.pool_lp_account.key() {
            msg!("ERROR: Pool LP account mismatch!");
            return Err(AmmError::InvalidPoolAuthority.into());
        }
        
        msg!("Pool accounts validated successfully!");
        
        // Transfer tokens from user to pool
        self.transfer_tokens_to_pool(amount_a, amount_b)?;
        
        // Mint LP tokens to user
        self.mint_lp_tokens(amount_a, amount_b)?;
        
        Ok(())
    }
    
    fn transfer_tokens_to_pool(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Transfer token A with transfer hook
        if amount_a > 0 {
            
            // Create mutable transfer_checked instruction
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.user_account_a.key(),
                &self.mint_a.key(),
                &self.pool_account_a.key(),
                &self.user.key(),
                &[&self.user.key()],
                amount_a,
                6,
            ).unwrap();
            
            // Add transfer hook program ID first
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.transfer_hook_program_a.key(),
                false,
            ));
            
            // Add transfer hook accounts for mint A
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_a.key(),
                false,
            ));
            transfer_ix.accounts.push(AccountMeta::new(
                self.mint_trade_counter_a.key(),
                false,
            ));
                        
            // Invoke the modified instruction
            let account_infos = &[
                self.token_program.to_account_info(),
                self.user_account_a.to_account_info(),
                self.mint_a.to_account_info(),
                self.pool_account_a.to_account_info(),
                self.user.to_account_info(),
                self.transfer_hook_program_a.to_account_info(),
                self.extra_account_meta_list_a.to_account_info(),
                self.mint_trade_counter_a.to_account_info(),
            ];
            
            // Account infos prepared for transfer
            
            invoke(&transfer_ix, account_infos)?;
        }
        
        // Transfer token B with transfer hook
        if amount_b > 0 {
            
            // Create mutable transfer_checked instruction
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::id(),
                &self.user_account_b.key(),
                &self.mint_b.key(),
                &self.pool_account_b.key(),
                &self.user.key(),
                &[&self.user.key()],
                amount_b,
                6,
            ).unwrap();
            
            // Add transfer hook program ID first (required by the guide)
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.transfer_hook_program_b.key(),
                false,
            ));
            
            // Add transfer hook accounts for mint B
            transfer_ix.accounts.push(AccountMeta::new_readonly(
                self.extra_account_meta_list_b.key(),
                false,
            ));
            transfer_ix.accounts.push(AccountMeta::new(
                self.mint_trade_counter_b.key(),
                false,
            ));
            
            // Invoke the modified instruction
            let account_infos = &[
                self.token_program.to_account_info(),
                self.user_account_b.to_account_info(),
                self.mint_b.to_account_info(),
                self.pool_account_b.to_account_info(),
                self.user.to_account_info(),
                self.transfer_hook_program_b.to_account_info(),
                self.extra_account_meta_list_b.to_account_info(),
                self.mint_trade_counter_b.to_account_info(),
            ];
            
            invoke(&transfer_ix, account_infos)?;
        }
        
        Ok(())
    }
    
    pub fn mint_lp_tokens(&self, amount_a: u64, amount_b: u64) -> Result<()> {
        // Calculate LP tokens to mint using geometric mean (like the working AMM)
        let lp_amount = if amount_a > 0 && amount_b > 0 {
            // Geometric mean calculation similar to working AMM
            ((amount_a as u128 * amount_b as u128) as f64).sqrt() as u64
        } else {
            (amount_a + amount_b) / 2 // Fallback for edge cases
        };
        
        
        // Use the stored bump from the pool state
        let pool_authority_bump = self.pool.pool_authority_bump;
        
        let pool_key = self.pool.key();
        let mint_a_key = self.mint_a.key();
        let mint_b_key = self.mint_b.key();
        
        let authority_seeds = &[
            pool_key.as_ref(),
            mint_a_key.as_ref(),
            mint_b_key.as_ref(),
            POOL_AUTHORITY_SEED,
            &[pool_authority_bump],
        ];
        let signer_seeds = &[&authority_seeds[..]];
        
        // Mint LP tokens using the same pattern as working AMM
        self.mint_token(
            self.lp_mint.to_account_info(),
            self.user_lp_account.to_account_info(),
            self.pool_authority.to_account_info(),
            lp_amount,
            signer_seeds,
            self.token_program.to_account_info(),
        )?;
        
        Ok(())
    }

    pub fn mint_token(
        &self,
        mint: AccountInfo<'info>, 
        to: AccountInfo<'info>, 
        authority: AccountInfo<'info>, 
        amount: u64, 
        signer_seeds: &[&[&[u8]]; 1], 
        token_program: AccountInfo<'info>
    ) -> Result<()> {
        msg!("Minting {} tokens to {}", amount, to.key());
        
        mint_to(
            CpiContext::new_with_signer(
                token_program,
                MintTo {
                    mint,
                    to,
                    authority,
                },
                signer_seeds
            ),
            amount,
        )?;

        Ok(())
    }
} 