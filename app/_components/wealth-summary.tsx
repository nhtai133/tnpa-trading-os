"use client";

import { useSyncExternalStore } from "react";
import { buildWealthSummaryWithAccounts } from "@/app/_lib/wealth-metrics";
import { useHydrated } from "@/app/_lib/use-hydrated";
import {
  readStoredBrokerAccounts,
  subscribeToBrokerAccounts,
} from "@/app/_lib/broker-account-storage";
import {
  readStoredBankAccounts,
  subscribeToBankAccounts,
} from "@/app/_lib/bank-account-storage";
import {
  readStoredWealthAssets,
  subscribeToWealthAssets,
} from "@/app/_lib/wealth-storage";
import type {
  WealthAccount,
  WealthAsset,
  WealthBrokerAccount,
} from "@/app/_lib/wealth-types";

const emptyAssets: WealthAsset[] = [];
const emptyBankAccounts: WealthAccount[] = [];
const emptyBrokerAccounts: WealthBrokerAccount[] = [];
const wealthRows = [
  { key: "bankCash", label: "Bank Cash", notes: "Cash held in bank accounts" },
  { key: "brokerCash", label: "Broker Cash", notes: "Cash held at brokers" },
  { key: "brokerEquity", label: "Broker Equity", notes: "Cash plus stock and ETF holdings" },
  { key: "cash", label: "Cash", notes: "Cash and USDC balances" },
  { key: "savings", label: "Savings", notes: "Bank savings balances" },
  { key: "stocks", label: "Stocks", notes: "Equity holdings and broker securities" },
  { key: "crypto", label: "Crypto", notes: "Digital asset positions" },
  { key: "realEstate", label: "Real Estate", notes: "Property holdings" },
  { key: "other", label: "Other", notes: "Unclassified wealth assets" },
] as const;
type WealthRowKey = (typeof wealthRows)[number]["key"];

function formatMoney(value: number) {
  const sign = value >= 0 ? "" : "-";

  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  tone?: "positive" | "negative" | "neutral";
  value: string;
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
      <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
        Stored wealth
      </div>
    </section>
  );
}

function WealthSummaryPlaceholder() {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <section className="h-32 rounded-md border border-white/10 bg-white/[0.03]" key={item} />
        ))}
      </div>
      <section className="h-64 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20" />
    </section>
  );
}

export function WealthSummary() {
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
  const mounted = useHydrated();

  if (!mounted) {
    return <WealthSummaryPlaceholder />;
  }

  const summary = buildWealthSummaryWithAccounts(assets, bankAccounts, brokerAccounts);
  const summaryValues: Record<WealthRowKey, number> = {
    bankCash: summary.bankCash,
    brokerCash: summary.brokerCash,
    brokerEquity: summary.brokerEquity,
    cash: summary.cash,
    savings: summary.savings,
    stocks: summary.stocks,
    crypto: summary.crypto,
    realEstate: summary.realEstate,
    other: summary.other,
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Total Net Worth"
          tone={summary.totalNetWorth >= 0 ? "positive" : "negative"}
          value={formatMoney(summary.totalNetWorth)}
        />
        <SummaryCard label="Bank Cash" value={formatMoney(summary.bankCash)} />
        <SummaryCard label="Broker Cash" value={formatMoney(summary.brokerCash)} />
        <SummaryCard label="Broker Equity" value={formatMoney(summary.brokerEquity)} />
        <SummaryCard label="Cash" value={formatMoney(summary.cash)} />
        <SummaryCard label="Savings" value={formatMoney(summary.savings)} />
        <SummaryCard label="Stocks" value={formatMoney(summary.stocks)} />
        <SummaryCard label="Crypto" value={formatMoney(summary.crypto)} />
        <SummaryCard
          label="Real Estate"
          value={formatMoney(summary.realEstate)}
        />
        <SummaryCard
          label="Broker Cash"
          value={formatMoney(summary.brokerCash)}
        />
      </div>

      <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Wealth Snapshot</h2>
            <p className="mt-1 text-sm text-slate-500">
              {summary.assetCount} tracked assets across the portfolio
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Read-only summary
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="py-3 pr-4 font-semibold">Category</th>
                <th className="py-3 pr-4 font-semibold">Value</th>
                <th className="py-3 pr-4 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {wealthRows.map((row) => {
                return (
                  <tr key={row.key} className="text-slate-300">
                    <td className="py-3 pr-4 font-semibold text-white">{row.label}</td>
                    <td className="py-3 pr-4">{formatMoney(summaryValues[row.key])}</td>
                    <td className="py-3 pr-4 text-slate-500">{row.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
