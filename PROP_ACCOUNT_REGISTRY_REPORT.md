# Prop Account Registry Report

## Objective

TNPA OS now has a persistent Prop Account Registry so prop workflows no longer depend only on trade/import metadata. The registry is stored in localStorage and drives Prop Dashboard, Challenges, Funded Accounts, Prop Trades, Prop Analytics, Prop Risk, and Prop Import MT5.

## Storage

Registry storage lives in:

- `app/_lib/prop-account-storage.ts`

Storage key:

- `tnpa.prop-accounts.v1`

Each prop account includes:

- `id`
- `firmName`
- `accountName`
- `accountSize`
- `challengeType`
- `phase`
- `status`
- `startDate`
- `minimumTradingDays`
- `profitTargetPercent`
- `dailyLossLimitPercent`
- `maxLossLimitPercent`

## Demo Accounts

Settings now supports:

- Load Demo Prop Accounts
- Clear Demo Prop Accounts

Seeded accounts:

- FTMO V2 Challenge A, 100K, 2-Step, Phase 1, Active
- FTMO V2 Challenge B, 100K, 2-Step, Phase 1, Active
- FTMO V1 Challenge A, 50K, 1-Step, Phase 1, Active
- FTMO V1 Challenge B, 50K, 1-Step, Phase 1, Active
- FTMO Live 50K, 50K, Funded, Funded

## Prop Dashboard

The Prop Dashboard now selects accounts from the registry. For the selected account it shows:

- Account size
- Firm
- Challenge type
- Phase
- Status
- Profit target progress
- Daily loss remaining
- Max loss remaining
- Trading days progress
- Can trade today
- Next action

## Challenge Lifecycle

The Challenges page now uses the registry and separates:

- Active Challenges
- Passed Challenges
- Failed Challenges

Each challenge card shows account details, risk remaining, profit target progress, and trading day progress.

## Funded Accounts

The Funded Accounts page now uses registry accounts with `status = Funded` or `phase = Funded`. It shows:

- Account name
- Account size
- Net profit
- Payout readiness
- Open positions
- Risk status

## Prop Import MT5

Prop Import MT5 now uses registry account names when available. Selecting a registry account applies the registry metadata to the imported MT5 report and imported trades.

## Prop Scoped Workflows

The following prop routes now filter by the selected registry account:

- `/prop-trading/trades`
- `/prop-trading/analytics`
- `/prop-trading/risk`

The shared routes remain intact and personal trading/wealth modules are unchanged.

## Files Changed

- `app/_lib/prop-account-storage.ts`
- `app/_lib/trading-types.ts`
- `app/_components/settings-module.tsx`
- `app/_components/trading-account-dashboards.tsx`
- `app/_components/trading-os-modules.tsx`
- `app/_components/import-mt5-module.tsx`
- `app/_components/trades-module.tsx`
- `app/_components/analytics-module.tsx`
- `app/_components/risk-module.tsx`
