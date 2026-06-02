"use client";

import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyPropAccounts,
  emptyFtmoPayouts,
  readStoredFtmoPayouts,
  readStoredPropAccounts,
  subscribeToFtmoPayouts,
  subscribeToPropAccounts,
  type PropAccount,
} from "@/app/_lib/prop-account-storage";
import { buildRiskMetrics } from "@/app/_lib/risk-metrics";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import {
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  fallbackTradeHistory,
  initialTradingReport,
} from "@/app/_lib/trading-client-data";
import type { AccountType, Trade } from "@/app/_lib/trading-types";

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

function tradesForPropAccount(trades: Trade[], account: PropAccount) {
  return trades.filter((trade) => trade.accountName === account.accountName);
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
  const target = account.accountSize * (account.profitTargetPercent / 100);
  const targetProgress = target ? (risk.closedNetProfit / target) * 100 : 0;
  const dailyLossRemaining = Math.max(
    0,
    account.accountSize * (account.dailyLossLimitPercent / 100) - Math.max(0, -risk.dailyPnl),
  );
  const maxLossRemaining = Math.max(
    0,
    account.accountSize * (account.maxLossLimitPercent / 100) - Math.max(0, risk.currentDrawdown),
  );
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
          <Badge value={account.challengeType} tone="cyan" />
          <Badge value={account.phase} tone="amber" />
          <Badge value={account.status} tone={account.status === "Failed" ? "rose" : "emerald"} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Account Size</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(account.accountSize)}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Daily Loss Remaining</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(dailyLossRemaining)}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Max Loss Remaining</div>
            <div className="mt-2 font-semibold text-white">{plainMoney(maxLossRemaining)}</div>
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
  const { trades } = useTradingOsData("prop-firm");
  const registryAccounts = usePropAccountRegistry();
  const rows = accountSummaries(trades);

  return (
    <AppShell eyebrow="FTMO OS" title="FTMO Accounts">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registry Accounts" value={`${registryAccounts.length || rows.length}`} />
        <MetricCard label="Active Accounts" value={`${registryAccounts.filter((row) => row.status === "Active").length || rows.filter((row) => row.status === "Active").length}`} />
        <MetricCard label="Total FTMO P/L" value={money(netProfit(trades))} tone={netProfit(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Open Positions" value={`${openTrades(trades).length}`} />
      </section>
      <div className="mt-6">
        <Section title="FTMO Account Registry">
          {registryAccounts.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {registryAccounts.map((account) => (
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-4" key={account.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{account.accountName}</div>
                      <div className="mt-1 text-sm text-slate-400">{account.firmName} / {plainMoney(account.accountSize)}</div>
                    </div>
                    <Badge value={account.status} tone={account.status === "Failed" ? "rose" : "emerald"} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge value={account.challengeType} tone="cyan" />
                    <Badge value={account.phase} tone="amber" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length ? (
            <AccountTable rows={rows} mode="prop" />
          ) : (
            <EmptyState text="No FTMO account registry records found. Load demo FTMO accounts from Settings." />
          )}
        </Section>
      </div>
    </AppShell>
  );
}

export function PropChallengesModule() {
  const { accountReport, trades } = useTradingOsData("prop-firm");
  const registryAccounts = usePropAccountRegistry();
  const challengeAccounts = registryAccounts.filter((account) => account.challengeType !== "FTMO Funded" && account.phase !== "Funded");
  const activeAccounts = challengeAccounts.filter((account) => account.status === "Active");
  const passedAccounts = challengeAccounts.filter((account) => account.status === "Passed");
  const failedAccounts = challengeAccounts.filter((account) => account.status === "Failed");

  return (
    <AppShell eyebrow="FTMO OS" title="FTMO Challenges">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Challenges" value={`${activeAccounts.length}`} />
        <MetricCard label="Passed Challenges" value={`${passedAccounts.length}`} />
        <MetricCard label="Failed Challenges" value={`${failedAccounts.length}`} tone={failedAccounts.length ? "text-rose-300" : "text-white"} />
        <MetricCard label="Registry Challenges" value={`${challengeAccounts.length}`} />
      </section>
      {[
        ["Active Challenges", activeAccounts],
        ["Passed Challenges", passedAccounts],
        ["Failed Challenges", failedAccounts],
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
  const fundedAccounts = usePropAccountRegistry().filter((account) => account.status === "Funded" || account.phase === "Funded");
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
          <Section title="FTMO Funded"><EmptyState text="No FTMO funded accounts found. Load demo FTMO accounts from Settings." /></Section>
        )}
      </div>
    </AppShell>
  );
}

export function PropPayoutsModule() {
  const { trades } = useTradingOsData("prop-firm");
  const rows = accountSummaries(trades);
  const ready = rows.filter((row) => row.closedPnl > 0 && row.status !== "Failed");

  return (
    <AppShell eyebrow="FTMO OS" title="FTMO Payouts">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Payout Ready Accounts" value={`${ready.length}`} />
        <MetricCard label="Estimated Payout Pool" value={money(ready.reduce((sum, row) => sum + row.closedPnl, 0))} tone="text-emerald-300" />
        <MetricCard label="Compliance Blocks" value={`${rows.filter((row) => row.status === "Failed").length}`} tone="text-rose-300" />
        <MetricCard label="Open Risk Checks" value={`${rows.filter((row) => row.openPositions > 0).length}`} />
      </section>
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

  return (
    <AppShell eyebrow="Personal Trading OS" title="Personal Accounts">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Broker Accounts" value={`${rows.length}`} />
        <MetricCard label="Net Profit" value={money(netProfit(trades))} tone={netProfit(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Open Positions" value={`${openTrades(trades).length}`} />
        <MetricCard label="Floating P/L" value={money(floatingPnl(trades))} tone={floatingPnl(trades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
      </section>
      <div className="mt-6">
        <Section title="Personal Trading Accounts">{rows.length ? <AccountTable rows={rows} mode="personal" /> : <EmptyState text="No personal trading accounts found." />}</Section>
      </div>
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
  const accountNames = accountSummaries(trades).map((row) => row.accountName);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountName, setAccountName] = useState(accountNames[0] ?? "Personal Trading");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

  function saveWithdrawal() {
    const parsedAmount = Number(amount);
    if (!date || !accountName || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    writeWithdrawals([
      { id: `withdrawal-${Date.now()}`, date, accountName, amount: parsedAmount, note },
      ...withdrawals,
    ]);
    setAmount("");
    setNote("");
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
            <input className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <select className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" value={accountName} onChange={(event) => setAccountName(event.target.value)}>
              {[accountName, ...accountNames].filter((value, index, values) => value && values.indexOf(value) === index).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input className="h-10 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <textarea className="min-h-24 w-full rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-sm text-slate-200 outline-none" placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            <button className="h-10 rounded-md bg-emerald-400 px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!amount || !accountName} onClick={saveWithdrawal} type="button">
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
