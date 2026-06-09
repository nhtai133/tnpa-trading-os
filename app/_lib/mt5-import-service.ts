import type { Mt5AccountReport, Trade } from "@/app/_lib/trading-types";

export type Mt5ImportSummary = {
  account_id: string;
  total_rows: number;
  new_trades: number;
  updated_trades: number;
  skipped_duplicates: number;
  errors: string[];
};

export type Mt5ImportResult = {
  report: Mt5AccountReport;
  summary: Mt5ImportSummary;
};

const brokerRawFields = [
  "symbol",
  "side",
  "volume",
  "openTime",
  "closeTime",
  "openPrice",
  "closePrice",
  "entry",
  "exit",
  "stopLoss",
  "takeProfit",
  "commission",
  "swap",
  "pnl",
  "floatingPnl",
  "result",
  "rawImportPayload",
] as const;

function stableHash(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function identifierPart(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function cleanId(value: string) {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function resolveTradeAccountId(
  trade: Partial<Trade>,
  report?: Partial<Mt5AccountReport> | null,
) {
  return (
    identifierPart(trade.accountId) ||
    identifierPart(trade.account_id) ||
    identifierPart(report?.accountId) ||
    identifierPart(report?.account_id) ||
    identifierPart(trade.accountName) ||
    identifierPart(report?.accountName) ||
    identifierPart(report?.account) ||
    "unassigned-account"
  );
}

export function deriveBrokerTradeIdentifier(
  trade: Partial<Trade>,
  accountId = resolveTradeAccountId(trade),
) {
  const preferred =
    identifierPart(trade.positionId) ||
    identifierPart(trade.position_id) ||
    identifierPart(trade.dealId) ||
    identifierPart(trade.deal_id) ||
    identifierPart(trade.orderId) ||
    identifierPart(trade.order_id) ||
    identifierPart(trade.ticket) ||
    identifierPart(trade.brokerTradeIdentifier) ||
    identifierPart(trade.broker_trade_identifier);

  if (preferred) {
    return preferred;
  }

  const fallbackInput = [
    accountId,
    trade.symbol,
    trade.side,
    trade.openTime,
    trade.closeTime,
    trade.openPrice ?? trade.entry,
    trade.closePrice ?? trade.exit,
    trade.volume,
    trade.pnl,
  ]
    .map((value) => identifierPart(value))
    .join("|");

  return `hash-${stableHash(fallbackInput)}`;
}

function tradeKey(accountId: string, brokerTradeIdentifier: string) {
  return `${accountId}::${brokerTradeIdentifier}`;
}

function tradeId(accountId: string, brokerTradeIdentifier: string) {
  return `MT5-${cleanId(accountId)}-${cleanId(brokerTradeIdentifier)}`;
}

function withIdentifiers(
  trade: Trade,
  report: Mt5AccountReport,
  options: { preserveId?: string; importedAt?: string; importBatchId?: string } = {},
): Trade {
  const accountId = resolveTradeAccountId(trade, report);
  const brokerTradeIdentifier = deriveBrokerTradeIdentifier(trade, accountId);
  const id = options.preserveId ?? trade.id ?? tradeId(accountId, brokerTradeIdentifier);

  return {
    ...trade,
    id,
    accountId,
    account_id: accountId,
    brokerTradeIdentifier,
    broker_trade_identifier: brokerTradeIdentifier,
    importedAt: options.importedAt ?? trade.importedAt,
    imported_at: options.importedAt ?? trade.imported_at,
    importBatchId: options.importBatchId ?? trade.importBatchId,
    import_batch_id: options.importBatchId ?? trade.import_batch_id,
  };
}

function comparableRawBrokerFields(trade: Trade) {
  return Object.fromEntries(
    brokerRawFields.map((field) => [field, trade[field]]),
  );
}

function hasBrokerFieldChanges(current: Trade, incoming: Trade) {
  return (
    JSON.stringify(comparableRawBrokerFields(current)) !==
    JSON.stringify(comparableRawBrokerFields(incoming))
  );
}

function updateBrokerFields(current: Trade, incoming: Trade) {
  return {
    ...current,
    symbol: incoming.symbol,
    side: incoming.side,
    volume: incoming.volume,
    openTime: incoming.openTime,
    closeTime: incoming.closeTime,
    date: incoming.date,
    session: incoming.session,
    openPrice: incoming.openPrice,
    closePrice: incoming.closePrice,
    entry: incoming.entry,
    exit: incoming.exit,
    stopLoss: incoming.stopLoss,
    takeProfit: incoming.takeProfit,
    commission: incoming.commission,
    swap: incoming.swap,
    pnl: incoming.pnl,
    floatingPnl: incoming.floatingPnl,
    result: incoming.result,
    rr: incoming.rr,
    rawImportPayload: incoming.rawImportPayload,
    raw_import_payload: incoming.raw_import_payload ?? incoming.rawImportPayload,
    importedAt: incoming.importedAt,
    imported_at: incoming.imported_at ?? incoming.importedAt,
    importBatchId: incoming.importBatchId,
    import_batch_id: incoming.import_batch_id ?? incoming.importBatchId,
  };
}

export function backfillMt5TradeIdentifiers(report: Mt5AccountReport) {
  return {
    ...report,
    accountId: report.accountId ?? report.account_id,
    account_id: report.account_id ?? report.accountId,
    trades: report.trades.map((trade) => withIdentifiers(trade, report)),
  };
}

export function importMt5Report(
  incomingReport: Mt5AccountReport,
  currentReport: Mt5AccountReport | null,
  options: { dryRun?: boolean; now?: string; importBatchId?: string } = {},
): Mt5ImportResult {
  const importedAt = options.now ?? new Date().toISOString();
  const importBatchId = options.importBatchId ?? `MT5-IMPORT-${stableHash(importedAt)}`;
  const incoming = backfillMt5TradeIdentifiers({
    ...incomingReport,
    trades: incomingReport.trades.map((trade) =>
      withIdentifiers(trade, incomingReport, { importedAt, importBatchId }),
    ),
  });
  const current = currentReport ? backfillMt5TradeIdentifiers(currentReport) : null;
  const accountId = incoming.accountId ?? incoming.account_id ?? resolveTradeAccountId({}, incoming);
  const summary: Mt5ImportSummary = {
    account_id: accountId,
    total_rows: incoming.trades.length,
    new_trades: 0,
    updated_trades: 0,
    skipped_duplicates: 0,
    errors: [],
  };
  const nextTrades = [...(current?.trades ?? [])];
  const existingIndex = new Map<string, number>();

  nextTrades.forEach((trade, index) => {
    const currentAccountId = resolveTradeAccountId(trade, current);
    const brokerTradeIdentifier = deriveBrokerTradeIdentifier(trade, currentAccountId);
    const key = tradeKey(currentAccountId, brokerTradeIdentifier);

    if (!existingIndex.has(key)) {
      existingIndex.set(key, index);
    }
  });

  const incomingKeys = new Set<string>();

  incoming.trades.forEach((trade) => {
    const incomingAccountId = resolveTradeAccountId(trade, incoming);
    const brokerTradeIdentifier = deriveBrokerTradeIdentifier(trade, incomingAccountId);
    const key = tradeKey(incomingAccountId, brokerTradeIdentifier);

    if (incomingKeys.has(key)) {
      summary.skipped_duplicates += 1;
      return;
    }
    incomingKeys.add(key);

    const existingTradeIndex = existingIndex.get(key);

    if (existingTradeIndex === undefined) {
      summary.new_trades += 1;
      if (!options.dryRun) {
        nextTrades.push({
          ...trade,
          id: tradeId(incomingAccountId, brokerTradeIdentifier),
        });
      }
      return;
    }

    const currentTrade = nextTrades[existingTradeIndex];

    if (!hasBrokerFieldChanges(currentTrade, trade)) {
      summary.skipped_duplicates += 1;
      return;
    }

    summary.updated_trades += 1;
    if (!options.dryRun) {
      nextTrades[existingTradeIndex] = updateBrokerFields(currentTrade, {
        ...trade,
        id: currentTrade.id,
      });
    }
  });

  return {
    report: options.dryRun
      ? current ?? incoming
      : {
          ...current,
          ...incoming,
          trades: nextTrades,
        },
    summary,
  };
}
