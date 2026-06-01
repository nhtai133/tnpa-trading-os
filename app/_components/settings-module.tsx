"use client";

import { useState } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  defaultRiskSettings,
  writeRiskSettings,
} from "@/app/_lib/risk-settings-storage";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import type { RiskSettings } from "@/app/_lib/trading-types";

export function SettingsModule() {
  const settings = useRiskSettings();
  const [draft, setDraft] = useState<RiskSettings | null>(null);
  const activeSettings = draft ?? settings;

  function updateField(key: keyof RiskSettings, value: string) {
    setDraft((current) => ({
      ...(current ?? settings),
      [key]: Number(value),
    }));
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
    </AppShell>
  );
}
