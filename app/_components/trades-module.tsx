"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyPropAccounts,
  readStoredPropAccounts,
  subscribeToPropAccounts,
  type PropAccount,
} from "@/app/_lib/prop-account-storage";
import {
  emptyPersonalTradingAccounts,
  readStoredPersonalTradingAccounts,
  subscribeToPersonalTradingAccounts,
  type PersonalTradingAccount,
} from "@/app/_lib/personal-account-storage";
import {
  type ManualTradeInput,
  updateManualTrade,
  writeManualTrade,
} from "@/app/_lib/manual-trade-storage";
import {
  readTradeAccountLinks,
  subscribeToTradeAccountLinks,
  writeTradeAccountLink,
  type TradeAccountLink,
  type TradeAccountLinks,
  type TradeAccountSource,
} from "@/app/_lib/trade-account-link-storage";
import {
  createEmptyTnpaPlaybookIntelligence,
  emptyTnpaPlaybookIntelligenceOverrides,
  evaluateTnpaGrade,
  readTnpaPlaybookIntelligenceOverrides,
  subscribeToTnpaPlaybookIntelligenceOverrides,
  tnpaCorePlaybooks,
  tnpaEmaStructureOptions,
  tnpaEntryQualityOptions,
  tnpaGrades,
  tnpaHigherTimeframeTrendOptions,
  tnpaMarketBiasOptions,
  tnpaRsiConfirmationOptions,
  tnpaTdSequentialOptions,
  tnpaVolumeConfirmationOptions,
  tnpaZoneContextOptions,
  writeTnpaPlaybookIntelligenceOverride,
  type TnpaGrade,
  type TnpaPlaybookIntelligence,
  type TnpaPlaybookIntelligenceOverrides,
  type TnpaRuleCompliance,
} from "@/app/_lib/tnpa-playbook-intelligence-storage";
import { writePlaybookOverride } from "@/app/_lib/playbook-storage";
import { writeSetupTagOverride } from "@/app/_lib/setup-tag-storage";
import { writeTradeJournalOverride } from "@/app/_lib/trade-journal-storage";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  AccountType,
  ChallengeType,
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Playbook,
  PropAccountStatus,
  PropFirmName,
  PropPhase,
  SetupTag,
  StrategyType,
  TradeJournal,
  Trade,
} from "@/app/_lib/trading-types";
import {
  accountTypes,
  brokerAccountNames,
  challengeTypes,
  emotionOptions,
  mistakeOptions,
  playbooks,
  propAccountStatuses,
  propFirmAccountNames,
  propFirmNames,
  propPhases,
  setupTags,
  strategyTypes,
} from "@/app/_lib/trading-types";

const pageSize = 8;

const initialManualTrade: ManualTradeInput = {
  status: "Closed",
  accountType: "broker",
  accountName: "ICMarkets",
  strategyType: "Swing",
  firmName: "FTMO",
  accountSize: "100000",
  challengeType: "FTMO Challenge V2",
  phase: "Phase 1",
  profitTargetPercent: "10",
  dailyLossLimitPercent: "5",
  maxLossLimitPercent: "10",
  minimumTradingDays: "4",
  startDate: "",
  propStatus: "Active",
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

function manualTradeInputFromTrade(trade: Trade): ManualTradeInput {
  return {
    status: trade.status,
    accountType: trade.accountType ?? "broker",
    accountName: trade.accountName ?? "ICMarkets",
    strategyType: trade.strategyType ?? "Swing",
    firmName: trade.firmName ?? "FTMO",
    accountSize: String(trade.accountSize ?? 100000),
    challengeType: trade.challengeType ?? "FTMO Challenge V2",
    phase: trade.phase ?? "Phase 1",
    profitTargetPercent: String(trade.profitTargetPercent ?? 10),
    dailyLossLimitPercent: String(trade.dailyLossLimitPercent ?? 5),
    maxLossLimitPercent: String(trade.maxLossLimitPercent ?? 10),
    minimumTradingDays: String(trade.minimumTradingDays ?? 4),
    startDate: trade.startDate ?? "",
    propStatus: trade.propStatus ?? "Active",
    symbol: trade.symbol,
    side: trade.side,
    entryScreenshot: trade.entryScreenshot,
    exitScreenshot: trade.exitScreenshot,
    openTime: trade.openTime ?? "",
    closeTime: trade.closeTime ?? "",
    volume: trade.volume ?? "",
    openPrice: String(trade.openPrice ?? trade.entry ?? ""),
    closePrice: String(trade.closePrice ?? trade.exit ?? ""),
    profit: String(trade.pnl ?? ""),
    floatingPnl: String(trade.floatingPnl ?? ""),
    setupTag: trade.setupTag,
    playbook: trade.playbook,
    entryReason: trade.entryReason ?? "",
    exitReason: trade.exitReason ?? "",
    lessonLearned: trade.lessonLearned ?? "",
    emotion: trade.emotion,
    mistake: trade.mistake,
  };
}

type FilterState = {
  accountType: string;
  accountName: string;
  strategyType: string;
  symbol: string;
  setupTag: string;
  playbook: string;
  tnpaGrade: string;
  result: string;
  direction: string;
};

type TradeTab = "all" | "mt5" | "manual" | "open";

type AccountLinkOption = TradeAccountLink & {
  label: string;
  value: string;
  strategyType?: StrategyType;
  propAccount?: PropAccount;
  personalAccount?: PersonalTradingAccount;
};

type AccountTradeMetric = {
  accountId: string;
  accountName: string;
  accountSource: TradeAccountSource;
  accountType: AccountType;
  netPnl: number;
  profitFactor: number;
  tradeCount: number;
  winRate: number;
};

function uniqueValues(
  trades: Trade[],
  key: keyof Pick<Trade, "symbol" | "setupTag" | "playbook" | "accountName" | "strategyType" | "accountType">,
) {
  return Array.from(new Set(trades.map((trade) => trade[key]).filter(Boolean))).sort() as string[];
}

function accountNameOptions(accountType: string, registryAccountNames: string[] = []) {
  if (accountType === "prop-firm") {
    return registryAccountNames.length ? registryAccountNames : [...propFirmAccountNames];
  }

  if (accountType === "broker") {
    return [...brokerAccountNames];
  }

  return [...propFirmAccountNames, ...brokerAccountNames];
}

function accountLinkValue(source: TradeAccountSource, accountId: string) {
  return `${source}:${accountId}`;
}

function buildAccountLinkOptions(
  propAccounts: PropAccount[],
  personalAccounts: PersonalTradingAccount[],
): AccountLinkOption[] {
  return [
    ...propAccounts.map<AccountLinkOption>((account) => ({
      accountId: account.id,
      accountName: account.accountName,
      accountSource: "prop",
      accountType: "prop-firm",
      label: `FTMO / ${account.accountName}`,
      propAccount: account,
      strategyType: "Intraweek",
      value: accountLinkValue("prop", account.id),
    })),
    ...personalAccounts.map<AccountLinkOption>((account) => ({
      accountId: account.id,
      accountName: account.accountName,
      accountSource: "personal",
      accountType: "broker",
      label: `Personal / ${account.accountName}`,
      personalAccount: account,
      strategyType: account.strategyType,
      value: accountLinkValue("personal", account.id),
    })),
  ];
}

function findLinkOptionFromTrade(trade: Trade, options: AccountLinkOption[]) {
  return (
    options.find(
      (option) =>
        option.accountType === (trade.accountType ?? "broker") &&
        option.accountName === trade.accountName,
    ) ?? null
  );
}

function effectiveTradeLink(
  trade: Trade,
  links: TradeAccountLinks,
  options: AccountLinkOption[],
) {
  const stored = links[trade.id];
  if (stored) return stored;

  const matched = findLinkOptionFromTrade(trade, options);
  return matched
    ? {
        accountId: matched.accountId,
        accountName: matched.accountName,
        accountSource: matched.accountSource,
        accountType: matched.accountType,
      }
    : null;
}

function applyAccountOptionToManualDraft(
  draft: ManualTradeInput,
  option: AccountLinkOption,
): ManualTradeInput {
  if (option.accountSource === "prop" && option.propAccount) {
    const account = option.propAccount;
    return {
      ...draft,
      accountType: "prop-firm",
      accountName: account.accountName,
      strategyType: "Intraweek",
      firmName: account.firmName,
      accountSize: String(account.accountSize),
      challengeType: account.challengeType,
      phase: account.phase,
      profitTargetPercent: String(account.profitTargetPercent),
      dailyLossLimitPercent: String(account.dailyLossLimitPercent),
      maxLossLimitPercent: String(account.maxLossLimitPercent),
      minimumTradingDays: String(account.minimumTradingDays),
      startDate: account.challengeStartDate || account.startDate,
      propStatus: account.status,
    };
  }

  return {
    ...draft,
    accountType: "broker",
    accountName: option.accountName,
    strategyType: option.strategyType ?? "Swing",
  };
}

function accountOptionSize(option: AccountLinkOption) {
  if (option.propAccount) return `$${option.propAccount.accountSize.toLocaleString()}`;
  if (option.personalAccount) return `$${option.personalAccount.initialBalance.toLocaleString()}`;
  return "-";
}

function accountOptionStatus(option: AccountLinkOption) {
  if (option.propAccount) return option.propAccount.lifecycleStatus;
  if (option.personalAccount) return option.personalAccount.status;
  return "-";
}

function closedTradesOnly(trades: Trade[]) {
  return trades.filter((trade) => trade.status !== "Open");
}

function profitFactorForTrades(trades: Trade[]) {
  const closedTrades = closedTradesOnly(trades);
  const grossProfit = closedTrades
    .filter((trade) => trade.pnl > 0)
    .reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(
    closedTrades
      .filter((trade) => trade.pnl < 0)
      .reduce((sum, trade) => sum + trade.pnl, 0),
  );

  if (grossLoss === 0) return grossProfit > 0 ? 99 : 0;
  return grossProfit / grossLoss;
}

function buildAccountTradeMetrics(
  trades: Trade[],
  links: TradeAccountLinks,
  options: AccountLinkOption[],
) {
  return options
    .map<AccountTradeMetric>((option) => {
      const accountTrades = trades.filter((trade) => {
        const link = effectiveTradeLink(trade, links, options);
        return link?.accountSource === option.accountSource && link.accountId === option.accountId;
      });
      const closedTrades = closedTradesOnly(accountTrades);
      const netPnl = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      const wins = closedTrades.filter((trade) => trade.result === "Win").length;

      return {
        accountId: option.accountId,
        accountName: option.accountName,
        accountSource: option.accountSource,
        accountType: option.accountType,
        netPnl,
        profitFactor: profitFactorForTrades(accountTrades),
        tradeCount: accountTrades.length,
        winRate: closedTrades.length ? (wins / closedTrades.length) * 100 : 0,
      };
    })
    .filter((metric) => metric.tradeCount > 0)
    .sort((a, b) => b.netPnl - a.netPnl);
}

function gradeTone(grade: TnpaGrade) {
  if (grade === "A+" || grade === "A") return "bg-emerald-400/10 text-emerald-300";
  if (grade === "B") return "bg-cyan-400/10 text-cyan-300";
  if (grade === "C") return "bg-amber-400/10 text-amber-200";
  return "bg-rose-400/10 text-rose-300";
}

function gradeSortValue(grade: TnpaGrade) {
  return { "A+": 5, A: 4, B: 3, C: 2, Invalid: 1 }[grade];
}

function buildTnpaSummary(
  trades: Trade[],
  overrides: TnpaPlaybookIntelligenceOverrides,
) {
  const gradeRows = tnpaGrades.map((grade) => {
    const gradeTrades = trades.filter((trade) => evaluateTnpaGrade(trade, overrides[trade.id]).grade === grade);
    const closed = closedTradesOnly(gradeTrades);
    const wins = closed.filter((trade) => trade.result === "Win").length;

    return {
      grade,
      netPnl: closed.reduce((sum, trade) => sum + trade.pnl, 0),
      trades: gradeTrades.length,
      winRate: closed.length ? (wins / closed.length) * 100 : 0,
    };
  });
  const playbookRows = tnpaCorePlaybooks
    .map((playbook) => {
      const playbookTrades = trades.filter((trade) => overrides[trade.id]?.corePlaybook === playbook);
      return {
        netPnl: closedTradesOnly(playbookTrades).reduce((sum, trade) => sum + trade.pnl, 0),
        playbook,
        trades: playbookTrades.length,
      };
    })
    .filter((row) => row.trades > 0)
    .sort((a, b) => b.netPnl - a.netPnl);
  const violatedRules = new Map<string, number>();

  trades.forEach((trade) => {
    evaluateTnpaGrade(trade, overrides[trade.id]).violatedRules.forEach((rule) => {
      violatedRules.set(rule, (violatedRules.get(rule) ?? 0) + 1);
    });
  });

  const mostViolatedRule = Array.from(violatedRules.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    bestPlaybook: playbookRows[0],
    gradeRows,
    mostViolatedRule,
  };
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function optionLabel(value: string) {
  if (value === "prop-firm") {
    return "Prop Firm";
  }

  if (value === "broker") {
    return "Broker";
  }

  return value;
}

function SelectFilter({
  label,
  onChange,
  includeAll = true,
  options,
  value,
}: {
  label: string;
  includeAll?: boolean;
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
        {includeAll ? <option value="">All</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function OptionalSelectField({
  label,
  onChange,
  options,
  placeholder = "Not reviewed",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
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
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RuleCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200">
      <input
        className="size-4 accent-emerald-400"
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
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
  accountLinkOptions,
  tnpaPlaybookIntelligence,
  tradeAccountLinks,
  onClose,
  trade,
}: {
  accountLinkOptions: AccountLinkOption[];
  tnpaPlaybookIntelligence: TnpaPlaybookIntelligenceOverrides;
  tradeAccountLinks: TradeAccountLinks;
  onClose: () => void;
  trade: Trade;
}) {
  const isManual = String(trade.source ?? "mt5") === "manual";
  const existingLink = effectiveTradeLink(trade, tradeAccountLinks, accountLinkOptions);
  const [setupTag, setSetupTag] = useState<SetupTag>(trade.setupTag);
  const [playbook, setPlaybook] = useState<Playbook>(trade.playbook);
  const [selectedAccountLinkValue, setSelectedAccountLinkValue] = useState(
    existingLink ? accountLinkValue(existingLink.accountSource, existingLink.accountId) : "",
  );
  const [draft, setDraft] = useState<TradeJournal>({
    entryScreenshot: trade.entryScreenshot,
    exitScreenshot: trade.exitScreenshot,
    entryReason: trade.entryReason ?? "",
    exitReason: trade.exitReason ?? "",
    emotion: trade.emotion,
    mistake: trade.mistake,
    lessonLearned: trade.lessonLearned ?? "",
  });
  const [manualDraft, setManualDraft] = useState<ManualTradeInput>(
    manualTradeInputFromTrade(trade),
  );
  const [tnpaDraft, setTnpaDraft] = useState<TnpaPlaybookIntelligence>(
    tnpaPlaybookIntelligence[trade.id] ?? createEmptyTnpaPlaybookIntelligence(),
  );
  const propAccounts = useSyncExternalStore(
    subscribeToPropAccounts,
    readStoredPropAccounts,
    () => emptyPropAccounts,
  );
  const registryAccountNames = propAccounts.map((account) => account.accountName);
  const [error, setError] = useState("");
  const selectedAccountLinkOption =
    accountLinkOptions.find((option) => option.value === selectedAccountLinkValue) ?? null;
  const tnpaGrade = evaluateTnpaGrade(trade, tnpaDraft);

  function updateDraft(key: keyof TradeJournal, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  }

  function updateManualDraft(key: keyof ManualTradeInput, value: string) {
    setManualDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateTnpaDraft<K extends keyof Omit<TnpaPlaybookIntelligence, "rules">>(
    key: K,
    value: TnpaPlaybookIntelligence[K] | "",
  ) {
    setTnpaDraft((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  }

  function updateTnpaRule(key: keyof TnpaRuleCompliance, value: boolean) {
    setTnpaDraft((current) => ({
      ...current,
      rules: {
        ...current.rules,
        [key]: value,
      },
    }));
  }

  function saveReview() {
    if (isManual) {
      if (!manualDraft.symbol.trim()) {
        setError("Symbol is required.");
        return;
      }

      if (!manualDraft.side) {
        setError("Direction is required.");
        return;
      }

      if (!manualDraft.accountType || !manualDraft.accountName || !manualDraft.strategyType) {
        setError("Account Type, Account Name, and Strategy Type are required.");
        return;
      }

      if (
        manualDraft.accountType === "prop-firm" &&
        (!manualDraft.firmName ||
          !manualDraft.challengeType ||
          !manualDraft.phase ||
          !manualDraft.accountSize.trim() ||
          !manualDraft.profitTargetPercent.trim() ||
          !manualDraft.dailyLossLimitPercent.trim() ||
          !manualDraft.maxLossLimitPercent.trim() ||
          !manualDraft.minimumTradingDays.trim() ||
          !manualDraft.propStatus)
      ) {
        setError("Prop firm challenge metadata is required.");
        return;
      }

      if (manualDraft.status === "Closed" && !manualDraft.closeTime) {
        setError("Close Time is required for closed trades.");
        return;
      }

      if (manualDraft.status === "Closed" && !manualDraft.closePrice.trim()) {
        setError("Close Price is required for closed trades.");
        return;
      }

      if (manualDraft.status === "Closed" && !manualDraft.profit.trim()) {
        setError("Profit is required for closed trades.");
        return;
      }

      if (manualDraft.status === "Closed" && !Number.isFinite(Number(manualDraft.profit))) {
        setError("Profit must be a number.");
        return;
      }

      if (manualDraft.floatingPnl.trim() && !Number.isFinite(Number(manualDraft.floatingPnl))) {
        setError("Floating P/L must be a number when provided.");
        return;
      }

      updateManualTrade(trade.id, manualDraft);
    }

    writeTradeAccountLink(
      trade.id,
      selectedAccountLinkOption
        ? {
            accountId: selectedAccountLinkOption.accountId,
            accountName: selectedAccountLinkOption.accountName,
            accountSource: selectedAccountLinkOption.accountSource,
            accountType: selectedAccountLinkOption.accountType,
          }
        : null,
    );
    writeSetupTagOverride(trade.id, setupTag);
    writePlaybookOverride(trade.id, playbook);
    writeTradeJournalOverride(trade.id, draft);
    writeTnpaPlaybookIntelligenceOverride(trade.id, tnpaDraft);
    onClose();
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
            <h2 className="mt-2 text-2xl font-semibold text-white">{trade.id}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {trade.symbol} - {trade.date}
            </p>
            <div className="mt-3 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
              {isManual ? "Manual" : "MT5"}
            </div>
          </div>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-md border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-semibold text-rose-200">
            {error}
          </div>
        ) : null}

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
            ["TNPA Grade", `${tnpaGrade.grade} / ${tnpaGrade.score}`],
            ["Original Setup", trade.setup],
          ].map(([label, value]) => (
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4" key={label}>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{value}</div>
            </div>
          ))}
        </div>

        <section className="mt-6 rounded-md border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">TNPA Playbook Intelligence</h3>
              <p className="mt-1 text-sm text-slate-500">{tnpaGrade.explanation}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${gradeTone(tnpaGrade.grade)}`}>
              {tnpaGrade.grade}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OptionalSelectField
              label="TNPA Playbook"
              options={tnpaCorePlaybooks}
              value={tnpaDraft.corePlaybook ?? ""}
              onChange={(value) => updateTnpaDraft("corePlaybook", value as TnpaPlaybookIntelligence["corePlaybook"] | "")}
            />
            <OptionalSelectField
              label="Market Bias"
              options={tnpaMarketBiasOptions}
              value={tnpaDraft.marketBias ?? ""}
              onChange={(value) => updateTnpaDraft("marketBias", value as TnpaPlaybookIntelligence["marketBias"] | "")}
            />
            <OptionalSelectField
              label="Higher Timeframe Trend"
              options={tnpaHigherTimeframeTrendOptions}
              value={tnpaDraft.higherTimeframeTrend ?? ""}
              onChange={(value) => updateTnpaDraft("higherTimeframeTrend", value as TnpaPlaybookIntelligence["higherTimeframeTrend"] | "")}
            />
            <OptionalSelectField
              label="EMA Structure"
              options={tnpaEmaStructureOptions}
              value={tnpaDraft.emaStructure ?? ""}
              onChange={(value) => updateTnpaDraft("emaStructure", value as TnpaPlaybookIntelligence["emaStructure"] | "")}
            />
            <OptionalSelectField
              label="RSI Confirmation"
              options={tnpaRsiConfirmationOptions}
              value={tnpaDraft.rsiConfirmation ?? ""}
              onChange={(value) => updateTnpaDraft("rsiConfirmation", value as TnpaPlaybookIntelligence["rsiConfirmation"] | "")}
            />
            <OptionalSelectField
              label="TD Sequential"
              options={tnpaTdSequentialOptions}
              value={tnpaDraft.tdSequentialConfirmation ?? ""}
              onChange={(value) => updateTnpaDraft("tdSequentialConfirmation", value as TnpaPlaybookIntelligence["tdSequentialConfirmation"] | "")}
            />
            <OptionalSelectField
              label="Volume Confirmation"
              options={tnpaVolumeConfirmationOptions}
              value={tnpaDraft.volumeConfirmation ?? ""}
              onChange={(value) => updateTnpaDraft("volumeConfirmation", value as TnpaPlaybookIntelligence["volumeConfirmation"] | "")}
            />
            <OptionalSelectField
              label="Zone Context"
              options={tnpaZoneContextOptions}
              value={tnpaDraft.zoneContext ?? ""}
              onChange={(value) => updateTnpaDraft("zoneContext", value as TnpaPlaybookIntelligence["zoneContext"] | "")}
            />
            <OptionalSelectField
              label="Entry Quality"
              options={tnpaEntryQualityOptions}
              value={tnpaDraft.entryQuality ?? ""}
              onChange={(value) => updateTnpaDraft("entryQuality", value as TnpaPlaybookIntelligence["entryQuality"] | "")}
            />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <RuleCheckbox
              checked={tnpaDraft.rules.tradeWithH4Trend}
              label="Trade with H4 trend"
              onChange={(checked) => updateTnpaRule("tradeWithH4Trend", checked)}
            />
            <RuleCheckbox
              checked={tnpaDraft.rules.avoidEma21Ema34Entry}
              label="Avoid entry between EMA21 and EMA34"
              onChange={(checked) => updateTnpaRule("avoidEma21Ema34Entry", checked)}
            />
            <RuleCheckbox
              checked={tnpaDraft.rules.rrAtLeastTwo}
              label="RR >= 1:2"
              onChange={(checked) => updateTnpaRule("rrAtLeastTwo", checked)}
            />
            <RuleCheckbox
              checked={tnpaDraft.rules.stopLossDefined}
              label="Stop loss defined"
              onChange={(checked) => updateTnpaRule("stopLossDefined", checked)}
            />
            <RuleCheckbox
              checked={tnpaDraft.rules.playbookMatched}
              label="Playbook matched"
              onChange={(checked) => updateTnpaRule("playbookMatched", checked)}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Linked Account
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={selectedAccountLinkValue}
              onChange={(event) => {
                const value = event.target.value;
                const option = accountLinkOptions.find((item) => item.value === value) ?? null;
                setSelectedAccountLinkValue(value);
                if (isManual && option) {
                  setManualDraft((current) => applyAccountOptionToManualDraft(current, option));
                }
              }}
            >
              <option value="">Unlinked</option>
              {accountLinkOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Account Source</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              {selectedAccountLinkOption
                ? selectedAccountLinkOption.accountSource === "prop"
                  ? "FTMO Account"
                  : "Personal Trading Account"
                : "Unlinked"}
            </div>
          </div>
        </div>

        {isManual ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <TextInputField
              label="Symbol"
              value={manualDraft.symbol}
              onChange={(value) => updateManualDraft("symbol", value)}
            />
            <SelectFilter
              label="Account Type"
              options={[...accountTypes]}
              value={manualDraft.accountType}
              onChange={(value) => {
                updateManualDraft("accountType", value as AccountType);
                updateManualDraft(
                  "accountName",
                  value === "prop-firm" ? registryAccountNames[0] ?? "FTMO" : "ICMarkets",
                );
                updateManualDraft("strategyType", value === "prop-firm" ? "Intraweek" : "Swing");
              }}
              includeAll={false}
            />
            <SelectFilter
              label="Account Name"
              options={accountNameOptions(manualDraft.accountType, registryAccountNames)}
              value={manualDraft.accountName}
              onChange={(value) => updateManualDraft("accountName", value)}
              includeAll={false}
            />
            <SelectFilter
              label="Strategy Type"
              options={[...strategyTypes]}
              value={manualDraft.strategyType}
              onChange={(value) => updateManualDraft("strategyType", value as StrategyType)}
              includeAll={false}
            />
            {manualDraft.accountType === "prop-firm" ? (
              <>
                <SelectFilter
                  label="Firm Name"
                  options={[...propFirmNames]}
                  value={manualDraft.firmName}
                  onChange={(value) => updateManualDraft("firmName", value as PropFirmName)}
                  includeAll={false}
                />
                <TextInputField
                  label="Account Size"
                  value={manualDraft.accountSize}
                  onChange={(value) => updateManualDraft("accountSize", value)}
                />
                <SelectFilter
                  label="Challenge Type"
                  options={[...challengeTypes]}
                  value={manualDraft.challengeType}
                  onChange={(value) => updateManualDraft("challengeType", value as ChallengeType)}
                  includeAll={false}
                />
                <SelectFilter
                  label="Phase"
                  options={[...propPhases]}
                  value={manualDraft.phase}
                  onChange={(value) => updateManualDraft("phase", value as PropPhase)}
                  includeAll={false}
                />
                <TextInputField
                  label="Profit Target %"
                  value={manualDraft.profitTargetPercent}
                  onChange={(value) => updateManualDraft("profitTargetPercent", value)}
                />
                <TextInputField
                  label="Daily Loss Limit %"
                  value={manualDraft.dailyLossLimitPercent}
                  onChange={(value) => updateManualDraft("dailyLossLimitPercent", value)}
                />
                <TextInputField
                  label="Max Loss Limit %"
                  value={manualDraft.maxLossLimitPercent}
                  onChange={(value) => updateManualDraft("maxLossLimitPercent", value)}
                />
                <TextInputField
                  label="Minimum Trading Days"
                  value={manualDraft.minimumTradingDays}
                  onChange={(value) => updateManualDraft("minimumTradingDays", value)}
                />
                <TextInputField
                  label="Start Date"
                  type="date"
                  value={manualDraft.startDate}
                  onChange={(value) => updateManualDraft("startDate", value)}
                />
                <SelectFilter
                  label="Status"
                  options={[...propAccountStatuses]}
                  value={manualDraft.propStatus}
                  onChange={(value) => updateManualDraft("propStatus", value as PropAccountStatus)}
                  includeAll={false}
                />
              </>
            ) : null}
            <SelectFilter
              label="Trade Status"
              options={["Open", "Closed"]}
              value={manualDraft.status}
              onChange={(value) => updateManualDraft("status", value)}
              includeAll={false}
            />
            <SelectFilter
              label="Direction"
              options={["Long", "Short"]}
              value={manualDraft.side}
              onChange={(value) => updateManualDraft("side", value)}
              includeAll={false}
            />
            <TextInputField
              label="Open Time"
              type="datetime-local"
              value={manualDraft.openTime}
              onChange={(value) => updateManualDraft("openTime", value)}
            />
            <TextInputField
              label="Close Time"
              type="datetime-local"
              value={manualDraft.closeTime}
              onChange={(value) => updateManualDraft("closeTime", value)}
            />
            <TextInputField
              label="Volume"
              value={manualDraft.volume}
              onChange={(value) => updateManualDraft("volume", value)}
            />
            <TextInputField
              label="Open Price"
              value={manualDraft.openPrice}
              onChange={(value) => updateManualDraft("openPrice", value)}
            />
            <TextInputField
              label="Close Price"
              value={manualDraft.closePrice}
              onChange={(value) => updateManualDraft("closePrice", value)}
            />
            <TextInputField
              label={manualDraft.status === "Open" ? "Profit (optional)" : "Profit"}
              value={manualDraft.profit}
              onChange={(value) => updateManualDraft("profit", value)}
            />
            <TextInputField
              label="Floating P/L"
              value={manualDraft.floatingPnl}
              onChange={(value) => updateManualDraft("floatingPnl", value)}
            />
            <SelectFilter
              label="Setup Tag"
              options={[...setupTags]}
              value={manualDraft.setupTag}
              onChange={(value) => updateManualDraft("setupTag", value)}
              includeAll={false}
            />
            <SelectFilter
              label="Playbook"
              options={[...playbooks]}
              value={manualDraft.playbook}
              onChange={(value) => updateManualDraft("playbook", value)}
              includeAll={false}
            />
            <SelectFilter
              label="Emotion"
              options={[...emotionOptions]}
              value={manualDraft.emotion ?? ""}
              onChange={(value) => updateManualDraft("emotion", value)}
              includeAll={false}
            />
            <SelectFilter
              label="Mistake"
              options={[...mistakeOptions]}
              value={manualDraft.mistake ?? ""}
              onChange={(value) => updateManualDraft("mistake", value)}
              includeAll={false}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SelectFilter
              label="Setup Tag"
              options={[...setupTags]}
              value={setupTag}
              onChange={(value) => setSetupTag(value as SetupTag)}
              includeAll={false}
            />
            <SelectFilter
              label="Playbook"
              options={[...playbooks]}
              value={playbook}
              onChange={(value) => setPlaybook(value as Playbook)}
              includeAll={false}
            />
            <SelectFilter
              label="Emotion"
              options={[...emotionOptions]}
              value={draft.emotion ?? ""}
              onChange={(value) => updateDraft("emotion", value)}
              includeAll={false}
            />
            <SelectFilter
              label="Mistake"
              options={[...mistakeOptions]}
              value={draft.mistake ?? ""}
              onChange={(value) => updateDraft("mistake", value)}
              includeAll={false}
            />
          </div>
        )}

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
            onClick={saveReview}
            type="button"
          >
            Save Review
          </button>
        </div>
      </aside>
    </div>
  );
}

function manualTradeDefaults(accountType: AccountType = "broker", accountName?: string): ManualTradeInput {
  if (accountType === "prop-firm") {
    return {
      ...initialManualTrade,
      accountType: "prop-firm",
      accountName: accountName ?? "FTMO",
      strategyType: "Intraweek",
    };
  }

  return initialManualTrade;
}

function CreateTradeDrawer({
  accountLinkOptions,
  defaultAccountType = "broker",
  defaultAccountName,
  lockedAccountLinkValue,
  onClose,
}: {
  accountLinkOptions: AccountLinkOption[];
  defaultAccountName?: string;
  defaultAccountType?: AccountType;
  lockedAccountLinkValue?: string;
  onClose: () => void;
}) {
  const defaultAccountOption =
    accountLinkOptions.find((option) => option.value === lockedAccountLinkValue) ??
    accountLinkOptions.find(
      (option) =>
        option.accountType === defaultAccountType &&
        (!defaultAccountName || option.accountName === defaultAccountName),
    ) ??
    null;
  const [draft, setDraft] = useState<ManualTradeInput>(
    defaultAccountOption
      ? applyAccountOptionToManualDraft(
          manualTradeDefaults(defaultAccountOption.accountType, defaultAccountOption.accountName),
          defaultAccountOption,
        )
      : manualTradeDefaults(defaultAccountType, defaultAccountName),
  );
  const [selectedAccountLinkValue, setSelectedAccountLinkValue] = useState(defaultAccountOption?.value ?? "");
  const [error, setError] = useState("");
  const selectedAccountOption =
    accountLinkOptions.find((option) => option.value === selectedAccountLinkValue) ?? null;
  const lockedAccount = Boolean(lockedAccountLinkValue);

  function updateDraft(key: keyof ManualTradeInput, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectAccount(value: string) {
    const option = accountLinkOptions.find((item) => item.value === value) ?? null;
    setSelectedAccountLinkValue(value);
    if (option) {
      setDraft((current) => applyAccountOptionToManualDraft(current, option));
    }
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

    if (!selectedAccountOption) {
      setError("Linked Account is required.");
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

    const tradeId = writeManualTrade(draft, { includeAccountMetadata: false });
    writeTradeAccountLink(tradeId, {
      accountId: selectedAccountOption.accountId,
      accountName: selectedAccountOption.accountName,
      accountSource: selectedAccountOption.accountSource,
      accountType: selectedAccountOption.accountType,
    });
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

        <section className="mt-6 rounded-md border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Linked Account
              </span>
              <select
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition disabled:cursor-not-allowed disabled:opacity-70 focus:border-emerald-300/50"
                disabled={lockedAccount}
                value={selectedAccountLinkValue}
                onChange={(event) => selectAccount(event.target.value)}
              >
                <option value="">Select account</option>
                {accountLinkOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Account Name</div>
                <div className="mt-1 text-sm font-semibold text-white">{selectedAccountOption?.accountName ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Source</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selectedAccountOption
                    ? selectedAccountOption.accountSource === "prop"
                      ? "FTMO"
                      : "Personal"
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Type</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selectedAccountOption ? optionLabel(selectedAccountOption.accountType) : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Size</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selectedAccountOption ? accountOptionSize(selectedAccountOption) : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selectedAccountOption ? accountOptionStatus(selectedAccountOption) : "-"}
                </div>
              </div>
            </div>
          </div>
        </section>

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
            includeAll={false}
          />
          <SelectFilter
            label="Direction"
            options={["Long", "Short"]}
            value={draft.side}
            onChange={(value) => updateDraft("side", value)}
            includeAll={false}
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
            includeAll={false}
          />
          <SelectFilter
            label="Playbook"
            options={[...playbooks]}
            value={draft.playbook}
            onChange={(value) => updateDraft("playbook", value)}
            includeAll={false}
          />
          <SelectFilter
            label="Emotion"
            options={[...emotionOptions]}
            value={draft.emotion ?? ""}
            onChange={(value) => updateDraft("emotion", value)}
            includeAll={false}
          />
          <SelectFilter
            label="Mistake"
            options={[...mistakeOptions]}
            value={draft.mistake ?? ""}
            onChange={(value) => updateDraft("mistake", value)}
            includeAll={false}
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
  scopeAccountType,
  trades,
  title = "Trades",
  eyebrow = "Execution Database",
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  initialReport: Mt5AccountReport | null;
  scopeAccountType?: AccountType;
  trades: Trade[];
  title?: string;
  eyebrow?: string;
}) {
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades: trades,
  });
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TradeTab>("all");
  const [filters, setFilters] = useState<FilterState>({
    accountType: scopeAccountType ?? "",
    accountName: "",
    strategyType: "",
    symbol: "",
    setupTag: "",
    playbook: "",
    tnpaGrade: "",
    result: "",
    direction: "",
  });
  const [page, setPage] = useState(1);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [creatingTrade, setCreatingTrade] = useState(false);
  const propAccounts = useSyncExternalStore(
    subscribeToPropAccounts,
    readStoredPropAccounts,
    () => emptyPropAccounts,
  );
  const personalAccounts = useSyncExternalStore(
    subscribeToPersonalTradingAccounts,
    readStoredPersonalTradingAccounts,
    () => emptyPersonalTradingAccounts,
  );
  const tradeAccountLinks = useSyncExternalStore(
    subscribeToTradeAccountLinks,
    readTradeAccountLinks,
    () => ({}),
  );
  const tnpaPlaybookIntelligence = useSyncExternalStore(
    subscribeToTnpaPlaybookIntelligenceOverrides,
    readTnpaPlaybookIntelligenceOverrides,
    () => emptyTnpaPlaybookIntelligenceOverrides,
  );
  const registryAccountNames = propAccounts.map((account) => account.accountName);
  const accountLinkOptions = useMemo(
    () => buildAccountLinkOptions(propAccounts, personalAccounts),
    [personalAccounts, propAccounts],
  );
  const [selectedRegistryAccountName, setSelectedRegistryAccountName] = useState("");
  const activeRegistryAccountName =
    scopeAccountType === "prop-firm"
      ? selectedRegistryAccountName || registryAccountNames[0] || ""
      : "";
  const lockedCreateAccountLinkValue = scopeAccountType
    ? accountLinkOptions.find(
        (option) =>
          option.accountType === scopeAccountType &&
          (!activeRegistryAccountName || option.accountName === activeRegistryAccountName),
      )?.value
    : undefined;

  const scopedTradeHistory = scopeAccountType
    ? tradeHistory.filter((trade) => {
        const link = effectiveTradeLink(trade, tradeAccountLinks, accountLinkOptions);
        const effectiveAccountType = link?.accountType ?? trade.accountType;
        const effectiveAccountName = link?.accountName ?? trade.accountName;
        return (
          effectiveAccountType === scopeAccountType &&
          (!activeRegistryAccountName || effectiveAccountName === activeRegistryAccountName)
        );
      })
    : tradeHistory;
  const symbols = useMemo(() => uniqueValues(scopedTradeHistory, "symbol"), [scopedTradeHistory]);
  const accountTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          scopedTradeHistory
            .map((trade) => effectiveTradeLink(trade, tradeAccountLinks, accountLinkOptions)?.accountType ?? trade.accountType)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [accountLinkOptions, scopedTradeHistory, tradeAccountLinks],
  );
  const accountNameFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          scopedTradeHistory
            .map((trade) => effectiveTradeLink(trade, tradeAccountLinks, accountLinkOptions)?.accountName ?? trade.accountName)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [accountLinkOptions, scopedTradeHistory, tradeAccountLinks],
  );
  const strategyTypeOptions = useMemo(() => uniqueValues(scopedTradeHistory, "strategyType"), [scopedTradeHistory]);
  const setupTagOptions = useMemo(() => uniqueValues(scopedTradeHistory, "setupTag"), [scopedTradeHistory]);
  const playbookOptions = useMemo(() => uniqueValues(scopedTradeHistory, "playbook"), [scopedTradeHistory]);
  const tnpaSummary = useMemo(
    () => buildTnpaSummary(scopedTradeHistory, tnpaPlaybookIntelligence),
    [scopedTradeHistory, tnpaPlaybookIntelligence],
  );
  const accountTradeMetrics = useMemo(
    () => buildAccountTradeMetrics(scopedTradeHistory, tradeAccountLinks, accountLinkOptions),
    [accountLinkOptions, scopedTradeHistory, tradeAccountLinks],
  );

  const tabTrades = useMemo(() => {
    return scopedTradeHistory.filter((trade) => {
      const source = String(trade.source ?? "mt5");
      if (activeTab === "mt5") {
        return source === "mt5";
      }

      if (activeTab === "manual") {
        return source === "manual";
      }

      if (activeTab === "open") {
        return trade.status === "Open";
      }

      return true;
    });
  }, [activeTab, scopedTradeHistory]);

  const filteredTrades = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tabTrades.filter((trade) => {
      const link = effectiveTradeLink(trade, tradeAccountLinks, accountLinkOptions);
      const effectiveAccountType = link?.accountType ?? trade.accountType;
      const effectiveAccountName = link?.accountName ?? trade.accountName;
      const tnpaGrade = evaluateTnpaGrade(trade, tnpaPlaybookIntelligence[trade.id]).grade;
      const matchesQuery =
        !normalizedQuery ||
        [
          trade.id,
          trade.symbol,
          trade.setup,
          trade.setupTag,
          trade.playbook,
          tnpaGrade,
          effectiveAccountType,
          effectiveAccountName,
          trade.strategyType,
          trade.session,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return (
        matchesQuery &&
        (!filters.accountType || effectiveAccountType === filters.accountType) &&
        (!filters.accountName || effectiveAccountName === filters.accountName) &&
        (!filters.strategyType || trade.strategyType === filters.strategyType) &&
        (!filters.symbol || trade.symbol === filters.symbol) &&
        (!filters.setupTag || trade.setupTag === filters.setupTag) &&
        (!filters.playbook || trade.playbook === filters.playbook) &&
        (!filters.tnpaGrade || tnpaGrade === filters.tnpaGrade) &&
        (!filters.result || trade.result === filters.result) &&
        (!filters.direction || trade.side === filters.direction)
      );
    });
  }, [accountLinkOptions, filters, query, tabTrades, tnpaPlaybookIntelligence, tradeAccountLinks]);

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
      eyebrow={eyebrow}
      title={title}
      action={
        <div className="flex flex-wrap items-center gap-3">
          {scopeAccountType === "prop-firm" && registryAccountNames.length ? (
            <label className="block">
              <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                FTMO Account
              </span>
              <select
                className="h-10 rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={activeRegistryAccountName}
                onChange={(event) => {
                  setSelectedRegistryAccountName(event.target.value);
                  setPage(1);
                }}
              >
                {registryAccountNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            onClick={() => setCreatingTrade(true)}
            type="button"
          >
            New Trade
          </button>
        </div>
      }
    >
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["all", "All Trades"],
            ["mt5", "Imported MT5"],
            ["manual", "Manual Trades"],
            ["open", "Open Positions"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setActiveTab(value as TradeTab);
                setPage(1);
              }}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                activeTab === value
                  ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-300/30 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.25fr_repeat(9,minmax(0,1fr))]">
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
          {scopeAccountType ? null : (
            <SelectFilter
              label="Account Type"
              options={accountTypeOptions}
              value={filters.accountType}
              onChange={(value) => updateFilter("accountType", value)}
            />
          )}
          <SelectFilter
            label="Account Name"
            options={accountNameFilterOptions}
            value={filters.accountName}
            onChange={(value) => updateFilter("accountName", value)}
          />
          <SelectFilter
            label="Strategy Type"
            options={strategyTypeOptions}
            value={filters.strategyType}
            onChange={(value) => updateFilter("strategyType", value)}
          />
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
            label="TNPA Grade"
            options={[...tnpaGrades]}
            value={filters.tnpaGrade}
            onChange={(value) => updateFilter("tnpaGrade", value)}
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

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">TNPA Playbook Intelligence</h2>
            <p className="mt-1 text-sm text-slate-500">Grade quality, playbook fit, and recurring rule violations.</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200">
            Best playbook: {tnpaSummary.bestPlaybook ? `${tnpaSummary.bestPlaybook.playbook} ${money(tnpaSummary.bestPlaybook.netPnl)}` : "-"}
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200">
            Most violated: {tnpaSummary.mostViolatedRule ? `${tnpaSummary.mostViolatedRule[0]} (${tnpaSummary.mostViolatedRule[1]})` : "-"}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {tnpaSummary.gradeRows
            .slice()
            .sort((a, b) => gradeSortValue(b.grade) - gradeSortValue(a.grade))
            .map((row) => (
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-4" key={row.grade}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${gradeTone(row.grade)}`}>
                    {row.grade}
                  </span>
                  <span className="text-xs uppercase tracking-[0.14em] text-slate-500">{row.trades} trades</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Win Rate</div>
                    <div className="mt-1 font-semibold text-white">{row.winRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Net P/L</div>
                    <div className={`mt-1 font-semibold ${row.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {money(row.netPnl)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {accountTradeMetrics.length ? (
        <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Account Trade Metrics</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accountTradeMetrics.map((metric) => (
              <div
                className="rounded-md border border-white/10 bg-white/[0.03] p-4"
                key={`${metric.accountSource}-${metric.accountId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{metric.accountName}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {metric.accountSource === "prop" ? "FTMO Account" : "Personal Account"}
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300">
                    {optionLabel(metric.accountType)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Trades</div>
                    <div className="mt-1 text-lg font-semibold text-white">{metric.tradeCount}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Net P/L</div>
                    <div className={`mt-1 text-lg font-semibold ${metric.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {money(metric.netPnl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Win Rate</div>
                    <div className="mt-1 text-lg font-semibold text-white">{metric.winRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Profit Factor</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {metric.profitFactor >= 99 ? "No losses" : metric.profitFactor.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
                accountType: scopeAccountType ?? "",
                accountName: "",
                strategyType: "",
                symbol: "",
                setupTag: "",
                playbook: "",
                tnpaGrade: "",
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
          <table className="w-full min-w-[1240px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Trade</th>
                  <th className="px-5 py-4 font-semibold">Source</th>
                  <th className="px-5 py-4 font-semibold">Account</th>
                  <th className="px-5 py-4 font-semibold">Strategy</th>
                  <th className="px-5 py-4 font-semibold">Symbol</th>
                  <th className="px-5 py-4 font-semibold">Setup Tag</th>
                  <th className="px-5 py-4 font-semibold">Playbook</th>
                  <th className="px-5 py-4 font-semibold">TNPA Grade</th>
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
                const link = effectiveTradeLink(trade, tradeAccountLinks, accountLinkOptions);
                const effectiveAccountName = link?.accountName ?? trade.accountName ?? "Unassigned";
                const effectiveAccountType = link?.accountType ?? trade.accountType ?? "broker";
                const displayPnl =
                  trade.status === "Open" ? trade.floatingPnl ?? 0 : trade.pnl;
                const positive = displayPnl >= 0;
                const tnpaGrade = evaluateTnpaGrade(trade, tnpaPlaybookIntelligence[trade.id]);

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
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          String(trade.source ?? "mt5") === "manual"
                            ? "bg-sky-400/10 text-sky-300"
                            : "bg-amber-400/10 text-amber-200"
                        }`}
                      >
                        {String(trade.source ?? "mt5") === "manual" ? "Manual" : "MT5"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-100">
                        {effectiveAccountName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {optionLabel(effectiveAccountType)}
                        {link ? " / linked" : ""}
                      </div>
                    </td>
                    <td className="px-5 py-4">{trade.strategyType ?? "Swing"}</td>
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
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${gradeTone(tnpaGrade.grade)}`}>
                          {tnpaGrade.grade}
                        </span>
                        <span className="text-xs text-slate-500">{tnpaGrade.score}/100</span>
                      </div>
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
          accountLinkOptions={accountLinkOptions}
          key={selectedTrade.id}
          tnpaPlaybookIntelligence={tnpaPlaybookIntelligence}
          tradeAccountLinks={tradeAccountLinks}
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      ) : null}
      {creatingTrade ? (
        <CreateTradeDrawer
          accountLinkOptions={accountLinkOptions}
          defaultAccountName={activeRegistryAccountName || undefined}
          defaultAccountType={scopeAccountType}
          lockedAccountLinkValue={lockedCreateAccountLinkValue}
          onClose={() => setCreatingTrade(false)}
        />
      ) : null}
    </AppShell>
  );
}
