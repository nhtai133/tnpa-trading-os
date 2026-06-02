# TNPA Setup Intelligence V1 Report

## Objective

TNPA Setup Intelligence adds an FTMO-focused decision-support layer that ranks setup quality from existing `setupTag` data.

## Route

New route:

- `/prop-trading/setup-intelligence`

The route is available in the FTMO OS sidebar.

## Filters

Setup Intelligence supports global filters:

- FTMO Account
- Challenge Type
- Phase
- Date Range

## Metrics

The Setup Performance table includes:

- Setup
- Trades
- Win Rate
- Profit Factor
- Net Profit
- Avg R
- Expectancy
- Max Drawdown

Only closed FTMO/prop trades are included in expectancy, profit factor, and drawdown calculations.

## Cards And Ranking

The module includes:

- Best Setup Card
- Worst Setup Card
- Setup Ranking by expectancy, then profit factor

## Setup Badges

Visual setup quality badges:

- Elite
- Good
- Neutral
- Weak
- Avoid

## Insights

The Dashboard Insights section generates setup guidance such as:

- Highest expectancy setup
- Fragile or negative expectancy setup
- Avoid-rated setup

## Files Changed

- `app/_components/sidebar.tsx`
- `app/_components/setup-intelligence-module.tsx`
- `app/prop-trading/setup-intelligence/page.tsx`
- `TNPA_SETUP_INTELLIGENCE_REPORT.md`
