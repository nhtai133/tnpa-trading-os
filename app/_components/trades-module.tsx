"use client";

import { useMemo, useState } from "react";
import { writeSetupTagOverride } from "@/app/_lib/setup-tag-storage";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  SetupTag,
  Trade,
} from "@/app/_lib/trading-types";
import { setupTags } from "@/app/_lib/trading-types";

const pageSize = 8;

type FilterState = {
  symbol: string;
  setupTag: string;
  result: string;
  direction: string;
};

function uniqueValues(trades: Trade[], key: keyof Pick<Trade, "symbol" | "setupTag">) {
  return Array.from(new Set(trades.map((trade) => trade[key]))).sort();
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function SelectFilter({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TradesModule({
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  initialReport,
  trades,
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  initialReport: Mt5AccountReport | null;
  trades: Trade[];
}) {
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades: trades,
  });
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    symbol: "",
    setupTag: "",
    result: "",
    direction: "",
  });
  const [page, setPage] = useState(1);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const symbols = useMemo(() => uniqueValues(tradeHistory, "symbol"), [tradeHistory]);
  const setupTagOptions = useMemo(
    () => uniqueValues(tradeHistory, "setupTag"),
    [tradeHistory],
  );

  const filteredTrades = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tradeHistory.filter((trade) => {
      const matchesQuery =
        !normalizedQuery ||
        [trade.id, trade.symbol, trade.setup, trade.setupTag, trade.session]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return (
        matchesQuery &&
        (!filters.symbol || trade.symbol === filters.symbol) &&
        (!filters.setupTag || trade.setupTag === filters.setupTag) &&
        (!filters.result || trade.result === filters.result) &&
        (!filters.direction || trade.side === filters.direction)
      );
    });
  }, [filters, query, tradeHistory]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTrades = filteredTrades.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  return (
    <>
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-4 xl:grid-cols-[1.25fr_repeat(4,minmax(0,1fr))]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Search
            </span>
            <input
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
              placeholder="Search trade, symbol, setup, session"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <SelectFilter
            label="Symbol"
            options={symbols}
            value={filters.symbol}
            onChange={(value) => updateFilter("symbol", value)}
          />
          <SelectFilter
            label="Setup Tag"
            options={setupTagOptions}
            value={filters.setupTag}
            onChange={(value) => updateFilter("setupTag", value)}
          />
          <SelectFilter
            label="Result"
            options={["Win", "Loss"]}
            value={filters.result}
            onChange={(value) => updateFilter("result", value)}
          />
          <SelectFilter
            label="Direction"
            options={["Long", "Short"]}
            value={filters.direction}
            onChange={(value) => updateFilter("direction", value)}
          />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Full Trade History
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredTrades.length} trades match the current view
            </p>
          </div>
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
            onClick={() => {
              setQuery("");
              setFilters({ symbol: "", setupTag: "", result: "", direction: "" });
              setPage(1);
            }}
          >
            Reset Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Trade</th>
                <th className="px-5 py-4 font-semibold">Symbol</th>
                <th className="px-5 py-4 font-semibold">Setup Tag</th>
                <th className="px-5 py-4 font-semibold">Direction</th>
                <th className="px-5 py-4 font-semibold">Session</th>
                <th className="px-5 py-4 font-semibold">Entry</th>
                <th className="px-5 py-4 font-semibold">Exit</th>
                <th className="px-5 py-4 font-semibold">RR</th>
                <th className="px-5 py-4 font-semibold">P/L</th>
                <th className="px-5 py-4 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {paginatedTrades.map((trade) => {
                const positive = trade.pnl >= 0;

                return (
                  <tr
                    className="cursor-pointer text-slate-300 transition hover:bg-white/[0.03]"
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade)}
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-100">
                        {trade.id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {trade.date}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {trade.symbol}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        className="h-9 min-w-40 rounded-md border border-white/10 bg-[#090d15] px-2 text-xs font-semibold text-slate-200 outline-none transition focus:border-emerald-300/50"
                        value={trade.setupTag}
                        onChange={(event) => {
                          writeSetupTagOverride(
                            trade.id,
                            event.target.value as SetupTag,
                          );
                        }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {setupTags.map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">{trade.side}</td>
                    <td className="px-5 py-4">{trade.session}</td>
                    <td className="px-5 py-4">{trade.entry}</td>
                    <td className="px-5 py-4">{trade.exit}</td>
                    <td className="px-5 py-4 font-semibold">{trade.rr}R</td>
                    <td
                      className={`px-5 py-4 font-semibold ${
                        positive ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {money(trade.pnl)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          trade.result === "Win"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-rose-400/10 text-rose-300"
                        }`}
                      >
                        {trade.result}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5 text-sm text-slate-400">
          <div>
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-white/10 px-3 py-2 font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <button
              className="rounded-md border border-white/10 px-3 py-2 font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage === totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedTrade ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            className="absolute inset-0 cursor-default"
            aria-label="Close trade detail drawer"
            onClick={() => setSelectedTrade(null)}
          />
          <aside className="relative h-full w-full max-w-md border-l border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                  Trade Detail
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedTrade.id}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedTrade.symbol} - {selectedTrade.date}
                </p>
              </div>
              <button
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300"
                onClick={() => setSelectedTrade(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                ["Setup Tag", selectedTrade.setupTag],
                ["Original Setup", selectedTrade.setup],
                ["Direction", selectedTrade.side],
                ["Session", selectedTrade.session],
                ["Result", selectedTrade.result],
                ["Entry", selectedTrade.entry],
                ["Exit", selectedTrade.exit],
                ["Risk Reward", `${selectedTrade.rr}R`],
                ["Net P/L", money(selectedTrade.pnl)],
              ].map(([label, value]) => (
                <div
                  className="rounded-md border border-white/10 bg-white/[0.03] p-4"
                  key={label}
                >
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Journal Notes
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Execution followed the pre-market bias, with risk contained to
                the planned invalidation level. Screenshot and MT5 execution
                metadata are ready for attachment in the next import pass.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
