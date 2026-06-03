# TNPA Roadmap Next

Date: 2026-06-03

Source: `TNPA_PRODUCT_AUDIT.md`

Priority definitions:

- P0 = Must Fix Before New Features
- P1 = Important UX Improvements
- P2 = Nice To Have

Effort definitions:

- Small = narrow UI/storage/routing change
- Medium = one complete workflow or several coordinated UI changes
- Large = multi-screen workflow, shared data model work, or cross-OS behavior

## P0 Items

These block the product from being coherent enough to add more feature surface.

| Item | Effort | Why P0 |
| --- | --- | --- |
| Add FTMO account creation, edit, archive, and status/phase management | Large | FTMO OS is organized around accounts, challenges, funded accounts, risk, and payouts, but users cannot create the core FTMO account object. |
| Make `/prop-trading/accounts` the source-of-truth FTMO account management screen | Medium | The current screen reads like account management but behaves like a read-only report or demo-data viewer. |
| Add FTMO payout recording from Payouts and Funded Accounts | Medium | Payouts are a primary FTMO workflow, but the current flow is read-only and cannot maintain lifetime payout data. |
| Add Personal Trading account creation, edit, and archive | Large | Personal Trading OS accounts are derived from trades, so users cannot set up a personal trading account before adding/importing trades. |
| Add Wealth asset CRUD for non-bank/non-broker assets | Large | Wealth OS reports savings, crypto, real estate, and other assets, but users cannot create most of those holdings. |
| Remove, hide, or implement `/savings` placeholder | Small if hidden, Medium if implemented | Placeholder-only screens should not remain in primary product navigation. |
| Remove, hide, or implement `/real-estate` placeholder | Small if hidden, Medium if implemented | Placeholder-only screens should not remain in primary product navigation. |
| Differentiate or merge `/net-worth` and `/portfolio` | Medium | Both currently render the same summary, creating duplicate read-only product surfaces. |
| Convert `/portfolio` into actual holdings/asset management if it remains | Large | A Portfolio page that cannot manage holdings is product-dead relative to its label. |
| Replace FTMO empty states that point to demo data with real setup CTAs | Medium | FTMO first-run path currently pushes users toward demo data rather than real account setup. |
| Replace Wealth category empty states with add-asset/account CTAs | Medium | Wealth dashboard categories appear without corresponding creation paths. |
| Add primary actions to every management screen: FTMO Accounts, Payouts, Net Worth, Portfolio | Medium | Management nouns need visible create/manage actions, otherwise the screens feel broken or read-only. |
| Decide and enforce the role of Shared Trading routes | Medium | Shared Trading duplicates scoped FTMO/Personal surfaces and creates scope ambiguity. |
| Redirect or remove legacy alias routes `/prop-firm` and `/broker-trading` | Small | Duplicate dashboard routes increase confusion and maintenance cost. |

## P1 Items

These materially improve usability and reduce confusion, but can follow the P0 workflow fixes.

| Item | Effort | Why P1 |
| --- | --- | --- |
| Add first-run setup checklist for FTMO OS, Personal Trading OS, and Wealth OS | Large | The product needs a clear start path across three operating systems. |
| Separate demo data from real data in setup and Settings | Medium | Demo data is currently useful but too close to the real workflow. |
| Add persistent data-source badges for Demo, Imported MT5, Manual, and Registry data | Medium | Users need to understand where records came from before trusting dashboards. |
| Add scope indicators or breadcrumbs for Global, FTMO, and Personal Trading screens | Medium | Reused modules make it easy to lose track of whether the user is in global or scoped trading. |
| Rename global risk to `Trading Risk` and reserve `FTMO Risk` for prop-firm rules | Small | Current naming makes FTMO-specific discipline language appear in non-FTMO contexts. |
| Add or clarify Personal Trading risk surface | Medium | Personal Trading lacks a scoped risk path while global risk already exists. |
| Rename Wealth `Broker Accounts` to `Investment Broker Accounts` if distinct from trading accounts | Small | Prevents confusion with personal trading broker accounts. |
| Standardize product naming: FTMO OS, Personal Trading OS, Wealth OS | Small | Sidebar, home, and page headers use slightly different names. |
| Improve empty states with direct next actions across all OS areas | Medium | Empty states are often descriptive but not actionable. |
| Add account-level import history for FTMO accounts | Medium | Users need to know which MT5 imports are tied to which FTMO account. |
| Reconcile MT5 imports to specific account registry records | Large | Import should link to existing account objects instead of implicitly defining account metadata. |
| Add challenge lifecycle fields: purchase date, start date, end date, pass/fail date | Medium | FTMO challenge management needs lifecycle data beyond current phase/status labels. |
| Add challenge pass/fail actions | Medium | FTMO lifecycle screens should support status transitions, not just display them. |
| Add deposit flow for Personal Trading OS | Medium | Personal account balance and withdrawals need a complete cashflow model. |
| Add withdrawal validation against actual personal trading account balance | Medium | Current withdrawal recording can target a fallback account without balance validation. |
| Add manual net-worth snapshot creation and editing | Medium | Trend snapshots are auto-created, but users cannot correct or backfill history. |
| Add workspace data management: export, import, reset localStorage data | Medium | LocalStorage persistence needs an explicit management surface. |
| Remove duplicate `Broker Cash` card in Wealth Summary | Small | Simple clarity fix in a prominent summary grid. |

## P2 Items

These are useful polish, reporting depth, or future integration work after the product’s core flows are complete.

| Item | Effort | Why P2 |
| --- | --- | --- |
| Add payout proof/screenshot attachment | Medium | Useful for record quality, but payout recording itself is the blocker. |
| Add FTMO account promotion/demotion history | Medium | Good lifecycle audit trail once status changes exist. |
| Add asset-level transaction history in Wealth OS | Large | Useful for mature portfolio tracking, but asset CRUD comes first. |
| Add currency handling and VND/USD reconciliation | Large | Important for accuracy, but can wait until core wealth data entry is complete. |
| Link Personal Trading withdrawals to Wealth cash/bank accounts | Large | Valuable cross-OS integration, but not required for standalone workflows. |
| Link Personal Trading broker accounts with Wealth investment broker accounts when they represent the same account | Large | Prevents double counting, but needs mature account models first. |
| Add reconciliation views for trading cash, broker equity, and net-worth snapshots | Large | Advanced reporting layer after account and asset models are stable. |
| Add stronger visual distinction between dashboards, management screens, reports, and setup screens | Medium | Improves polish and scanability after the information architecture is stable. |
| Make generic Trading Dashboard a true cross-account executive dashboard if Shared Trading remains | Medium | Useful only after Shared Trading’s role is decided. |
| Add report exports for analytics, risk, net worth, and payouts | Medium | Helpful workflow enhancement but not required to fix current product coherence. |
| Add saved filters/views for Trades, Analytics, and Risk | Medium | Useful for repeated use after route/scope clarity is fixed. |
| Add richer onboarding copy for demo vs real workspace setup | Small | Helpful polish once first-run setup exists. |

## Recommended Build Order

1. Fix the core object model gaps: FTMO accounts, Personal Trading accounts, Wealth assets.
2. Remove or demote placeholder and duplicate screens.
3. Add payout recording and FTMO lifecycle actions.
4. Improve first-run setup and empty states.
5. Clarify route scope, naming, and data-source badges.
6. Add cross-OS reconciliation and advanced reporting.

## P0 Completion Definition

P0 is complete when:

- A new user can create a FTMO account without loading demo data.
- A new user can create a personal trading account before adding trades.
- A new user can create non-bank/non-broker wealth assets.
- Payouts can be recorded from the UI.
- Primary nav no longer contains placeholder-only pages.
- Net Worth and Portfolio are no longer duplicate read-only screens.
- Shared/legacy trading routes have a clear product role or are redirected.
