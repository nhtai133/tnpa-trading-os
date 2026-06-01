import type {
  EquityPoint,
  Kpi,
  MonthlyPerformance,
  Mt5AccountReport,
  Playbook,
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

export type PlaybookMetric = {
  playbook: Playbook;
  trades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  netProfit: number;
};

export type TradingDataset = {
  accountReport: Mt5AccountReport | null;
  closedNetProfit: number;
  closedTrades: Trade[];
  floatingPnl: number;
  kpis: Kpi[];
  equityCurve: EquityPoint[];
  monthlyPerformance: MonthlyPerformance[];
  recentTrades: Trade[];
  openPositions: Trade[];
  openPositionsCount: number;
  setupMetrics: SetupMetric[];
  bestSetup: SetupMetric | null;
  worstSetup: SetupMetric | null;
  playbookMetrics: PlaybookMetric[];
  bestPlaybook: PlaybookMetric | null;
  worstPlaybook: PlaybookMetric | null;
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

function closedTradesOnly(trades: Trade[]) {
  return trades.filter((trade) => trade.status !== "Open");
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
  const closedTrades = closedTradesOnly(trades);
  const groups = new Map<SetupTag, Trade[]>();

  closedTrades.forEach((trade) => {
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

export function buildPlaybookMetrics(trades: Trade[]) {
  const closedTrades = closedTradesOnly(trades);
  const groups = new Map<Playbook, Trade[]>();

  closedTrades.forEach((trade) => {
    groups.set(trade.playbook, [...(groups.get(trade.playbook) ?? []), trade]);
  });

  return Array.from(groups.entries())
    .map<PlaybookMetric>(([playbook, group]) => {
      const netProfit = group.reduce((sum, trade) => sum + trade.pnl, 0);

      return {
        playbook,
        trades: group.length,
        winRate: calculateWinRate(group),
        profitFactor: calculateProfitFactor(group),
        expectancy: group.length === 0 ? 0 : netProfit / group.length,
        netProfit,
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit);
}

export function buildEquityCurve(
  trades: Trade[],
  report: Mt5AccountReport | null,
  fallback: EquityPoint[],
) {
  const closedTrades = closedTradesOnly(trades);

  if (!report || closedTrades.length === 0) {
    return fallback;
  }

  const startBalance = report.balance - report.totalNetProfit;
  let runningBalance = startBalance;
  const points = closedTrades.reduce<EquityPoint[]>((acc, trade) => {
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
  const closedTrades = closedTradesOnly(trades);

  if (!report || closedTrades.length === 0) {
    return fallback;
  }

  const months = new Map<string, number>();
  closedTrades.forEach((trade) => {
    const month = trade.date.split(" ")[0];
    months.set(month, (months.get(month) ?? 0) + trade.pnl);
  });

  return Array.from(months.entries()).map(([month, pnl]) => ({
    month,
    pnl: Number(pnl.toFixed(2)),
  }));
}

export function buildKpis(trades: Trade[], report: Mt5AccountReport | null): Kpi[] {
  const closedTrades = closedTradesOnly(trades);
  const netProfit =
    report?.totalNetProfit ??
    closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winRate = calculateWinRate(closedTrades);
  const profitFactor = report?.profitFactor ?? calculateProfitFactor(closedTrades);
  const averageRr = calculateAverageRr(closedTrades);

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
      change: `${closedTrades.length} closed trades`,
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
  const closedTrades = closedTradesOnly(trades);
  const openPositions = trades.filter((trade) => trade.status === "Open");
  const closedNetProfit =
    report?.totalNetProfit ??
    closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const floatingPnl = openPositions.reduce(
    (sum, trade) => sum + (trade.floatingPnl ?? 0),
    0,
  );
  const setupMetrics = buildSetupMetrics(trades);
  const playbookMetrics = buildPlaybookMetrics(trades);

  return {
    accountReport: report,
    closedNetProfit,
    closedTrades,
    floatingPnl,
    kpis: buildKpis(trades, report),
    equityCurve: buildEquityCurve(trades, report, fallbackEquityCurve),
    monthlyPerformance: buildMonthlyPerformance(
      trades,
      report,
      fallbackMonthlyPerformance,
    ),
    recentTrades: trades.slice(0, 5),
    openPositions,
    openPositionsCount: openPositions.length,
    setupMetrics,
    bestSetup: setupMetrics[0] ?? null,
    worstSetup: setupMetrics.at(-1) ?? null,
    playbookMetrics,
    bestPlaybook: playbookMetrics[0] ?? null,
    worstPlaybook: playbookMetrics.at(-1) ?? null,
    tradeHistory: trades,
  };
}
