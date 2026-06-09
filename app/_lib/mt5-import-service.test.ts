import test from "node:test";
import assert from "node:assert/strict";
import { importMt5Report } from "./mt5-import-service.ts";
import type { Mt5AccountReport, Trade } from "./trading-types.ts";

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: overrides.id ?? `MT5-${overrides.positionId ?? "1001"}`,
    accountId: overrides.accountId ?? "FTMO-200K-P1",
    account_id: overrides.account_id ?? overrides.accountId ?? "FTMO-200K-P1",
    brokerTradeIdentifier: overrides.brokerTradeIdentifier ?? overrides.positionId ?? "1001",
    broker_trade_identifier:
      overrides.broker_trade_identifier ?? overrides.brokerTradeIdentifier ?? overrides.positionId ?? "1001",
    positionId: overrides.positionId ?? "1001",
    position_id: overrides.position_id ?? overrides.positionId ?? "1001",
    source: "mt5",
    accountType: "prop-firm",
    accountName: "FTMO Challenge 200k Phase 1",
    strategyType: "Intraweek",
    symbol: "XAUUSD",
    setup: "MT5 imported",
    setupTag: "Other",
    playbook: "Other",
    status: "Closed",
    side: "Long",
    date: "Jun 1, 2026 10:00:00",
    session: "London",
    openTime: "2026.06.01 09:00:00",
    closeTime: "2026.06.01 10:00:00",
    volume: "1.00",
    openPrice: 2300,
    closePrice: 2310,
    entry: 2300,
    exit: 2310,
    rr: 1,
    pnl: 100,
    result: "Win",
    rawImportPayload: { position_id: overrides.positionId ?? "1001", profit: 100 },
    ...overrides,
  };
}

function report(accountId: string, trades: Trade[]): Mt5AccountReport {
  return {
    sourceFile: "ReportHistory.html",
    accountId,
    account_id: accountId,
    accountType: "prop-firm",
    accountName: accountId,
    strategyType: "Intraweek",
    name: "TNPA",
    account: accountId,
    company: "FTMO",
    generatedAt: "2026.06.01 11:00:00",
    balance: 200000,
    equity: 200000,
    totalNetProfit: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0,
    expectedPayoff: 0,
    totalTrades: trades.length,
    shortTrades: "0",
    longTrades: String(trades.length),
    maxDrawdown: "0",
    trades,
  };
}

test("importing the same MT5 file twice does not duplicate trades", () => {
  const first = importMt5Report(report("FTMO-200K-P1", [trade()]), null, {
    now: "2026-06-01T00:00:00.000Z",
  });
  const second = importMt5Report(report("FTMO-200K-P1", [trade()]), first.report, {
    now: "2026-06-01T00:00:00.000Z",
  });

  assert.equal(first.summary.new_trades, 1);
  assert.equal(second.report.trades.length, 1);
  assert.equal(second.summary.new_trades, 0);
  assert.equal(second.summary.updated_trades, 0);
  assert.equal(second.summary.skipped_duplicates, 1);
});

test("same ticket under two account_id values creates separate trades", () => {
  const first = importMt5Report(report("FTMO-200K-P1", [trade()]), null, {
    now: "2026-06-01T00:00:00.000Z",
  });
  const second = importMt5Report(
    report("FTMO-200K-P2", [
      trade({
        accountId: "FTMO-200K-P2",
        account_id: "FTMO-200K-P2",
        accountName: "FTMO-200K-P2",
      }),
    ]),
    first.report,
    { now: "2026-06-01T00:00:00.000Z" },
  );

  assert.equal(second.report.trades.length, 2);
  assert.equal(second.summary.new_trades, 1);
});

test("re-importing a trade preserves setup_tag and notes", () => {
  const current = report("FTMO-200K-P1", [
    trade({
      id: "existing-review-id",
      setupTag: "Breakout Trendline",
      setup_tag: "Breakout Trendline",
      notes: "Do not overwrite manual review.",
    }),
  ]);
  const result = importMt5Report(report("FTMO-200K-P1", [trade({ pnl: 125 })]), current, {
    now: "2026-06-02T00:00:00.000Z",
  });

  assert.equal(result.report.trades[0].id, "existing-review-id");
  assert.equal(result.report.trades[0].setupTag, "Breakout Trendline");
  assert.equal(result.report.trades[0].setup_tag, "Breakout Trendline");
  assert.equal(result.report.trades[0].notes, "Do not overwrite manual review.");
  assert.equal(result.report.trades[0].pnl, 125);
});

test("newer report adds only new trades and updates broker fields for existing trades", () => {
  const current = report("FTMO-200K-P1", [trade({ closePrice: 2310, exit: 2310, pnl: 100 })]);
  const incoming = report("FTMO-200K-P1", [
    trade({ closePrice: 2312, exit: 2312, pnl: 120 }),
    trade({ positionId: "1002", brokerTradeIdentifier: "1002", broker_trade_identifier: "1002" }),
  ]);
  const result = importMt5Report(incoming, current, {
    now: "2026-06-02T00:00:00.000Z",
  });

  assert.equal(result.report.trades.length, 2);
  assert.equal(result.summary.new_trades, 1);
  assert.equal(result.summary.updated_trades, 1);
  assert.equal(result.report.trades[0].closePrice, 2312);
  assert.equal(result.report.trades[0].pnl, 120);
});

test("dry-run does not mutate the current report", () => {
  const current = report("FTMO-200K-P1", [trade()]);
  const result = importMt5Report(
    report("FTMO-200K-P1", [
      trade(),
      trade({ positionId: "1002", brokerTradeIdentifier: "1002", broker_trade_identifier: "1002" }),
    ]),
    current,
    { dryRun: true, now: "2026-06-02T00:00:00.000Z" },
  );

  assert.equal(result.summary.new_trades, 1);
  assert.equal(result.summary.skipped_duplicates, 1);
  assert.equal(result.report.trades.length, 1);
  assert.equal(current.trades.length, 1);
});
