"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  readStoredMt5Report,
  subscribeToStoredMt5Report,
  writeStoredMt5Report,
} from "@/app/_lib/mt5-local-storage";
import { parseMt5ReportHtml } from "@/app/_lib/mt5-parser-core";
import type {
  AccountType,
  ChallengeType,
  Mt5AccountReport,
  PropAccountStatus,
  PropFirmName,
  PropPhase,
  StrategyType,
} from "@/app/_lib/trading-types";
import {
  accountTypeLabel,
  accountTypes,
  brokerAccountNames,
  challengeTypes,
  propAccountStatuses,
  propFirmAccountNames,
  propFirmNames,
  propPhases,
  strategyTypes,
} from "@/app/_lib/trading-types";

type ImportState = "idle" | "parsing" | "success" | "error";

function money(value: number) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

function decodeFileBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }

  return new TextDecoder("utf-8").decode(buffer);
}

function accountNameOptions(accountType: AccountType) {
  return accountType === "prop-firm" ? [...propFirmAccountNames] : [...brokerAccountNames];
}

function assignAccountToReport({
  accountName,
  accountType,
  accountSize,
  challengeType,
  dailyLossLimitPercent,
  firmName,
  maxLossLimitPercent,
  minimumTradingDays,
  phase,
  profitTargetPercent,
  propStatus,
  report,
  startDate,
  strategyType,
}: {
  accountName: string;
  accountType: AccountType;
  accountSize: number;
  challengeType: ChallengeType;
  dailyLossLimitPercent: number;
  firmName: PropFirmName;
  maxLossLimitPercent: number;
  minimumTradingDays: number;
  phase: PropPhase;
  profitTargetPercent: number;
  propStatus: PropAccountStatus;
  report: Mt5AccountReport;
  startDate: string;
  strategyType: StrategyType;
}): Mt5AccountReport {
  const isPropFirm = accountType === "prop-firm";

  return {
    ...report,
    accountType,
    accountName,
    strategyType,
    firmName: isPropFirm ? firmName : undefined,
    accountSize: isPropFirm ? accountSize : undefined,
    challengeType: isPropFirm ? challengeType : undefined,
    phase: isPropFirm ? phase : undefined,
    profitTargetPercent: isPropFirm ? profitTargetPercent : undefined,
    dailyLossLimitPercent: isPropFirm ? dailyLossLimitPercent : undefined,
    maxLossLimitPercent: isPropFirm ? maxLossLimitPercent : undefined,
    minimumTradingDays: isPropFirm ? minimumTradingDays : undefined,
    startDate: isPropFirm ? startDate : undefined,
    propStatus: isPropFirm ? propStatus : undefined,
    trades: report.trades.map((trade) => ({
      ...trade,
      source: "mt5",
      accountType,
      accountName,
      strategyType,
      firmName: isPropFirm ? firmName : undefined,
      accountSize: isPropFirm ? accountSize : undefined,
      challengeType: isPropFirm ? challengeType : undefined,
      phase: isPropFirm ? phase : undefined,
      profitTargetPercent: isPropFirm ? profitTargetPercent : undefined,
      dailyLossLimitPercent: isPropFirm ? dailyLossLimitPercent : undefined,
      maxLossLimitPercent: isPropFirm ? maxLossLimitPercent : undefined,
      minimumTradingDays: isPropFirm ? minimumTradingDays : undefined,
      startDate: isPropFirm ? startDate : undefined,
      propStatus: isPropFirm ? propStatus : undefined,
    })),
  };
}

export function ImportMt5Module({
  defaultAccountType,
  eyebrow = "Broker Sync",
  initialReport,
  lockAccountType = false,
  requirePropMetadata = false,
  title = "Import MT5",
}: {
  defaultAccountType?: AccountType;
  eyebrow?: string;
  initialReport: Mt5AccountReport | null;
  lockAccountType?: boolean;
  requirePropMetadata?: boolean;
  title?: string;
}) {
  const storedReport = useSyncExternalStore(
    subscribeToStoredMt5Report,
    readStoredMt5Report,
    () => null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedReport, setUploadedReport] = useState<Mt5AccountReport | null>(
    null,
  );
  const report = uploadedReport ?? storedReport ?? initialReport;
  const [selectedFileName, setSelectedFileName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>(
    defaultAccountType ?? report?.accountType ?? "prop-firm",
  );
  const [accountName, setAccountName] = useState(
    defaultAccountType === "prop-firm" ? "FTMO" : report?.accountName ?? "FTMO",
  );
  const [strategyType, setStrategyType] = useState<StrategyType>(
    defaultAccountType === "prop-firm" ? "Intraweek" : report?.strategyType ?? "Intraweek",
  );
  const [firmName, setFirmName] = useState<PropFirmName>(
    defaultAccountType === "prop-firm" ? "FTMO" : report?.firmName ?? "FTMO",
  );
  const [accountSize, setAccountSize] = useState(
    String(defaultAccountType === "prop-firm" ? 100000 : report?.accountSize ?? 100000),
  );
  const [challengeType, setChallengeType] = useState<ChallengeType>(
    defaultAccountType === "prop-firm" ? "2-Step Challenge" : report?.challengeType ?? "2-Step Challenge",
  );
  const [phase, setPhase] = useState<PropPhase>(
    defaultAccountType === "prop-firm" ? "Phase 1" : report?.phase ?? "Phase 1",
  );
  const [profitTargetPercent, setProfitTargetPercent] = useState(
    String(defaultAccountType === "prop-firm" ? 10 : report?.profitTargetPercent ?? 10),
  );
  const [dailyLossLimitPercent, setDailyLossLimitPercent] = useState(
    String(defaultAccountType === "prop-firm" ? 5 : report?.dailyLossLimitPercent ?? 5),
  );
  const [maxLossLimitPercent, setMaxLossLimitPercent] = useState(
    String(defaultAccountType === "prop-firm" ? 10 : report?.maxLossLimitPercent ?? 10),
  );
  const [minimumTradingDays, setMinimumTradingDays] = useState(
    String(defaultAccountType === "prop-firm" ? 4 : report?.minimumTradingDays ?? 4),
  );
  const [startDate, setStartDate] = useState(
    defaultAccountType === "prop-firm" ? "" : report?.startDate ?? "",
  );
  const [propStatus, setPropStatus] = useState<PropAccountStatus>(
    defaultAccountType === "prop-firm" ? "Active" : report?.propStatus ?? "Active",
  );
  const [status, setStatus] = useState<ImportState>(
    report ? "success" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const displayStatus = status === "idle" && report ? "success" : status;

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function parseSelectedFile(file: File | undefined) {
    if (!file) {
      return;
    }

    console.log("[TNPA MT5 Import] file selected", file.name);
    console.log("[TNPA MT5 Import] file size", file.size);

    setSelectedFileName(file.name);
    setStatus("parsing");
    setErrorMessage("");

    if (!file.name.toLowerCase().endsWith(".html")) {
      setStatus("error");
      setErrorMessage("Please select an MT5 HTML report file.");
      return;
    }

    if (!accountName || !strategyType || (accountType === "prop-firm" && (!challengeType || !phase))) {
      setStatus("error");
      setErrorMessage("Account assignment is required before importing.");
      return;
    }

    if (
      requirePropMetadata &&
      accountType === "prop-firm" &&
      (!firmName ||
        !challengeType ||
        !phase ||
        !accountName ||
        !strategyType ||
        !accountSize.trim() ||
        !Number.isFinite(Number(accountSize)) ||
        !profitTargetPercent.trim() ||
        !Number.isFinite(Number(profitTargetPercent)) ||
        !dailyLossLimitPercent.trim() ||
        !Number.isFinite(Number(dailyLossLimitPercent)) ||
        !maxLossLimitPercent.trim() ||
        !Number.isFinite(Number(maxLossLimitPercent)) ||
        !minimumTradingDays.trim() ||
        !Number.isFinite(Number(minimumTradingDays)))
    ) {
      setStatus("error");
      setErrorMessage("Firm name, challenge type, phase, account size, account name, and strategy type are required.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result;

        if (!(result instanceof ArrayBuffer)) {
          throw new Error("The selected file could not be read as binary data.");
        }

        const html = decodeFileBuffer(result);
        const parsedReport = assignAccountToReport({
          accountName,
          accountType,
          accountSize: Number(accountSize),
          challengeType,
          dailyLossLimitPercent: Number(dailyLossLimitPercent),
          firmName,
          maxLossLimitPercent: Number(maxLossLimitPercent),
          minimumTradingDays: Number(minimumTradingDays),
          phase,
          profitTargetPercent: Number(profitTargetPercent),
          propStatus,
          report: parseMt5ReportHtml(html, file.name),
          startDate,
          strategyType,
        });
        console.log(
          "[TNPA MT5 Import] parsed trade count",
          parsedReport.trades.length,
        );
        writeStoredMt5Report(parsedReport);
        setUploadedReport(parsedReport);
        setStatus("success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to parse this MT5 HTML report.";
        console.error("[TNPA MT5 Import] parse failed", error);
        setStatus("error");
        setErrorMessage(message);
      }
    };

    reader.onerror = () => {
      console.error("[TNPA MT5 Import] file read failed", reader.error);
      setStatus("error");
      setErrorMessage("The file could not be read. Try exporting it again from MT5.");
    };

    reader.readAsArrayBuffer(file);
  }

  return (
    <AppShell
      eyebrow={eyebrow}
      title={title}
      action={
        <button
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          onClick={openFilePicker}
          type="button"
        >
          Upload Statement
        </button>
      }
    >
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".html,text/html"
        onChange={(event) => parseSelectedFile(event.target.files?.[0])}
      />

      <section
        className={`rounded-md border p-6 shadow-2xl shadow-black/20 transition ${
          isDragging
            ? "border-emerald-300/60 bg-emerald-400/10"
            : "border-white/10 bg-[#0d121c]"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          parseSelectedFile(event.dataTransfer.files[0]);
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              MT5 HTML Statement Upload
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Select or drop an MT5 HTML report. The browser reads it locally,
              parses closed positions, and stores the result in localStorage.
            </p>
          </div>
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
            onClick={openFilePicker}
            type="button"
          >
            Select HTML File
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Account Type
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={accountType}
              disabled={lockAccountType}
              onChange={(event) => {
                const nextType = event.target.value as AccountType;
                setAccountType(nextType);
                setAccountName(nextType === "prop-firm" ? "FTMO" : "ICMarkets");
                setStrategyType(nextType === "prop-firm" ? "Intraweek" : "Swing");
              }}
            >
              {accountTypes.map((option) => (
                <option key={option} value={option}>
                  {accountTypeLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Account Name
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            >
              {accountNameOptions(accountType).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Strategy Type
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={strategyType}
              onChange={(event) => setStrategyType(event.target.value as StrategyType)}
            >
              {strategyTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {accountType === "prop-firm" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Firm Name
              </span>
              <select
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={firmName}
                onChange={(event) => setFirmName(event.target.value as PropFirmName)}
              >
                {propFirmNames.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Account Size
              </span>
              <input
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={accountSize}
                onChange={(event) => setAccountSize(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Challenge Type
              </span>
              <select
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={challengeType}
                onChange={(event) => setChallengeType(event.target.value as ChallengeType)}
              >
                {challengeTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Phase
              </span>
              <select
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={phase}
                onChange={(event) => setPhase(event.target.value as PropPhase)}
              >
                {propPhases.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Status
              </span>
              <select
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={propStatus}
                onChange={(event) => setPropStatus(event.target.value as PropAccountStatus)}
              >
                {propAccountStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {[
              ["Profit Target %", profitTargetPercent, setProfitTargetPercent],
              ["Daily Loss Limit %", dailyLossLimitPercent, setDailyLossLimitPercent],
              ["Max Loss Limit %", maxLossLimitPercent, setMaxLossLimitPercent],
              ["Minimum Trading Days", minimumTradingDays, setMinimumTradingDays],
            ].map(([label, value, setter]) => (
              <label className="block" key={label as string}>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {label as string}
                </span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={value as string}
                  onChange={(event) => (setter as (next: string) => void)(event.target.value)}
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Start Date
              </span>
              <input
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Selected File
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              {selectedFileName || (report ? fileName(report.sourceFile) : "None")}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Status
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              {displayStatus === "parsing"
                ? "Parsing..."
                : displayStatus === "success"
                  ? "Success"
                  : displayStatus === "error"
                    ? "Error"
                    : "Waiting for file"}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Parsed Trades
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              {report?.trades.length ?? 0}
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-md border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-medium text-rose-200">
            {errorMessage}
          </div>
        ) : null}
      </section>

      {report ? (
        <>
          <section className="mt-6 rounded-md border border-emerald-300/20 bg-emerald-400/10 p-5 shadow-2xl shadow-black/20">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Import Complete
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {fileName(report.sourceFile)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Parsed {report.trades.length} closed MT5 positions from account{" "}
              {report.account}. Dashboard, Trades, and Analytics will use this
              localStorage import in the browser.
            </p>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Account Name", report.name],
              ["Trading Account", report.accountName ?? accountName],
              ["Account Type", accountTypeLabel(report.accountType ?? accountType)],
              ["Challenge Type", report.challengeType ?? challengeType],
              ["Phase", report.phase ?? phase],
              ["Strategy Type", report.strategyType ?? strategyType],
              ["Company", report.company],
              ["Generated", report.generatedAt],
              ["Total Trades", report.totalTrades.toLocaleString()],
              ["Balance", money(report.balance)],
              ["Equity", money(report.equity)],
              ["Net Profit", money(report.totalNetProfit)],
              ["Profit Factor", report.profitFactor.toFixed(2)],
              ["Gross Profit", money(report.grossProfit)],
              ["Gross Loss", money(report.grossLoss)],
              ["Long Trades", report.longTrades],
              ["Short Trades", report.shortTrades],
            ].map(([label, value]) => (
              <div
                className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20"
                key={label}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </div>
                <div className="mt-3 text-lg font-semibold text-white">
                  {value}
                </div>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
