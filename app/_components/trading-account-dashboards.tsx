"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyFtmoPayouts,
  emptyPropAccounts,
  readStoredFtmoPayouts,
  readStoredPropAccounts,
  subscribeToFtmoPayouts,
  subscribeToPropAccounts,
  type PropAccount,
} from "@/app/_lib/prop-account-storage";
import {
  emptyPersonalTradingAccounts,
  readStoredPersonalTradingAccounts,
  subscribeToPersonalTradingAccounts,
} from "@/app/_lib/personal-account-storage";
import { useHydrated } from "@/app/_lib/use-hydrated";
import { buildRiskMetrics } from "@/app/_lib/risk-metrics";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import {
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  fallbackTradeHistory,
  initialTradingReport,
} from "@/app/_lib/trading-client-data";
import type { AccountType, MonthlyPerformance, Trade } from "@/app/_lib/trading-types";

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function plainMoney(value: number) {
  return `$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: number) {
  return `${Math.max(0, value).toFixed(1)}%`;
}

function uniqueAccountNames(trades: Trade[], accountType: AccountType) {
  return Array.from(
    new Set(
      trades
        .filter((trade) => (trade.accountType ?? "broker") === accountType)
        .map((trade) => trade.accountName ?? "Unassigned"),
    ),
  ).sort();
}

function monthlyPerformance(trades: Trade[]): MonthlyPerformance[] {
  const grouped = new Map<string, number>();

  trades
    .filter((trade) => trade.status !== "Open")
    .forEach((trade) => {
      const month = trade.date.split(" ")[0] || "Unknown";
      grouped.set(month, (grouped.get(month) ?? 0) + trade.pnl);
    });

  return Array.from(grouped.entries()).map(([month, pnl]) => ({ month, pnl }));
}

function countTradingDays(trades: Trade[]) {
  return new Set(
    trades
      .filter((trade) => trade.status !== "Open")
      .map((trade) => trade.date.split(",")[0] || trade.date),
  ).size;
}

function nextPropAction({
  canTradeToday,
  maxLossUsage,
  phase,
  profitTargetProgress,
  riskLevel,
}: {
  canTradeToday: string;
  maxLossUsage?: number;
  phase: string;
  profitTargetProgress: number;
  riskLevel: string;
}) {
  if (canTradeToday === "Stop") return "Stop Trading Today";
  if (riskLevel === "Breach" || riskLevel === "Danger") return "Rule Danger";
  if ((maxLossUsage ?? 0) >= 70) return "Trade Small Size";
  if (phase === "Funded" && profitTargetProgress >= 10) return "Payout Ready";
  if (phase === "Funded") return "Protect Funded";
  if (profitTargetProgress >= 100) return "Close To Passing";
  if (profitTargetProgress >= 90) return "Close To Passing";
  return "Keep Trading";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function missionForAccount(account: PropAccount, payoutReady: boolean) {
  if (payoutReady) return "Prepare For Payout";
  if (account.lifecycleType === "Funded" || account.phase === "Funded") return "Protect Funded Account";
  if (account.phase === "Phase 2") return "Pass Phase 2";
  return "Pass Phase 1";
}

function closedNetProfit(trades: Trade[]) {
  return trades
    .filter((trade) => trade.status !== "Open")
    .reduce((sum, trade) => sum + trade.pnl, 0);
}

function openPositionCount(trades: Trade[]) {
  return trades.filter((trade) => trade.status === "Open").length;
}

function statusBadgeTone(status: string) {
  if (status === "Danger" || status === "At Risk" || status === "Stop Trading Today" || status === "Rule Danger" || status === "Breached" || status === "Failed") {
    return "border-rose-300/30 bg-rose-400/10 text-rose-200";
  }

  if (status === "Warning") {
    return "border-amber-300/30 bg-amber-400/10 text-amber-200";
  }

  if (status === "Near Pass") {
    return "border-cyan-300/30 bg-cyan-400/10 text-cyan-200";
  }

  if (status === "Funded" || status === "Payout Ready" || status === "Passed" || status === "Active") {
    return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
  }

  return "border-sky-300/30 bg-sky-400/10 text-sky-200";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeTone(value)}`}>
      {value}
    </span>
  );
}

function CommandItem({
  label,
  metric,
}: {
  label: string;
  metric: ReturnType<typeof buildFtmoAccountMetrics> | null;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-3 text-lg font-semibold text-white">
        {metric?.account.accountName ?? "None"}
      </div>
      <div className="mt-3">
        {metric ? <StatusBadge value={metric.payoutReady ? "Payout Ready" : metric.visualStatus} /> : <StatusBadge value="Safe" />}
      </div>
      <div className="mt-3 text-sm text-slate-400">
        {metric?.nextAction ?? "No action required"}
      </div>
    </div>
  );
}

function registryAccountFromTrade(accountName: string, trades: Trade[]): PropAccount {
  const trade = trades.find((row) => row.accountName === accountName);
  const status =
    trade?.propStatus === "Passed" || trade?.propStatus === "Failed" || trade?.propStatus === "Archived"
      ? trade.propStatus
      : "Active";

  return {
    id: `trade-derived-${accountName}`,
    firmName: "FTMO",
    accountName,
    lifecycleType: trade?.phase === "Funded" || trade?.challengeType === "FTMO Funded" ? "Funded" : trade?.phase === "Phase 2" ? "Verification" : trade?.challengeType === "FTMO Challenge V1" ? "Challenge v1" : "Challenge v2",
    accountSize: trade?.accountSize ?? 100000,
    challengeType: trade?.challengeType ?? "FTMO Challenge V2",
    phase: trade?.phase ?? "Phase 1",
    status,
    lifecycleStatus: status,
    startDate: trade?.startDate ?? "",
    challengeStartDate: trade?.startDate ?? "",
    challengeEndDate: "",
    targetProfit: (trade?.accountSize ?? 100000) * ((trade?.profitTargetPercent ?? 10) / 100),
    minimumTradingDays: trade?.minimumTradingDays ?? 4,
    profitTargetPercent: trade?.profitTargetPercent ?? 10,
    dailyLossLimitPercent: trade?.dailyLossLimitPercent ?? 5,
    maxLossLimitPercent: trade?.maxLossLimitPercent ?? 10,
  };
}

function buildFtmoAccountMetrics({
  account,
  accountReport,
  payouts,
  settings,
  trades,
}: {
  account: PropAccount;
  accountReport: ReturnType<typeof useTradingDataset>["accountReport"];
  payouts: Array<{ accountName: string; amount: number }>;
  settings: ReturnType<typeof useRiskSettings>;
  trades: Trade[];
}) {
  const accountTrades = trades.filter((trade) => trade.accountName === account.accountName);
  const risk = buildRiskMetrics({ report: accountReport, settings, trades: accountTrades });
  const accountProfit = closedNetProfit(accountTrades);
  const targetAmount = account.targetProfit || account.accountSize * (account.profitTargetPercent / 100);
  const targetProgress = targetAmount === 0 ? 0 : (accountProfit / targetAmount) * 100;
  const targetRemaining = Math.max(0, targetAmount - accountProfit);
  const dailyLossRemaining = Math.max(
    0,
    account.accountSize * (account.dailyLossLimitPercent / 100) - Math.max(0, -risk.dailyPnl),
  );
  const maxLossRemaining = Math.max(
    0,
    account.accountSize * (account.maxLossLimitPercent / 100) - Math.max(0, risk.currentDrawdown),
  );
  const days = countTradingDays(accountTrades);
  const tradingDaysProgress = account.minimumTradingDays === 0 ? 100 : (days / Math.max(1, account.minimumTradingDays)) * 100;
  const canTradeToday = risk.dailyLossUsage >= 100 || risk.riskLevel === "Breach" ? "Stop" : risk.dailyLossUsage >= 70 ? "Warning" : "Yes";
  const lifetimePayout = payouts
    .filter((payout) => payout.accountName === account.accountName)
    .reduce((sum, payout) => sum + payout.amount, 0);
  const estimatedNextPayout = Math.max(0, accountProfit - lifetimePayout) * 0.8;
  const payoutReady =
    (account.lifecycleType === "Funded" || account.phase === "Funded") &&
    estimatedNextPayout > 0 &&
    openPositionCount(accountTrades) === 0 &&
    risk.riskLevel !== "Breach";
  const nextAction = nextPropAction({
    canTradeToday,
    maxLossUsage: risk.maxLossUsage,
    phase: account.phase,
    profitTargetProgress: targetProgress,
    riskLevel: risk.riskLevel,
  });
  const targetScore = account.lifecycleType === "Funded" || account.phase === "Funded" ? 75 : Math.min(100, Math.max(0, targetProgress));
  const dailyLossScore = Math.min(100, (dailyLossRemaining / Math.max(1, account.accountSize * (account.dailyLossLimitPercent / 100))) * 100);
  const maxLossScore = Math.min(100, (maxLossRemaining / Math.max(1, account.accountSize * (account.maxLossLimitPercent / 100))) * 100);
  const tradingDaysScore = account.minimumTradingDays === 0 ? 100 : Math.min(100, tradingDaysProgress);
  const openRiskScore = openPositionCount(accountTrades) > 0 ? 70 : 100;
  const healthScore = clampScore(
    targetScore * 0.2 +
      dailyLossScore * 0.2 +
      maxLossScore * 0.2 +
      tradingDaysScore * 0.15 +
      risk.disciplineScore * 0.15 +
      openRiskScore * 0.1,
  );
  const visualStatus = payoutReady
    ? "Payout Ready"
    : account.lifecycleType === "Funded" || account.phase === "Funded"
      ? "Funded"
      : targetProgress >= 90
        ? "Near Pass"
        : risk.riskLevel === "Danger" || risk.riskLevel === "Breach"
          ? "Danger"
          : risk.dailyLossUsage >= 70 || risk.maxLossUsage >= 70
            ? "Warning"
            : "Safe";

  return {
    account,
    accountProfit,
    canTradeToday,
    dailyLossRemaining,
    estimatedNextPayout,
    lifetimePayout,
    maxLossRemaining,
    nextAction,
    openPositions: openPositionCount(accountTrades),
    payoutReady,
    risk,
    targetProgress,
    targetRemaining,
    tradingDays: days,
    tradingDaysProgress,
    healthScore,
    mission: missionForAccount(account, payoutReady),
    riskBudgetRemaining: Math.min(dailyLossRemaining, maxLossRemaining),
    suggestedDailyProfitPace:
      account.lifecycleType === "Funded" || account.phase === "Funded" || targetRemaining === 0
        ? 0
        : targetRemaining / Math.max(1, account.minimumTradingDays - days),
    visualStatus,
  };
}

function MetricCard({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${tone}`}>{value}</div>
    </section>
  );
}

function BadgeCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-emerald-200">{label}</div>
      <div className="mt-3 inline-flex rounded-full border border-emerald-300/30 px-3 py-1 text-sm font-semibold text-emerald-100">
        {value}
      </div>
    </section>
  );
}

function AccountSelector({
  accountName,
  accountNames,
  onChange,
}: {
  accountName: string;
  accountNames: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Account
      </span>
      <select
        className="h-10 rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
        value={accountName}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All Accounts</option>
        {accountNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProgressCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-400">{label}</div>
        <div className="text-sm font-semibold text-slate-200">{percent(value)}</div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
        <div
          className={`h-2 rounded-full ${value >= 100 ? "bg-emerald-400" : value >= 70 ? "bg-amber-300" : "bg-sky-400"}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </section>
  );
}

function MonthlyTable({ rows }: { rows: MonthlyPerformance[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">Monthly Performance</h2>
      <div className="mt-5 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div className="flex items-center justify-between gap-4" key={row.month}>
              <div className="text-sm font-medium text-slate-200">{row.month}</div>
              <div className={`text-sm font-semibold ${row.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {money(row.pnl)}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500">No closed trades for this account.</div>
        )}
      </div>
    </section>
  );
}

export function PropTradingDashboard() {
  const settings = useRiskSettings();
  const { accountReport, tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport: initialTradingReport,
    initialTrades: fallbackTradeHistory,
  });
  const propAccounts = useSyncExternalStore(
    subscribeToPropAccounts,
    readStoredPropAccounts,
    () => emptyPropAccounts,
  );
  const ftmoPayouts = useSyncExternalStore(
    subscribeToFtmoPayouts,
    readStoredFtmoPayouts,
    () => emptyFtmoPayouts,
  );
  const mounted = useHydrated();
  const visiblePropAccounts = mounted ? propAccounts : emptyPropAccounts;
  const visibleFtmoPayouts = mounted ? ftmoPayouts : emptyFtmoPayouts;
  const registryNames = visiblePropAccounts.map((account) => account.accountName);
  const tradeAccountNames = uniqueAccountNames(tradeHistory, "prop-firm");
  const accountNames = registryNames.length ? registryNames : tradeAccountNames;
  const [accountName, setAccountName] = useState("");
  const selectedAccountName = accountName;
  const allPropTrades = tradeHistory.filter((trade) => (trade.accountType ?? "prop-firm") === "prop-firm");
  const ftmoAccounts = visiblePropAccounts.length
    ? visiblePropAccounts
    : tradeAccountNames.map((name) => registryAccountFromTrade(name, allPropTrades));
  const selectedRegistryAccount =
    visiblePropAccounts.find((account) => account.accountName === selectedAccountName) ?? null;
  const trades = useMemo(
    () =>
      tradeHistory.filter(
        (trade) =>
          (trade.accountType ?? "prop-firm") === "prop-firm" &&
          (!selectedAccountName || trade.accountName === selectedAccountName),
      ),
    [selectedAccountName, tradeHistory],
  );
  const accountMetrics = ftmoAccounts.map((account) =>
    buildFtmoAccountMetrics({
      account,
      accountReport,
      payouts: visibleFtmoPayouts,
      settings,
      trades: allPropTrades,
    }),
  );
  const healthRanking = [...accountMetrics].sort((a, b) => b.healthScore - a.healthScore);
  const tradableAccounts = accountMetrics.filter(
    (row) => row.canTradeToday !== "Stop" && row.visualStatus !== "Danger" && row.account.lifecycleType !== "Funded" && row.account.phase !== "Funded",
  );
  const bestAccountToTrade = [...tradableAccounts].sort((a, b) => b.healthScore - a.healthScore)[0] ?? null;
  const accountToAvoid =
    [...accountMetrics].sort((a, b) => a.healthScore - b.healthScore)[0] ?? null;
  const accountNearPassing =
    accountMetrics
      .filter((row) => row.account.lifecycleType !== "Funded" && row.account.phase !== "Funded")
      .sort((a, b) => b.targetProgress - a.targetProgress)[0] ?? null;
  const accountNearPayout =
    accountMetrics
      .filter((row) => row.account.lifecycleType === "Funded" || row.account.phase === "Funded")
      .sort((a, b) => b.estimatedNextPayout - a.estimatedNextPayout)[0] ?? null;
  const accountAtRisk =
    accountMetrics
      .filter((row) => row.visualStatus === "Warning" || row.visualStatus === "Danger")
      .sort((a, b) => a.healthScore - b.healthScore)[0] ?? accountToAvoid;
  const isAllAccounts = !selectedAccountName;
  const totalChallengeCapital = ftmoAccounts
    .filter((account) => account.lifecycleType !== "Funded" && account.phase !== "Funded")
    .reduce((sum, account) => sum + account.accountSize, 0);
  const totalFundedCapital = ftmoAccounts
    .filter((account) => account.lifecycleType === "Funded" || account.phase === "Funded")
    .reduce((sum, account) => sum + account.accountSize, 0);
  const activeChallenges = ftmoAccounts.filter(
    (account) => account.lifecycleStatus === "Active" && account.lifecycleType !== "Funded" && account.phase !== "Funded",
  ).length;
  const fundedAccounts = ftmoAccounts.filter((account) => account.lifecycleType === "Funded" || account.phase === "Funded").length;
  const accountsNearPass = accountMetrics.filter((row) => row.visualStatus === "Near Pass").length;
  const accountsAtRisk = accountMetrics.filter((row) => row.visualStatus === "Warning" || row.visualStatus === "Danger").length;
  const totalProfitTargetRemaining = accountMetrics
    .filter((row) => row.account.lifecycleType !== "Funded" && row.account.phase !== "Funded")
    .reduce((sum, row) => sum + row.targetRemaining, 0);
  const totalLifetimePayout = accountMetrics.reduce((sum, row) => sum + row.lifetimePayout, 0);
  const selected = trades[0];
  const risk = buildRiskMetrics({ report: accountReport, settings, trades });
  const accountSize = selectedRegistryAccount?.accountSize ?? selected?.accountSize ?? accountReport?.accountSize ?? risk.accountBalance;
  const profitTargetPercent = selectedRegistryAccount?.profitTargetPercent ?? selected?.profitTargetPercent ?? 10;
  const dailyLossLimitPercent = selectedRegistryAccount?.dailyLossLimitPercent ?? selected?.dailyLossLimitPercent ?? 5;
  const maxLossLimitPercent = selectedRegistryAccount?.maxLossLimitPercent ?? selected?.maxLossLimitPercent ?? 10;
  const minimumTradingDays = selectedRegistryAccount?.minimumTradingDays ?? selected?.minimumTradingDays ?? 4;
  const tradingDays = countTradingDays(trades);
  const profitTarget = selectedRegistryAccount?.targetProfit ?? accountSize * (profitTargetPercent / 100);
  const profitTargetProgress = profitTarget === 0 ? 0 : (risk.closedNetProfit / profitTarget) * 100;
  const dailyLossLimit = accountSize * (dailyLossLimitPercent / 100);
  const maxLossLimit = accountSize * (maxLossLimitPercent / 100);
  const dailyLossRemaining = Math.max(0, dailyLossLimit - Math.max(0, -risk.dailyPnl));
  const maxLossRemaining = Math.max(0, maxLossLimit - Math.max(0, risk.currentDrawdown));
  const canTradeToday = risk.dailyLossUsage >= 100 || risk.riskLevel === "Breach" ? "Stop" : risk.dailyLossUsage >= 70 ? "Warning" : "Yes";
  const nextAction = nextPropAction({
    canTradeToday,
    maxLossUsage: risk.maxLossUsage,
    phase: selectedRegistryAccount?.phase ?? selected?.phase ?? "Phase 1",
    profitTargetProgress,
    riskLevel: risk.riskLevel,
  });

  return (
    <AppShell
      eyebrow="FTMO OS"
      title="FTMO Dashboard"
      action={<AccountSelector accountName={selectedAccountName} accountNames={accountNames} onChange={setAccountName} />}
    >
      {isAllAccounts ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Challenge Capital" value={plainMoney(totalChallengeCapital)} />
            <MetricCard label="Total Funded Capital" value={plainMoney(totalFundedCapital)} />
            <MetricCard label="Active Challenges" value={`${activeChallenges}`} />
            <MetricCard label="Funded Accounts" value={`${fundedAccounts}`} />
            <MetricCard label="Accounts Near Pass" value={`${accountsNearPass}`} tone={accountsNearPass ? "text-cyan-300" : "text-white"} />
            <MetricCard label="Accounts At Risk" value={`${accountsAtRisk}`} tone={accountsAtRisk ? "text-amber-300" : "text-white"} />
            <MetricCard label="Total Profit Target Remaining" value={plainMoney(totalProfitTargetRemaining)} />
            <MetricCard label="Total Lifetime Payout" value={plainMoney(totalLifetimePayout)} />
          </section>

          <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
            <div>
              <h2 className="text-base font-semibold text-white">Daily Command Panel</h2>
              <p className="mt-1 text-sm text-slate-500">
                Account-level priorities generated from FTMO risk, target progress, payout readiness, and health score.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <CommandItem label="Best Account To Trade Today" metric={bestAccountToTrade} />
              <CommandItem label="Account To Avoid Today" metric={accountToAvoid} />
              <CommandItem label="Account Near Passing" metric={accountNearPassing} />
              <CommandItem label="Account Near Payout" metric={accountNearPayout} />
              <CommandItem label="Account At Risk" metric={accountAtRisk} />
            </div>
          </section>

          <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-base font-semibold text-white">Account Health Ranking</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Rank</th>
                    <th className="px-5 py-4 font-semibold">Account</th>
                    <th className="px-5 py-4 font-semibold">Health Score</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {healthRanking.map((row, index) => (
                    <tr className="text-slate-300" key={row.account.id}>
                      <td className="px-5 py-4 font-semibold text-white">#{index + 1}</td>
                      <td className="px-5 py-4 font-semibold text-white">{row.account.accountName}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 font-semibold text-white">{row.healthScore}</span>
                          <div className="h-2 w-36 rounded-full bg-white/[0.06]">
                            <div
                              className={`h-2 rounded-full ${
                                row.healthScore >= 80 ? "bg-emerald-400" : row.healthScore >= 60 ? "bg-amber-300" : "bg-rose-400"
                              }`}
                              style={{ width: `${row.healthScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><StatusBadge value={row.visualStatus} /></td>
                      <td className="px-5 py-4"><StatusBadge value={row.payoutReady ? "Payout Ready" : row.nextAction} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            {accountMetrics.map((row) => (
              <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20" key={row.account.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mission</div>
                    <h2 className="mt-2 text-lg font-semibold text-white">{row.account.accountName}</h2>
                  </div>
                  <StatusBadge value={row.mission} />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Remaining To Target</div>
                    <div className="mt-2 font-semibold text-white">{plainMoney(row.targetRemaining)}</div>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Daily Profit Pace</div>
                    <div className="mt-2 font-semibold text-white">{plainMoney(row.suggestedDailyProfitPace)}</div>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Risk Budget Remaining</div>
                    <div className="mt-2 font-semibold text-white">{plainMoney(row.riskBudgetRemaining)}</div>
                  </div>
                </div>
              </section>
            ))}
          </section>

          <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-base font-semibold text-white">FTMO Account Overview</h2>
              <p className="mt-1 text-sm text-slate-500">
                Portfolio-level view across every FTMO account in the registry.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Account Name</th>
                    <th className="px-5 py-4 font-semibold">Account Size</th>
                    <th className="px-5 py-4 font-semibold">Type</th>
                    <th className="px-5 py-4 font-semibold">Phase</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Profit Target Progress</th>
                    <th className="px-5 py-4 font-semibold">Daily Loss Remaining</th>
                    <th className="px-5 py-4 font-semibold">Max Loss Remaining</th>
                    <th className="px-5 py-4 font-semibold">Trading Days Progress</th>
                    <th className="px-5 py-4 font-semibold">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {accountMetrics.map((row) => (
                    <tr className="text-slate-300" key={row.account.id}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{row.account.accountName}</div>
                        <div className="mt-1">
                          <StatusBadge value={row.visualStatus} />
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-100">{plainMoney(row.account.accountSize)}</td>
                      <td className="px-5 py-4">{row.account.challengeType}</td>
                      <td className="px-5 py-4">{row.account.phase}</td>
                      <td className="px-5 py-4">
                        <StatusBadge value={row.account.lifecycleStatus} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="min-w-40">
                          <div className="mb-2 flex justify-between gap-3">
                            <span>{percent(row.targetProgress)}</span>
                            {row.account.phase === "Funded" ? (
                              <span className="text-emerald-300">{money(row.accountProfit)}</span>
                            ) : (
                              <span className="text-slate-500">{plainMoney(row.targetRemaining)} left</span>
                            )}
                          </div>
                          <div className="h-2 rounded-full bg-white/[0.06]">
                            <div
                              className={`h-2 rounded-full ${row.targetProgress >= 90 ? "bg-cyan-300" : "bg-emerald-400"}`}
                              style={{ width: `${Math.min(100, Math.max(0, row.targetProgress))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">{plainMoney(row.dailyLossRemaining)}</td>
                      <td className="px-5 py-4">{plainMoney(row.maxLossRemaining)}</td>
                      <td className="px-5 py-4">
                        {row.account.phase === "Funded" ? (
                          <div>
                            <div className="font-semibold text-emerald-300">{plainMoney(row.estimatedNextPayout)}</div>
                            <div className="mt-1 text-xs text-slate-500">Est. next payout</div>
                          </div>
                        ) : (
                          <div>
                            <div>{percent(row.tradingDaysProgress)}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {row.tradingDays}/{row.account.minimumTradingDays} days
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={row.payoutReady ? "Payout Ready" : row.nextAction} />
                        {row.account.phase === "Funded" ? (
                          <div className="mt-2 text-xs text-slate-500">
                            Lifetime payout {plainMoney(row.lifetimePayout)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Account Size" value={plainMoney(accountSize)} />
        <BadgeCard label="Firm" value={selectedRegistryAccount?.firmName ?? selected?.firmName ?? "FTMO"} />
        <BadgeCard label="Challenge Type" value={selectedRegistryAccount?.challengeType ?? selected?.challengeType ?? "FTMO Challenge V2"} />
        <BadgeCard label="Phase" value={selectedRegistryAccount?.phase ?? selected?.phase ?? "Phase 1"} />
        <MetricCard label="Status" value={selectedRegistryAccount?.status ?? selected?.propStatus ?? "Active"} />
        <MetricCard
          label="Can Trade Today"
          value={canTradeToday}
          tone={canTradeToday === "Stop" ? "text-rose-300" : canTradeToday === "Warning" ? "text-amber-300" : "text-emerald-300"}
        />
        <MetricCard label="Next Action" value={nextAction} tone={nextAction.includes("Stop") || nextAction.includes("Danger") ? "text-rose-300" : "text-emerald-300"} />
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressCard label="Profit Target Progress" value={profitTargetProgress} />
        <MetricCard label="Daily Loss Remaining" value={plainMoney(dailyLossRemaining)} />
        <MetricCard label="Max Loss Remaining" value={plainMoney(maxLossRemaining)} />
        <ProgressCard label="Trading Days Progress" value={(tradingDays / Math.max(1, minimumTradingDays)) * 100} />
        <MetricCard label="Discipline Score" value={`${risk.disciplineScore}/100`} />
      </section>
        </>
      )}
    </AppShell>
  );
}

export function PersonalTradingDashboard() {
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport: initialTradingReport,
    initialTrades: fallbackTradeHistory,
  });
  const personalAccounts = useSyncExternalStore(
    subscribeToPersonalTradingAccounts,
    readStoredPersonalTradingAccounts,
    () => emptyPersonalTradingAccounts,
  );
  const mounted = useHydrated();
  const visiblePersonalAccounts = mounted ? personalAccounts : emptyPersonalTradingAccounts;
  const accountNames = Array.from(
    new Set([
      ...visiblePersonalAccounts
        .filter((account) => account.status !== "Archived")
        .map((account) => account.accountName),
      ...uniqueAccountNames(tradeHistory, "broker"),
    ]),
  ).sort();
  const [accountName, setAccountName] = useState("");
  const trades = useMemo(
    () =>
      tradeHistory.filter(
        (trade) =>
          (trade.accountType ?? "broker") === "broker" &&
          (!accountName || trade.accountName === accountName),
      ),
    [accountName, tradeHistory],
  );
  const closedTrades = trades.filter((trade) => trade.status !== "Open");
  const openPositions = trades.filter((trade) => trade.status === "Open");
  const netProfit = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const floatingPnl = openPositions.reduce((sum, trade) => sum + (trade.floatingPnl ?? 0), 0);
  const monthlyRows = monthlyPerformance(trades);
  const latestMonthlyReturn = monthlyRows.at(-1)?.pnl ?? 0;
  const swingTrades = trades.filter((trade) => trade.strategyType === "Swing");
  const intraweekTrades = trades.filter((trade) => trade.strategyType === "Intraweek");

  return (
    <AppShell
      eyebrow="Personal Trading OS"
      title="Personal Trading"
      action={<AccountSelector accountName={accountName} accountNames={accountNames} onChange={setAccountName} />}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Monthly Return" value={money(latestMonthlyReturn)} tone={latestMonthlyReturn >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Open Positions" value={`${openPositions.length}`} />
        <MetricCard label="Floating P/L" value={money(floatingPnl)} tone={floatingPnl >= 0 ? "text-emerald-300" : "text-rose-300"} />
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <MetricCard label="Swing Trades" value={`${swingTrades.length}`} />
        <MetricCard label="Intraweek Trades" value={`${intraweekTrades.length}`} />
      </section>
      <div className="mt-6">
        <MonthlyTable rows={monthlyRows} />
      </div>
    </AppShell>
  );
}

export const PropFirmDashboard = PropTradingDashboard;
export const BrokerTradingDashboard = PersonalTradingDashboard;
