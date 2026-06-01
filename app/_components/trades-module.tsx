"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  type ManualTradeInput,
  writeManualTrade,
} from "@/app/_lib/manual-trade-storage";
import { writePlaybookOverride } from "@/app/_lib/playbook-storage";
import { writeSetupTagOverride } from "@/app/_lib/setup-tag-storage";
import { writeTradeJournalOverride } from "@/app/_lib/trade-journal-storage";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Playbook,
  SetupTag,
  TradeJournal,
  Trade,
} from "@/app/_lib/trading-types";
import {
  emotionOptions,
  mistakeOptions,
  playbooks,
  setupTags,
} from "@/app/_lib/trading-types";

const pageSize = 8;

const initialManualTrade: ManualTradeInput = {
  status: "Closed",
  symbol: "",
  side: "Long",
  openTime: "",
  closeTime: "",
  volume: "",
  openPrice: "",
  closePrice: "",
  profit: "",
  floatingPnl: "",
  setupTag: "Other",
  playbook: "Other",
  entryReason: "",
  exitReason: "",
  lessonLearned: "",
};

type FilterState = {
  symbol: string;
  setupTag: string;
  playbook: string;
  result: string;
  direction: string;
};

function uniqueValues(
  trades: Trade[],
  key: keyof Pick<Trade, "symbol" | "setupTag" | "playbook">,
) {
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

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <textarea
        className="min-h-24 w-full rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextInputField({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ScreenshotPicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value?: string;
}) {
  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.03] p-3 text-center text-xs font-semibold text-slate-400 transition hover:border-emerald-300/40 hover:text-slate-200">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={label}
            className="max-h-32 rounded-md object-cover"
            src={value}
          />
        ) : (
          "Upload screenshot"
        )}
        <input
          className="hidden"
          type="file"
          accept="image/*"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </label>
    </div>
  );
}

function TradeReviewDrawer({
  onClose,
  trade,
}: {
  onClose: () => void;
  trade: Trade;
}) {
  const [setupTag, setSetupTag] = useState<SetupTag>(trade.setupTag);
  const [playbook, setPlaybook] = useState<Playbook>(trade.playbook);
  const [draft, setDraft] = useState<TradeJournal>({
    entryScreenshot: trade.entryScreenshot,
    exitScreenshot: trade.exitScreenshot,
    entryReason: trade.entryReason ?? "",
    exitReason: trade.exitReason ?? "",
    emotion: trade.emotion,
    mistake: trade.mistake,
    lessonLearned: trade.lessonLearned ?? "",
  });

  function updateDraft(key: keyof TradeJournal, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <button
        className="absolute inset-0 cursor-default"
        aria-label="Close trade review drawer"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">
              Trade Review
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {trade.id}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {trade.symbol} - {trade.date}
            </p>
          </div>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            ["Direction", trade.side],
            ["Status", trade.status],
            ["Session", trade.session],
            ["Result", trade.result],
            ["Risk Reward", `${trade.rr}R`],
            ["Net P/L", money(trade.pnl)],
            ["Floating P/L", money(trade.floatingPnl ?? 0)],
            ["Playbook", trade.playbook],
            ["Original Setup", trade.setup],
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SelectFilter
            label="Setup Tag"
            options={[...setupTags]}
            value={setupTag}
            onChange={(value) => setSetupTag(value as SetupTag)}
          />
          <SelectFilter
            label="Playbook"
            options={[...playbooks]}
            value={playbook}
            onChange={(value) => setPlaybook(value as Playbook)}
          />
          <SelectFilter
            label="Emotion"
            options={[...emotionOptions]}
            value={draft.emotion ?? ""}
            onChange={(value) => updateDraft("emotion", value)}
          />
          <SelectFilter
            label="Mistake"
            options={[...mistakeOptions]}
            value={draft.mistake ?? ""}
            onChange={(value) => updateDraft("mistake", value)}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ScreenshotPicker
            label="Entry Screenshot"
            value={draft.entryScreenshot}
            onChange={(value) => updateDraft("entryScreenshot", value)}
          />
          <ScreenshotPicker
            label="Exit Screenshot"
            value={draft.exitScreenshot}
            onChange={(value) => updateDraft("exitScreenshot", value)}
          />
        </div>

        <div className="mt-6 grid gap-4">
          <TextAreaField
            label="Entry Reason"
            value={draft.entryReason ?? ""}
            onChange={(value) => updateDraft("entryReason", value)}
          />
          <TextAreaField
            label="Exit Reason"
            value={draft.exitReason ?? ""}
            onChange={(value) => updateDraft("exitReason", value)}
          />
          <TextAreaField
            label="Lesson Learned"
            value={draft.lessonLearned ?? ""}
            onChange={(value) => updateDraft("lessonLearned", value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            onClick={() => {
              writeSetupTagOverride(trade.id, setupTag);
              writePlaybookOverride(trade.id, playbook);
              writeTradeJournalOverride(trade.id, draft);
              onClose();
            }}
            type="button"
          >
            Save Review
          </button>
        </div>
      </aside>
    </div>
  );
}

function CreateTradeDrawer({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<ManualTradeInput>(initialManualTrade);
  const [error, setError] = useState("");

  function updateDraft(key: keyof ManualTradeInput, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function saveTrade() {
    if (!draft.symbol.trim()) {
      setError("Symbol is required.");
      return;
    }

    if (!draft.side) {
      setError("Direction is required.");
      return;
    }

    if (draft.status === "Closed" && !draft.closeTime) {
      setError("Close Time is required for closed trades.");
      return;
    }

    if (draft.status === "Closed" && !draft.closePrice.trim()) {
      setError("Close Price is required for closed trades.");
      return;
    }

    if (draft.status === "Closed" && !draft.profit.trim()) {
      setError("Profit is required for closed trades.");
      return;
    }

    if (draft.status === "Closed" && !Number.isFinite(Number(draft.profit))) {
      setError("Profit must be a number.");
      return;
    }

    if (
      draft.floatingPnl.trim() &&
      !Number.isFinite(Number(draft.floatingPnl))
    ) {
      setError("Floating P/L must be a number when provided.");
      return;
    }

    writeManualTrade(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <button
        className="absolute inset-0 cursor-default"
        aria-label="Close create trade drawer"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">
              Manual Trade
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Create Trade
            </h2>
          </div>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300"
            onClick={onClose}
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
          <TextInputField
            label="Symbol"
            value={draft.symbol}
            onChange={(value) => updateDraft("symbol", value)}
          />
          <SelectFilter
            label="Trade Status"
            options={["Open", "Closed"]}
            value={draft.status}
            onChange={(value) => updateDraft("status", value)}
          />
          <SelectFilter
            label="Direction"
            options={["Long", "Short"]}
            value={draft.side}
            onChange={(value) => updateDraft("side", value)}
          />
          <TextInputField
            label="Open Time"
            type="datetime-local"
            value={draft.openTime}
            onChange={(value) => updateDraft("openTime", value)}
          />
          <TextInputField
            label="Close Time"
            type="datetime-local"
            value={draft.closeTime}
            onChange={(value) => updateDraft("closeTime", value)}
          />
          <TextInputField
            label="Volume"
            value={draft.volume}
            onChange={(value) => updateDraft("volume", value)}
          />
          <TextInputField
            label="Open Price"
            value={draft.openPrice}
            onChange={(value) => updateDraft("openPrice", value)}
          />
          <TextInputField
            label="Close Price"
            value={draft.closePrice}
            onChange={(value) => updateDraft("closePrice", value)}
          />
          <TextInputField
            label={draft.status === "Open" ? "Profit (optional)" : "Profit"}
            value={draft.profit}
            onChange={(value) => updateDraft("profit", value)}
          />
          <TextInputField
            label="Floating P/L"
            value={draft.floatingPnl}
            onChange={(value) => updateDraft("floatingPnl", value)}
          />
          <SelectFilter
            label="Setup Tag"
            options={[...setupTags]}
            value={draft.setupTag}
            onChange={(value) => updateDraft("setupTag", value)}
          />
          <SelectFilter
            label="Playbook"
            options={[...playbooks]}
            value={draft.playbook}
            onChange={(value) => updateDraft("playbook", value)}
          />
          <SelectFilter
            label="Emotion"
            options={[...emotionOptions]}
            value={draft.emotion ?? ""}
            onChange={(value) => updateDraft("emotion", value)}
          />
          <SelectFilter
            label="Mistake"
            options={[...mistakeOptions]}
            value={draft.mistake ?? ""}
            onChange={(value) => updateDraft("mistake", value)}
          />
        </div>

        <div className="mt-6 grid gap-4">
          <TextAreaField
            label="Entry Reason"
            value={draft.entryReason ?? ""}
            onChange={(value) => updateDraft("entryReason", value)}
          />
          <TextAreaField
            label="Exit Reason"
            value={draft.exitReason ?? ""}
            onChange={(value) => updateDraft("exitReason", value)}
          />
          <TextAreaField
            label="Lesson Learned"
            value={draft.lessonLearned ?? ""}
            onChange={(value) => updateDraft("lessonLearned", value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            onClick={saveTrade}
            type="button"
          >
            Save Trade
          </button>
        </div>
      </aside>
    </div>
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
    playbook: "",
    result: "",
    direction: "",
  });
  const [page, setPage] = useState(1);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [creatingTrade, setCreatingTrade] = useState(false);

  const symbols = useMemo(() => uniqueValues(tradeHistory, "symbol"), [tradeHistory]);
  const setupTagOptions = useMemo(
    () => uniqueValues(tradeHistory, "setupTag"),
    [tradeHistory],
  );
  const playbookOptions = useMemo(
    () => uniqueValues(tradeHistory, "playbook"),
    [tradeHistory],
  );

  const filteredTrades = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tradeHistory.filter((trade) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          trade.id,
          trade.symbol,
          trade.setup,
          trade.setupTag,
          trade.playbook,
          trade.session,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return (
        matchesQuery &&
        (!filters.symbol || trade.symbol === filters.symbol) &&
        (!filters.setupTag || trade.setupTag === filters.setupTag) &&
        (!filters.playbook || trade.playbook === filters.playbook) &&
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
    <AppShell
      eyebrow="Execution Database"
      title="Trades"
      action={
        <button
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          onClick={() => setCreatingTrade(true)}
          type="button"
        >
          New Trade
        </button>
      }
    >
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-4 xl:grid-cols-[1.25fr_repeat(5,minmax(0,1fr))]">
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
            label="Playbook"
            options={playbookOptions}
            value={filters.playbook}
            onChange={(value) => updateFilter("playbook", value)}
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
              setFilters({
                symbol: "",
                setupTag: "",
                playbook: "",
                result: "",
                direction: "",
              });
              setPage(1);
            }}
          >
            Reset Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Trade</th>
                <th className="px-5 py-4 font-semibold">Symbol</th>
                <th className="px-5 py-4 font-semibold">Setup Tag</th>
                <th className="px-5 py-4 font-semibold">Playbook</th>
                <th className="px-5 py-4 font-semibold">Direction</th>
                <th className="px-5 py-4 font-semibold">Status</th>
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
                const displayPnl =
                  trade.status === "Open" ? trade.floatingPnl ?? 0 : trade.pnl;
                const positive = displayPnl >= 0;

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
                    <td className="px-5 py-4">
                      <select
                        className="h-9 min-w-48 rounded-md border border-white/10 bg-[#090d15] px-2 text-xs font-semibold text-slate-200 outline-none transition focus:border-emerald-300/50"
                        value={trade.playbook}
                        onChange={(event) => {
                          writePlaybookOverride(
                            trade.id,
                            event.target.value as Playbook,
                          );
                        }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {playbooks.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">{trade.side}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          trade.status === "Open"
                            ? "bg-sky-400/10 text-sky-300"
                            : "bg-white/[0.05] text-slate-200"
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">{trade.session}</td>
                    <td className="px-5 py-4">{trade.entry}</td>
                    <td className="px-5 py-4">{trade.exit}</td>
                    <td className="px-5 py-4 font-semibold">{trade.rr}R</td>
                    <td
                      className={`px-5 py-4 font-semibold ${
                        positive ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {money(displayPnl)}
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
        <TradeReviewDrawer
          key={selectedTrade.id}
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      ) : null}
      {creatingTrade ? (
        <CreateTradeDrawer onClose={() => setCreatingTrade(false)} />
      ) : null}
    </AppShell>
  );
}
