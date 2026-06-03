"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  readStoredBrokerAccounts,
  subscribeToBrokerAccounts,
} from "@/app/_lib/broker-account-storage";
import {
  readStoredBankAccounts,
  subscribeToBankAccounts,
} from "@/app/_lib/bank-account-storage";
import {
  buildWealthSummaryWithAccounts,
  type WealthSummaryTotals,
} from "@/app/_lib/wealth-metrics";
import {
  readStoredWealthSnapshots,
  subscribeToWealthSnapshots,
  upsertWealthSnapshot,
} from "@/app/_lib/wealth-snapshot-storage";
import type { WealthSnapshot } from "@/app/_lib/wealth-snapshot-storage";
import {
  readStoredWealthAssets,
  subscribeToWealthAssets,
} from "@/app/_lib/wealth-storage";
import type {
  WealthAccount,
  WealthAsset,
  WealthBrokerAccount,
} from "@/app/_lib/wealth-types";
import { useHydrated } from "@/app/_lib/use-hydrated";

const emptyAssets: WealthAsset[] = [];
const emptyBankAccounts: WealthAccount[] = [];
const emptyBrokerAccounts: WealthBrokerAccount[] = [];
const emptySnapshots: WealthSnapshot[] = [];

type AllocationItem = {
  label: string;
  value: number;
  color: string;
};

type HoldingItem = {
  label: string;
  value: number;
  category: string;
};

function formatMoney(value: number) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function buildAllocationItems(
  summary: WealthSummaryTotals,
  bankCash: number,
  brokerCashFromAccounts: number,
): AllocationItem[] {
  return [
    {
      label: "Cash",
      value: summary.cash + bankCash,
      color: "#34d399",
    },
    {
      label: "Savings",
      value: summary.savings,
      color: "#60a5fa",
    },
    {
      label: "Stocks",
      value: summary.stocks,
      color: "#fbbf24",
    },
    {
      label: "Crypto",
      value: summary.crypto,
      color: "#a78bfa",
    },
    {
      label: "Real Estate",
      value: summary.realEstate,
      color: "#f97316",
    },
    {
      label: "Broker Cash",
      value: summary.brokerCash + brokerCashFromAccounts,
      color: "#22c55e",
    },
  ];
}

function buildAccountItems({
  bankCash,
  brokerEquity,
  crypto,
  tradingAccounts,
}: {
  bankCash: number;
  brokerEquity: number;
  crypto: number;
  tradingAccounts: number;
}): AllocationItem[] {
  return [
    { label: "Banks", value: bankCash, color: "#34d399" },
    { label: "Brokers", value: brokerEquity, color: "#60a5fa" },
    { label: "Trading Accounts", value: tradingAccounts, color: "#fbbf24" },
    { label: "Crypto Wallets", value: crypto, color: "#a78bfa" },
  ];
}

function buildStrategyItems({
  crypto,
  longTerm,
  retirement,
  swing,
  tradingAccounts,
}: {
  crypto: number;
  longTerm: number;
  retirement: number;
  swing: number;
  tradingAccounts: number;
}): AllocationItem[] {
  return [
    { label: "Intraweek", value: tradingAccounts, color: "#f97316" },
    { label: "Swing", value: swing, color: "#22c55e" },
    { label: "Long-Term", value: longTerm, color: "#60a5fa" },
    { label: "Retirement", value: retirement, color: "#a78bfa" },
    { label: "Crypto Spot", value: crypto, color: "#fbbf24" },
  ];
}

function largestItem(items: AllocationItem[]) {
  return items.reduce<AllocationItem | null>(
    (best, item) => (!best || item.value > best.value ? item : best),
    null,
  );
}

function calcDiversificationScore(items: AllocationItem[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const active = items.filter((item) => item.value > 0);

  if (total <= 0 || active.length <= 1) {
    return 0;
  }

  const n = items.length;
  const hhi = items.reduce((sum, item) => {
    const share = item.value / total;
    return sum + share * share;
  }, 0);
  const score = ((1 - hhi) / (1 - 1 / n)) * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function donutCss(items: AllocationItem[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return "conic-gradient(#1f2937 0% 100%)";
  }

  let start = 0;
  const parts = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const size = (item.value / total) * 100;
      const end = start + size;
      const segment = `${item.color} ${start}% ${end}%`;
      start = end;
      return segment;
    });

  return `conic-gradient(${parts.join(", ")})`;
}

function SectionCard({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {detail}
      </div>
    </section>
  );
}

function AllocationBarList({
  items,
}: {
  items: AllocationItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0;

        return (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-200">{item.label}</span>
              <span className="text-slate-400">
                {formatPercent(percent)} - {formatMoney(item.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06]">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  backgroundColor: item.color,
                  width: `${Math.max(8, percent)}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutAllocationChart({
  items,
}: {
  items: AllocationItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const legend = items.map((item) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    return {
      ...item,
      percent,
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div className="flex items-center justify-center">
        <div
          className="relative h-64 w-64 rounded-full"
          style={{ background: donutCss(items) }}
        >
          <div className="absolute inset-[18%] rounded-full border border-white/10 bg-[#0b1019] shadow-inner shadow-black/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Net Worth
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {formatMoney(total)}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {legend.map((item) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3"
            key={item.label}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <div className="font-semibold text-white">{item.label}</div>
                <div className="text-xs text-slate-500">
                  {formatPercent(item.percent)}
                </div>
              </div>
            </div>
            <div className="font-semibold text-slate-100">{formatMoney(item.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({
  snapshots,
}: {
  snapshots: ReturnType<typeof readStoredWealthSnapshots>;
}) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-500">
        Monthly snapshots will appear here once the dashboard records them.
      </div>
    );
  }

  const width = 800;
  const height = 280;
  const paddingX = 32;
  const paddingY = 24;
  const values = snapshots.map((snapshot) => snapshot.netWorth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = snapshots.length > 1 ? (width - paddingX * 2) / (snapshots.length - 1) : 0;

  const points = snapshots.map((snapshot, index) => {
    const x = paddingX + step * index;
    const y = height - paddingY - ((snapshot.netWorth - min) / range) * (height - paddingY * 2);
    return `${x},${y}`;
  });

  const area = [
    `M ${paddingX} ${height - paddingY}`,
    ...points.map((point) => `L ${point}`),
    `L ${width - paddingX} ${height - paddingY}`,
    "Z",
  ].join(" ");

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          className="h-72 w-full min-w-[680px]"
          preserveAspectRatio="none"
          viewBox={`0 0 ${width} ${height}`}
        >
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={paddingX}
              x2={width - paddingX}
              y1={paddingY + (height - paddingY * 2) * ratio}
              y2={paddingY + (height - paddingY * 2) * ratio}
              stroke="rgba(148,163,184,0.18)"
              strokeDasharray="4 6"
            />
          ))}
          <path d={area} fill="rgba(16,185,129,0.12)" />
          <polyline
            fill="none"
            points={points.join(" ")}
            stroke="#34d399"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {snapshots.map((snapshot, index) => {
            const x = paddingX + step * index;
            const y = height - paddingY - ((snapshot.netWorth - min) / range) * (height - paddingY * 2);

            return (
              <g key={snapshot.month}>
                <circle cx={x} cy={y} fill="#34d399" r="4" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {snapshots.map((snapshot) => (
          <div
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-300"
            key={snapshot.month}
          >
            {snapshot.label}: {formatMoney(snapshot.netWorth)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WealthDashboardV2({
  tradingAccountEquity,
  tradingAccountName,
}: {
  tradingAccountEquity: number;
  tradingAccountName: string;
}) {
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
  const mounted = useHydrated();
  const visibleAssets = mounted ? assets : emptyAssets;
  const visibleBankAccounts = mounted ? bankAccounts : emptyBankAccounts;
  const visibleBrokerAccounts = mounted ? brokerAccounts : emptyBrokerAccounts;
  const visibleSnapshots = mounted ? snapshots : emptySnapshots;

  const activeBankAccounts = visibleBankAccounts.filter(
    (account) => account.status !== "Archived",
  );
  const activeBrokerAccounts = visibleBrokerAccounts.filter(
    (account) => account.status !== "Archived",
  );
  const summary = buildWealthSummaryWithAccounts(
    visibleAssets,
    activeBankAccounts,
    activeBrokerAccounts,
  );
  const bankCash = activeBankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const brokerCashFromAccounts = activeBrokerAccounts.reduce(
    (sum, account) => sum + account.cashBalance,
    0,
  );
  const brokerEquity = activeBrokerAccounts.reduce(
    (sum, account) => sum + account.totalEquity,
    0,
  );
  const stocksAssets = visibleAssets
    .filter((asset) => asset.status !== "Archived")
    .filter((asset) => asset.assetClass === "Stocks")
    .reduce((sum, asset) => sum + asset.currentValue, 0);
  const longTerm = activeBrokerAccounts
    .filter(
      (account) =>
        account.portfolioType === "Long-Term Stock Portfolio" ||
        account.portfolioType === "3-5Y Stocks + Bitcoin + Real Estate Portfolio",
    )
    .reduce((sum, account) => sum + account.totalEquity, 0);
  const swing = activeBrokerAccounts
    .filter((account) => account.portfolioType === "Stock Swing Portfolio")
    .reduce((sum, account) => sum + account.totalEquity, 0);
  const retirement = activeBrokerAccounts
    .filter((account) => account.portfolioType === "Retirement Stock Portfolio 5%")
    .reduce((sum, account) => sum + account.totalEquity, 0);
  const crypto = summary.crypto;

  const assetAllocation = buildAllocationItems(summary, bankCash, brokerCashFromAccounts);
  const accountAllocation = buildAccountItems({
    bankCash,
    brokerEquity,
    crypto,
    tradingAccounts: tradingAccountEquity,
  });
  const strategyAllocation = buildStrategyItems({
    crypto,
    longTerm: longTerm + stocksAssets,
    retirement,
    swing,
    tradingAccounts: tradingAccountEquity,
  });
  const topAssetClass = useMemo(() => largestItem(assetAllocation), [assetAllocation]);
  const mostConcentratedAsset = useMemo(() => {
    const holdings: HoldingItem[] = [
      ...activeBankAccounts.map((account) => ({
        label: account.name,
        value: account.balance,
        category: "Bank",
      })),
      ...activeBrokerAccounts.map((account) => ({
        label: account.name,
        value: account.totalEquity,
        category: "Broker",
      })),
      ...visibleAssets
        .filter((asset) => asset.status !== "Archived")
        .map((asset) => ({
          label: asset.name,
          value: asset.currentValue,
          category: asset.assetClass,
        })),
      ...(tradingAccountEquity > 0
        ? [
            {
              label: tradingAccountName || "Trading Account",
              value: tradingAccountEquity,
              category: "Trading",
            },
          ]
        : []),
    ];

    return holdings.reduce<HoldingItem | null>(
      (best, item) => (!best || item.value > best.value ? item : best),
      null,
    );
  }, [activeBankAccounts, activeBrokerAccounts, visibleAssets, tradingAccountEquity, tradingAccountName]);
  const diversificationScore = calcDiversificationScore(assetAllocation);
  const snapshotMonth = mounted ? getMonthKey() : "1970-01";
  const snapshotLabel = mounted ? getMonthLabel(snapshotMonth) : "Loading";

  useEffect(() => {
    if (!mounted) return;

    upsertWealthSnapshot({
      month: snapshotMonth,
      label: snapshotLabel,
      netWorth: summary.totalNetWorth,
      cash: summary.cash + bankCash,
      savings: summary.savings,
      stocks: summary.stocks,
      crypto: summary.crypto,
      realEstate: summary.realEstate,
      brokerCash: summary.brokerCash + brokerCashFromAccounts,
      brokerEquity,
      bankCash,
      tradingAccounts: tradingAccountEquity,
      timestamp: new Date().toISOString(),
    });
  }, [
    bankCash,
    brokerCashFromAccounts,
    brokerEquity,
    snapshotLabel,
    snapshotMonth,
    stocksAssets,
    summary.cash,
    summary.crypto,
    summary.realEstate,
    summary.savings,
    summary.brokerCash,
    summary.stocks,
    summary.totalNetWorth,
    tradingAccountEquity,
    mounted,
  ]);

  return (
    <section className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          detail="Largest asset class"
          label="Top Asset Class"
          value={topAssetClass ? topAssetClass.label : "None"}
        />
        <MetricCard
          detail="Largest single holding"
          label="Most Concentrated Asset"
          value={
            mostConcentratedAsset
              ? `${mostConcentratedAsset.label} (${formatPercent(
                  summary.totalNetWorth > 0
                    ? (mostConcentratedAsset.value / summary.totalNetWorth) * 100
                    : 0,
                )})`
              : "None"
          }
        />
        <MetricCard
          detail="Higher means more balanced"
          label="Diversification Score"
          value={`${diversificationScore}/100`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          subtitle="Cash, savings, stocks, crypto, real estate, and broker cash"
          title="Net Worth Allocation Donut Chart"
        >
          <DonutAllocationChart items={assetAllocation} />
        </SectionCard>
        <SectionCard
          subtitle="Show percentage and value by net worth bucket"
          title="Asset Allocation %"
        >
          <AllocationBarList items={assetAllocation} />
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          subtitle="Banks, brokers, trading accounts, and crypto wallets"
          title="Account Allocation Chart"
        >
          <AllocationBarList items={accountAllocation} />
        </SectionCard>
        <SectionCard
          subtitle="Intraweek, swing, long-term, retirement, and crypto spot"
          title="Strategy Allocation Chart"
        >
          <AllocationBarList items={strategyAllocation} />
        </SectionCard>
      </section>

      <SectionCard
        subtitle="Monthly snapshots are stored in localStorage and updated automatically"
        title="Net Worth Trend Chart"
      >
        <TrendChart snapshots={visibleSnapshots} />
      </SectionCard>
    </section>
  );
}
