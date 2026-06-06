# TNPA Trading OS Project State

Date: 2026-06-06

Scope: repository inspection only. Production code was not modified.

## 1. Current Architecture

TNPA Trading OS is a Next.js App Router application using Next.js 16.2.6, React 19.2.4, TypeScript, ESLint 9, and Tailwind CSS 4. The app follows the `app/` file-system routing model described by the bundled Next.js documentation in `node_modules/next/dist/docs/01-app/index.md`.

The application is currently a client-side local workspace rather than a backend-backed product:

- Routes live under `app/**/page.tsx`.
- Shared UI lives in `app/_components`.
- Domain logic, storage adapters, parsers, metrics, and types live in `app/_lib`.
- The root layout only provides fonts, metadata, global CSS, and the dark page background.
- `AppShell` and `Sidebar` provide the main dashboard frame for most active pages.
- Most interactive modules are `"use client"` components.
- Persistence is implemented through `window.localStorage` plus custom browser events and `useSyncExternalStore`.
- There are no API routes, server actions, ORM models, SQL migrations, Prisma schema, Supabase client, authentication layer, or external backend integration in the current source tree.

The main data architecture is a normalized trading dataset built by `useTradingDataset`. It merges:

- imported MT5 report trades from `tnpa.mt5.import.v1`,
- manual trades from `tnpa.manual-trades.v1`,
- setup tag overrides from `tnpa.setup-tags.v1`,
- playbook overrides from `tnpa.playbooks.v1`,
- trade journal overrides from `tnpa.trade-journal.v1`,
- static fallback trade data from `app/_lib/trading-client-data.ts` and `app/_lib/trading-data.ts`.

The app is organized around two primary operating areas:

- FTMO OS for prop trading accounts, trades, risk, analytics, setup intelligence, challenges, funded accounts, payouts, and MT5 import.
- Personal Trading for broker/personal trading accounts, dashboard, performance, withdrawals, and analytics.

Wealth modules still exist in the codebase, but current top-level Wealth routes redirect to `/` and Wealth is not exposed in the current sidebar.

## 2. Current Routes

Active primary routes in current sidebar:

| Route | Current behavior |
| --- | --- |
| `/` | Home dashboard with entry cards for FTMO OS and Personal Trading. |
| `/prop-trading` | FTMO dashboard and command center across prop accounts. |
| `/prop-trading/trades` | FTMO-scoped trade table, filtering, review, manual trade creation. |
| `/prop-trading/analytics` | FTMO-scoped analytics using shared `AnalyticsModule`. |
| `/prop-trading/setup-intelligence` | Setup quality analysis for trading history. |
| `/prop-trading/risk` | FTMO-scoped risk monitor. |
| `/prop-trading/import-mt5` | FTMO MT5 HTML import with prop metadata required. |
| `/prop-trading/accounts` | FTMO account registry with create, edit, archive, and archived visibility. |
| `/prop-trading/challenges` | Challenge lifecycle view for active, passed, and failed challenge accounts. |
| `/prop-trading/funded-accounts` | Funded account monitoring and payout history display. |
| `/prop-trading/payouts` | Payout entry, payout history, and payout readiness. |
| `/personal-trading` | Personal trading dashboard. |
| `/personal-trading/accounts` | Personal trading account registry with create, edit, archive, and archived visibility. |
| `/personal-trading/performance` | Monthly and cumulative personal trading performance. |
| `/personal-trading/withdrawals` | Personal withdrawal entry and history. |
| `/personal-trading/analytics` | Personal trading analytics. |
| `/settings` | FTMO risk settings, demo FTMO account controls, and demo wealth data controls. |

Active but not in current sidebar:

| Route | Current behavior |
| --- | --- |
| `/trades` | Global trade table using shared `TradesModule`. |
| `/analytics` | Global analytics using shared `AnalyticsModule`. |
| `/risk` | Global risk monitor using shared `RiskModule`. |
| `/import-mt5` | Global MT5 import. |
| `/trading` | Older generic trading dashboard. |

Redirect / legacy routes:

| Route | Redirect |
| --- | --- |
| `/prop-firm` | `/prop-trading` |
| `/broker-trading` | `/personal-trading` |
| `/wealth` | `/` |
| `/net-worth` | `/` |
| `/portfolio` | `/` |
| `/bank-accounts` | `/` |
| `/broker-accounts` | `/` |
| `/savings` | `/` |
| `/real-estate` | `/` |
| `/archive-history` | `/` |

## 3. Database Schema

There is no server database. The effective schema is browser `localStorage`. Storage is fragmented by domain-specific keys.

### Trading Data

`tnpa.mt5.import.v1`

- Stores one `Mt5AccountReport`.
- Important fields: `sourceFile`, account metadata, `name`, `account`, `company`, `generatedAt`, `balance`, `equity`, MT5 profit metrics, `maxDrawdown`, and `trades`.

`tnpa.manual-trades.v1`

- Stores `Trade[]`.
- Trade fields include source/account metadata, prop metadata, symbol, side, status, date/time, volume, open/close prices, entry/exit, RR, P/L, floating P/L, result, setup tag, playbook, screenshots, entry/exit reasons, emotion, mistake, and lesson learned.

`tnpa.trade-journal.v1`

- Stores `Record<tradeId, TradeJournal>`.
- Used for per-trade screenshots, entry/exit reasons, emotion, mistake, and lessons.

`tnpa.setup-tags.v1`

- Stores `Record<tradeId, SetupTag>`.

`tnpa.playbooks.v1`

- Stores `Record<tradeId, Playbook>`.

`tnpa.risk-settings.v1`

- Stores `RiskSettings`: `dailyLossLimitPercent`, `maxLossLimitPercent`, and `profitTargetPercent`.

### Prop Trading

`tnpa.prop-accounts.v1`

- Stores `PropAccount[]`.
- Fields: `id`, `firmName`, `accountName`, `accountSize`, `challengeType`, `phase`, `status`, `startDate`, `minimumTradingDays`, `profitTargetPercent`, `dailyLossLimitPercent`, `maxLossLimitPercent`.

`tnpa.ftmo-payouts.v1`

- Stores `FtmoPayout[]`.
- Fields: `id`, `accountName`, `date`, `amount`, `note`.

### Personal Trading

`tnpa.personal-trading-accounts.v1`

- Stores `PersonalTradingAccount[]`.
- Fields: `id`, `accountName`, `brokerName`, `strategyType`, `initialBalance`, `status`, `archivedAt`, `notes`.

`tnpa.personal-withdrawals.v1`

- Used inside `trading-os-modules.tsx`.
- Stores personal withdrawal rows with account, date, amount, and notes.

### Wealth Data

These schemas exist, but the current Wealth routes redirect away from their modules.

`tnpa.bank-accounts.v1`

- Stores `WealthAccount[]`.
- Fields: `id`, `name`, `institution`, `currency`, `balance`, `status`, `archiveReason`, `archivedAt`, `accountType`, `notes`.

`tnpa.broker-accounts.v1`

- Stores `WealthBrokerAccount[]`.
- Fields: `id`, `broker`, `name`, `currency`, `cashBalance`, `stockMarketValue`, `fundEtfValue`, `totalEquity`, `portfolioType`, `status`, `archiveReason`, `archivedAt`, `notes`.

`tnpa.wealth-assets.v1`

- Stores `WealthAsset[]`.
- Fields: `id`, `name`, `assetClass`, `institution`, `currency`, `currentValue`, `status`, `archiveReason`, `archivedAt`, `costBasis`, `accountId`, `notes`.

`tnpa.wealth-snapshots.v1`

- Stores wealth snapshots for net worth history.

## 4. Existing Features

Implemented trading features:

- MT5 HTML report parsing and import.
- Manual trade creation.
- Trade editing/review drawer with journal fields.
- Trade screenshots stored as data URLs.
- Trade filters by account type, account name, strategy, setup, playbook, status, result, and other dimensions.
- Setup tag overrides and playbook overrides.
- Trading KPIs: net profit, win rate, profit factor, average RR, max drawdown.
- Equity curve and monthly performance calculations.
- Setup and playbook analytics.
- Risk monitor with daily loss usage, max loss usage, warnings, discipline score, heatmap, best/worst day, losing streak, overtrading, and large losing day warnings.

Implemented account/workspace features:

- FTMO account create, edit, archive, show archived.
- Personal trading account create, edit, archive, show archived.
- FTMO payout recording and payout history.
- Personal withdrawal recording.
- Demo FTMO account load/clear controls.
- Demo Wealth data load/clear controls.
- Risk settings save/reset.

Implemented wealth features in code but not reachable through current navigation or active routes:

- Bank account CRUD.
- Broker account CRUD.
- Wealth asset CRUD component.
- Net worth summary and snapshot storage.
- Archive history component.
- Wealth dashboard components.

## 5. Existing Dashboards

Primary dashboards:

- Home dashboard: product entry point and trading net profit summary.
- FTMO Dashboard: account-level command center, health rankings, mission cards, account selector, risk and target progress.
- Personal Trading Dashboard: broker/personal trading overview with P/L, open positions, strategy segmentation, and monthly rows.

Supporting dashboards/reports:

- FTMO Trades.
- FTMO Analytics.
- Setup Intelligence.
- FTMO Risk Monitor.
- FTMO Accounts.
- FTMO Challenges.
- FTMO Funded.
- FTMO Payouts.
- Personal Accounts.
- Personal Performance.
- Personal Withdrawals.
- Personal Analytics.
- Global Trades, Analytics, Risk, Import MT5, and old Trading dashboard.

Inactive or redirected dashboard code:

- Wealth dashboard.
- Net Worth module.
- Bank Accounts module.
- Broker Accounts module.
- Wealth Assets module.
- Archive History module.

## 6. Existing Prop Trading Functionality

Prop trading is currently centered on FTMO.

Implemented:

- FTMO-specific sidebar taxonomy.
- Prop account registry persisted under `tnpa.prop-accounts.v1`.
- Account fields for firm, account size, challenge type, phase, status, start date, target percent, daily loss percent, max loss percent, minimum trading days.
- Create/edit/archive FTMO accounts.
- Demo FTMO accounts.
- FTMO import route that locks account type to `prop-firm` and requires prop metadata.
- Prop trade scoping through `accountType = "prop-firm"`.
- Challenge lifecycle screens for active/passed/failed accounts.
- Funded account screen with current profit, open positions, risk status, lifetime payout, estimated next payout, and payout readiness.
- Payout entry and payout history.
- Dashboard command items for best account to trade, account to avoid, near passing, near payout, and account at risk.
- Account health scoring and visual statuses.
- Risk controls based on FTMO-style daily loss, max loss, profit target, and trading-day requirements.

Limitations:

- Only `FTMO` is supported as a prop firm enum.
- Payout model is minimal: amount/date/note only.
- No explicit challenge promotion action; phase/status are edited manually.
- No rule breach ledger, payout proof attachment, challenge certificate, invoice, or payout status workflow.
- Account registry and trade-derived account summaries coexist, which can create source-of-truth ambiguity.

## 7. Technical Debt

High-impact technical debt:

- No durable backend database. All real user data is browser-local and vulnerable to device loss, browser clearing, and cross-device inconsistency.
- No authentication or multi-user model.
- No migrations or versioned schema evolution beyond ad hoc sanitizers.
- No automated tests are present in `package.json`; only `dev`, `build`, `start`, and `lint` scripts exist.
- LocalStorage keys are spread across many modules with repeated read/write/subscribe patterns.
- Some current routes are legacy/global duplicates of scoped FTMO and Personal Trading routes.
- Wealth modules remain in code while all Wealth routes redirect to `/`, creating inactive surface area and maintenance cost.
- There is no central app state layer; modules independently compose storage, derived metrics, and UI.
- The MT5 parser is HTML/string based and likely sensitive to statement format changes.
- IDs are generated from array length, dates, and names in several places, which can collide after deletes/archives or repeated operations.
- Financial calculations lack explicit currency normalization and account base-currency handling.
- Several metrics use fallbacks/demo values when no imported report exists, which can blur the distinction between sample data and real user data.

Product/UX debt:

- The app has multiple scopes: global trading, FTMO, personal trading, and inactive wealth. Scope boundaries are not always obvious outside the sidebar.
- Important workflows are drawer/form based but lack bulk import/export, backup, restore, or data health checks.
- Manual trade RR is simplified and not derived from stop loss/take profit.
- Payout readiness uses simplified logic and does not model payout cycles or prop-firm payout rules deeply.
- Personal trading and FTMO accounts can exist without enforced linkage to trades.

## 8. Missing Features

Foundational missing features:

- Real database and backend API.
- Authentication, user accounts, and secure data ownership.
- Import/export/backup/restore for all local data.
- Automated tests for parsers, storage sanitizers, metrics, and workflows.
- Error boundary and observability/logging.
- Data migration/versioning strategy.

Trading missing features:

- Multi-report MT5 import history instead of one stored MT5 report.
- CSV import/export.
- Duplicate trade detection.
- Trade attachments beyond local data URL screenshots.
- Broker sync or read-only integrations.
- Per-account equity curves and drawdown charts.
- Position sizing, stop loss, risk per trade, and rule compliance at trade entry.
- Calendar view and daily review workflow.
- Strategy/playbook management UI.

Prop trading missing features:

- Support for non-FTMO firms.
- Challenge promotion workflow with audit trail.
- Rule breach ledger.
- Payout lifecycle statuses such as requested, approved, paid, rejected.
- Payout split configuration per account.
- Payout proof/document attachment.
- Evaluation fee tracking and ROI.
- Reset/repurchase tracking.
- Prop account credentials/server metadata.

Personal trading missing features:

- Deposit tracking.
- Withdrawal edit/archive.
- Cashflow reconciliation by account.
- Broker account balance snapshots.
- Tax/export reports.

Wealth missing features:

- Wealth routes are currently redirected away from the existing modules.
- General wealth asset management is not exposed through active navigation.
- Net worth snapshots are not a primary workflow.
- Currency conversion and FX rates are absent.
- Asset allocation targets and rebalance recommendations are absent.

## 9. Recommended Roadmap From Current State

### Phase 1: Stabilize Current Product Surface

- Decide whether global `/trades`, `/analytics`, `/risk`, `/import-mt5`, and `/trading` are supported workspaces or legacy routes.
- Keep FTMO and Personal Trading as the primary product surfaces.
- Remove, redirect, or clearly label legacy/global routes.
- Decide whether Wealth is paused or should be reactivated; if paused, consider moving Wealth modules out of the active mental model.
- Add basic tests for `mt5-parser-core`, `trading-metrics`, `risk-metrics`, and storage sanitizers.
- Add data export/import backup for every localStorage key before adding more workflows.

### Phase 2: Make Data Reliable

- Introduce a real persistence layer: database schema, migrations, and API/server actions.
- Create first-class entities for users, accounts, trades, imports, journal entries, payouts, withdrawals, and attachments.
- Preserve localStorage as an offline/demo mode or migrate it into the backend.
- Replace array-length IDs with UUIDs.
- Add schema validation with a single shared validation library.
- Add migration tools from current localStorage data to the new backend schema.

### Phase 3: Deepen FTMO OS

- Add prop firm abstraction while keeping FTMO defaults.
- Add challenge promotion actions with audit trail.
- Add rule breach/event ledger per account.
- Add payout lifecycle with status, split percentage, proof, and notes.
- Add per-account equity curve, drawdown curve, and rule compliance timeline.
- Add evaluation fee, reset, and ROI tracking.

### Phase 4: Deepen Personal Trading

- Add deposit tracking and withdrawal edit/archive.
- Add account balance snapshots.
- Add cashflow-adjusted performance.
- Add broker-specific account metadata.
- Add tax/report exports.

### Phase 5: Reactivate or Remove Wealth

- If Wealth remains in scope, reactivate `/wealth`, `/net-worth`, `/portfolio`, `/bank-accounts`, `/broker-accounts`, `/savings`, `/real-estate`, and `/archive-history` intentionally.
- Expose general wealth asset CRUD.
- Add net worth snapshot capture and trends as a real workflow.
- Add currency conversion and asset allocation targets.
- If Wealth is out of scope, delete or archive inactive modules and storage code to reduce maintenance cost.

### Phase 6: Product Hardening

- Add onboarding and empty-state flows that guide users to create accounts, import trades, review risk, and record payouts/withdrawals.
- Add CI with lint, typecheck, tests, and build.
- Add monitoring for production runtime errors.
- Add responsive and accessibility QA.
- Add documentation for data model, route ownership, and release process.
