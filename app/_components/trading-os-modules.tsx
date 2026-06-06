"use client";

import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyPropAccounts,
  emptyFtmoPayouts,
  lifecycleAccountStatuses,
  lifecycleAccountTypes,
  readStoredFtmoPayouts,
  readStoredPropAccounts,
  subscribeToFtmoPayouts,
  subscribeToPropAccounts,
  writeFtmoPayouts,
  writePropAccounts,
  type LifecycleAccountStatus,
  type LifecycleAccountType,
  type PropAccount,
} from "@/app/_lib/prop-account-storage";
import {
  emptyPersonalTradingAccounts,
  readStoredPersonalTradingAccounts,
  subscribeToPersonalTradingAccounts,
  writePersonalTradingAccounts,
  type PersonalTradingAccount,
} from "@/app/_lib/personal-account-storage";
import { buildRiskMetrics } from "@/app/_lib/risk-metrics";
import { useHydrated } from "@/app/_lib/use-hydrated";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import {
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  fallbackTradeHistory,
  initialTradingReport,
} from "@/app/_lib/trading-client-data";
import type {
  AccountType,
  ChallengeType,
  PropFirmName,
  PropPhase,
  StrategyType,
  Trade,
} from "@/app/_lib/trading-types";
import {
  brokerAccountNames,
  challengeTypes,
  propFirmNames,
  propPhases,
  strategyTypes,
} from "@/app/_lib/trading-types";

type AccountSummary = {
  key: string;
  accountName: string;
  firmName: string;
  challengeType: string;
  phase: string;
  status: string;
  strategyType: string;
  accountSize: number;
  closedPnl: number;
  floatingPnl: number;
  openPositions: number;
  closedTrades: number;
  winningTrades: number;
  tradingDays: number;
  profitTargetPercent: number;
  dailyLossLimitPercent: number;
  maxLossLimitPercent: number;
  minimumTradingDays: number;
};

type PersonalWithdrawal = {
  id: string;
  date: string;
  accountName: string;
  amount: number;
  note: string;
};

type PropAccountDraft = {
  id?: string;
  firmName: PropFirmName;
  accountName: string;
  lifecycleType: Exclude<LifecycleAccountType, "Personal">;
  accountSize: string;
  challengeType: ChallengeType;
  phase: PropPhase;
  status: LifecycleAccountStatus;
  startDate: string;
  challengeStartDate: string;
  challengeEndDate: string;
  targetProfit: string;
  minimumTradingDays: string;
  profitTargetPercent: string;
  dailyLossLimitPercent: string;
  maxLossLimitPercent: string;
};

type PersonalAccountDraft = {
  id?: string;
  accountName: string;
  brokerName: string;
  strategyType: StrategyType;
  initialBalance: string;
  challengeStartDate: string;
  challengeEndDate: string;
  targetProfit: string;
  status: LifecycleAccountStatus;
  notes: string;
};

type PayoutDraft = {
  accountName: string;
  date: string;
  amount: string;
  note: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const withdrawalStorageKey = "tnpa.personal-withdrawals.v1";
const emptyWithdrawals: PersonalWithdrawal[] = [];
let lastWithdrawalRaw: string | null = null;
let lastWithdrawalParsed: PersonalWithdrawal[] = emptyWithdrawals;

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function plainMoney(value: number) {
  return `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function lifecycleTypeFromChallengeType(challengeType: ChallengeType): Exclude<LifecycleAccountType, "Personal"> {
  if (challengeType === "FTMO Challenge V1") return "Challenge v1";
  if (challengeType === "FTMO Funded") return "Funded";
  return "Challenge v2";
}

function phaseFromLifecycleType(lifecycleType: Exclude<LifecycleAccountType, "Personal">): PropPhase {
  if (lifecycleType === "Funded") return "Funded";
  if (lifecycleType === "Verification") return "Phase 2";
  return "Phase 1";
}

function challengeTypeFromLifecycleType(lifecycleType: Exclude<LifecycleAccountType, "Personal">): ChallengeType {
  if (lifecycleType === "Challenge v1") return "FTMO Challenge V1";
  if (lifecycleType === "Funded") return "FTMO Funded";
  return "FTMO Challenge V2";
}

function propDraftFromAccount(account?: PropAccount): PropAccountDraft {
  const lifecycleStatus =
    account?.lifecycleStatus ?? (account?.status === "Funded" ? "Active" : account?.status) ?? "Active";

  return {
    id: account?.id,
    firmName: account?.firmName ?? "FTMO",
    accountName: account?.accountName ?? "",
    lifecycleType: account?.lifecycleType ?? lifecycleTypeFromChallengeType(account?.challengeType ?? "FTMO Challenge V2"),
    accountSize: account ? String(account.accountSize) : "100000",
    challengeType: account?.challengeType ?? "FTMO Challenge V2",
    phase: account?.phase ?? "Phase 1",
    status: lifecycleStatus,
    startDate: account?.startDate ?? "",
    challengeStartDate: account?.challengeStartDate ?? account?.startDate ?? "",
    challengeEndDate: account?.challengeEndDate ?? "",
    targetProfit: account ? String(account.targetProfit) : "10000",
    minimumTradingDays: account ? String(account.minimumTradingDays) : "4",
    profitTargetPercent: account ? String(account.profitTargetPercent) : "10",
    dailyLossLimitPercent: account ? String(account.dailyLossLimitPercent) : "5",
    maxLossLimitPercent: account ? String(account.maxLossLimitPercent) : "10",
  };
}

function personalDraftFromAccount(account?: PersonalTradingAccount): PersonalAccountDraft {
  return {
    id: account?.id,
    accountName: account?.accountName ?? "",
    brokerName: account?.brokerName ?? "ICMarkets",
    strategyType: account?.strategyType ?? "Swing",
    initialBalance: account ? String(account.initialBalance) : "",
    challengeStartDate: account?.challengeStartDate ?? "",
    challengeEndDate: account?.challengeEndDate ?? "",
    targetProfit: account ? String(account.targetProfit) : "",
    status: account?.status ?? "Active",
    notes: account?.notes ?? "",
  };
}

function closedTrades(trades: Trade[]) {
  return trades.filter((trade) => trade.status !== "Open");
}

function openTrades(trades: Trade[]) {
  return trades.filter((trade) => trade.status === "Open");
}

function netProfit(trades: Trade[]) {
  return closedTrades(trades).reduce((sum, trade) => sum + trade.pnl, 0);
}

function floatingPnl(trades: Trade[]) {
  return openTrades(trades).reduce((sum, trade) => sum + (trade.floatingPnl ?? 0), 0);
}

function winRate(trades: Trade[]) {
  const rows = closedTrades(trades);
  if (!rows.length) return 0;
  return (rows.filter((trade) => trade.result === "Win").length / rows.length) * 100;
}

function profitFactor(trades: Trade[]) {
  const rows = closedTrades(trades);
  const grossProfit = rows.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(rows.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
  if (grossLoss === 0) return grossProfit > 0 ? 99 : 0;
  return grossProfit / grossLoss;
}

function expectancy(trades: Trade[]) {
  const rows = closedTrades(trades);
  if (!rows.length) return 0;
  return rows.reduce((sum, trade) => sum + trade.pnl, 0) / rows.length;
}

function tradingDays(trades: Trade[]) {
  return new Set(closedTrades(trades).map((trade) => trade.date.split(",")[0] || trade.date)).size;
}

function monthKey(trade: Trade) {
  return trade.date.split(" ")[0] || "Unknown";
}

function useTradingOsData(accountType: AccountType) {
  const { accountReport, tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport: initialTradingReport,
    initialTrades: fallbackTradeHistory,
  });
  const trades = tradeHistory.filter((trade) => (trade.accountType ?? "broker") === accountType);
  return { accountReport, trades };
}

function usePropAccountRegistry() {
  return useSyncExternalStore(subscribeToPropAccounts, readStoredPropAccounts, () => emptyPropAccounts);
}

function usePersonalAccountRegistry() {
  return useSyncExternalStore(
    subscribeToPersonalTradingAccounts,
    readStoredPersonalTradingAccounts,
    () => emptyPersonalTradingAccounts,
  );
}

function tradesForPropAccount(trades: Trade[], account: PropAccount) {
  return trades.filter((trade) => trade.accountName === account.accountName);
}

function buildLifecycleSummary({
  accountSize,
  closedPnl,
  currentDrawdown,
  dailyPnl,
  dailyLossLimitPercent,
  maxLossLimitPercent,
  targetProfit,
}: {
  accountSize: number;
  closedPnl: number;
  currentDrawdown: number;
  dailyPnl: number;
  dailyLossLimitPercent: number;
  maxLossLimitPercent: number;
  targetProfit: number;
}) {
  return {
    remainingTarget: Math.max(0, targetProfit - closedPnl),
    remainingDailyLoss: Math.max(
      0,
      accountSize * (dailyLossLimitPercent / 100) - Math.max(0, -dailyPnl),
    ),
    remainingMaxLoss: Math.max(
      0,
      accountSize * (maxLossLimitPercent / 100) - Math.max(0, currentDrawdown),
    ),
  };
}

function accountSummaries(trades: Trade[]): AccountSummary[] {
  const grouped = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const key = trade.accountName ?? "Unassigned";
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  });

  return Array.from(grouped.entries())
    .map(([accountName, accountTrades]) => {
      const first = accountTrades[0];
      return {
        key: accountName,
        accountName,
        firmName: first?.firmName ?? first?.accountName ?? "Other",
        challengeType: first?.challengeType ?? "Other",
        phase: first?.phase ?? "Phase 1",
        status: first?.propStatus ?? "Active",
        strategyType: first?.strategyType ?? "Other",
        accountSize: first?.accountSize ?? 100000,
        closedPnl: netProfit(accountTrades),
        floatingPnl: floatingPnl(accountTrades),
        openPositions: openTrades(accountTrades).length,
        closedTrades: closedTrades(accountTrades).length,
        winningTrades: closedTrades(accountTrades).filter((trade) => trade.result === "Win").length,
        tradingDays: tradingDays(accountTrades),
        profitTargetPercent: first?.profitTargetPercent ?? 10,
        dailyLossLimitPercent: first?.dailyLossLimitPercent ?? 5,
        maxLossLimitPercent: first?.maxLossLimitPercent ?? 10,
        minimumTradingDays: first?.minimumTradingDays ?? 4,
      };
    })
    .sort((a, b) => b.closedPnl - a.closedPnl);
}

function groupedMetricRows(trades: Trade[], getKey: (trade: Trade) => string) {
  const grouped = new Map<string, Trade[]>();
  closedTrades(trades).forEach((trade) => {
    const key = getKey(trade);
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  });
  return Array.from(grouped.entries())
    .map(([label, rows]) => ({
      label,
      trades: rows.length,
      netProfit: netProfit(rows),
      winRate: winRate(rows),
      profitFactor: profitFactor(rows),
      expectancy: expectancy(rows),
    }))
    .sort((a, b) => b.netProfit - a.netProfit);
}

function monthlyRows(trades: Trade[]) {
  const grouped = new Map<string, number>();
  closedTrades(trades).forEach((trade) => {
    const key = monthKey(trade);
    grouped.set(key, (grouped.get(key) ?? 0) + trade.pnl);
  });
  return Array.from(grouped.entries()).map(([month, pnl]) => ({ month, pnl }));
}

function readWithdrawals() {
  if (typeof window === "undefined") return emptyWithdrawals;
  const raw = window.localStorage.getItem(withdrawalStorageKey);
  if (raw === lastWithdrawalRaw) return lastWithdrawalParsed;
  lastWithdrawalRaw = raw;
  if (!raw) {
    lastWithdrawalParsed = emptyWithdrawals;
    return lastWithdrawalParsed;
  }
  try {
    lastWithdrawalParsed = JSON.parse(raw) as PersonalWithdrawal[];
  } catch {
    lastWithdrawalParsed = emptyWithdrawals;
  }
  return lastWithdrawalParsed;
}

function subscribeWithdrawals(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener("tnpa:personal-withdrawals-updated", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("tnpa:personal-withdrawals-updated", listener);
  };
}

function writeWithdrawals(withdrawals: PersonalWithdrawal[]) {
  window.localStorage.setItem(withdrawalStorageKey, JSON.stringify(withdrawals));
  window.dispatchEvent(new Event("tnpa:personal-withdrawals-updated"));
}

function MetricCard({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${tone}`}>{value}</div>
    </section>
  );
}

function Badge({ value, tone = "emerald" }: { value: string; tone?: "emerald" | "amber" | "rose" | "cyan" }) {
  const colors = {
    amber: "border-amber-300/30 bg-amber-400/10 text-amber-200",
    cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    rose: "border-rose-300/30 bg-rose-400/10 text-rose-200",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>{value}</span>;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-white/[0.06]">
      <div
        className={`h-2 rounded-full ${value >= 100 ? "bg-emerald-400" : value >= 70 ? "bg-amber-300" : "bg-cyan-400"}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function HydrationPlaceholder({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <AppShell eyebrow={eyebrow} title={title}>
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <div className="h-4 w-48 rounded bg-white/[0.06]" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div className="h-24 rounded-md border border-white/10 bg-white/[0.03]" key={item} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function AccountTable({ rows, mode }: { rows: AccountSummary[]; mode: "prop" | "personal" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr className="border-b border-white/10">
            <th className="pb-3">Account</th>
            <th className="pb-3">{mode === "prop" ? "Firm" : "Strategy"}</th>
            <th className="pb-3">{mode === "prop" ? "Challenge" : "Open Positions"}</th>
            <th className="pb-3">Closed P/L</th>
            <th className="pb-3">Floating P/L</th>
            <th className="pb-3">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-white/5 text-slate-200" key={row.key}>
              <td className="py-3 font-semibold text-white">{row.accountName}</td>
              <td className="py-3">{mode === "prop" ? row.firmName : row.strategyType}</td>
              <td className="py-3">
                {mode === "prop" ? <Badge value={row.challengeType} tone="cyan" /> : row.openPositions}
              </td>
              <td className={`py-3 font-semibold ${row.closedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.closedPnl)}</td>
              <td className={`py-3 font-semibold ${row.floatingPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.floatingPnl)}</td>
              <td className="py-3">{percent(row.closedTrades ? (row.winningTrades / row.closedTrades) * 100 : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropLifecycleCard({
  account,
  accountReport,
  trades,
}: {
  account: PropAccount;
  accountReport: ReturnType<typeof useTradingOsData>["accountReport"];
  trades: Trade[];
}) {
  const settings = useRiskSettings();
  const accountTrades = tradesForPropAccount(trades, account);
  const risk = buildRiskMetrics({ report: accountReport, settings, trades: accountTrades });
  const target = account.targetProfit || account.accountSize * (account.profitTargetPercent / 100);
  const targetProgress = target ? (risk.closedNetProfit / target) * 100 : 0;
  const lifecycle = buildLifecycleSummary({
    accountSize: account.accountSize,
    closedPnl: risk.closedNetProfit,
    currentDrawdown: risk.currentDrawdown,
    dailyPnl: risk.dailyPnl,
    dailyLossLimitPercent: account.dailyLossLimitPercent,
    maxLossLimitPercent: account.maxLossLimitPercent,
    targetProfit: target,
  });
  const days = tradingDays(accountTrades);
  const dayProgress = account.minimumTradingDays
    ? (days / account.minimumTradingDays) * 100
    : 100;

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-base font-semibold text-white">{account.accountName}</h3>
      <div className="space-y-4">
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge value={account.firmName} />
          <Badge value={account.lifecycleType} tone="cyan" />
          <Badge value={account.phase} tone="amber" />
          <Badge value={account.lifecycleStatus} tone={account.lifecycleStatus === "Failed" || account.lifecycleStatus === "Breached" ? "rose" : "emerald"} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Account Size</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(account.accountSize)}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Daily Loss Remaining</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(lifecycle.remainingDailyLoss)}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Max Loss Remaining</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(lifecycle.remainingMaxLoss)}</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Target Profit</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(target)}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Remaining Target</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(lifecycle.remainingTarget)}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Challenge Window</div>
            <div className="mt-2 font-semibold text-white">
              {account.challengeStartDate || "Open"} / {account.challengeEndDate || "Open"}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm text-slate-300">
            <span>Profit Target Progress</span>
            <span>{percent(targetProgress)}</span>
          </div>
          <ProgressBar value={targetProgress} />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm text-slate-300">
            <span>Trading Days Progress</span>
            <span>{days}/{account.minimumTradingDays}</span>
          </div>
          <ProgressBar value={dayProgress} />
        </div>
      </div>
    </div>
  );
}

function AnalyticsTable({ rows }: { rows: ReturnType<typeof groupedMetricRows> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr className="border-b border-white/10">
            <th className="pb-3">Segment</th>
            <th className="pb-3">Trades</th>
            <th className="pb-3">Win Rate</th>
            <th className="pb-3">Profit Factor</th>
            <th className="pb-3">Expectancy</th>
            <th className="pb-3">Net Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-white/5 text-slate-200" key={row.label}>
              <td className="py-3 font-semibold text-white">{row.label}</td>
              <td className="py-3">{row.trades}</td>
              <td className="py-3">{percent(row.winRate)}</td>
              <td className="py-3">{row.profitFactor >= 99 ? "No losses" : row.profitFactor.toFixed(2)}</td>
              <td className={`py-3 font-semibold ${row.expectancy >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.expectancy)}</td>
              <td className={`py-3 font-semibold ${row.netProfit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.netProfit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PropAccountsModule() {
  const { accountReport, trades } = useTradingOsData("prop-firm");
  const settings = useRiskSettings();
  const registryAccounts = usePropAccountRegistry();
  const rows = accountSummaries(trades);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<PropAccountDraft>(() => propDraftFromAccount());
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const mounted = useHydrated();
  const activeAccounts = registryAccounts.filter((account) => account.lifecycleStatus !== "Archived");
  const archivedAccounts = registryAccounts.filter((account) => account.lifecycleStatus === "Archived");
  const passedAccounts = registryAccounts.filter((account) => account.lifecycleStatus === "Passed");
  const breachedAccounts = registryAccounts.filter((account) => account.lifecycleStatus === "Breached");
  const activeChallengeAccounts = registryAccounts.filter((account) => account.lifecycleStatus === "Active" && account.lifecycleType !== "Funded");
  const fundedLifecycleAccounts = registryAccounts.filter((account) => account.lifecycleType === "Funded");
  const lifecycleSummaries = registryAccounts.map((account) => {
    const accountTrades = tradesForPropAccount(trades, account);
    const risk = buildRiskMetrics({ report: accountReport, settings, trades: accountTrades });
    const targetProfit = account.targetProfit || account.accountSize * (account.profitTargetPercent / 100);
    return buildLifecycleSummary({
      accountSize: account.accountSize,
      closedPnl: risk.closedNetProfit,
      currentDrawdown: risk.currentDrawdown,
      dailyPnl: risk.dailyPnl,
      dailyLossLimitPercent: account.dailyLossLimitPercent,
      maxLossLimitPercent: account.maxLossLimitPercent,
      targetProfit,
    });
  });
  const totalTargetProfit = registryAccounts.reduce(
    (sum, account) => sum + (account.targetProfit || account.accountSize * (account.profitTargetPercent / 100)),
    0,
  );
  const totalRemainingTarget = lifecycleSummaries.reduce((sum, row) => sum + row.remainingTarget, 0);
  const totalRemainingDailyLoss = lifecycleSummaries.reduce((sum, row) => sum + row.remainingDailyLoss, 0);
  const totalRemainingMaxLoss = lifecycleSummaries.reduce((sum, row) => sum + row.remainingMaxLoss, 0);

  function openCreate() {
    setDraft(propDraftFromAccount());
    setError("");
    setIsOpen(true);
  }

  function openEdit(account: PropAccount) {
    setDraft(propDraftFromAccount(account));
    setError("");
    setIsOpen(true);
  }

  function buildValidatedAccount() {
    if (!draft.accountName.trim()) {
      setError("Account Name is required.");
      return null;
    }

    const accountSize = Number(draft.accountSize);
    const targetProfit = Number(draft.targetProfit);
    const minimumTradingDays = Number(draft.minimumTradingDays);
    const profitTargetPercent = Number(draft.profitTargetPercent);
    const dailyLossLimitPercent = Number(draft.dailyLossLimitPercent);
    const maxLossLimitPercent = Number(draft.maxLossLimitPercent);

    if (
      !Number.isFinite(accountSize) ||
      !Number.isFinite(targetProfit) ||
      !Number.isFinite(minimumTradingDays) ||
      !Number.isFinite(profitTargetPercent) ||
      !Number.isFinite(dailyLossLimitPercent) ||
      !Number.isFinite(maxLossLimitPercent)
    ) {
      setError("Account size, target profit, and rule fields must be numbers.");
      return null;
    }

    return {
      id: draft.id ?? `FTMO-${registryAccounts.length + 1}-${draft.accountName.trim().replace(/\s+/g, "-").toUpperCase()}`,
      firmName: draft.firmName,
      accountName: draft.accountName.trim(),
      lifecycleType: draft.lifecycleType,
      accountSize,
      challengeType: draft.challengeType,
      phase: draft.phase,
      status: draft.status === "Archived" ? "Archived" : draft.status === "Passed" ? "Passed" : draft.status === "Failed" || draft.status === "Breached" ? "Failed" : "Active",
      lifecycleStatus: draft.status,
      startDate: draft.challengeStartDate || draft.startDate,
      challengeStartDate: draft.challengeStartDate || draft.startDate,
      challengeEndDate: draft.challengeEndDate,
      targetProfit,
      minimumTradingDays,
      profitTargetPercent,
      dailyLossLimitPercent,
      maxLossLimitPercent,
    } satisfies PropAccount;
  }

  function saveAccount() {
    const nextAccount = buildValidatedAccount();
    if (!nextAccount) return;

    if (!draft.id) {
      writePropAccounts([nextAccount, ...registryAccounts]);
      setIsOpen(false);
      return;
    }

    writePropAccounts(
      registryAccounts.map((account) => (account.id === draft.id ? nextAccount : account)),
    );
    setIsOpen(false);
  }

  function archiveAccount(account: PropAccount) {
    writePropAccounts(
      registryAccounts.map((row) =>
        row.id === account.id ? { ...row, status: "Archived", lifecycleStatus: "Archived" } : row,
      ),
    );
  }

  if (!mounted) {
    return <HydrationPlaceholder eyebrow="FTMO OS" title="FTMO Accounts" />;
  }

  return (
    <AppShell
      eyebrow="FTMO OS"
      title="FTMO Accounts"
      action={
        <button
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          onClick={openCreate}
          type="button"
        >
          Add FTMO Account
        </button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registry Accounts" value={`${registryAccounts.length || rows.length}`} />
        <MetricCard label="Active Accounts" value={`${activeAccounts.filter((row) => row.status === "Active").length || rows.filter((row) => row.status === "Active").length}`} />
        <MetricCard label="Passed Accounts" value={`${passedAccounts.length}`} />
        <MetricCard label="Breached Accounts" value={`${breachedAccounts.length}`} tone={breachedAccounts.length ? "text-rose-300" : "text-white"} />
        <MetricCard label="Archived Accounts" value={`${archivedAccounts.length}`} />
        <MetricCard label="Active Challenges" value={`${activeChallengeAccounts.length}`} />
        <MetricCard label="Funded Accounts" value={`${fundedLifecycleAccounts.length}`} />
        <MetricCard label="Target Profit" value={plainMoney(totalTargetProfit)} />
        <MetricCard label="Remaining Target" value={plainMoney(totalRemainingTarget)} />
        <MetricCard label="Remaining Daily Loss" value={plainMoney(totalRemainingDailyLoss)} />
        <MetricCard label="Remaining Max Loss" value={plainMoney(totalRemainingMaxLoss)} />
        <MetricCard label="Total FTMO P/L" value={money(netProfit(trades))} tone={netProfit(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Open Positions" value={`${openTrades(trades).length}`} />
      </section>
      <div className="mt-6">
        <Section title="FTMO Account Registry">
          {registryAccounts.length ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                  onClick={() => setShowArchived((value) => !value)}
                  type="button"
                >
                  {showArchived ? "Hide Archived" : "Show Archived"}
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
              {(showArchived ? registryAccounts : activeAccounts).map((account) => (
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-4" key={account.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{account.accountName}</div>
                      <div className="mt-1 text-sm text-slate-400">{account.firmName} / {account.lifecycleType} / {plainMoney(account.accountSize)}</div>
                    </div>
                    <Badge value={account.lifecycleStatus} tone={account.lifecycleStatus === "Failed" || account.lifecycleStatus === "Breached" ? "rose" : "emerald"} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge value={`Target ${plainMoney(account.targetProfit)}`} tone="cyan" />
                    <Badge value={account.phase} tone="amber" />
                    <Badge value={`${account.challengeStartDate || "Open"} / ${account.challengeEndDate || "Open"}`} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                      onClick={() => openEdit(account)}
                      type="button"
                    >
                      Edit
                    </button>
                    {account.lifecycleStatus !== "Archived" ? (
                      <button
                        className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/40 hover:text-rose-100"
                        onClick={() => archiveAccount(account)}
                        type="button"
                      >
                        Archive
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              </div>
            </div>
          ) : rows.length ? (
            <AccountTable rows={rows} mode="prop" />
          ) : (
            <EmptyState text="No FTMO accounts found. Use Add FTMO Account to create your first registry record." />
          )}
        </Section>
      </div>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            aria-label="Close FTMO account drawer"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">FTMO Registry</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {draft.id ? "Edit FTMO Account" : "Add FTMO Account"}
                </h2>
              </div>
              <button
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            {error ? (
              <div className="mt-6 rounded-md border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-semibold text-rose-200">
                {error}
              </div>
            ) : null}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Account Name</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.accountName} onChange={(event) => setDraft((current) => ({ ...current, accountName: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Firm</span>
                <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.firmName} onChange={(event) => setDraft((current) => ({ ...current, firmName: event.target.value as PropFirmName }))}>
                  {propFirmNames.map((firm) => <option key={firm} value={firm}>{firm}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Account Size</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.accountSize} onChange={(event) => setDraft((current) => ({ ...current, accountSize: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Account Type</span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none"
                  value={draft.lifecycleType}
                  onChange={(event) => {
                    const lifecycleType = event.target.value as Exclude<LifecycleAccountType, "Personal">;
                    setDraft((current) => ({
                      ...current,
                      lifecycleType,
                      challengeType: challengeTypeFromLifecycleType(lifecycleType),
                      phase: phaseFromLifecycleType(lifecycleType),
                    }));
                  }}
                >
                  {lifecycleAccountTypes
                    .filter((type) => type !== "Personal")
                    .map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Challenge Type</span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none"
                  value={draft.challengeType}
                  onChange={(event) => {
                    const challengeType = event.target.value as ChallengeType;
                    setDraft((current) => ({
                      ...current,
                      challengeType,
                      lifecycleType: lifecycleTypeFromChallengeType(challengeType),
                    }));
                  }}
                >
                  {challengeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Phase</span>
                <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.phase} onChange={(event) => setDraft((current) => ({ ...current, phase: event.target.value as PropPhase }))}>
                  {propPhases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</span>
                <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as LifecycleAccountStatus }))}>
                  {lifecycleAccountStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Challenge Start Date</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" type="date" value={draft.challengeStartDate} onChange={(event) => setDraft((current) => ({ ...current, challengeStartDate: event.target.value, startDate: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Challenge End Date</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" type="date" value={draft.challengeEndDate} onChange={(event) => setDraft((current) => ({ ...current, challengeEndDate: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Target Profit</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.targetProfit} onChange={(event) => setDraft((current) => ({ ...current, targetProfit: event.target.value }))} />
              </label>
              {[
                ["Profit Target %", "profitTargetPercent"],
                ["Daily Loss Limit %", "dailyLossLimitPercent"],
                ["Max Loss Limit %", "maxLossLimitPercent"],
                ["Minimum Trading Days", "minimumTradingDays"],
              ].map(([label, key]) => (
                <label className="block" key={key}>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
                  <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft[key as keyof PropAccountDraft] as string} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200" onClick={() => setIsOpen(false)} type="button">Cancel</button>
              <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" onClick={saveAccount} type="button">
                {draft.id ? "Save Changes" : "Save Account"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}

export function PropChallengesModule() {
  const { accountReport, trades } = useTradingOsData("prop-firm");
  const registryAccounts = usePropAccountRegistry();
  const challengeAccounts = registryAccounts.filter((account) => account.lifecycleType !== "Funded");
  const activeAccounts = challengeAccounts.filter((account) => account.lifecycleStatus === "Active");
  const passedAccounts = challengeAccounts.filter((account) => account.lifecycleStatus === "Passed");
  const failedAccounts = challengeAccounts.filter((account) => account.lifecycleStatus === "Failed");
  const breachedAccounts = challengeAccounts.filter((account) => account.lifecycleStatus === "Breached");

  return (
    <AppShell eyebrow="FTMO OS" title="FTMO Challenges">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Challenges" value={`${activeAccounts.length}`} />
        <MetricCard label="Passed Challenges" value={`${passedAccounts.length}`} />
        <MetricCard label="Failed Challenges" value={`${failedAccounts.length}`} tone={failedAccounts.length ? "text-rose-300" : "text-white"} />
        <MetricCard label="Breached Challenges" value={`${breachedAccounts.length}`} tone={breachedAccounts.length ? "text-rose-300" : "text-white"} />
        <MetricCard label="Registry Challenges" value={`${challengeAccounts.length}`} />
      </section>
      {[
        ["Active Challenges", activeAccounts],
        ["Passed Challenges", passedAccounts],
        ["Failed Challenges", failedAccounts],
        ["Breached Challenges", breachedAccounts],
      ].map(([title, accounts]) => (
        <div className="mt-6" key={title as string}>
          <Section title={title as string}>
            {(accounts as PropAccount[]).length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {(accounts as PropAccount[]).map((account) => (
                  <PropLifecycleCard account={account} accountReport={accountReport} key={account.id} trades={trades} />
                ))}
              </div>
            ) : (
              <EmptyState text={`No ${(title as string).toLowerCase()} found.`} />
            )}
          </Section>
        </div>
      ))}
    </AppShell>
  );
}

export function PropFundedAccountsModule() {
  const { accountReport, trades } = useTradingOsData("prop-firm");
  const settings = useRiskSettings();
  const fundedAccounts = usePropAccountRegistry().filter((account) => account.lifecycleType === "Funded" || account.phase === "Funded");
  const payouts = useSyncExternalStore(
    subscribeToFtmoPayouts,
    readStoredFtmoPayouts,
    () => emptyFtmoPayouts,
  );

  return (
    <AppShell eyebrow="FTMO OS" title="FTMO Funded">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="FTMO Funded Accounts" value={`${fundedAccounts.length}`} />
        <MetricCard label="Funded Net Profit" value={money(fundedAccounts.reduce((sum, account) => sum + netProfit(tradesForPropAccount(trades, account)), 0))} />
        <MetricCard label="Open Funded Positions" value={`${fundedAccounts.reduce((sum, account) => sum + openTrades(tradesForPropAccount(trades, account)).length, 0)}`} />
        <MetricCard label="Payout Ready" value={`${fundedAccounts.filter((account) => netProfit(tradesForPropAccount(trades, account)) > 0).length}`} />
      </section>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {fundedAccounts.length ? (
          fundedAccounts.map((account) => {
            const accountTrades = tradesForPropAccount(trades, account);
            const risk = buildRiskMetrics({ report: accountReport, settings, trades: accountTrades });
            const pnl = netProfit(accountTrades);
            const openPositions = openTrades(accountTrades).length;
            const accountPayouts = payouts.filter((payout) => payout.accountName === account.accountName);
            const lifetimePayout = accountPayouts.reduce((sum, payout) => sum + payout.amount, 0);
            const estimatedNextPayout = Math.max(0, pnl - lifetimePayout) * 0.8;
            const payoutReady = estimatedNextPayout > 0 && risk.riskLevel !== "Breach" && openPositions === 0;
            return (
              <Section title={account.accountName} key={account.id}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Account Size" value={plainMoney(account.accountSize)} />
                  <MetricCard label="Current Profit" value={money(pnl)} tone={pnl >= 0 ? "text-emerald-300" : "text-rose-300"} />
                  <MetricCard label="Lifetime Payout" value={plainMoney(lifetimePayout)} />
                  <MetricCard label="Estimated Next Payout" value={plainMoney(estimatedNextPayout)} />
                  <MetricCard label="Payout Readiness" value={payoutReady ? "Ready" : "Not Ready"} tone={payoutReady ? "text-emerald-300" : "text-amber-300"} />
                  <MetricCard label="Open Positions" value={`${openPositions}`} />
                  <MetricCard label="Risk Status" value={risk.riskLevel} tone={risk.riskLevel === "Breach" ? "text-rose-300" : "text-emerald-300"} />
                </div>
                <div className="mt-5 rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-sm font-semibold text-white">Payout History</h3>
                  <div className="mt-3 space-y-2">
                    {accountPayouts.length ? (
                      accountPayouts.map((payout) => (
                        <div className="flex items-center justify-between gap-3 text-sm" key={payout.id}>
                          <span className="text-slate-300">{payout.date}</span>
                          <span className="font-semibold text-emerald-300">{plainMoney(payout.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">No payout history recorded.</div>
                    )}
                  </div>
                </div>
              </Section>
            );
          })
        ) : (
          <Section title="FTMO Funded">
            <EmptyState text="No funded FTMO accounts yet. Create an FTMO account and promote it to Funded from the Accounts screen." />
            <div className="mt-3">
              <a href="/prop-trading/accounts" className="inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20">
                Go to FTMO Accounts
              </a>
            </div>
          </Section>
        )}
      </div>
    </AppShell>
  );
}

export function PropPayoutsModule() {
  const { trades } = useTradingOsData("prop-firm");
  const rows = accountSummaries(trades);
  const registryAccounts = usePropAccountRegistry();
  const mounted = useHydrated();
  const payouts = useSyncExternalStore(
    subscribeToFtmoPayouts,
    readStoredFtmoPayouts,
    () => emptyFtmoPayouts,
  );
  const accountNames = Array.from(
    new Set([
      ...registryAccounts.map((account) => account.accountName),
      ...rows.map((row) => row.accountName),
    ]),
  );
  const firstAccountName = accountNames[0] ?? "";
  const [draft, setDraft] = useState<PayoutDraft>({
    accountName: "",
    date: "",
    amount: "",
    note: "",
  });
  const [error, setError] = useState("");
  const ready = rows.filter((row) => row.closedPnl > 0 && row.status !== "Failed");
  const totalPayouts = payouts.reduce((sum, payout) => sum + payout.amount, 0);

  const visiblePayoutAccountName = draft.accountName || firstAccountName;
  const visiblePayoutDate = draft.date || (mounted ? todayIsoDate() : "");

  function savePayout() {
    const amount = Number(draft.amount);
    const accountName = visiblePayoutAccountName;
    if (!accountName) {
      setError("Account is required.");
      return;
    }

    if (!draft.date) {
      setError("Date is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    writeFtmoPayouts([
      {
        id: `payout-${payouts.length + 1}-${draft.date}-${accountName.replace(/\s+/g, "-").toLowerCase()}`,
        accountName,
        date: visiblePayoutDate,
        amount,
        note: draft.note.trim(),
      },
      ...payouts,
    ]);
    setDraft((current) => ({ ...current, amount: "", note: "" }));
    setError("");
  }

  if (!mounted) {
    return <HydrationPlaceholder eyebrow="FTMO OS" title="FTMO Payouts" />;
  }

  return (
    <AppShell eyebrow="FTMO OS" title="FTMO Payouts">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Payout Ready Accounts" value={`${ready.length}`} />
        <MetricCard label="Estimated Payout Pool" value={money(ready.reduce((sum, row) => sum + row.closedPnl, 0))} tone="text-emerald-300" />
        <MetricCard label="Lifetime Payouts" value={plainMoney(totalPayouts)} />
        <MetricCard label="Payout Events" value={`${payouts.length}`} />
        <MetricCard label="Compliance Blocks" value={`${rows.filter((row) => row.status === "Failed").length}`} tone="text-rose-300" />
        <MetricCard label="Open Risk Checks" value={`${rows.filter((row) => row.openPositions > 0).length}`} />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <Section title="Add Payout">
          <div className="space-y-3">
            {error ? (
              <div className="rounded-md border border-rose-300/20 bg-rose-400/10 p-3 text-sm font-semibold text-rose-200">
                {error}
              </div>
            ) : null}
            <select
              className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none"
              value={visiblePayoutAccountName}
              onChange={(event) => setDraft((current) => ({ ...current, accountName: event.target.value }))}
            >
              {accountNames.length ? (
                accountNames.map((name) => <option key={name} value={name}>{name}</option>)
              ) : (
                <option value="">Create an FTMO account first</option>
              )}
            </select>
            <input
              className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none"
              type="date"
              value={visiblePayoutDate}
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            />
            <input
              className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none"
              placeholder="Amount"
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
            />
            <textarea
              className="min-h-24 w-full rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-sm text-slate-200 outline-none"
              placeholder="Notes"
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            />
            <button
              className="h-10 rounded-md bg-emerald-400 px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!accountNames.length}
              onClick={savePayout}
              type="button"
            >
              Save Payout
            </button>
          </div>
        </Section>
        <Section title="Payout History">
          {payouts.length ? (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3" key={payout.id}>
                  <div>
                    <div className="font-semibold text-white">{payout.accountName}</div>
                    <div className="mt-1 text-sm text-slate-400">{payout.date}{payout.note ? ` / ${payout.note}` : ""}</div>
                  </div>
                  <div className="font-semibold text-emerald-300">{plainMoney(payout.amount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No payouts recorded yet." />
          )}
        </Section>
      </div>
      <div className="mt-6">
        <Section title="Payout Readiness">
          {rows.length ? (
            <div className="space-y-3">
              {rows.map((row) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3" key={row.key}>
                  <div>
                    <div className="font-semibold text-white">{row.accountName}</div>
                    <div className="mt-1 text-sm text-slate-400">{row.firmName} / {row.phase}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-semibold ${row.closedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.closedPnl)}</div>
                    <Badge value={row.closedPnl > 0 && row.status !== "Failed" ? "Ready" : "Not Ready"} tone={row.closedPnl > 0 && row.status !== "Failed" ? "emerald" : "amber"} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No FTMO accounts found for payout review." />
          )}
        </Section>
      </div>
    </AppShell>
  );
}

export function PropAnalyticsModule() {
  const { trades } = useTradingOsData("prop-firm");
  const firmRows = groupedMetricRows(trades, (trade) => trade.firmName ?? trade.accountName ?? "Other");
  const challengeRows = groupedMetricRows(trades, (trade) => trade.challengeType ?? "Other");
  const setupRows = groupedMetricRows(trades, (trade) => trade.setupTag);

  return (
    <AppShell eyebrow="FTMO OS" title="FTMO Analytics">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="FTMO Net Profit" value={money(netProfit(trades))} tone={netProfit(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Win Rate" value={percent(winRate(trades))} />
        <MetricCard label="Profit Factor" value={profitFactor(trades).toFixed(2)} />
        <MetricCard label="Expectancy" value={money(expectancy(trades))} />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section title="By Firm">{firmRows.length ? <AnalyticsTable rows={firmRows} /> : <EmptyState text="No prop trades available." />}</Section>
        <Section title="By Challenge Type">{challengeRows.length ? <AnalyticsTable rows={challengeRows} /> : <EmptyState text="No prop challenge data available." />}</Section>
        <Section title="By Setup">{setupRows.length ? <AnalyticsTable rows={setupRows} /> : <EmptyState text="No prop setup data available." />}</Section>
      </div>
    </AppShell>
  );
}

export function PersonalAccountsModule() {
  const { trades } = useTradingOsData("broker");
  const rows = accountSummaries(trades);
  const registryAccounts = usePersonalAccountRegistry();
  const [isOpen, setIsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<PersonalAccountDraft>(() => personalDraftFromAccount());
  const [error, setError] = useState("");
  const mounted = useHydrated();
  const activeAccounts = registryAccounts.filter((account) => account.status !== "Archived");
  const archivedAccounts = registryAccounts.filter((account) => account.status === "Archived");
  const passedAccounts = registryAccounts.filter((account) => account.status === "Passed");
  const breachedAccounts = registryAccounts.filter((account) => account.status === "Breached");

  function openCreate() {
    setDraft(personalDraftFromAccount());
    setError("");
    setIsOpen(true);
  }

  function openEdit(account: PersonalTradingAccount) {
    setDraft(personalDraftFromAccount(account));
    setError("");
    setIsOpen(true);
  }

  function buildValidatedAccount() {
    if (!draft.accountName.trim()) {
      setError("Account Name is required.");
      return null;
    }

    if (!draft.brokerName.trim()) {
      setError("Broker Name is required.");
      return null;
    }

    const initialBalance = draft.initialBalance.trim() ? Number(draft.initialBalance) : 0;
    const targetProfit = draft.targetProfit.trim() ? Number(draft.targetProfit) : 0;
    if (!Number.isFinite(initialBalance) || !Number.isFinite(targetProfit)) {
      setError("Initial Balance and Target Profit must be numbers.");
      return null;
    }

    return {
      id: draft.id ?? `PERSONAL-${registryAccounts.length + 1}-${draft.accountName.trim().replace(/\s+/g, "-").toUpperCase()}`,
      lifecycleType: "Personal",
      accountName: draft.accountName.trim(),
      brokerName: draft.brokerName.trim(),
      strategyType: draft.strategyType,
      initialBalance,
      challengeStartDate: draft.challengeStartDate,
      challengeEndDate: draft.challengeEndDate,
      targetProfit,
      notes: draft.notes.trim() || undefined,
      status: draft.status,
    } satisfies PersonalTradingAccount;
  }

  function saveAccount() {
    const nextAccount = buildValidatedAccount();
    if (!nextAccount) return;

    if (!draft.id) {
      writePersonalTradingAccounts([nextAccount, ...registryAccounts]);
      setIsOpen(false);
      return;
    }

    const before = registryAccounts.find((account) => account.id === draft.id);
    writePersonalTradingAccounts(
      registryAccounts.map((account) =>
        account.id === draft.id
          ? {
              ...nextAccount,
              status: nextAccount.status ?? before?.status ?? "Active",
              archivedAt: before?.archivedAt,
            }
          : account,
      ),
    );
    setIsOpen(false);
  }

  function archiveAccount(account: PersonalTradingAccount) {
    writePersonalTradingAccounts(
      registryAccounts.map((row) =>
        row.id === account.id
          ? { ...row, status: "Archived", archivedAt: new Date().toISOString() }
          : row,
      ),
    );
  }

  if (!mounted) {
    return <HydrationPlaceholder eyebrow="Personal Trading OS" title="Personal Accounts" />;
  }

  return (
    <AppShell
      eyebrow="Personal Trading OS"
      title="Personal Accounts"
      action={
        <button
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          onClick={openCreate}
          type="button"
        >
          Add Personal Account
        </button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registry Accounts" value={`${registryAccounts.length || rows.length}`} />
        <MetricCard label="Active Accounts" value={`${activeAccounts.length || rows.length}`} />
        <MetricCard label="Passed Accounts" value={`${passedAccounts.length}`} />
        <MetricCard label="Breached Accounts" value={`${breachedAccounts.length}`} tone={breachedAccounts.length ? "text-rose-300" : "text-white"} />
        <MetricCard label="Archived Accounts" value={`${archivedAccounts.length}`} />
        <MetricCard label="Net Profit" value={money(netProfit(trades))} tone={netProfit(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Open Positions" value={`${openTrades(trades).length}`} />
        <MetricCard label="Floating P/L" value={money(floatingPnl(trades))} tone={floatingPnl(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
      </section>
      <div className="mt-6">
        <Section title="Personal Trading Accounts">
          {registryAccounts.length ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                  onClick={() => setShowArchived((value) => !value)}
                  type="button"
                >
                  {showArchived ? "Hide Archived" : "Show Archived"}
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {(showArchived ? registryAccounts : activeAccounts).map((account) => (
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4" key={account.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{account.accountName}</div>
                        <div className="mt-1 text-sm text-slate-400">{account.lifecycleType} / {account.brokerName} / {account.strategyType}</div>
                      </div>
                      <Badge value={account.status} tone={account.status === "Failed" || account.status === "Breached" ? "rose" : account.status === "Archived" ? "amber" : "emerald"} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MetricCard label="Initial Balance" value={plainMoney(account.initialBalance)} />
                      <MetricCard label="Strategy" value={account.strategyType} />
                      <MetricCard label="Target Profit" value={plainMoney(account.targetProfit)} />
                      <MetricCard
                        label="Remaining Target"
                        value={plainMoney(Math.max(0, account.targetProfit - netProfit(trades.filter((trade) => trade.accountName === account.accountName))))}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge value={`${account.challengeStartDate || "Open"} / ${account.challengeEndDate || "Open"}`} />
                    </div>
                    {account.notes ? <div className="mt-3 text-sm text-slate-500">{account.notes}</div> : null}
                    <div className="mt-4 flex gap-2">
                      <button
                        className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                        onClick={() => openEdit(account)}
                        type="button"
                      >
                        Edit
                      </button>
                      {account.status !== "Archived" ? (
                        <button
                          className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/40 hover:text-rose-100"
                          onClick={() => archiveAccount(account)}
                          type="button"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : rows.length ? (
            <AccountTable rows={rows} mode="personal" />
          ) : (
            <EmptyState text="No personal trading accounts found. Use Add Personal Account to create one." />
          )}
        </Section>
      </div>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            aria-label="Close personal account drawer"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Personal Trading</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {draft.id ? "Edit Personal Account" : "Add Personal Account"}
                </h2>
              </div>
              <button
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            {error ? (
              <div className="mt-6 rounded-md border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-semibold text-rose-200">
                {error}
              </div>
            ) : null}
            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Account Name</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.accountName} onChange={(event) => setDraft((current) => ({ ...current, accountName: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Broker Name</span>
                <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.brokerName} onChange={(event) => setDraft((current) => ({ ...current, brokerName: event.target.value }))}>
                  {brokerAccountNames.map((broker) => <option key={broker} value={broker}>{broker}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Strategy Type</span>
                <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.strategyType} onChange={(event) => setDraft((current) => ({ ...current, strategyType: event.target.value as StrategyType }))}>
                  {strategyTypes.map((strategy) => <option key={strategy} value={strategy}>{strategy}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Initial Balance</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.initialBalance} onChange={(event) => setDraft((current) => ({ ...current, initialBalance: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Account Type</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-400 outline-none" readOnly value="Personal" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</span>
                <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as LifecycleAccountStatus }))}>
                  {lifecycleAccountStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Challenge Start Date</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" type="date" value={draft.challengeStartDate} onChange={(event) => setDraft((current) => ({ ...current, challengeStartDate: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Challenge End Date</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" type="date" value={draft.challengeEndDate} onChange={(event) => setDraft((current) => ({ ...current, challengeEndDate: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Target Profit</span>
                <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={draft.targetProfit} onChange={(event) => setDraft((current) => ({ ...current, targetProfit: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Notes</span>
                <textarea className="min-h-24 w-full rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-sm text-slate-200 outline-none" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200" onClick={() => setIsOpen(false)} type="button">Cancel</button>
              <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" onClick={saveAccount} type="button">
                {draft.id ? "Save Changes" : "Save Account"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}

export function PersonalPerformanceModule() {
  const { trades } = useTradingOsData("broker");
  const rows = monthlyRows(trades);
  const growthRows = rows.reduce<Array<{ month: string; pnl: number; cumulative: number }>>((items, row) => {
    const previous = items.at(-1)?.cumulative ?? 0;
    return [...items, { ...row, cumulative: previous + row.pnl }];
  }, []);

  return (
    <AppShell eyebrow="Personal Trading OS" title="Performance">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net Profit" value={money(netProfit(trades))} tone={netProfit(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Monthly Return" value={money(rows.at(-1)?.pnl ?? 0)} />
        <MetricCard label="Portfolio Growth" value={money(netProfit(trades) + floatingPnl(trades))} />
        <MetricCard label="Open Positions" value={`${openTrades(trades).length}`} />
      </section>
      <div className="mt-6">
        <Section title="Monthly Cashflow and Growth">
          {growthRows.length ? (
            <div className="space-y-3">
              {growthRows.map((row) => (
                <div className="grid gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 sm:grid-cols-3" key={row.month}>
                  <div className="font-semibold text-white">{row.month}</div>
                  <div className={row.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}>{money(row.pnl)}</div>
                  <div className="text-slate-400">Growth: {money(row.cumulative)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No closed personal trades available for performance tracking." />
          )}
        </Section>
      </div>
    </AppShell>
  );
}

export function PersonalWithdrawalsModule() {
  const { trades } = useTradingOsData("broker");
  const withdrawals = useSyncExternalStore(subscribeWithdrawals, readWithdrawals, () => emptyWithdrawals);
  const personalAccounts = usePersonalAccountRegistry();
  const mounted = useHydrated();
  const accountNames = Array.from(
    new Set([
      ...personalAccounts
        .filter((account) => account.status !== "Archived")
        .map((account) => account.accountName),
      ...accountSummaries(trades).map((row) => row.accountName),
    ]),
  );
  const firstAccountName = accountNames[0] ?? "Personal Trading";
  const [date, setDate] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

  const visibleWithdrawalDate = date || (mounted ? todayIsoDate() : "");
  const visibleWithdrawalAccountName = accountName || firstAccountName;

  function saveWithdrawal() {
    const parsedAmount = Number(amount);
    if (!visibleWithdrawalDate || !visibleWithdrawalAccountName || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    writeWithdrawals([
      { id: `withdrawal-${Date.now()}`, date: visibleWithdrawalDate, accountName: visibleWithdrawalAccountName, amount: parsedAmount, note },
      ...withdrawals,
    ]);
    setAmount("");
    setNote("");
  }

  if (!mounted) {
    return <HydrationPlaceholder eyebrow="Personal Trading OS" title="Withdrawals" />;
  }

  return (
    <AppShell eyebrow="Personal Trading OS" title="Withdrawals">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Withdrawn" value={plainMoney(totalWithdrawn)} />
        <MetricCard label="Trading Cashflow" value={money(netProfit(trades) - totalWithdrawn)} />
        <MetricCard label="Withdrawal Events" value={`${withdrawals.length}`} />
        <MetricCard label="Open Positions" value={`${openTrades(trades).length}`} />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <Section title="Record Withdrawal">
          <div className="space-y-3">
            <input className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" type="date" value={visibleWithdrawalDate} onChange={(event) => setDate(event.target.value)} />
            <select className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={visibleWithdrawalAccountName} onChange={(event) => setAccountName(event.target.value)}>
              {[visibleWithdrawalAccountName, ...accountNames].filter((value, index, values) => value && values.indexOf(value) === index).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <textarea className="min-h-24 w-full rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-sm text-slate-200 outline-none" placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            <button className="h-10 rounded-md bg-emerald-400 px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!amount || !visibleWithdrawalAccountName} onClick={saveWithdrawal} type="button">
              Save Withdrawal
            </button>
          </div>
        </Section>
        <Section title="Withdraw History">
          {withdrawals.length ? (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3" key={withdrawal.id}>
                  <div>
                    <div className="font-semibold text-white">{withdrawal.accountName}</div>
                    <div className="mt-1 text-sm text-slate-400">{withdrawal.date}{withdrawal.note ? ` / ${withdrawal.note}` : ""}</div>
                  </div>
                  <div className="font-semibold text-amber-300">{plainMoney(withdrawal.amount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No withdrawals recorded yet." />
          )}
        </Section>
      </div>
    </AppShell>
  );
}

export function PersonalAnalyticsModule() {
  const { trades } = useTradingOsData("broker");
  const accountRows = groupedMetricRows(trades, (trade) => trade.accountName ?? "Unassigned");
  const strategyRows = groupedMetricRows(trades, (trade) => trade.strategyType ?? "Other");
  const setupRows = groupedMetricRows(trades, (trade) => trade.setupTag);

  return (
    <AppShell eyebrow="Personal Trading OS" title="Personal Analytics">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Personal Net Profit" value={money(netProfit(trades))} tone={netProfit(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Win Rate" value={percent(winRate(trades))} />
        <MetricCard label="Profit Factor" value={profitFactor(trades).toFixed(2)} />
        <MetricCard label="Expectancy" value={money(expectancy(trades))} />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section title="By Broker Account">{accountRows.length ? <AnalyticsTable rows={accountRows} /> : <EmptyState text="No personal trades available." />}</Section>
        <Section title="By Strategy">{strategyRows.length ? <AnalyticsTable rows={strategyRows} /> : <EmptyState text="No strategy data available." />}</Section>
        <Section title="By Setup">{setupRows.length ? <AnalyticsTable rows={setupRows} /> : <EmptyState text="No setup data available." />}</Section>
      </div>
    </AppShell>
  );
}
