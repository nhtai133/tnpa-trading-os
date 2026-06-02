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
  clearDemoPropAccounts,
  loadDemoPropAccounts,
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

  return (
    <AppShell eyebrow="Workspace Controls" title="Settings">
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-white">FTMO Risk Rules</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Configure the prop-firm risk limits used by Dashboard and Risk Monitor.
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
        <h2 className="text-lg font-semibold text-white">Demo Prop Accounts</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Load the FTMO-style registry used by Prop Dashboard, Challenges, Funded Accounts, Risk, Import, Trades, and Analytics.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApplying}
            onClick={() => setConfirmState({ type: "load-prop" })}
            type="button"
          >
            Load Demo Prop Accounts
          </button>
          <button
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApplying}
            onClick={() => setConfirmState({ type: "clear-prop" })}
            type="button"
          >
            Clear Demo Prop Accounts
          </button>
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
                    loadDemoPropAccounts();
                  } else {
                    clearDemoPropAccounts();
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
    </AppShell>
  );
}
