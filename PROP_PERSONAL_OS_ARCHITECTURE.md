# Prop and Personal Trading OS Architecture

## Objective

TNPA Trading OS now separates prop trading and personal trading into independent operating areas while keeping the shared trade engine intact. Trades, MT5 imports, manual trades, setup tags, playbooks, journal annotations, and risk calculations continue to use the existing normalized trade dataset.

## Navigation

The sidebar now exposes three trading areas:

- Prop Trading
  - Dashboard
  - Accounts
  - Challenges
  - Funded Accounts
  - Payouts
  - Analytics
- Personal Trading
  - Dashboard
  - Accounts
  - Performance
  - Withdrawals
  - Analytics
- Shared Trading
  - Trades
  - Risk Monitor
  - Import MT5

Wealth remains a separate navigation section and does not share these trading modules.

## Shared Trade Engine

The shared engine remains the source of truth:

- `useTradingDataset` merges MT5 imported trades and manual trades.
- Trades remain tagged by `source`, `accountType`, `accountName`, and `strategyType`.
- Prop trades use `accountType = "prop-firm"`.
- Personal trades use `accountType = "broker"`.
- MT5 import and manual trade creation continue to assign account metadata before trades enter the shared dataset.

## Prop Trading OS

Prop Trading focuses on prop-firm execution and challenge operations:

- `/prop-trading` keeps the prop dashboard.
- `/prop-trading/accounts` summarizes prop accounts by firm, challenge type, phase, status, P/L, open positions, and win rate.
- `/prop-trading/challenges` tracks challenge progress, profit target, daily loss usage, max loss usage, trading days, and rule compliance.
- `/prop-trading/funded-accounts` isolates funded-account monitoring and payout-ready funded accounts.
- `/prop-trading/payouts` reviews payout readiness, compliance blocks, open risk checks, and estimated payout pool.
- `/prop-trading/analytics` provides prop-only analytics by firm, challenge type, and setup.

## Personal Trading OS

Personal Trading focuses on broker execution, cashflow, and account growth:

- `/personal-trading` keeps the personal dashboard.
- `/personal-trading/accounts` summarizes broker accounts, net profit, floating P/L, open positions, and win rate.
- `/personal-trading/performance` tracks monthly cashflow and cumulative portfolio growth from personal trading results.
- `/personal-trading/withdrawals` stores personal withdrawal history in `localStorage` under `tnpa.personal-withdrawals.v1`.
- `/personal-trading/analytics` provides personal-only analytics by broker account, strategy, and setup.

## Files Changed

- `app/_components/sidebar.tsx`
- `app/_components/trading-os-modules.tsx`
- `app/prop-trading/accounts/page.tsx`
- `app/prop-trading/challenges/page.tsx`
- `app/prop-trading/funded-accounts/page.tsx`
- `app/prop-trading/payouts/page.tsx`
- `app/prop-trading/analytics/page.tsx`
- `app/personal-trading/accounts/page.tsx`
- `app/personal-trading/performance/page.tsx`
- `app/personal-trading/withdrawals/page.tsx`
- `app/personal-trading/analytics/page.tsx`

## Migration Notes

No destructive migration is required. Existing localStorage trade data remains compatible because the new modules read the existing `accountType` metadata:

- `prop-firm` trades appear in Prop Trading OS.
- `broker` trades appear in Personal Trading OS.
- Existing MT5 and manual trade records continue to work through `useTradingDataset`.

## Future Improvements

- Add dedicated prop account CRUD separate from trade-derived account summaries.
- Add personal broker account CRUD separate from trade-derived account summaries.
- Add payout request lifecycle statuses.
- Add withdrawal edit/archive flow.
- Add deeper prop compliance audit by rule breach timestamp.
