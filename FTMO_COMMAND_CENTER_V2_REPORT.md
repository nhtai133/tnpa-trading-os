# FTMO Command Center V2 Report

## Objective

FTMO Dashboard All Accounts mode now includes a command-center layer for daily account prioritization, account health scoring, and mission planning.

## Daily Command Panel

The All Accounts view now shows:

- Best Account To Trade Today
- Account To Avoid Today
- Account Near Passing
- Account Near Payout
- Account At Risk

These recommendations are derived from account health score, target progress, risk usage, payout readiness, and account phase.

## Account Health Score

Every FTMO account receives a 0-100 health score based on:

- Target progress
- Daily loss remaining
- Max loss remaining
- Trading days progress
- Discipline score
- Open risk

## Health Ranking

The Account Health Ranking table shows:

- Rank
- Account
- Health Score
- Status
- Recommended Action

## Mission Cards

Every account has a mission card with:

- Mission
- Remaining To Target
- Suggested Daily Profit Pace
- Risk Budget Remaining

Mission logic supports:

- Pass Phase 1
- Pass Phase 2
- Protect Funded Account
- Prepare For Payout

## Next Action Logic

The FTMO dashboard now supports:

- Keep Trading
- Stop Trading Today
- Trade Small Size
- Close To Passing
- Protect Funded
- Payout Ready
- Rule Danger

## Compatibility

The existing FTMO account registry, All Accounts overview, FTMO import, FTMO trades, FTMO analytics, FTMO risk, Personal Trading, and Wealth modules remain intact.

## Files Changed

- `app/_components/trading-account-dashboards.tsx`
- `FTMO_COMMAND_CENTER_V2_REPORT.md`
