# TNPA Cleanup P0 Report

Date: 2026-06-03

## Summary

Implemented TNPA Cleanup Sprint P0 to make TNPA OS usable without loading demo data. The work added first-class creation and management flows for FTMO accounts, personal trading accounts, FTMO payouts, and generic wealth assets.

## Completed P0 Items

### P0.1 FTMO Account Creation

- Added `Add FTMO Account` action on `/prop-trading/accounts`.
- Added create/edit drawer for FTMO accounts.
- Added archive support by setting account status to `Archived`.
- Persisted records to the existing FTMO registry storage key: `tnpa.prop-accounts.v1`.
- Preserved trade-derived account fallback when no registry records exist.

### P0.2 Personal Trading Account Creation

- Added personal trading account registry storage.
- Added `Add Personal Account` action on `/personal-trading/accounts`.
- Added create/edit/archive support for personal trading accounts.
- Personal Trading dashboard and withdrawals now include registry-created personal accounts.
- Preserved existing trade-derived account fallback.

### P0.3 Payout Entry System

- Added payout entry form on `/prop-trading/payouts`.
- Fields added:
  - Account
  - Date
  - Amount
  - Notes
- Payouts persist to the existing FTMO payout storage key: `tnpa.ftmo-payouts.v1`.
- Existing Funded Account payout history and lifetime payout calculations update through the existing payout subscription.

### P0.4 Wealth Asset Creation

- Added generic wealth asset CRUD module.
- Added asset creation/edit/archive support.
- Added supported asset types:
  - Crypto
  - Stocks
  - ETF
  - Mutual Fund
  - Real Estate
  - Loan
  - Vehicle
  - Cash
  - Other
- Kept legacy wealth asset classes valid for stored data compatibility.
- Converted `/portfolio`, `/savings`, and `/real-estate` from summary/placeholder screens into asset management screens.
- Persisted assets to the existing wealth asset storage key: `tnpa.wealth-assets.v1`.

## Compatibility Notes

- MT5 import was not modified.
- Existing analytics modules were not modified.
- Existing FTMO registry storage compatibility was preserved.
- Existing FTMO payout storage compatibility was preserved.
- Existing wealth asset storage compatibility was preserved.
- Existing trade-derived account fallback behavior was preserved for FTMO and Personal Trading account screens.

## Files Changed

- `app/_components/trading-os-modules.tsx`
- `app/_components/trading-account-dashboards.tsx`
- `app/_components/wealth-assets-module.tsx`
- `app/_lib/personal-account-storage.ts`
- `app/_lib/wealth-types.ts`
- `app/_lib/wealth-metrics.ts`
- `app/portfolio/page.tsx`
- `app/savings/page.tsx`
- `app/real-estate/page.tsx`

## Verification

- `npm run lint`: Passed.
- `npm run build`: Passed.

Build note: the first build attempt failed because restricted network access blocked `next/font` from fetching Google fonts. The build was rerun with network approval and completed successfully.

## Remaining Follow-Up

- Add richer account lifecycle history for FTMO accounts.
- Add payout proof/screenshot attachment.
- Add personal account deposit/transfer flows.
- Add wealth asset transaction history.
- Add explicit data-source badges for demo/import/manual/registry records.
