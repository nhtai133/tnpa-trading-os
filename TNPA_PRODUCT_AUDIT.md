# TNPA Product Audit

Date: 2026-06-03

Scope: FTMO OS, Personal Trading OS, and Wealth OS. This audit reviewed the App Router route inventory, sidebar navigation, dashboard modules, account modules, import/trade flows, settings/demo data controls, and placeholder screens. No application code was modified.

## Executive Summary

TNPA OS has useful foundations for a localStorage-first trading and wealth workspace, but the product surface is currently over-expanded relative to the number of complete workflows. The strongest flows are MT5 import, manual trade entry, trade review, bank account CRUD, broker account CRUD, and archive visibility. The weakest flows are first-time onboarding, account creation for trading accounts, FTMO lifecycle management, payout recording, and wealth asset creation outside bank/broker records.

The main product issue is not lack of screens. It is that many screens are navigationally prominent but either duplicate another screen, depend on demo data, or expose read-only summaries with no path to create the underlying data.

## Route Inventory

### FTMO OS

- `/prop-trading`: FTMO dashboard.
- `/prop-trading/trades`: Scoped trade database.
- `/prop-trading/analytics`: Scoped analytics.
- `/prop-trading/setup-intelligence`: Setup analysis.
- `/prop-trading/risk`: Scoped risk monitor.
- `/prop-trading/import-mt5`: Scoped MT5 import.
- `/prop-trading/accounts`: FTMO account registry view.
- `/prop-trading/challenges`: Challenge lifecycle view.
- `/prop-trading/funded-accounts`: Funded account view.
- `/prop-trading/payouts`: Payout readiness view.

### Personal Trading OS

- `/personal-trading`: Personal trading dashboard.
- `/personal-trading/accounts`: Personal account summary.
- `/personal-trading/performance`: Monthly performance.
- `/personal-trading/withdrawals`: Withdrawal entry and history.
- `/personal-trading/analytics`: Personal analytics.

### Wealth OS

- `/wealth`: Wealth summary and allocation dashboard.
- `/net-worth`: Wealth summary only.
- `/portfolio`: Wealth summary only.
- `/bank-accounts`: Bank account CRUD.
- `/savings`: Placeholder.
- `/broker-accounts`: Broker account CRUD.
- `/real-estate`: Placeholder.
- `/archive-history`: Archive history.

### Shared / Legacy Trading Routes

- `/trading`: Generic trading dashboard.
- `/trades`: Generic trade database.
- `/risk`: Generic risk monitor.
- `/import-mt5`: Generic import.
- `/analytics`: Generic analytics.
- `/prop-firm`: Alias of FTMO dashboard.
- `/broker-trading`: Alias of Personal Trading dashboard.

## Highest Priority Findings

### 1. FTMO Account Creation Is Missing

Severity: High

The FTMO sidebar exposes account management, challenges, funded accounts, payouts, risk, trades, analytics, and import. However, there is no direct flow to create, edit, archive, or promote a real FTMO account in the account registry.

Evidence:

- `FTMO Accounts` displays registry records or trade-derived rows, but has no Add/Edit action.
- Empty copy tells the user to load demo accounts from Settings, which is not an account creation flow.
- MT5 import can attach prop metadata, but that creates/imports trade data, not a reusable account registry record.
- Manual trade creation can include prop metadata, but account creation is again implicit through a trade, not an account object.

Impact:

- A new FTMO user cannot start by creating an account.
- Challenges, funded accounts, payouts, and risk screens are hard to use with real data unless the user loads demo data or imports trades first.
- The account registry reads like a management surface but behaves like a report.

Recommended product decision:

- Add first-class FTMO account CRUD: create account, edit rules/status/phase, archive account, and promote Phase 1 -> Phase 2 -> Funded.
- Make `/prop-trading/accounts` the source of truth for FTMO accounts.
- Treat import/manual trades as linking to existing accounts, not as the primary way to create accounts.

### 2. FTMO Payout Flow Is Read-Only

Severity: High

FTMO OS has a dedicated Payouts page and the funded-account view reads payout history, but there is no user-facing flow to record a payout.

Evidence:

- `/prop-trading/payouts` calculates readiness and estimated payout pool.
- `/prop-trading/funded-accounts` displays payout history and lifetime payout.
- No visible form or action records a new FTMO payout.

Impact:

- The product claims payout tracking but only supports payout display if data already exists.
- Lifetime payout and estimated next payout can become permanently stale.

Recommended product decision:

- Add a payout recording drawer from Funded Accounts and Payouts.
- Fields should include account, date, amount, status, split percentage, notes, and proof/screenshot.

### 3. Wealth OS Has Read-Only Portfolio/Net Worth Pages With No Asset CRUD

Severity: High

Bank accounts and broker accounts are real CRUD surfaces. Net Worth and Portfolio are read-only summaries. Savings and Real Estate are placeholders. There is no clear flow to create general assets such as crypto, real estate, savings buckets, or other holdings, despite those categories appearing in dashboards.

Evidence:

- `/bank-accounts` supports Add/Edit/Archive.
- `/broker-accounts` supports Add/Edit/Archive.
- `/net-worth` and `/portfolio` render the same `WealthSummary`.
- `/savings` and `/real-estate` use a visible Placeholder module.
- Wealth summary includes cash, savings, stocks, crypto, real estate, and other categories, but only bank/broker account creation is exposed.

Impact:

- Wealth OS cannot fully support the categories it reports.
- Users have no clear way to add crypto, real estate, savings buckets, or miscellaneous assets.
- Net Worth and Portfolio feel like duplicate read-only dashboards.

Recommended product decision:

- Add a general Wealth Assets CRUD flow or split it into dedicated asset modules.
- Convert `/portfolio` into holdings-level asset management.
- Convert `/net-worth` into a snapshot/trend/reconciliation view.
- Replace Savings and Real Estate placeholders with real create/edit/archive flows or remove them from primary nav until implemented.

### 4. Navigation Contains Duplicates and Legacy Routes

Severity: Medium-High

The sidebar has FTMO OS, Personal Trading, Shared Trading, Wealth, and System. The codebase also has generic and alias routes that are not consistently represented in the sidebar.

Duplicate or near-duplicate routes:

- `/prop-trading` and `/prop-firm` render the same FTMO dashboard.
- `/personal-trading` and `/broker-trading` render the same personal trading dashboard.
- `/trades`, `/risk`, `/import-mt5`, and `/analytics` duplicate scoped FTMO/Personal concepts in a shared/global mode.
- `/net-worth` and `/portfolio` both render only `WealthSummary`.

Impact:

- Users can land in similar screens with different names and scopes.
- Shared Trading creates ambiguity: is the user working in FTMO, Personal, or all trading?
- Legacy aliases increase maintenance cost and confuse product positioning.

Recommended product decision:

- Choose whether shared trading is a real global workspace or a deprecated legacy workspace.
- If global trading remains, make scope switching explicit inside one trading module.
- Remove or redirect `/prop-firm` and `/broker-trading` if they are legacy aliases.
- Differentiate `/net-worth` and `/portfolio`, or merge one into the other.

## Duplicate Features

### Trading Dashboards

- FTMO Dashboard, Personal Trading Dashboard, and Generic Trading Dashboard overlap on net profit, win rate, open positions, floating P/L, source filter, equity/performance, and recent trades.
- The generic dashboard is less integrated with the newer FTMO and Personal sidebar taxonomy.

Recommendation:

- Keep FTMO Dashboard and Personal Trading Dashboard as the primary product dashboards.
- Either remove the generic dashboard from product navigation or make it a true cross-account executive dashboard.

### Trading Data Management

- `/trades` and `/prop-trading/trades` share the same module with different scope props.
- Manual trade creation in scoped and global contexts uses similar account metadata fields.

Recommendation:

- Keep one reusable trade module, but ensure the UI clearly labels the active scope.
- Add breadcrumbs or persistent scope chips: Global, FTMO, Personal.

### Risk Monitor

- `/risk` and `/prop-trading/risk` share the same risk module.
- The risk module is titled as FTMO discipline even when used globally.

Recommendation:

- Rename global risk to `Trading Risk` and reserve `FTMO Risk` for prop-firm rules.
- In Personal Trading OS, consider a personal risk page or remove the global risk ambiguity.

### Wealth Summary

- `/wealth`, `/net-worth`, and `/portfolio` all expose overlapping net-worth summary data.
- `WealthSummary` duplicates `Broker Cash` in its card grid.

Recommendation:

- `/wealth`: executive dashboard.
- `/net-worth`: snapshots, trend, reconciliation.
- `/portfolio`: holdings, allocations, add/edit assets.
- Remove duplicate Broker Cash card.

## Dead Screens

### Explicit Placeholders

- `/savings`
- `/real-estate`

These are visible in primary navigation but only show placeholder copy.

Recommendation:

- Either implement them or move them behind a lower-priority "Coming Soon" area.
- Primary nav should not include placeholder-only screens in a product audit-ready app.

### Functional but Product-Dead Screens

- `/prop-trading/accounts` is read-only despite being named like a management surface.
- `/prop-trading/payouts` is read-only despite being named like a payout workflow.
- `/portfolio` is not a portfolio management screen; it is another wealth summary.
- `/net-worth` is not meaningfully different from portfolio summary.

Recommendation:

- Rename read-only screens as reports or add the missing workflows.

## Empty Dashboards and Thin States

### FTMO OS

- Challenges can show three empty sections: Active, Passed, Failed.
- Funded Accounts can be fully empty and tells users to load demo accounts.
- Payouts can be empty if no trade-derived FTMO accounts exist.
- FTMO Accounts can be empty and points to demo loading instead of account creation.

Recommended first-empty-state flow:

1. Create FTMO account.
2. Import MT5 statement or add manual trade.
3. Review dashboard and risk.
4. Promote challenge/funded status.
5. Record payout.

### Personal Trading OS

- Accounts are only derived from broker trades.
- Performance is empty without closed trades.
- Withdrawals can record withdrawals against a fallback `Personal Trading` account even if no real account exists.

Recommended first-empty-state flow:

1. Create personal trading account.
2. Add/import trades.
3. Review performance.
4. Record withdrawals.

### Wealth OS

- Wealth dashboard can show mostly zeros unless demo data or bank/broker data exists.
- Net-worth trend auto-creates snapshots, but users cannot manually create historical snapshots.
- Portfolio categories show categories that cannot be created from the UI.

Recommended first-empty-state flow:

1. Add bank account.
2. Add broker account.
3. Add wealth asset.
4. Create or confirm monthly net-worth snapshot.
5. Review archive/history.

## Missing User Flows

### Global Onboarding

Missing:

- First-run setup wizard.
- Choice between FTMO, Personal Trading, Wealth, or all modules.
- Clear "start here" empty states.
- Demo vs real data separation.

Recommendation:

- Add a first-run home screen with three setup cards:
  - Set up FTMO OS.
  - Set up Personal Trading OS.
  - Set up Wealth OS.
- Keep demo loading in Settings, but do not make it the only onboarding path.

### FTMO OS

Missing:

- Create FTMO account.
- Edit FTMO account.
- Archive FTMO account.
- Promote/demote phase and status.
- Record payout.
- Attach payout proof.
- Record challenge purchase/start/end dates.
- Mark challenge passed/failed.
- Account-level import history.
- Reconcile MT5 imports to specific account registry records.

### Personal Trading OS

Missing:

- Create personal trading account.
- Edit/archive personal trading account.
- Deposit flow.
- Transfer flow between trading account and wealth/broker account.
- Link personal trading account to Wealth OS.
- Withdrawal validation against actual account balance.

### Wealth OS

Missing:

- Create general wealth asset.
- Edit/archive general wealth asset.
- Savings bucket creation.
- Real estate asset creation.
- Manual net-worth snapshot creation/editing.
- Asset-level transaction history.
- Currency handling/reconciliation between VND and USD.
- Link wealth broker accounts to Personal Trading accounts where appropriate.

## Missing Account Creation Flows

### Present

- Bank account creation exists.
- Broker account creation exists.
- Manual trade creation exists.
- MT5 import exists.

### Missing

- FTMO prop account creation.
- Personal trading account creation.
- General wealth asset creation.
- Savings account/bucket creation.
- Real estate holding creation.
- Trading account to wealth-account link creation.

Product implication:

The app currently supports creating some financial containers, but not the core trading account containers that FTMO OS and Personal Trading OS are organized around.

## UX Inconsistencies

### Naming and Scope

- Sidebar says `Personal Trading`, while page eyebrow says `Personal Trading OS`.
- Shared routes use generic labels like `Trades` and `Risk Monitor`, while scoped routes use FTMO labels.
- Home card says `Trading OS`, but sidebar splits `FTMO OS`, `Personal Trading`, and `Shared Trading`.
- `/broker-accounts` in Wealth OS can be confused with personal trading broker accounts.

Recommendation:

- Use consistent top-level product names:
  - FTMO OS
  - Personal Trading OS
  - Wealth OS
- Rename Wealth broker accounts to `Investment Broker Accounts` if they are not trading accounts.

### Actions

- Bank and Broker account screens have primary add buttons.
- FTMO Accounts has no primary add button.
- Payouts has no primary add button.
- Net Worth and Portfolio have no add/reconcile actions.

Recommendation:

- Every management noun in navigation should expose a primary creation or management action.

### Empty State Quality

- Some empty states are descriptive but not actionable.
- FTMO empty states direct users to demo data rather than the real workflow.
- Placeholder screens are visually marked as placeholder in the product.

Recommendation:

- Empty states should include the next real action, not only explanatory text.

### Data Source Clarity

- LocalStorage is referenced in UI copy.
- Demo data can be loaded into the same product surfaces as real data.
- Imported MT5 data, manual trades, demo accounts, and account registry data are blended without a persistent source indicator outside trade rows.

Recommendation:

- Add a data-source banner or badge for Demo, Imported, Manual, and Registry data.
- Add a workspace reset/export/import data screen if localStorage remains the persistence model.

### Visual Hierarchy

- Many screens use the same KPI card/table pattern, which is consistent but can make unrelated workflows feel identical.
- Dashboard, report, and management screens do not always visually differentiate their purpose.

Recommendation:

- Use a stronger pattern distinction:
  - Dashboards: metrics and command panels.
  - Management: table plus Add/Edit/Archive actions.
  - Reports: filters, charts, export.
  - Empty setup: guided checklist.

## Product Recommendations

### Phase 1: Reduce Confusion

- Remove placeholder pages from primary nav or implement them.
- Redirect legacy aliases `/prop-firm` and `/broker-trading`.
- Decide whether Shared Trading remains a global workspace.
- Rename Wealth broker accounts to avoid confusion with personal trading accounts.
- Differentiate Net Worth and Portfolio.

### Phase 2: Complete Core Account Flows

- Add FTMO account CRUD.
- Add Personal Trading account CRUD.
- Add Wealth asset CRUD.
- Add payout recording.
- Add account lifecycle actions for FTMO challenges and funded accounts.

### Phase 3: Improve Onboarding

- Add first-run setup checklist.
- Replace demo-data dependency with real setup paths.
- Add clear CTAs to empty states.
- Add source badges for demo/import/manual/registry data.

### Phase 4: Make Cross-OS Links Explicit

- Link Personal Trading withdrawals to Wealth cash/bank accounts.
- Link Personal Trading broker accounts and Wealth investment broker accounts only when they represent the same account.
- Add reconciliation views for trading cash, broker equity, and net worth snapshots.

## Suggested Information Architecture

### FTMO OS

- Dashboard
- Accounts
- Challenges
- Funded
- Trades
- Risk
- Analytics
- Setup Intelligence
- Payouts
- Import MT5

### Personal Trading OS

- Dashboard
- Accounts
- Trades
- Performance
- Risk
- Withdrawals
- Analytics
- Import MT5

### Wealth OS

- Dashboard
- Net Worth
- Portfolio / Assets
- Bank Accounts
- Investment Broker Accounts
- Savings
- Real Estate
- Archive History

### System

- Settings
- Data Management
- Demo Data

## Final Assessment

TNPA OS is directionally strong but currently reads like a prototype that has grown screens faster than workflows. The main gap is lifecycle completeness: users can view many product concepts, but cannot create or manage several of the core objects those concepts depend on.

The next best product move is not another dashboard. It is to make account and asset creation first-class across FTMO OS, Personal Trading OS, and Wealth OS, then remove or demote screens that are currently placeholders or duplicate reports.
