"use client";

import { useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { EquityCurveChart } from "@/app/_components/equity-curve-chart";
import { KpiCard } from "@/app/_components/kpi-card";
import { MonthlyPerformanceChart } from "@/app/_components/monthly-performance-chart";
import { RecentTradesTable } from "@/app/_components/recent-trades-table";
import {
  readStoredBrokerAccounts,
  subscribeToBrokerAccounts,
} from "@/app/_lib/broker-account-storage";
import {
  readStoredBankAccounts,
  subscribeToBankAccounts,
} from "@/app/_lib/bank-account-storage";
import { buildRiskMetrics } from "@/app/_lib/risk-metrics";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import { buildWealthSummaryWithAccounts } from "@/app/_lib/wealth-metrics";
import type { WealthAccount } from "@/app/_lib/wealth-types";
import {
  readStoredWealthAssets,
  subscribeToWealthAssets,
} from "@/app/_lib/wealth-storage";
import type { WealthAsset, WealthBrokerAccount } from "@/app/_lib/wealth-types";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

const emptyBankAccounts: WealthAccount[] = [];
const emptyBrokerAccounts: WealthBrokerAccount[] = [];
const emptyAssets: WealthAsset[] = [];

function formatMoney(value: number) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function SetupPerformanceCard({
  label,
  netProfit,
  name,
  trades,
}: {
  label: string;
  netProfit: number;
  name: string;
  trades: number;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-3 text-xl font-semibold text-white">{name}</div>
      <div
        className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          netProfit >= 0
            ? "bg-emerald-400/10 text-emerald-300"
            : "bg-rose-400/10 text-rose-300"
        }`}
      >
        {formatMoney(netProfit)} - {trades} trades
      </div>
    </section>
  );
}

function DashboardRiskCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  detail: string;
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-400/10 text-emerald-300"
      : tone === "negative"
        ? "bg-rose-400/10 text-rose-300"
        : "bg-amber-400/10 text-amber-300";

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
        {detail}
      </div>
    </section>
  );
}

function CashByBankCard({
  accounts,
  totalCash,
}: {
  accounts: { id: string; institution: string; balance: number; currency: string; name: string }[];
  totalCash: number;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-400">Cash by Bank</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {formatMoney(totalCash)}
          </div>
        </div>
        <div className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
          Bank balances
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {accounts.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">
            No bank accounts saved yet.
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">
                  {account.name}
                </div>
                <div className="text-xs text-slate-500">{account.institution}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-100">
                  {formatMoney(account.balance)}
                </div>
                <div className="text-xs text-slate-500">{account.currency}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function topJournalValue(
  trades: Trade[],
  key: keyof Pick<Trade, "emotion" | "mistake">,
) {
  const counts = new Map<string, number>();

  trades.forEach((trade) => {
    const value = trade[key];

    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
}

export function DashboardShell({
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  initialReport,
  initialTrades,
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  initialReport: Mt5AccountReport | null;
  initialTrades: Trade[];
}) {
  const settings = useRiskSettings();
  const {
    accountReport,
    bestSetup,
    bestPlaybook,
    closedNetProfit,
    equityCurve,
    kpis,
    monthlyPerformance,
    openPositionsCount,
    recentTrades,
    tradeHistory,
    worstSetup,
    worstPlaybook,
  } =
    useTradingDataset({
      fallbackEquityCurve,
      fallbackMonthlyPerformance,
      initialReport,
      initialTrades,
    });
  const bankAccounts = useSyncExternalStore(
    subscribeToBankAccounts,
    readStoredBankAccounts,
    () => emptyBankAccounts,
  );
  const brokerAccounts = useSyncExternalStore(
    subscribeToBrokerAccounts,
    readStoredBrokerAccounts,
    () => emptyBrokerAccounts,
  );
  const assets = useSyncExternalStore(
    subscribeToWealthAssets,
    readStoredWealthAssets,
    () => emptyAssets,
  );
  const activeBankAccounts = bankAccounts.filter(
    (account) => account.status !== "Archived",
  );
  const activeBrokerAccounts = brokerAccounts.filter(
    (account) => account.status !== "Archived",
  );
  const wealthSummary = buildWealthSummaryWithAccounts(
    assets,
    activeBankAccounts,
    activeBrokerAccounts,
  );
  const risk = buildRiskMetrics({
    report: accountReport,
    settings,
    trades: tradeHistory,
  });
  const totalCash = activeBankAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const reviewedTrades = tradeHistory.filter(
    (trade) =>
      trade.emotion ||
      trade.mistake ||
      trade.entryReason ||
      trade.exitReason ||
      trade.lessonLearned,
  ).length;
  const topMistake = topJournalValue(tradeHistory, "mistake");
  const topEmotion = topJournalValue(tradeHistory, "emotion");

  return (
    <AppShell
      eyebrow="Professional Trading Journal"
      title="TNPA Trading OS"
      action={
        <button className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white">
          Export Report
        </button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-5">
        <DashboardRiskCard
          label="Open Positions"
          value={`${openPositionsCount}`}
          tone={openPositionsCount > 0 ? "neutral" : "positive"}
          detail="Running trades"
        />
        <DashboardRiskCard
          label="Total Cash"
          value={formatMoney(totalCash)}
          tone={totalCash >= 0 ? "positive" : "negative"}
          detail="Bank balances"
        />
        <DashboardRiskCard
          label="Closed Net Profit"
          value={formatMoney(closedNetProfit)}
          tone={closedNetProfit >= 0 ? "positive" : "negative"}
          detail="Closed trades only"
        />
        <DashboardRiskCard
          label="Broker Equity"
          value={formatMoney(wealthSummary.brokerEquity)}
          tone={wealthSummary.brokerEquity >= 0 ? "positive" : "negative"}
          detail="Active broker accounts"
        />
        <DashboardRiskCard
          label="Stocks Value"
          value={formatMoney(wealthSummary.stocks)}
          tone={wealthSummary.stocks >= 0 ? "positive" : "negative"}
          detail="Broker and portfolio stocks"
        />
      </section>

      <section className="mt-4">
        <CashByBankCard accounts={activeBankAccounts} totalCash={totalCash} />
      </section>

      {bestSetup && worstSetup ? (
        <section className="mt-4 grid gap-4 xl:grid-cols-4">
          <SetupPerformanceCard
            label="Best Setup"
            name={bestSetup.setupTag}
            netProfit={bestSetup.netProfit}
            trades={bestSetup.trades}
          />
          <SetupPerformanceCard
            label="Worst Setup"
            name={worstSetup.setupTag}
            netProfit={worstSetup.netProfit}
            trades={worstSetup.trades}
          />
          <DashboardRiskCard
            label="FTMO Risk Status"
            value={risk.riskLevel}
            tone={
              risk.riskLevel === "Safe"
                ? "positive"
                : risk.riskLevel === "Warning"
                  ? "neutral"
                  : "negative"
            }
            detail={`Daily ${risk.dailyLossUsage.toFixed(1)}% / Max ${risk.maxLossUsage.toFixed(1)}%`}
          />
          <DashboardRiskCard
            label="Discipline Score"
            value={`${risk.disciplineScore}/100`}
            tone={
              risk.disciplineScore >= 80
                ? "positive"
                : risk.disciplineScore >= 60
                  ? "neutral"
                  : "negative"
            }
            detail="FTMO control model"
          />
        </section>
      ) : null}

      {bestPlaybook && worstPlaybook ? (
        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <SetupPerformanceCard
            label="Best Playbook"
            name={bestPlaybook.playbook}
            netProfit={bestPlaybook.netProfit}
            trades={bestPlaybook.trades}
          />
          <SetupPerformanceCard
            label="Worst Playbook"
            name={worstPlaybook.playbook}
            netProfit={worstPlaybook.netProfit}
            trades={worstPlaybook.trades}
          />
        </section>
      ) : null}

      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <DashboardRiskCard
          label="Discipline Summary"
          value={`${reviewedTrades}/${tradeHistory.length}`}
          tone={reviewedTrades > 0 ? "positive" : "neutral"}
          detail="Trades reviewed"
        />
        <DashboardRiskCard
          label="Top Mistake"
          value={topMistake?.[0] ?? "None"}
          tone={topMistake ? "neutral" : "positive"}
          detail={`${topMistake?.[1] ?? 0} tagged trades`}
        />
        <DashboardRiskCard
          label="Top Emotion"
          value={topEmotion?.[0] ?? "None"}
          tone={topEmotion ? "neutral" : "positive"}
          detail={`${topEmotion?.[1] ?? 0} tagged trades`}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <EquityCurveChart data={equityCurve} />
        <MonthlyPerformanceChart data={monthlyPerformance} />
      </section>

      <div className="mt-6">
        <RecentTradesTable trades={recentTrades} />
      </div>
    </AppShell>
  );
}
