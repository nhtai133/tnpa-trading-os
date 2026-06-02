"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTradingDataset } from "../_lib/use-trading-dataset";
import {
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  fallbackTradeHistory,
  initialTradingReport,
} from "../_lib/trading-client-data";

type UnknownRecord = Record<string, unknown>;
type SeriesPoint = { label: string; value: number };
type TradeSourceFilter = "all" | "mt5" | "manual";

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function pickSeries(data: UnknownRecord, keys: string[]): SeriesPoint[] {
  for (const key of keys) {
    const raw = data[key];
    if (!Array.isArray(raw) || raw.length === 0) continue;
    return raw.map((entry, index) => {
      if (typeof entry === "number") {
        return { label: String(index + 1), value: entry };
      }

      const point = asRecord(entry);
      return {
        label: String(point.label ?? point.date ?? point.month ?? index + 1),
        value: toNumber(point.value ?? point.equity ?? point.balance ?? point.netProfit ?? point.profit),
      };
    });
  }

  return [];
}

function computeBestWorst(trades: UnknownRecord[], field: "setupTag" | "playbook") {
  const closedTrades = trades.filter((trade) => String(trade.status ?? "Closed") === "Closed");
  const grouped = new Map<string, { profit: number; count: number }>();

  for (const trade of closedTrades) {
    const name = String(trade[field] ?? "Other");
    const current = grouped.get(name) ?? { profit: 0, count: 0 };
    current.profit += toNumber(trade.profit ?? trade.netProfit ?? trade.pnl ?? trade.closedPnl);
    current.count += 1;
    grouped.set(name, current);
  }

  const ranked = Array.from(grouped.entries()).sort((a, b) => b[1].profit - a[1].profit);
  return {
    best: ranked[0] ? { name: ranked[0][0], ...ranked[0][1] } : null,
    worst: ranked[ranked.length - 1] ? { name: ranked[ranked.length - 1][0], ...ranked[ranked.length - 1][1] } : null,
  };
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/80 p-4 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
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

function Sparkline({ series }: { series: SeriesPoint[] }) {
  if (series.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-white/10 bg-slate-900/60 text-sm text-slate-500">
        No equity data yet.
      </div>
    );
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 920;
  const height = 220;
  const step = width / Math.max(series.length - 1, 1);

  const path = series
    .map((point, index) => {
      const x = index * step;
      const normalized = (point.value - min) / range;
      const y = height - normalized * (height - 24) - 12;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/60">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <defs>
          <linearGradient id="trading-equity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#trading-equity-fill)" />
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-slate-400">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function TradingDashboard() {
  const [sourceFilter, setSourceFilter] = useState<TradeSourceFilter>("all");
  const dataset = asRecord(
    useTradingDataset({
      fallbackEquityCurve,
      fallbackMonthlyPerformance,
      initialReport: initialTradingReport,
      initialTrades: fallbackTradeHistory,
    }) as unknown,
  );
  const metrics = asRecord(dataset.metrics ?? dataset.summary ?? {});

  const trades = asArray(dataset.tradeHistory ?? dataset.trades ?? dataset.allTrades ?? dataset.items).map((trade) =>
    asRecord(trade),
  );
  const filteredTrades = trades.filter((trade) => {
    const source = String(trade.source ?? "mt5");
    if (sourceFilter === "mt5") return source === "mt5";
    if (sourceFilter === "manual") return source === "manual";
    return true;
  });
  const openTrades = filteredTrades.filter((trade) => String(trade.status ?? "Closed") === "Open");
  const closedTrades = filteredTrades.filter((trade) => String(trade.status ?? "Closed") === "Closed");

  const grossProfit = closedTrades.filter((trade) => toNumber(trade.pnl) > 0).reduce((sum, trade) => sum + toNumber(trade.pnl), 0);
  const grossLoss = Math.abs(
    closedTrades.filter((trade) => toNumber(trade.pnl) < 0).reduce((sum, trade) => sum + toNumber(trade.pnl), 0),
  );
  const netProfit = closedTrades.reduce((sum, trade) => sum + toNumber(trade.pnl), 0);
  const winRate = closedTrades.length === 0 ? 0 : (closedTrades.filter((trade) => String(trade.result ?? "") === "Win").length / closedTrades.length) * 100;
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  const averageRR = closedTrades.length === 0 ? 0 : closedTrades.reduce((sum, trade) => sum + toNumber(trade.rr), 0) / closedTrades.length;
  const maxDrawdown = toNumber(metrics.maxDrawdown ?? metrics.drawdown ?? 0);
  const floatingPL = toNumber(
    metrics.floatingPL ??
      metrics.floatingPnl ??
      openTrades.reduce((sum, trade) => sum + toNumber(trade.floatingPL ?? trade.floatingPnl ?? trade.floatingProfit), 0),
  );

  const equitySeries = pickSeries(dataset, ["equityCurve", "equityHistory", "equitySeries", "performanceCurve"]);
  const bestWorstSetup = computeBestWorst(filteredTrades, "setupTag");
  const bestWorstPlaybook = computeBestWorst(filteredTrades, "playbook");
  const disciplineScore = toNumber(metrics.disciplineScore ?? dataset.disciplineScore ?? 0);
  const ftmoRiskStatus = String(metrics.riskStatus ?? dataset.riskStatus ?? "Safe");
  const mt5Count = trades.filter((trade) => String(trade.source ?? "mt5") === "mt5").length;
  const manualCount = trades.filter((trade) => String(trade.source ?? "mt5") === "manual").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Net Profit" value={formatMoney(netProfit)} subvalue="Closed trades only" />
        <MetricCard label="Win Rate" value={formatPercent(winRate)} subvalue="Closed trades only" />
        <MetricCard label="Profit Factor" value={profitFactor ? profitFactor.toFixed(2) : "—"} />
        <MetricCard label="Average RR" value={averageRR ? averageRR.toFixed(2) : "—"} />
        <MetricCard label="Max Drawdown" value={formatMoney(maxDrawdown)} />
      </div>

      <SectionCard title="Data Source" icon="SRC">
        <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr_1fr] md:items-end">
          <label className="block">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Source</div>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as TradeSourceFilter)}
            >
              <option value="all">All</option>
              <option value="mt5">MT5 Only</option>
              <option value="manual">Manual Only</option>
            </select>
          </label>
          <MetricCard label="MT5 Trades" value={String(mt5Count)} subvalue="Imported trades" />
          <MetricCard label="Manual Trades" value={String(manualCount)} subvalue="Local entries" />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Equity Curve" icon="EQ">
          <Sparkline series={equitySeries} />
        </SectionCard>

        <SectionCard title="Trading Health" icon="FTMO">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Open Positions" value={String(openTrades.length)} />
            <MetricCard label="Floating P/L" value={formatMoney(floatingPL)} />
            <MetricCard label="FTMO Risk Status" value={ftmoRiskStatus} />
            <MetricCard label="Discipline Score" value={`${disciplineScore.toFixed(0)}/100`} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Setup Performance" icon="SETUP">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Best Setup"
              value={bestWorstSetup.best?.name ?? "—"}
              subvalue={bestWorstSetup.best ? `${formatMoney(bestWorstSetup.best.profit)} across ${bestWorstSetup.best.count} trades` : undefined}
            />
            <MetricCard
              label="Worst Setup"
              value={bestWorstSetup.worst?.name ?? "—"}
              subvalue={bestWorstSetup.worst ? `${formatMoney(bestWorstSetup.worst.profit)} across ${bestWorstSetup.worst.count} trades` : undefined}
            />
            <MetricCard
              label="Best Playbook"
              value={bestWorstPlaybook.best?.name ?? "—"}
              subvalue={bestWorstPlaybook.best ? `${formatMoney(bestWorstPlaybook.best.profit)} across ${bestWorstPlaybook.best.count} trades` : undefined}
            />
            <MetricCard
              label="Worst Playbook"
              value={bestWorstPlaybook.worst?.name ?? "—"}
              subvalue={bestWorstPlaybook.worst ? `${formatMoney(bestWorstPlaybook.worst.profit)} across ${bestWorstPlaybook.worst.count} trades` : undefined}
            />
          </div>
        </SectionCard>

        <SectionCard title="Open Positions" icon="OPEN">
          <div className="space-y-3">
            {openTrades.length ? (
              openTrades.slice(0, 5).map((trade, index) => (
                <div key={String(trade.ticket ?? trade.id ?? index)} className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{String(trade.symbol ?? "Unknown")}</div>
                      <div className="text-xs text-slate-400">
                        {String(trade.direction ?? trade.side ?? "—")} · {String(trade.setupTag ?? "No setup")} · {String(trade.playbook ?? "No playbook")}
                      </div>
                    </div>
                    <div className="text-right text-sm text-emerald-400">
                      {formatMoney(toNumber(trade.floatingPL ?? trade.floatingPnl ?? trade.floatingProfit))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-slate-900/50 p-4 text-sm text-slate-500">
                No open positions.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Recent Trades" icon="TRADES">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2">Setup</th>
                  <th className="px-3 py-2">Playbook</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.slice(0, 8).map((trade, index) => (
                  <tr key={String(trade.ticket ?? trade.id ?? index)} className="rounded-lg bg-slate-900/70 text-slate-200">
                    <td className="rounded-l-lg px-3 py-3">{String(trade.ticket ?? trade.id ?? "—")}</td>
                    <td className="px-3 py-3">{String(trade.symbol ?? "—")}</td>
                    <td className="px-3 py-3">{String(trade.direction ?? trade.side ?? "—")}</td>
                    <td className="px-3 py-3">{String(trade.setupTag ?? "Other")}</td>
                    <td className="px-3 py-3">{String(trade.playbook ?? "Other")}</td>
                    <td className="rounded-r-lg px-3 py-3 text-right">
                      {formatMoney(toNumber(trade.profit ?? trade.netProfit ?? trade.pnl))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Quick Links" icon="GO">
          <div className="grid gap-3">
            <Link href="/trades" className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15">
              Open Trades
            </Link>
            <Link href="/analytics" className="rounded-lg border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-cyan-500/25 hover:bg-slate-900">
              View Analytics
            </Link>
            <Link href="/risk" className="rounded-lg border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-cyan-500/25 hover:bg-slate-900">
              Open Risk Monitor
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
