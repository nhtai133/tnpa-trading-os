"use client";

import { useState } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  readStoredBankAccounts,
  writeBankAccounts,
} from "@/app/_lib/bank-account-storage";
import {
  readStoredBrokerAccounts,
  writeBrokerAccounts,
} from "@/app/_lib/broker-account-storage";
import {
  readStoredWealthAssets,
  writeWealthAssets,
} from "@/app/_lib/wealth-storage";
import {
  defaultRiskSettings,
  writeRiskSettings,
} from "@/app/_lib/risk-settings-storage";
import {
  clearDemoFtmoAccounts,
  loadDemoFtmoAccounts,
} from "@/app/_lib/prop-account-storage";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import type { RiskSettings } from "@/app/_lib/trading-types";
import type {
  WealthAccount,
  WealthAsset,
  WealthBrokerAccount,
} from "@/app/_lib/wealth-types";

type ConfirmState =
  | { type: "load" }
  | { type: "clear" }
  | { type: "load-prop" }
  | { type: "clear-prop" }
  | null;

type BackupMetadata = {
  appName: "TNPA Trading OS";
  backupVersion: "1";
  exportedAt: string;
  includedKeys: string[];
};

type TnpaBackup = {
  metadata: BackupMetadata;
  data: Record<string, string | null>;
};

type PendingRestore = {
  backup: TnpaBackup;
  foundKeys: string[];
  selectedKeys: string[];
};

const backupVersion = "1";
const backupAppName = "TNPA Trading OS";

const backupStorageKeys = [
  "tnpa.mt5.import.v1",
  "tnpa.manual-trades.v1",
  "tnpa.trade-journal.v1",
  "tnpa.setup-tags.v1",
  "tnpa.playbooks.v1",
  "tnpa.risk-settings.v1",
  "tnpa.prop-accounts.v1",
  "tnpa.ftmo-payouts.v1",
  "tnpa.personal-trading-accounts.v1",
  "tnpa.personal-withdrawals.v1",
  "tnpa.trade-account-links.v1",
  "tnpa.playbook-intelligence.v1",
  "tnpa.review-notes.v1",
] as const;

const backupStorageEvents: Record<(typeof backupStorageKeys)[number], string> = {
  "tnpa.mt5.import.v1": "tnpa:mt5-import-updated",
  "tnpa.manual-trades.v1": "tnpa:manual-trades-updated",
  "tnpa.trade-journal.v1": "tnpa:trade-journal-updated",
  "tnpa.setup-tags.v1": "tnpa:setup-tags-updated",
  "tnpa.playbooks.v1": "tnpa:playbooks-updated",
  "tnpa.risk-settings.v1": "tnpa:risk-settings-updated",
  "tnpa.prop-accounts.v1": "tnpa:prop-accounts-updated",
  "tnpa.ftmo-payouts.v1": "tnpa:ftmo-payouts-updated",
  "tnpa.personal-trading-accounts.v1": "tnpa:personal-trading-accounts-updated",
  "tnpa.personal-withdrawals.v1": "tnpa:personal-withdrawals-updated",
  "tnpa.trade-account-links.v1": "tnpa:trade-account-links-updated",
  "tnpa.playbook-intelligence.v1": "tnpa:playbook-intelligence-updated",
  "tnpa.review-notes.v1": "tnpa:review-notes-updated",
};

function backupFileName(date = new Date()) {
  return `tnpa-trading-os-backup-${date.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
}

function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createBackup(): TnpaBackup {
  const data = Object.fromEntries(
    backupStorageKeys.map((key) => [key, window.localStorage.getItem(key)]),
  ) as Record<string, string | null>;

  return {
    metadata: {
      appName: backupAppName,
      backupVersion,
      exportedAt: new Date().toISOString(),
      includedKeys: [...backupStorageKeys],
    },
    data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateBackup(value: unknown): TnpaBackup | null {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.data)) {
    return null;
  }

  const metadata = value.metadata;
  if (
    metadata.appName !== backupAppName ||
    metadata.backupVersion !== backupVersion ||
    typeof metadata.exportedAt !== "string" ||
    !Array.isArray(metadata.includedKeys)
  ) {
    return null;
  }

  const dataEntries = Object.entries(value.data).filter(([key, raw]) => {
    return (
      backupStorageKeys.includes(key as (typeof backupStorageKeys)[number]) &&
      (typeof raw === "string" || raw === null)
    );
  });

  return {
    metadata: {
      appName: backupAppName,
      backupVersion,
      exportedAt: metadata.exportedAt,
      includedKeys: metadata.includedKeys.filter((key): key is string => typeof key === "string"),
    },
    data: Object.fromEntries(dataEntries) as Record<string, string | null>,
  };
}

function dispatchBackupKeyEvent(key: (typeof backupStorageKeys)[number]) {
  window.dispatchEvent(new Event(backupStorageEvents[key]));
}

const demoBankAccountIds = [
  "DEMO-BANK-TECHCOMBANK-MAIN-CASH",
  "DEMO-BANK-TPBANK-RESERVE-FUND",
];

const demoBrokerAccountIds = [
  "DEMO-BROKER-VCBS-LONG-TERM",
  "DEMO-BROKER-TCBS-RETIREMENT",
];

const demoAssetIds = [
  "DEMO-ASSET-USDC-TREASURY",
  "DEMO-ASSET-NHA-TRANG-LAND",
];

const demoBankAccounts: WealthAccount[] = [
  {
    id: demoBankAccountIds[0],
    name: "Techcombank Main Cash",
    institution: "Techcombank",
    currency: "VND",
    balance: 260000000,
    status: "Active",
    accountType: "Bank",
  },
  {
    id: demoBankAccountIds[1],
    name: "TPBank Reserve Fund",
    institution: "TPBank",
    currency: "VND",
    balance: 120000000,
    status: "Active",
    accountType: "Bank",
  },
];

const demoBrokerAccounts: WealthBrokerAccount[] = [
  {
    id: demoBrokerAccountIds[0],
    broker: "VCBS",
    name: "VCBS Long-Term",
    currency: "VND",
    cashBalance: 260000000,
    stockMarketValue: 135000000,
    fundEtfValue: 85000000,
    totalEquity: 480000000,
    portfolioType: "Long-Term Stock Portfolio",
    status: "Active",
  },
  {
    id: demoBrokerAccountIds[1],
    broker: "TCBS",
    name: "TCBS Retirement",
    currency: "VND",
    cashBalance: 50000000,
    stockMarketValue: 300000000,
    fundEtfValue: 100000000,
    totalEquity: 450000000,
    portfolioType: "Retirement Stock Portfolio 5%",
    status: "Active",
  },
];

const demoAssets: WealthAsset[] = [
  {
    id: demoAssetIds[0],
    name: "USDC Treasury",
    assetClass: "USDC",
    institution: "Binance",
    currency: "USD",
    currentValue: 130000,
    status: "Active",
  },
  {
    id: demoAssetIds[1],
    name: "Nha Trang Land",
    assetClass: "Real Estate",
    institution: "Other",
    currency: "VND",
    currentValue: 2500000000,
    status: "Active",
  },
];

export function SettingsModule() {
  const settings = useRiskSettings();
  const [draft, setDraft] = useState<RiskSettings | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [exportBeforeRestore, setExportBeforeRestore] = useState(true);
  const activeSettings = draft ?? settings;

  function updateField(key: keyof RiskSettings, value: string) {
    setDraft((current) => ({
      ...(current ?? settings),
      [key]: Number(value),
    }));
  }

  function loadDemoData() {
    const currentBankAccounts = readStoredBankAccounts();
    const currentBrokerAccounts = readStoredBrokerAccounts();
    const currentAssets = readStoredWealthAssets();

    writeBankAccounts([
      ...currentBankAccounts.filter((account) => !demoBankAccountIds.includes(account.id)),
      ...demoBankAccounts,
    ]);
    writeBrokerAccounts([
      ...currentBrokerAccounts.filter((account) => !demoBrokerAccountIds.includes(account.id)),
      ...demoBrokerAccounts,
    ]);
    writeWealthAssets([
      ...currentAssets.filter((asset) => !demoAssetIds.includes(asset.id)),
      ...demoAssets,
    ]);
  }

  function clearDemoData() {
    const currentBankAccounts = readStoredBankAccounts();
    const currentBrokerAccounts = readStoredBrokerAccounts();
    const currentAssets = readStoredWealthAssets();

    writeBankAccounts(
      currentBankAccounts.filter((account) => !demoBankAccountIds.includes(account.id)),
    );
    writeBrokerAccounts(
      currentBrokerAccounts.filter((account) => !demoBrokerAccountIds.includes(account.id)),
    );
    writeWealthAssets(currentAssets.filter((asset) => !demoAssetIds.includes(asset.id)));
  }

  function exportBackup() {
    setBackupError("");
    downloadJsonFile(backupFileName(), createBackup());
  }

  function handleBackupFile(file: File | undefined) {
    setBackupError("");
    setPendingRestore(null);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed = JSON.parse(text) as unknown;
        const backup = validateBackup(parsed);

        if (!backup) {
          setBackupError("Invalid TNPA backup file.");
          return;
        }

        const foundKeys = backupStorageKeys.filter((key) => typeof backup.data[key] === "string");
        if (!foundKeys.length) {
          setBackupError("Backup file does not contain any supported TNPA keys.");
          return;
        }

        setPendingRestore({
          backup,
          foundKeys,
          selectedKeys: foundKeys,
        });
      } catch {
        setBackupError("Backup file must be valid JSON.");
      }
    };
    reader.onerror = () => setBackupError("Unable to read backup file.");
    reader.readAsText(file);
  }

  function toggleRestoreKey(key: string) {
    setPendingRestore((current) => {
      if (!current) return current;

      const selectedKeys = current.selectedKeys.includes(key)
        ? current.selectedKeys.filter((item) => item !== key)
        : [...current.selectedKeys, key];

      return { ...current, selectedKeys };
    });
  }

  function restoreSelectedKeys() {
    if (!pendingRestore || !pendingRestore.selectedKeys.length) return;

    if (exportBeforeRestore) {
      downloadJsonFile(backupFileName(new Date()), createBackup());
    }

    pendingRestore.selectedKeys.forEach((key) => {
      const raw = pendingRestore.backup.data[key];
      if (typeof raw !== "string") return;

      window.localStorage.setItem(key, raw);
      dispatchBackupKeyEvent(key as (typeof backupStorageKeys)[number]);
    });

    setPendingRestore(null);
    setBackupError("");
  }

  return (
    <AppShell eyebrow="Workspace Controls" title="Settings">
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-white">FTMO Risk Rules</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Configure the FTMO risk limits used by Dashboard and Risk Monitor.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["dailyLossLimitPercent", "Daily Loss Limit"],
            ["maxLossLimitPercent", "Max Loss Limit"],
            ["profitTargetPercent", "Profit Target"],
          ].map(([key, label]) => (
            <label className="block" key={key}>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {label}
              </span>
              <div className="flex items-center rounded-md border border-white/10 bg-[#090d15] focus-within:border-emerald-300/50">
                <input
                  className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-100 outline-none"
                  min="1"
                  max="100"
                  step="0.1"
                  type="number"
                  value={activeSettings[key as keyof RiskSettings]}
                  onChange={(event) =>
                    updateField(key as keyof RiskSettings, event.target.value)
                  }
                />
                <span className="px-3 text-sm font-semibold text-slate-500">%</span>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            onClick={() => {
              writeRiskSettings(activeSettings);
              setDraft(null);
            }}
            type="button"
          >
            Save Risk Rules
          </button>
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
            onClick={() => {
              setDraft(null);
              writeRiskSettings(defaultRiskSettings);
            }}
            type="button"
          >
          Reset FTMO Defaults
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-white">Demo FTMO Accounts</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Load the FTMO account registry used by FTMO Dashboard, Challenges, Funded, Risk, Import, Trades, and Analytics.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApplying}
            onClick={() => setConfirmState({ type: "load-prop" })}
            type="button"
          >
            Load Demo FTMO Accounts
          </button>
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApplying}
            onClick={() => setConfirmState({ type: "clear-prop" })}
            type="button"
          >
            Clear Demo FTMO Accounts
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-white">Backup & Restore</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Export or restore local TNPA trading data stored in this browser.
        </p>

        {backupError ? (
          <div className="mt-5 rounded-md border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-semibold text-rose-200">
            {backupError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white">Export Backup</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Downloads one JSON file containing every supported TNPA storage key.
            </p>
            <button
              className="mt-4 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              onClick={exportBackup}
              type="button"
            >
              Export Backup
            </button>
          </div>

          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white">Import Backup</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Select a TNPA backup JSON file. Restore requires confirmation before any key is overwritten.
            </p>
            <label className="mt-4 inline-flex cursor-pointer rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white">
              Select Backup File
              <input
                className="hidden"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  handleBackupFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold text-white">Supported Keys</h3>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {backupStorageKeys.map((key) => (
              <div className="rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-xs font-semibold text-slate-300" key={key}>
                {key}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-white">Demo Wealth Data</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Demo data only. Do not use for real portfolio.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApplying}
            onClick={() => setConfirmState({ type: "load" })}
            type="button"
          >
            Load Demo Wealth Data
          </button>
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApplying}
            onClick={() => setConfirmState({ type: "clear" })}
            type="button"
          >
            Clear Demo Wealth Data
          </button>
        </div>
      </section>

      {confirmState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-md border border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <h3 className="text-xl font-semibold text-white">
              {confirmState.type === "load" || confirmState.type === "load-prop"
                ? "Load Demo Data?"
                : "Clear Demo Data?"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Demo data only. Do not use for real portfolio.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isApplying}
                onClick={() => setConfirmState(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isApplying}
                onClick={() => {
                  setIsApplying(true);
                  if (confirmState.type === "load") {
                    loadDemoData();
                  } else if (confirmState.type === "clear") {
                    clearDemoData();
                  } else if (confirmState.type === "load-prop") {
                    loadDemoFtmoAccounts();
                  } else {
                    clearDemoFtmoAccounts();
                  }
                  setIsApplying(false);
                  setConfirmState(null);
                }}
                type="button"
              >
                {confirmState.type === "load" || confirmState.type === "load-prop"
                  ? "Load Demo Data"
                  : "Clear Demo Data"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRestore ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <h3 className="text-xl font-semibold text-white">Restore Backup?</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Backup exported at {pendingRestore.backup.metadata.exportedAt}. Select the keys to restore before confirming.
            </p>

            <div className="mt-5 grid gap-2">
              {pendingRestore.foundKeys.map((key) => (
                <label
                  className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3"
                  key={key}
                >
                  <span className="text-sm font-semibold text-slate-200">{key}</span>
                  <input
                    checked={pendingRestore.selectedKeys.includes(key)}
                    className="h-4 w-4 accent-emerald-400"
                    onChange={() => toggleRestoreKey(key)}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              <input
                checked={exportBeforeRestore}
                className="h-4 w-4 accent-emerald-400"
                onChange={(event) => setExportBeforeRestore(event.target.checked)}
                type="checkbox"
              />
              Export current data before restore
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                onClick={() => setPendingRestore(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!pendingRestore.selectedKeys.length}
                onClick={restoreSelectedKeys}
                type="button"
              >
                Restore Selected Keys
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
