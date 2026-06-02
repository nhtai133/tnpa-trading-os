# Prop / Personal Trading Split Report

## Architecture

The trading area is now split into two focused operating surfaces:

- `Prop Trading OS` at `/prop-trading`
- `Personal Trading OS` at `/personal-trading`

The shared trade dataset remains centralized in `useTradingDataset`. Trades still preserve MT5/manual source separation, and now carry account metadata used by both dashboards:

- `accountType`: `prop-firm` or `broker`
- `accountName`
- `strategyType`

Prop-firm trades can also carry challenge metadata:

- `firmName`
- `accountSize`
- `challengeType`
- `phase`
- `profitTargetPercent`
- `dailyLossLimitPercent`
- `maxLossLimitPercent`
- `minimumTradingDays`
- `startDate`
- `propStatus`

The dataset hook normalizes older records so previous localStorage data remains usable.

## Files Changed

- `app/_lib/trading-types.ts`
  - Added prop challenge taxonomy and prop account metadata fields.
  - Updated account type values to `prop-firm` and `broker`.

- `app/_lib/use-trading-dataset.ts`
  - Normalizes legacy account types.
  - Adds default prop and broker metadata for older trades/imports.

- `app/_lib/manual-trade-storage.ts`
  - Requires and persists account metadata for manual trades.
  - Persists prop challenge metadata when account type is `prop-firm`.

- `app/_lib/trading-data.ts`
  - Adds prop-firm defaults to server-loaded mock/imported trades.

- `app/_lib/trading-client-data.ts`
  - Adds client-safe prop challenge defaults.

- `app/_components/import-mt5-module.tsx`
  - Adds required account assignment before import.
  - Adds prop challenge type and phase fields for prop-firm imports.

- `app/_components/trades-module.tsx`
  - Manual create/edit flows now require account metadata.
  - Prop-firm manual trades expose challenge fields.
  - Existing setup tags, playbooks, journal fields, screenshots, and source tabs remain intact.

- `app/_components/analytics-module.tsx`
  - Account filters continue to work with the new `prop-firm` / `broker` values.

- `app/_components/trading-account-dashboards.tsx`
  - Replaced the old prop/broker dashboard implementation with Prop Trading OS and Personal Trading OS dashboards.

- `app/prop-trading/page.tsx`
  - Adds `/prop-trading`.

- `app/personal-trading/page.tsx`
  - Adds `/personal-trading`.

- `app/_components/sidebar.tsx`
  - Updates Trading navigation to Prop Trading and Personal Trading.

## Migration Notes

Existing records remain compatible.

Legacy account types are normalized:

- `Prop Firm` becomes `prop-firm`
- `Broker` becomes `broker`

Older MT5 trades without prop metadata default to:

- firm: `FTMO`
- account name: `FTMO`
- challenge type: `2-Step Challenge`
- phase: `Phase 1`
- account size: `100000`
- profit target: `10%`
- daily loss limit: `5%`
- max loss limit: `10%`
- minimum trading days: `4`
- status: `Active`

Older manual trades without account metadata default to:

- account type: `broker`
- account name: `ICMarkets`
- strategy type: `Swing`

## Future Improvements

- Add a dedicated prop account management page.
- Allow editing MT5 import account assignment after import.
- Store prop account definitions separately from trades.
- Add phase-specific FTMO rule profiles.
- Add personal broker account deposits/withdrawals.
- Add account-level equity curves and account-level calendar heatmaps.
