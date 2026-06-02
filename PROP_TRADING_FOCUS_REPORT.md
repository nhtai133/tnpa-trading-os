# Prop Trading Focus Report

## Objective

TNPA OS now prioritizes Prop Trading as the primary weekly workflow. Shared trading engines remain available, but Prop Trading OS has its own routes for trades, analytics, risk, import, accounts, challenges, funded accounts, and payouts.

## Navigation Changes

The Prop Trading section now leads with:

- Prop Dashboard
- Prop Trades
- Prop Analytics
- Prop Risk Monitor
- Prop Import MT5
- Prop Accounts
- Challenges
- Funded Accounts
- Payouts

The existing shared routes remain available:

- `/trades`
- `/analytics`
- `/risk`
- `/import-mt5`

## New Prop Routes

- `/prop-trading/trades`
- `/prop-trading/analytics`
- `/prop-trading/risk`
- `/prop-trading/import-mt5`

## Prop Scoped Engines

The new prop routes reuse existing engines with `accountType = "prop-firm"` scope:

- `TradesModule` supports `scopeAccountType`.
- `AnalyticsModule` supports `scopeAccountType`.
- `RiskModule` supports `scopeAccountType`.
- `ImportMt5Module` supports prop defaults, locked account type, and required prop metadata.

## Prop Trades

`/prop-trading/trades` shows prop-firm trades by default. The New Trade drawer defaults manual trades to:

- `accountType = "prop-firm"`
- `accountName = "FTMO"`
- `strategyType = "Intraweek"`

Prop challenge metadata remains editable in the manual trade drawer.

## Prop Analytics

`/prop-trading/analytics` filters to prop-firm data by default and includes:

- Account filter
- Strategy filter
- Challenge type filter
- Phase filter
- MT5/manual source filter

The shared `/analytics` route is unchanged.

## Prop Risk

`/prop-trading/risk` filters to prop-firm trades and keeps the FTMO-style risk engine focused on:

- Daily loss usage
- Max loss usage
- Profit target progress
- Challenge status
- Challenge type
- Phase
- Account size

The shared `/risk` route is unchanged.

## Prop Import MT5

`/prop-trading/import-mt5` defaults and locks imports to `prop-firm`. It requires prop challenge metadata before parsing:

- Firm name
- Challenge type
- Phase
- Account size
- Account name
- Strategy type
- Profit target %
- Daily loss limit %
- Max loss limit %
- Minimum trading days

The shared `/import-mt5` route remains available.

## Compatibility

No storage migration was required. Existing localStorage data remains compatible because scoping is applied at the UI/engine layer through normalized trade metadata.

## Files Changed

- `app/_components/sidebar.tsx`
- `app/_components/trades-module.tsx`
- `app/_components/analytics-module.tsx`
- `app/_components/risk-module.tsx`
- `app/_components/import-mt5-module.tsx`
- `app/prop-trading/trades/page.tsx`
- `app/prop-trading/analytics/page.tsx`
- `app/prop-trading/risk/page.tsx`
- `app/prop-trading/import-mt5/page.tsx`
