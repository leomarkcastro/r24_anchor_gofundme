use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("4sexL2C9M3xM69EzMwFEN4yTkm3qWmJpBu83KXyjsmqJ");

// create error types
#[error_code]
pub enum FundMeErrors {
    #[msg("Value must be greater than 0")]
    TargetFundMustBeGreaterThanZero,
    #[msg("Fund not reached yet")]
    FundNotReachedYet,
}

#[program]
pub mod r24_anchor_gofundme {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        name: String,
        description: String,
        target_fund: u64,
    ) -> Result<()> {
        require!(
            target_fund > 0,
            FundMeErrors::TargetFundMustBeGreaterThanZero
        );

        let fund_data = &mut ctx.accounts.funds_data;
        fund_data.set_inner(FundData {
            name: name,
            description: description,
            target_fund: target_fund,
            bump: *ctx.bumps.get("funds_data").unwrap(),
        });
        Ok(())
    }

    pub fn fund(ctx: Context<ExternalStruct>, amount: u64) -> Result<()> {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.funds_data.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<OwnerStruct>) -> Result<()> {
        let fund_data = &mut ctx.accounts.funds_data;

        // compute rent
        let rent = Rent::get()?;

        // compute rent exempt
        let rent_exempt = rent.minimum_balance(FUNDSACT_SIZE);

        // get current balance
        let current_balance = **fund_data.to_account_info().lamports.borrow();

        let amount = current_balance - rent_exempt;

        require!(
            amount >= fund_data.target_fund,
            FundMeErrors::FundNotReachedYet
        );

        **ctx
            .accounts
            .funds_data
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}

#[account]
pub struct FundData {
    pub name: String,
    pub description: String,
    pub target_fund: u64,
    pub bump: u8,
}

const FUNDS_SEED: &[u8] = b"gofundme-20221215";
// get size of FundData
const FUNDSACT_SIZE: usize = 100;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer=user, space=FUNDSACT_SIZE, seeds=[FUNDS_SEED, user.key().as_ref()], bump)]
    pub funds_data: Account<'info, FundData>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerStruct<'info> {
    #[account(mut, seeds=[FUNDS_SEED, user.key().as_ref()], bump=funds_data.bump)]
    pub funds_data: Account<'info, FundData>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExternalStruct<'info> {
    #[account(mut)]
    pub funds_data: Account<'info, FundData>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
