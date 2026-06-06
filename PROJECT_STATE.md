# TNPA Trading OS Project State

Date: 2026-06-06
Current version: v0.9 QA Stabilization & Production Readiness

## 1. Current Architecture

TNPA Trading OS is a Next.js App Router application using Next.js 16.2.6, React 19, TypeScript, ESLint 9, and Tailwind CSS 4. The app is still a client-side local workspace: there are no API routes, server actions, ORM models, SQL migrations, authentication, or backend persistence.

Core structure:

- `app/**/page.tsx`: file-system routes.
- `app/_components`: route modules, dashboards, drawers, tables, and settings UI.
- `app/_lib`: localStorage adapters, parser logic, metrics, trading types, and client data.
- `useTradingDataset`: client-side composition layer for imported MT5 trades, manual trades, setup/playbook overrides, journal overrides, and fallback data.
- `useSyncExternalStore` plus custom browser events: localStorage synchronization pattern.

Persistence is browser-local. User data is preserved through versioned localStorage keys and sanitizers, not database migrations.

## 2. Current Routes

Primary routes:

| Route | Purpose |
| --- | --- |
| `/` | Home dashboard for FTMO OS and Personal Trading. |
| `/prop-trading` | FTMO command dashboard. |
| `/prop-trading/accounts` | FTMO account lifecycle registry. |
| `/prop-trading/trades` | FTMO-scoped trades, manual trade creation, review, account linking, TNPA intelligence. |
| `/prop-trading/analytics` | FTMO analytics. |
| `/prop-trading/setup-intelligence` | TNPA setup grading analytics and edge report. |
| `/prop-trading/risk` | FTMO risk monitor. |
| `/prop-trading/import-mt5` | FTMO MT5 import. |
| `/prop-trading/challenges` | Challenge lifecycle views. |
| `/prop-trading/funded-accounts` | Funded account and payout readiness. |
| `/prop-trading/payouts` | FTMO payout recording/history. |
| `/personal-trading` | Personal trading dashboard. |
| `/personal-trading/accounts` | Personal account lifecycle registry. |
| `/personal-trading/performance` | Personal trading performance. |
| `/personal-trading/withdrawals` | Personal withdrawal recording/history. |
| `/personal-trading/analytics` | Personal trading analytics. |
| `/settings` | Risk settings, backup/restore, demo data controls. |

Global/legacy active routes still exist: `/trades`, `/analytics`, `/risk`, `/import-mt5`, `/trading`.

Redirected legacy wealth routes still exist: `/wealth`, `/net-worth`, `/portfolio`, `/bank-accounts`, `/broker-accounts`, `/savings`, `/real-estate`, `/archive-history`.

## 3. LocalStorage Data Schema

There is no server database. Current supported localStorage keys:

| Key | Data |
| --- | --- |
| `tnpa.mt5.import.v1` | One imported MT5 account report and trades. |
| `tnpa.manual-trades.v1` | Manual `Trade[]`. |
| `tnpa.trade-journal.v1` | Per-trade journal overrides. |
| `tnpa.setup-tags.v1` | Per-trade setup tag overrides. |
| `tnpa.playbooks.v1` | Per-trade playbook overrides. |
| `tnpa.risk-settings.v1` | FTMO risk settings. |
| `tnpa.prop-accounts.v1` | FTMO account lifecycle registry. |
| `tnpa.ftmo-payouts.v1` | FTMO payout records. |
| `tnpa.personal-trading-accounts.v1` | Personal trading account lifecycle registry. |
| `tnpa.personal-withdrawals.v1` | Personal withdrawal records. |
| `tnpa.trade-account-links.v1` | Explicit trade-to-account links. |
| `tnpa.playbook-intelligence.v1` | TNPA playbook intelligence and rule compliance per trade. |

Backup/restore in `/settings` exports and imports all supported TNPA trading keys with confirmation.

## 4. Completed Features v0.3-v0.8

v0.3 Account Lifecycle Engine:

- FTMO account lifecycle types: Challenge v1, Challenge v2, Verification, Funded.
- Personal account lifecycle type.
- Lifecycle statuses: Active, Passed, Failed, Breached, Archived.
- Challenge start/end dates, target profit, remaining target, remaining daily loss, remaining max loss.
- Lifecycle summary cards.

v0.4 Trade-to-Account Link:

- Explicit links from imported/manual trades to FTMO or Personal accounts.
- Backward-compatible account-name fallback when no explicit link exists.
- Per-account trade count, net P/L, win rate, and profit factor.

v0.4.1 Account-Aware Manual Trade Creation:

- New Trade from account context preselects and locks the linked account.
- Trade forms collect trade-level fields only.
- Manual trade records avoid account lifecycle metadata and store account linkage separately.

v0.5 Backup & Restore:

- Export supported TNPA localStorage keys to one JSON file.
- Import backup JSON with key summary, selected-key restore, confirmation, and optional current-data export before restore.

v0.6 Account Performance Timeline:

- Per-account performance timelines for FTMO and Personal accounts.
- Starting/current balance, net P/L, win rate, profit factor, best/worst trade, max drawdown, daily P/L, equity curve.
- Timeline markers for account creation, first trade, best/worst trade, payouts, withdrawals, and lifecycle status.
- FTMO compliance summary for profit target, daily loss, max loss, and Safe/Warning/Breached status.

v0.7 TNPA Playbook Intelligence:

- TNPA core playbooks: Rectangle Breakout and Trendline Breakout.
- Trade context fields for bias, HTF trend, EMA, RSI, TD Sequential, volume, zone, entry quality.
- Rule compliance checks and TNPA grade: A+, A, B, C, Invalid.
- Editable TNPA intelligence in trade review drawer.
- Grade filters, table column, summary cards, and grade explanation.

v0.8 Setup Grading Analytics:

- `/prop-trading/setup-intelligence` analytics engine based on TNPA intelligence.
- Grade performance, playbook performance, rule violation analytics, edge report, insight engine, and dashboard cards.

## 5. v0.9 Stabilization Notes

v0.9 focused on QA and reliability rather than new product surface.

Stabilized areas:

- Manual trade IDs now use collision-resistant generation instead of `Date.now()` alone.
- Legacy duplicate manual trade IDs are normalized on read to avoid UI/link collisions.
- Manual trade edits preserve the v0.4.1 storage contract by avoiding account lifecycle metadata in manual trade records.
- Trade-account links now reject inconsistent source/type pairs such as Personal + `prop-firm`.
- Trade-account link writes normalize trade IDs and account identity strings.
- Trade table now shows a clean empty state when no trades match filters.
- `PROJECT_STATE.md` updated to current v0.9 state.

## 6. Existing Features

Trading:

- MT5 HTML import and local report storage.
- Manual trade creation and editing.
- Trade review drawer with journal, screenshots, setup/playbook overrides, account link, and TNPA intelligence.
- Global and scoped trade tables with filters.
- Setup tag, playbook, journal, account-link, and TNPA intelligence overrides.
- Trading analytics and risk metrics.

Accounts:

- FTMO account create/edit/archive/show archived.
- Personal account create/edit/archive/show archived.
- FTMO payout recording/history.
- Personal withdrawal recording/history.
- Explicit trade-account linking with backward-compatible name fallback.
- Account performance timelines.

Settings:

- FTMO risk rules.
- Demo FTMO account load/clear.
- Backup/restore for all TNPA trading keys.

## 7. Known Limitations

- Data is browser-local. Users can lose data if localStorage is cleared and no backup exists.
- No authentication, backend sync, multi-device support, or durable database.
- No automated test suite exists yet.
- MT5 import stores one report, not an import history.
- Manual trade RR remains simplified and is not derived from stop loss/take profit.
- Stop loss is modeled as TNPA rule compliance, not as a first-class trade price field.
- Account-name fallback can still be ambiguous when multiple historical accounts share the same name; explicit links are the reliable path.
- Wealth modules exist but remain redirected away from active product navigation.
- FTMO is the only prop firm enum.
- Payout and withdrawal records are simple amount/date/note records.

## 8. What Should Not Be Changed Without Explicit Scope

- Do not change MT5 import/parser behavior unless fixing a verified import bug.
- Do not remove legacy/global routes until product scope is clarified.
- Do not break existing localStorage keys.
- Do not migrate or delete user data automatically.
- Do not remove setup/playbook/journal override behavior.
- Do not replace account-name fallback until all legacy trades can be migrated to explicit links.
- Do not push to GitHub unless explicitly requested.

## 9. Recommended Next Sprints

1. v1.0 Test Harness & Data Health
   Add unit tests for storage sanitizers, TNPA grading, account links, risk metrics, and backup validation. Add a Data Health page for duplicate IDs, orphaned links, unsupported records, and unreviewed trades.

2. v1.1 Trade Risk Model
   Add first-class stop loss, take profit, risk amount, risk percent, and computed RR for manual trades and TNPA compliance.

3. v1.2 Local Migration Utilities
   Add explicit migration tools for old localStorage records, especially account links and duplicate account names.

4. v1.3 Multi-Import MT5 History
   Store multiple MT5 imports, detect duplicates, and allow import rollback.

5. v1.4 Prop Firm Expansion
   Abstract FTMO rules enough to support additional prop firms without losing FTMO defaults.

6. v1.5 Backend Readiness
   Design database schema, auth model, migration path from localStorage, and API/server-action boundaries.
