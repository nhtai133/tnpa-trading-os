import type {
  Mt5AccountReport,
  RiskLevel,
  RiskSettings,
  SetupTag,
  Trade,
} from "@/app/_lib/trading-types";

export type DailyRiskMetric = {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
  dailyLossUsage: number;
  status: RiskLevel;
};

export type RiskWarning = {
  label: string;
  detail: string;
  level: Exclude<RiskLevel, "Safe">;
};

export type RiskMetrics = {
  accountBalance: number;
  equity: number;
  netProfit: number;
  maxDailyLoss: number;
  maxTotalDrawdown: number;
  currentDrawdown: number;
  peakEquity: number;
  dailyPnl: number;
  worstDay: DailyRiskMetric | null;
  bestDay: DailyRiskMetric | null;
  dailyLossUsage: number;
  maxLossUsage: number;
  profitTargetProgress: number;
  riskLevel: RiskLevel;
  dailyMetrics: DailyRiskMetric[];
  warnings: RiskWarning[];
  disciplineScore: number;
};

function dateKey(trade: Trade) {
  const date = new Date(trade.date);

  if (Number.isNaN(date.getTime())) {
    return trade.date.split(" ").slice(0, 3).join(" ");
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function winRate(trades: Trade[]) {
  return trades.length === 0
    ? 0
    : (trades.filter((trade) => trade.result === "Win").length / trades.length) *
        100;
}

function maxConsecutiveLosses(trades: Trade[]) {
  let current = 0;
  let best = 0;

  trades.forEach((trade) => {
    if (trade.result === "Loss") {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
}

function riskLevelFromUsage(dailyUsage: number, maxUsage: number) {
  const usage = Math.max(dailyUsage, maxUsage);

  if (usage >= 100) {
    return "Breach";
  }

  if (usage >= 85) {
    return "Danger";
  }

  if (usage >= 70) {
    return "Warning";
  }

  return "Safe";
}

function parseDrawdownPercent(drawdown: string) {
  const match = drawdown.match(/\(([\d.]+)%\)/);
  return match ? Number(match[1]) : 0;
}

export function buildRiskMetrics({
  report,
  settings,
  trades,
}: {
  report: Mt5AccountReport | null;
  settings: RiskSettings;
  trades: Trade[];
}): RiskMetrics {
  const netProfit = report
    ? report.totalNetProfit
    : trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const accountBalance = report ? report.balance : 100000 + netProfit;
  const equity = report ? report.equity : accountBalance;
  const startingBalance = Math.max(1, accountBalance - netProfit);
  const maxDailyLoss = startingBalance * (settings.dailyLossLimitPercent / 100);
  const maxTotalDrawdown = startingBalance * (settings.maxLossLimitPercent / 100);
  const profitTarget = startingBalance * (settings.profitTargetPercent / 100);

  let runningEquity = startingBalance;
  let peakEquity = startingBalance;
  let maxDrawdownAmount = 0;

  trades
    .slice()
    .reverse()
    .forEach((trade) => {
      runningEquity += trade.pnl;
      peakEquity = Math.max(peakEquity, runningEquity);
      maxDrawdownAmount = Math.max(maxDrawdownAmount, peakEquity - runningEquity);
    });

  const reportDrawdownPercent = report ? parseDrawdownPercent(report.maxDrawdown) : 0;
  const currentDrawdown = Math.max(0, peakEquity - equity);
  const drawdownForUsage = Math.max(
    currentDrawdown,
    maxDrawdownAmount,
    startingBalance * (reportDrawdownPercent / 100),
  );
  const grouped = new Map<string, Trade[]>();

  trades.forEach((trade) => {
    const key = dateKey(trade);
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  });

  const dailyMetrics = Array.from(grouped.entries())
    .map<DailyRiskMetric>(([date, dayTrades]) => {
      const pnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      const dailyLossUsage = pnl < 0 ? (Math.abs(pnl) / maxDailyLoss) * 100 : 0;

      return {
        date,
        pnl,
        trades: dayTrades.length,
        winRate: winRate(dayTrades),
        dailyLossUsage,
        status: riskLevelFromUsage(dailyLossUsage, 0),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const bestDay = dailyMetrics.reduce<DailyRiskMetric | null>(
    (best, day) => (!best || day.pnl > best.pnl ? day : best),
    null,
  );
  const worstDay = dailyMetrics.reduce<DailyRiskMetric | null>(
    (worst, day) => (!worst || day.pnl < worst.pnl ? day : worst),
    null,
  );
  const latestDay = dailyMetrics[0] ?? null;
  const dailyPnl = latestDay?.pnl ?? 0;
  const dailyLossUsage =
    dailyPnl < 0 ? (Math.abs(dailyPnl) / maxDailyLoss) * 100 : 0;
  const maxLossUsage = (drawdownForUsage / maxTotalDrawdown) * 100;
  const profitTargetProgress = (netProfit / profitTarget) * 100;
  const losingStreak = maxConsecutiveLosses(trades);
  const warnings: RiskWarning[] = [];

  if (dailyLossUsage >= 70) {
    warnings.push({
      label: "Daily loss pressure",
      detail: `Daily loss usage is ${dailyLossUsage.toFixed(1)}%.`,
      level: dailyLossUsage >= 100 ? "Breach" : "Warning",
    });
  }

  if (maxLossUsage >= 70) {
    warnings.push({
      label: "Max loss pressure",
      detail: `Max loss usage is ${maxLossUsage.toFixed(1)}%.`,
      level: maxLossUsage >= 100 ? "Breach" : "Warning",
    });
  }

  if (losingStreak >= 3) {
    warnings.push({
      label: "Losing streak",
      detail: `${losingStreak} consecutive losses detected.`,
      level: losingStreak >= 5 ? "Danger" : "Warning",
    });
  }

  dailyMetrics
    .filter((day) => day.trades > 5)
    .slice(0, 3)
    .forEach((day) => {
      warnings.push({
        label: "Overtrading",
        detail: `${day.trades} trades on ${day.date}.`,
        level: day.trades >= 8 ? "Danger" : "Warning",
      });
    });

  dailyMetrics
    .filter((day) => day.pnl < -(startingBalance * 0.02))
    .slice(0, 3)
    .forEach((day) => {
      warnings.push({
        label: "Large losing day",
        detail: `${day.date} lost ${((Math.abs(day.pnl) / startingBalance) * 100).toFixed(2)}%.`,
        level: "Warning",
      });
    });

  const setupCounts = new Map<SetupTag, number>();
  trades.forEach((trade) => {
    setupCounts.set(trade.setupTag, (setupCounts.get(trade.setupTag) ?? 0) + 1);
  });
  const largestSetupShare =
    trades.length === 0
      ? 0
      : Math.max(...Array.from(setupCounts.values())) / trades.length;
  const setupDisciplinePenalty = largestSetupShare < 0.35 ? 10 : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        Math.max(0, maxLossUsage - 35) * 0.55 -
        Math.max(0, dailyLossUsage - 35) * 0.55 -
        Math.max(0, (latestDay?.trades ?? 0) - 3) * 6 -
        Math.max(0, losingStreak - 2) * 8 -
        setupDisciplinePenalty,
    ),
  );

  return {
    accountBalance,
    equity,
    netProfit,
    maxDailyLoss,
    maxTotalDrawdown,
    currentDrawdown,
    peakEquity,
    dailyPnl,
    worstDay,
    bestDay,
    dailyLossUsage,
    maxLossUsage,
    profitTargetProgress,
    riskLevel: riskLevelFromUsage(dailyLossUsage, maxLossUsage),
    dailyMetrics,
    warnings,
    disciplineScore: Math.round(score),
  };
}
