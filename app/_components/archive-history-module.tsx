"use client";

import { useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
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

const emptyAccounts: WealthAccount[] = [];
const emptyAssets: WealthAsset[] = [];
const emptyBrokerAccounts: WealthBrokerAccount[] = [];

function formatMoney(value: number, currency: string) {
  const sign = value >= 0 ? "" : "-";
  const prefix = currency === "VND" ? "VND " : "$";

  return `${sign}${prefix}${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString();
}

export function ArchiveHistoryModule() {
  const bankAccounts = useSyncExternalStore(
    subscribeToBankAccounts,
    readStoredBankAccounts,
    () => emptyAccounts,
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

  const archivedAccounts = bankAccounts.filter(
    (account) => account.status === "Archived",
  );
  const archivedBrokerAccounts = brokerAccounts.filter(
    (account) => account.status === "Archived",
  );
  const archivedAssets = assets.filter((asset) => asset.status === "Archived");

  return (
    <AppShell eyebrow="Wealth" title="Archive History">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Archived Accounts</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {archivedAccounts.length}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Archived Assets</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {archivedAssets.length}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Archived Broker Accounts</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {archivedBrokerAccounts.length}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-base font-semibold text-white">Archived Bank Accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Archived bank items remain in localStorage for traceability.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Account Name</th>
                <th className="px-5 py-4 font-semibold">Institution</th>
                <th className="px-5 py-4 font-semibold">Currency</th>
                <th className="px-5 py-4 font-semibold">Current Balance</th>
                <th className="px-5 py-4 font-semibold">Archive Reason</th>
                <th className="px-5 py-4 font-semibold">Archived At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {archivedAccounts.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-slate-500" colSpan={6}>
                    No archived bank accounts.
                  </td>
                </tr>
              ) : (
                archivedAccounts.map((account) => (
                  <tr className="text-slate-300" key={account.id}>
                    <td className="px-5 py-4 font-semibold text-white">{account.name}</td>
                    <td className="px-5 py-4">{account.institution}</td>
                    <td className="px-5 py-4">{account.currency}</td>
                    <td className="px-5 py-4">{formatMoney(account.balance, account.currency)}</td>
                    <td className="px-5 py-4">{account.archiveReason ?? "Other"}</td>
                    <td className="px-5 py-4">{formatDate(account.archivedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-base font-semibold text-white">Archived Wealth Assets</h2>
          <p className="mt-1 text-sm text-slate-500">
            Asset archive records are kept compatible with earlier localStorage data.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Asset Name</th>
                <th className="px-5 py-4 font-semibold">Class</th>
                <th className="px-5 py-4 font-semibold">Institution</th>
                <th className="px-5 py-4 font-semibold">Value</th>
                <th className="px-5 py-4 font-semibold">Archive Reason</th>
                <th className="px-5 py-4 font-semibold">Archived At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {archivedAssets.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-slate-500" colSpan={6}>
                    No archived wealth assets.
                  </td>
                </tr>
              ) : (
                archivedAssets.map((asset) => (
                  <tr className="text-slate-300" key={asset.id}>
                    <td className="px-5 py-4 font-semibold text-white">{asset.name}</td>
                    <td className="px-5 py-4">{asset.assetClass}</td>
                    <td className="px-5 py-4">{asset.institution}</td>
                    <td className="px-5 py-4">{formatMoney(asset.currentValue, asset.currency)}</td>
                    <td className="px-5 py-4">{asset.archiveReason ?? "Other"}</td>
                    <td className="px-5 py-4">{formatDate(asset.archivedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-base font-semibold text-white">Archived Broker Accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Archived broker items remain in localStorage for traceability.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Broker</th>
                <th className="px-5 py-4 font-semibold">Account Name</th>
                <th className="px-5 py-4 font-semibold">Currency</th>
                <th className="px-5 py-4 font-semibold">Cash Balance</th>
                <th className="px-5 py-4 font-semibold">Stock Market Value</th>
                <th className="px-5 py-4 font-semibold">Fund/ETF Value</th>
                <th className="px-5 py-4 font-semibold">Total Equity</th>
                <th className="px-5 py-4 font-semibold">Portfolio Type</th>
                <th className="px-5 py-4 font-semibold">Archive Reason</th>
                <th className="px-5 py-4 font-semibold">Archived At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {archivedBrokerAccounts.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-slate-500" colSpan={10}>
                    No archived broker accounts.
                  </td>
                </tr>
              ) : (
                archivedBrokerAccounts.map((account) => (
                  <tr className="text-slate-300" key={account.id}>
                    <td className="px-5 py-4 font-semibold text-white">{account.broker}</td>
                    <td className="px-5 py-4">{account.name}</td>
                    <td className="px-5 py-4">{account.currency}</td>
                    <td className="px-5 py-4">{formatMoney(account.cashBalance, account.currency)}</td>
                    <td className="px-5 py-4">{formatMoney(account.stockMarketValue, account.currency)}</td>
                    <td className="px-5 py-4">{formatMoney(account.fundEtfValue, account.currency)}</td>
                    <td className="px-5 py-4">{formatMoney(account.totalEquity, account.currency)}</td>
                    <td className="px-5 py-4">{account.portfolioType}</td>
                    <td className="px-5 py-4">{account.archiveReason ?? "Other"}</td>
                    <td className="px-5 py-4">{formatDate(account.archivedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
