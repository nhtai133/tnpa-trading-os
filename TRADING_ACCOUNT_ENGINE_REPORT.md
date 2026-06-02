# Trading Account Engine V1 Report

## Architecture

Trading Account Engine V1 adds account metadata to the existing trade model instead of creating a separate trade store.

Each trade now carries:

- `source`: `mt5` or `manual`
- `accountType`: `Prop Firm` or `Broker`
- `accountName`: prop-firm or broker account label
- `strategyType`: `Intraweek`, `Swing`, `Position`, `Scalp`, `Crypto Spot`, or `Other`

The central merge point remains `useTradingDataset`. It upgrades older localStorage and imported records with defaults, then returns one normalized dataset to Trades, Analytics, Risk Monitor, and dashboards.

MT5 imports assign account metadata at import time and persist it with the imported report. Manual trades require account metadata in the create/edit flow and persist it in the manual trade localStorage store.

## Files Changed

- `app/_lib/trading-types.ts`
  - Added account taxonomy, strategy taxonomy, `TradingAccount`, and optional account fields on `Trade` and `Mt5AccountReport`.

- `app/_lib/use-trading-dataset.ts`
  - Normalizes MT5 and manual trades with source/account metadata.
  - Keeps legacy data compatible with default account assignments.

- `app/_lib/manual-trade-storage.ts`
  - Persists manual trade account metadata.
  - Sanitizes older manual trades with broker/swing defaults.
  - Supports full manual trade updates.

- `app/_lib/trading-data.ts`
  - Adds source/account defaults to server-loaded mock or sample MT5 trade data.

- `app/_lib/trading-client-data.ts`
  - Adds client-safe fallback account metadata.

- `app/_components/import-mt5-module.tsx`
  - Adds account type, account name, and strategy type assignment before parsing/storing MT5 reports.

- `app/_components/trades-module.tsx`
  - Requires account metadata for manual trades.
  - Adds account type, account name, and strategy filters.
  - Shows account and strategy columns.

- `app/_components/analytics-module.tsx`
  - Adds account type, account name, and strategy filters.

- `app/_components/trading-account-dashboards.tsx`
  - Adds shared prop-firm and broker dashboard components.

- `app/prop-firm/page.tsx`
  - Adds `/prop-firm`.

- `app/broker-trading/page.tsx`
  - Adds `/broker-trading`.

- `app/_components/sidebar.tsx`
  - Adds Prop Firm and Broker Trading navigation links.

## Migration Notes

Existing localStorage data remains readable.

Older MT5 trades without account fields are normalized as:

- `source`: `mt5`
- `accountType`: `Prop Firm`
- `accountName`: report account name, or `FTMO Intraweek`
- `strategyType`: `Intraweek`

Older manual trades without account fields are normalized as:

- `source`: `manual`
- `accountType`: `Broker`
- `accountName`: `ICMarkets Swing`
- `strategyType`: `Swing`

New MT5 imports store account metadata with the report and each imported trade. New manual trades require account metadata before saving.

## Future Improvements

- Add a dedicated Trading Account management page.
- Allow editing account assignment for existing imported MT5 reports without re-importing.
- Store account definitions separately from trades.
- Add account-level equity curves and account-level drawdown charts.
- Add checklist/rules per account and strategy type.
- Add cross-account capital allocation reporting.
