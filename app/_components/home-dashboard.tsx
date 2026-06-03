"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTradingDataset } from "../_lib/use-trading-dataset";
import { buildWealthSummaryWithAccounts } from "../_lib/wealth-metrics";
import { readStoredBankAccounts } from "../_lib/bank-account-storage";
import { readStoredBrokerAccounts } from "../_lib/broker-account-storage";
import { readStoredWealthAssets } from "../_lib/wealth-storage";
import { useHydrated } from "../_lib/use-hydrated";
import {
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  fallbackTradeHistory,
  initialTradingReport,
} from "../_lib/trading-client-data";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatMoney(value: number, currency = "VND") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function SummaryCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {subvalue ? <div className="mt-2 text-sm text-slate-400">{subvalue}</div> : null}
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-white/10 bg-slate-950/80 p-5 transition hover:border-cyan-500/30 hover:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300">
              {icon}
            </span>
            {title}
          </div>
          <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
        </div>
        <span className="text-lg text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-300">→</span>
      </div>
    </Link>
  );
}

export function HomeDashboard() {
  const mounted = useHydrated();

  const tradingData = getRecord(
    useTradingDataset({
      fallbackEquityCurve,
      fallbackMonthlyPerformance,
      initialReport: initialTradingReport,
      initialTrades: fallbackTradeHistory,
    }) as unknown,
  );

  const tradingNetProfit = toNumber(
    getRecord(tradingData["metrics"])["netProfit"] ??
      getRecord(tradingData["metrics"])["closedNetProfit"] ??
      getRecord(tradingData["summary"])["netProfit"] ??
      getRecord(tradingData["summary"])["closedNetProfit"] ??
      tradingData["netProfit"] ??
      tradingData["closedNetProfit"],
  );

  const wealthSummary = useMemo(() => {
    if (!mounted) {
      return buildWealthSummaryWithAccounts([], [], []);
    }

    const assets = readStoredWealthAssets();
    const bankAccounts = readStoredBankAccounts();
    const brokerAccounts = readStoredBrokerAccounts();
    return buildWealthSummaryWithAccounts(assets, bankAccounts, brokerAccounts);
  }, [mounted]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">TNPA OS</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Choose your workspace</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Trading OS and Wealth OS are separated so each area stays focused on its own data, workflow, and reporting.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Trading Net Profit"
              value={mounted ? formatMoney(tradingNetProfit) : "—"}
              subvalue="Closed trades only"
            />
            <SummaryCard
              label="Total Net Worth"
              value={mounted ? formatMoney(wealthSummary.totalNetWorth) : "—"}
              subvalue="Active wealth only"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ActionCard title="Trading OS" description="Trading dashboard, trades, analytics, risk monitor, and MT5 import." href="/trading" icon="TRD" />
        <ActionCard title="Wealth OS" description="Net worth, portfolio, accounts, assets, and archive history." href="/wealth" icon="WTH" />
      </div>
    </div>
  );
}
