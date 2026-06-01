import type {
  EquityPoint,
  Kpi,
  MonthlyPerformance,
  Mt5AccountReport,
  SetupTag,
  Trade,
} from "@/app/_lib/trading-types";

export type SetupMetric = {
  setupTag: SetupTag;
  trades: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  averageRr: number;
};

export type TradingDataset = {
  accountReport: Mt5AccountReport | null;
  kpis: Kpi[];
  equityCurve: EquityPoint[];
  monthlyPerformance: MonthlyPerformance[];
  recentTrades: Trade[];
  setupMetrics: SetupMetric[];
  bestSetup: SetupMetric | null;
  worstSetup: SetupMetric | null;
  tradeHistory: Trade[];
};

function formatMoney(value: number) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function calculateWinRate(trades: Trade[]) {
  return trades.length === 0
    ? 0
    : (trades.filter((trade) => trade.result === "Win").length / trades.length) * 100;
}

function calculateProfitFactor(trades: Trade[]) {
  const grossProfit = trades
    .filter((trade) => trade.pnl > 0)
    .reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(
    trades
      .filter((trade) => trade.pnl < 0)
      .reduce((sum, trade) => sum + trade.pnl, 0),
  );

  return grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
}

function calculateAverageRr(trades: Trade[]) {
  return trades.length === 0
    ? 0
    : trades.reduce((sum, trade) => sum + trade.rr, 0) / trades.length;
}

export function buildSetupMetrics(trades: Trade[]) {
  const groups = new Map<SetupTag, Trade[]>();

  trades.forEach((trade) => {
    groups.set(trade.setupTag, [...(groups.get(trade.setupTag) ?? []), trade]);
  });

  return Array.from(groups.entries())
    .map<SetupMetric>(([setupTag, group]) => ({
      setupTag,
      trades: group.length,
      winRate: calculateWinRate(group),
      profitFactor: calculateProfitFactor(group),
      netProfit: group.reduce((sum, trade) => sum + trade.pnl, 0),
      averageRr: calculateAverageRr(group),
    }))
    .sort((a, b) => b.netProfit - a.netProfit);
}

export function buildEquityCurve(
  trades: Trade[],
  report: Mt5AccountReport | null,
  fallback: EquityPoint[],
) {
  if (!report || trades.length === 0) {
    return fallback;
  }

  const startBalance = report.balance - report.totalNetProfit;
  let runningBalance = startBalance;
  const points = trades.reduce<EquityPoint[]>((acc, trade) => {
    runningBalance += trade.pnl;
    acc.push({
      label: trade.date.split(",")[0],
      equity: Number(runningBalance.toFixed(2)),
    });
    return acc;
  }, []);

  return points.length > 48 ? points.filter((_, index) => index % 4 === 0) : points;
}

export function buildMonthlyPerformance(
  trades: Trade[],
  report: Mt5AccountReport | null,
  fallback: MonthlyPerformance[],
) {
  if (!report || trades.length === 0) {
    return fallback;
  }

  const months = new Map<string, number>();
  trades.forEach((trade) => {
    const month = trade.date.split(" ")[0];
    months.set(month, (months.get(month) ?? 0) + trade.pnl);
  });

  return Array.from(months.entries()).map(([month, pnl]) => ({
    month,
    pnl: Number(pnl.toFixed(2)),
  }));
}

export function buildKpis(trades: Trade[], report: Mt5AccountReport | null): Kpi[] {
  const netProfit =
    report?.totalNetProfit ?? trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winRate = calculateWinRate(trades);
  const profitFactor = report?.profitFactor ?? calculateProfitFactor(trades);
  const averageRr = calculateAverageRr(trades);

  return [
    {
      label: "Net Profit",
      value: formatMoney(netProfit),
      change: report ? "Imported from MT5" : "+18.4% YTD",
      tone: netProfit >= 0 ? "positive" : "negative",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      change: `${trades.length} closed trades`,
      tone: "positive",
    },
    {
      label: "Profit Factor",
      value: profitFactor.toFixed(2),
      change: "Gross win/loss",
      tone: "neutral",
    },
    {
      label: "Average RR",
      value: `${averageRr.toFixed(2)}R`,
      change: "Estimated from import",
      tone: averageRr >= 0 ? "positive" : "negative",
    },
    {
      label: "Max Drawdown",
      value: report?.maxDrawdown
        ? report.maxDrawdown.replace(/^.*\((.*?)\).*$/, "$1")
        : "7.6%",
      change: report?.maxDrawdown ?? "-2.4% improved",
      tone: "negative",
    },
  ];
}

export function createTradingDataset({
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  report,
  trades,
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  report: Mt5AccountReport | null;
  trades: Trade[];
}): TradingDataset {
  const setupMetrics = buildSetupMetrics(trades);

  return {
    accountReport: report,
    kpis: buildKpis(trades, report),
    equityCurve: buildEquityCurve(trades, report, fallbackEquityCurve),
    monthlyPerformance: buildMonthlyPerformance(
      trades,
      report,
      fallbackMonthlyPerformance,
    ),
    recentTrades: trades.slice(0, 5),
    setupMetrics,
    bestSetup: setupMetrics[0] ?? null,
    worstSetup: setupMetrics.at(-1) ?? null,
    tradeHistory: trades,
  };
}
