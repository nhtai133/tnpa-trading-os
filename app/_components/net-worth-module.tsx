"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { buildWealthSummaryWithAccounts } from "@/app/_lib/wealth-metrics";
import { useHydrated } from "@/app/_lib/use-hydrated";
import {
  readStoredBankAccounts,
  subscribeToBankAccounts,
} from "@/app/_lib/bank-account-storage";
import {
  readStoredBrokerAccounts,
  subscribeToBrokerAccounts,
} from "@/app/_lib/broker-account-storage";
import {
  readStoredWealthAssets,
  subscribeToWealthAssets,
} from "@/app/_lib/wealth-storage";
import {
  readStoredWealthSnapshots,
  subscribeToWealthSnapshots,
  upsertWealthSnapshot,
} from "@/app/_lib/wealth-snapshot-storage";
import type { WealthSnapshot } from "@/app/_lib/wealth-snapshot-storage";
import type {
  WealthAccount,
  WealthAsset,
  WealthBrokerAccount,
} from "@/app/_lib/wealth-types";

const emptyAssets: WealthAsset[] = [];
const emptyBankAccounts: WealthAccount[] = [];
const emptyBrokerAccounts: WealthBrokerAccount[] = [];
const emptySnapshots: WealthSnapshot[] = [];

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function formatMoney(value: number) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function formatChange(value: number) {
  if (value === 0) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function ChangeChip({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-slate-500">—</span>;
  }
  const positive = value > 0;
  return (
    <span className={positive ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
      {formatChange(value)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-400/10 text-emerald-300"
      : tone === "negative"
        ? "bg-rose-400/10 text-rose-300"
        : "bg-sky-400/10 text-sky-300";

  return (
    <section className="rounded-md border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {sub ? (
        <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
          {sub}
        </div>
      ) : null}
    </section>
  );
}

function SnapshotHistoryTable({ snapshots }: { snapshots: WealthSnapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => b.month.localeCompare(a.month));

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No snapshots yet. Visit this page each month to build a history.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
          <tr>
            <th className="py-3 pr-4 font-semibold">Month</th>
            <th className="py-3 pr-4 font-semibold text-right">Net Worth</th>
            <th className="py-3 pr-4 font-semibold text-right">Change</th>
            <th className="py-3 pr-4 font-semibold text-right">Cash</th>
            <th className="py-3 pr-4 font-semibold text-right">Savings</th>
            <th className="py-3 pr-4 font-semibold text-right">Stocks</th>
            <th className="py-3 pr-4 font-semibold text-right">Crypto</th>
            <th className="py-3 pr-4 font-semibold text-right">Real Estate</th>
            <th className="py-3 pr-4 font-semibold text-right">Broker</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {sorted.map((snap, index) => {
            const prev = sorted[index + 1];
            const change = prev ? snap.netWorth - prev.netWorth : 0;
            const isCurrentMonth = snap.month === getMonthKey();
            return (
              <tr key={snap.month} className="text-slate-300">
                <td className="py-3 pr-4 font-semibold text-white">
                  {getMonthLabel(snap.month)}
                  {isCurrentMonth ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
                      Current
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-white">
                  {formatMoney(snap.netWorth)}
                </td>
                <td className="py-3 pr-4 text-right">
                  {prev ? <ChangeChip value={change} /> : <span className="text-slate-500">—</span>}
                </td>
                <td className="py-3 pr-4 text-right">{formatMoney(snap.cash)}</td>
                <td className="py-3 pr-4 text-right">{formatMoney(snap.savings)}</td>
                <td className="py-3 pr-4 text-right">{formatMoney(snap.stocks)}</td>
                <td className="py-3 pr-4 text-right">{formatMoney(snap.crypto)}</td>
                <td className="py-3 pr-4 text-right">{formatMoney(snap.realEstate)}</td>
                <td className="py-3 pr-4 text-right">{formatMoney(snap.brokerEquity)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NetWorthModule() {
  const mounted = useHydrated();

  const assets = useSyncExternalStore(
    subscribeToWealthAssets,
    readStoredWealthAssets,
    () => emptyAssets,
  );
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
  const snapshots = useSyncExternalStore(
    subscribeToWealthSnapshots,
    readStoredWealthSnapshots,
    () => emptySnapshots,
  );

  const summary = buildWealthSummaryWithAccounts(assets, bankAccounts, brokerAccounts);

  useEffect(() => {
    if (!mounted) return;
    const monthKey = getMonthKey();
    upsertWealthSnapshot({
      month: monthKey,
      label: getMonthLabel(monthKey),
      netWorth: summary.totalNetWorth,
      cash: summary.cash,
      savings: summary.savings,
      stocks: summary.stocks,
      crypto: summary.crypto,
      realEstate: summary.realEstate,
      brokerCash: summary.brokerCash,
      brokerEquity: summary.brokerEquity,
      bankCash: summary.bankCash,
      tradingAccounts: 0,
      timestamp: new Date().toISOString(),
    });
  }, [mounted, summary.totalNetWorth, summary.cash, summary.savings, summary.stocks, summary.crypto, summary.realEstate, summary.brokerCash, summary.brokerEquity, summary.bankCash]);

  const sorted = [...snapshots].sort((a, b) => b.month.localeCompare(a.month));
  const latest = sorted[0];
  const previous = sorted[1];
  const momChange = latest && previous ? latest.netWorth - previous.netWorth : 0;
  const momTone = momChange > 0 ? "positive" : momChange < 0 ? "negative" : "neutral";

  if (!mounted) {
    return (
      <AppShell eyebrow="Wealth" title="Net Worth">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-md border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
          <div className="h-64 rounded-md border border-white/10 bg-[#0d121c]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Wealth" title="Net Worth">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Total Net Worth"
            value={formatMoney(summary.totalNetWorth)}
            sub="Current month"
            tone={summary.totalNetWorth >= 0 ? "positive" : "negative"}
          />
          <KpiCard
            label="Month-over-Month"
            value={momChange !== 0 ? formatChange(momChange) : "—"}
            sub={previous ? `vs ${getMonthLabel(previous.month)}` : "No prior snapshot"}
            tone={momTone}
          />
          <KpiCard
            label="Snapshots Recorded"
            value={String(snapshots.length)}
            sub="Auto-updated each visit"
          />
        </div>

        <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-white">Snapshot History</h2>
              <p className="mt-1 text-sm text-slate-500">
                Monthly net worth snapshots recorded automatically when you visit this page.
              </p>
            </div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Auto-snapshot
            </div>
          </div>
          <SnapshotHistoryTable snapshots={snapshots} />
        </section>
      </div>
    </AppShell>
  );
}
