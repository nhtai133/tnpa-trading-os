# Hydration Fix P0 Report

Date: 2026-06-03

## Summary

Fixed recoverable hydration mismatch risk introduced by Cleanup Sprint P0 localStorage-backed UI. The fix makes P0 storage-backed components render stable SSR/client placeholders first, then switch to live localStorage values after client hydration.

## Root Cause

The P0 screens read localStorage-backed stores through client components. When localStorage data existed in the browser, the client could render live values before the hydrated tree matched the server-rendered empty snapshot, producing text mismatches.

The deeper route audit found two additional hydration risks:

- The shared sidebar used `usePathname()` to render active navigation classes during the first client render. That could make AppShell routes differ from the server-rendered shell before hydration completed.
- The home route computed localStorage-backed wealth summary data during initial render even though the visible text was gated.

Additional risk came from render-time defaults such as current dates in payout/withdrawal forms.

## Changes Made

### Shared Hydration Gate

- Added `app/_lib/use-hydrated.ts`.
- Uses `useSyncExternalStore` with a stable server snapshot.
- Marks hydration after mount through an external-store listener pattern, avoiding direct `setState` in effects.

### Shared Route Shell

- Updated `Sidebar` to render neutral inactive navigation on SSR and first client render.
- Sidebar active route styling now appears only after `useHydrated()` returns true.

### Home Route

- Replaced the local hydration implementation in `HomeDashboard` with the shared `useHydrated()` hook.
- Prevented localStorage-backed wealth summary reads until hydration.

### FTMO OS

- Gated `/prop-trading/accounts` localStorage-backed account registry behind a stable hydration placeholder.
- Gated `/prop-trading/payouts` localStorage-backed payout values behind a stable hydration placeholder.
- Changed payout form date/account defaults to derive only after hydration instead of being generated during initial render.
- Kept existing FTMO account and payout business logic unchanged.

### Personal Trading OS

- Gated `/personal-trading/accounts` localStorage-backed personal registry behind a stable hydration placeholder.
- Changed withdrawal date/account defaults to derive only after hydration.
- Personal Trading dashboard now keeps registry-provided account names hidden until hydration, while preserving trade-derived fallback.
- Kept existing personal account and withdrawal business logic unchanged.

### Wealth OS

- Gated generic Wealth Asset CRUD screens behind stable hydration placeholders:
  - `/portfolio`
  - `/savings`
  - `/real-estate`
- Gated `WealthSummary` so Net Worth and Wealth summary values render a stable placeholder first.
- Updated `WealthDashboardV2` to use empty visible stores until hydration, then live localStorage stores.
- Prevented net-worth snapshot month generation and snapshot writes until after hydration.

## Files Changed

- `app/_lib/use-hydrated.ts`
- `app/_components/sidebar.tsx`
- `app/_components/home-dashboard.tsx`
- `app/_components/trading-os-modules.tsx`
- `app/_components/trading-account-dashboards.tsx`
- `app/_components/wealth-assets-module.tsx`
- `app/_components/wealth-summary.tsx`
- `app/_components/wealth-dashboard-v2.tsx`

## Routes Verified

- `/`
- `/wealth`
- `/net-worth`
- `/portfolio`
- `/savings`
- `/real-estate`
- `/prop-trading/accounts`
- `/personal-trading/accounts`
- `/prop-trading/payouts`

## Verification

- `npm run lint`: Passed.
- `npm run build`: Passed.

Build note: the first build attempt failed because restricted network access blocked `next/font` from fetching Google fonts. The build was rerun with network approval and completed successfully.

## Business Logic Impact

- No business logic was changed.
- No new features were added.
- MT5 import was not modified.
- Existing analytics were not modified.
- Existing localStorage keys and compatibility were preserved.
