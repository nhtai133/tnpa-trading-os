"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  readStoredMt5Report,
  subscribeToStoredMt5Report,
  writeStoredMt5Report,
} from "@/app/_lib/mt5-local-storage";
import { parseMt5ReportHtml } from "@/app/_lib/mt5-parser-core";
import type { AccountType, Mt5AccountReport, StrategyType } from "@/app/_lib/trading-types";
import {
  accountTypes,
  brokerAccountNames,
  propFirmAccountNames,
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
  return accountType === "Prop Firm" ? [...propFirmAccountNames] : [...brokerAccountNames];
}

function assignAccountToReport({
  accountName,
  accountType,
  report,
  strategyType,
}: {
  accountName: string;
  accountType: AccountType;
  report: Mt5AccountReport;
  strategyType: StrategyType;
}): Mt5AccountReport {
  return {
    ...report,
    accountType,
    accountName,
    strategyType,
    trades: report.trades.map((trade) => ({
      ...trade,
      source: "mt5",
      accountType,
      accountName,
      strategyType,
    })),
  };
}

export function ImportMt5Module({
  initialReport,
}: {
  initialReport: Mt5AccountReport | null;
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
    report?.accountType ?? "Prop Firm",
  );
  const [accountName, setAccountName] = useState(
    report?.accountName ?? "FTMO Intraweek",
  );
  const [strategyType, setStrategyType] = useState<StrategyType>(
    report?.strategyType ?? "Intraweek",
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
          report: parseMt5ReportHtml(html, file.name),
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
      eyebrow="Broker Sync"
      title="Import MT5"
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
              onChange={(event) => {
                const nextType = event.target.value as AccountType;
                setAccountType(nextType);
                setAccountName(nextType === "Prop Firm" ? "FTMO Intraweek" : "ICMarkets Swing");
                setStrategyType(nextType === "Prop Firm" ? "Intraweek" : "Swing");
              }}
            >
              {accountTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
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
              ["Account Type", report.accountType ?? accountType],
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
