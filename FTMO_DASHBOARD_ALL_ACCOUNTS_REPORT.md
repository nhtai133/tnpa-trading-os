# FTMO Dashboard All Accounts Report

## Objective

The FTMO Dashboard now supports an `All Accounts` overview mode for monitoring every FTMO registry account together. Selecting a specific account still opens the detailed single-account dashboard.

## Selector Behavior

The dashboard account selector includes:

- All Accounts
- Every FTMO account from the FTMO account registry

The empty selector value represents `All Accounts`.

## All Accounts Overview

When `All Accounts` is selected, the dashboard shows portfolio-level FTMO summary cards:

- Total Challenge Capital
- Total Funded Capital
- Active Challenges
- Funded Accounts
- Accounts Near Pass
- Accounts At Risk
- Total Profit Target Remaining
- Total Lifetime Payout

## FTMO Account Table

The overview includes an FTMO account table with:

- Account Name
- Account Size
- Type
- Phase
- Status
- Profit Target Progress
- Daily Loss Remaining
- Max Loss Remaining
- Trading Days Progress
- Next Action

## Status Badges

Visual badges support:

- Safe
- Warning
- Danger
- Near Pass
- Funded
- Payout Ready

## Challenge Accounts

Challenge rows show:

- Remaining to pass
- Daily loss remaining
- Max loss remaining
- Trading days progress

## Funded Accounts

Funded rows show:

- Current profit
- Lifetime payout
- Estimated next payout
- Payout readiness

## Compatibility

The implementation keeps the existing FTMO account registry, FTMO Import MT5, FTMO Trades, FTMO Analytics, FTMO Risk, Personal Trading, and Wealth modules intact.

## Files Changed

- `app/_components/trading-account-dashboards.tsx`
- `FTMO_DASHBOARD_ALL_ACCOUNTS_REPORT.md`
