"use client";

import { useState } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  resetTnpaTradingData,
  tradingStorageKeys,
} from "@/app/_lib/trading-data-migration";
import {
  defaultRiskSettings,
  writeRiskSettings,
} from "@/app/_lib/risk-settings-storage";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import type { RiskSettings } from "@/app/_lib/trading-types";

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
  ...tradingStorageKeys,
  "tnpa.risk-settings.v1",
] as const;

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

export function SettingsModule() {
  const settings = useRiskSettings();
  const [draft, setDraft] = useState<RiskSettings | null>(null);
  const [backupError, setBackupError] = useState("");
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [exportBeforeRestore, setExportBeforeRestore] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const activeSettings = draft ?? settings;

  function updateField(key: keyof RiskSettings, value: string) {
    setDraft((current) => ({
      ...(current ?? settings),
      [key]: Number(value),
    }));
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
    });

    setPendingRestore(null);
    setBackupError("");
    window.location.reload();
  }

  function resetTradingData() {
    resetTnpaTradingData();
    window.location.reload();
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
        <h2 className="text-lg font-semibold text-white">Backup & Restore</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Export or restore local TNPA data stored in this browser.
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
              Downloads one JSON file containing supported TNPA storage keys.
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
      </section>

      <section className="mt-6 rounded-md border border-rose-300/20 bg-rose-400/10 p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-white">Reset TNPA Trading Data</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-100/80">
          Clears prop accounts, MT5 imports, trades, setup tags, playbooks, journal entries, review notes, and trade account links from this browser. Risk settings are kept.
        </p>
        <button
          className="mt-6 rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300"
          onClick={() => setConfirmReset(true)}
          type="button"
        >
          Reset TNPA Trading Data
        </button>
      </section>

      {confirmReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-md border border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <h3 className="text-xl font-semibold text-white">Reset TNPA Trading Data?</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This clears local trading data from this browser and reloads the application.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                onClick={() => setConfirmReset(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300"
                onClick={resetTradingData}
                type="button"
              >
                Reset Trading Data
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
