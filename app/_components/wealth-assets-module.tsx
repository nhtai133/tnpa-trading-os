"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { useHydrated } from "@/app/_lib/use-hydrated";
import {
  isArchiveReason,
  readStoredWealthAssets,
  subscribeToWealthAssets,
  writeWealthAssets,
} from "@/app/_lib/wealth-storage";
import {
  archiveReasons,
  assetClasses,
  currencies,
  institutions,
  type ArchiveReason,
  type AssetClass,
  type Currency,
  type Institution,
  type WealthAsset,
} from "@/app/_lib/wealth-types";

type AssetDraft = {
  id?: string;
  name: string;
  assetClass: AssetClass;
  institution: Institution;
  currency: Currency;
  currentValue: string;
  costBasis: string;
  notes: string;
};

type ConfirmState =
  | { type: "archive"; asset: WealthAsset; reason: ArchiveReason }
  | { type: "save"; before: WealthAsset; after: WealthAsset }
  | null;

const emptyAssets: WealthAsset[] = [];
const primaryAssetClasses: AssetClass[] = [
  "Crypto",
  "Stocks",
  "ETF",
  "Mutual Fund",
  "Real Estate",
  "Loan",
  "Vehicle",
  "Cash",
  "Other",
];

function formatMoney(value: number, currency: string) {
  const sign = value >= 0 ? "" : "-";
  const prefix = currency === "VND" ? "VND " : currency === "USDC" ? "USDC " : "$";

  return `${sign}${prefix}${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function draftForAsset(asset?: WealthAsset, defaultAssetClass: AssetClass = "Other"): AssetDraft {
  return {
    id: asset?.id,
    name: asset?.name ?? "",
    assetClass: asset?.assetClass ?? defaultAssetClass,
    institution: asset?.institution ?? "Other",
    currency: asset?.currency ?? "VND",
    currentValue: asset ? String(asset.currentValue) : "",
    costBasis: asset?.costBasis === undefined ? "" : String(asset.costBasis),
    notes: asset?.notes ?? "",
  };
}

function assetSummary(asset: WealthAsset) {
  return [
    { label: "Name", value: asset.name },
    { label: "Type", value: asset.assetClass },
    { label: "Institution", value: asset.institution },
    { label: "Value", value: formatMoney(asset.currentValue, asset.currency) },
  ];
}

function statusClass(status: WealthAsset["status"]) {
  return status === "Active"
    ? "bg-emerald-400/10 text-emerald-300"
    : "bg-slate-400/10 text-slate-300";
}

function HydrationPlaceholder({ title }: { title: string }) {
  return (
    <AppShell eyebrow="Wealth" title={title}>
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <div className="h-4 w-44 rounded bg-white/[0.06]" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2].map((item) => (
            <div className="h-24 rounded-md border border-white/10 bg-white/[0.03]" key={item} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

export function WealthAssetsModule({
  defaultAssetClass = "Other",
  title = "Portfolio",
}: {
  defaultAssetClass?: AssetClass;
  title?: string;
}) {
  const assets = useSyncExternalStore(
    subscribeToWealthAssets,
    readStoredWealthAssets,
    () => emptyAssets,
  );
  const [draft, setDraft] = useState<AssetDraft>(() => draftForAsset(undefined, defaultAssetClass));
  const [isOpen, setIsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [error, setError] = useState("");
  const mounted = useHydrated();

  const activeAssets = useMemo(() => assets.filter((asset) => asset.status !== "Archived"), [assets]);
  const archivedAssets = useMemo(() => assets.filter((asset) => asset.status === "Archived"), [assets]);
  const totalValue = activeAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const actionDisabled = Boolean(confirmState);

  function openCreate() {
    setDraft(draftForAsset(undefined, defaultAssetClass));
    setError("");
    setIsOpen(true);
  }

  function openEdit(asset: WealthAsset) {
    setDraft(draftForAsset(asset, defaultAssetClass));
    setError("");
    setIsOpen(true);
  }

  function buildValidatedAsset() {
    if (!draft.name.trim()) {
      setError("Asset Name is required.");
      return null;
    }

    const currentValue = Number(draft.currentValue);
    if (!Number.isFinite(currentValue)) {
      setError("Current Value must be a number.");
      return null;
    }

    const costBasis = draft.costBasis.trim() ? Number(draft.costBasis) : undefined;
    if (costBasis !== undefined && !Number.isFinite(costBasis)) {
      setError("Cost Basis must be a number.");
      return null;
    }

    return {
      id: draft.id ?? `ASSET-${assets.length + 1}-${draft.name.trim().replace(/\s+/g, "-").toUpperCase()}`,
      name: draft.name.trim(),
      assetClass: draft.assetClass,
      institution: draft.institution,
      currency: draft.currency,
      currentValue,
      costBasis,
      notes: draft.notes.trim() || undefined,
      status: "Active" as const,
    } satisfies WealthAsset;
  }

  function submitDraft() {
    const nextAsset = buildValidatedAsset();
    if (!nextAsset) return;

    if (!draft.id) {
      writeWealthAssets([nextAsset, ...assets]);
      setIsOpen(false);
      return;
    }

    const before = assets.find((asset) => asset.id === draft.id);
    if (!before) {
      setError("The asset no longer exists.");
      return;
    }

    setConfirmState({
      type: "save",
      before,
      after: {
        ...before,
        ...nextAsset,
        status: before.status,
        archiveReason: before.archiveReason,
        archivedAt: before.archivedAt,
      },
    });
  }

  function applySave() {
    if (!confirmState || confirmState.type !== "save") return;

    writeWealthAssets(
      assets.map((asset) => (asset.id === confirmState.before.id ? confirmState.after : asset)),
    );
    setConfirmState(null);
    setIsOpen(false);
  }

  function applyArchive() {
    if (!confirmState || confirmState.type !== "archive") return;

    writeWealthAssets(
      assets.map((asset) =>
        asset.id === confirmState.asset.id
          ? {
              ...asset,
              status: "Archived",
              archiveReason: confirmState.reason,
              archivedAt: new Date().toISOString(),
            }
          : asset,
      ),
    );
    setConfirmState(null);
  }

  if (!mounted) {
    return <HydrationPlaceholder title={title} />;
  }

  return (
    <AppShell
      eyebrow="Wealth"
      title={title}
      action={
        <button
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={actionDisabled}
          onClick={openCreate}
          type="button"
        >
          Add Asset
        </button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Active Assets</div>
          <div className="mt-3 text-2xl font-semibold text-white">{activeAssets.length}</div>
        </section>
        <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Archived</div>
          <div className="mt-3 text-2xl font-semibold text-white">{archivedAssets.length}</div>
        </section>
        <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Active Value</div>
          <div className="mt-3 text-2xl font-semibold text-white">{formatMoney(totalValue, "VND")}</div>
        </section>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <h2 className="text-base font-semibold text-white">Active Wealth Assets</h2>
            <p className="mt-1 text-sm text-slate-500">
              Crypto, stocks, ETF, mutual fund, real estate, loan, vehicle, cash, and other holdings.
            </p>
          </div>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
            onClick={() => setShowArchived((value) => !value)}
            type="button"
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Asset</th>
                <th className="px-5 py-4 font-semibold">Type</th>
                <th className="px-5 py-4 font-semibold">Institution</th>
                <th className="px-5 py-4 font-semibold">Currency</th>
                <th className="px-5 py-4 font-semibold">Current Value</th>
                <th className="px-5 py-4 font-semibold">Cost Basis</th>
                <th className="px-5 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {activeAssets.length ? (
                activeAssets.map((asset) => (
                  <tr className="text-slate-300" key={asset.id}>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{asset.name}</div>
                      {asset.notes ? <div className="mt-1 text-xs text-slate-500">{asset.notes}</div> : null}
                    </td>
                    <td className="px-5 py-4">{asset.assetClass}</td>
                    <td className="px-5 py-4">{asset.institution}</td>
                    <td className="px-5 py-4">{asset.currency}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-300">
                      {formatMoney(asset.currentValue, asset.currency)}
                    </td>
                    <td className="px-5 py-4">
                      {asset.costBasis === undefined ? "-" : formatMoney(asset.costBasis, asset.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                          disabled={actionDisabled}
                          onClick={() => openEdit(asset)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/40 hover:text-rose-100"
                          disabled={actionDisabled}
                          onClick={() => setConfirmState({ type: "archive", asset, reason: "No Longer Used" })}
                          type="button"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-8 text-slate-500" colSpan={8}>
                    No active wealth assets saved yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showArchived ? (
        <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-base font-semibold text-white">Archived Wealth Assets</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Asset</th>
                  <th className="px-5 py-4 font-semibold">Type</th>
                  <th className="px-5 py-4 font-semibold">Value</th>
                  <th className="px-5 py-4 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {archivedAssets.length ? (
                  archivedAssets.map((asset) => (
                    <tr className="text-slate-300" key={asset.id}>
                      <td className="px-5 py-4 font-semibold text-white">{asset.name}</td>
                      <td className="px-5 py-4">{asset.assetClass}</td>
                      <td className="px-5 py-4">{formatMoney(asset.currentValue, asset.currency)}</td>
                      <td className="px-5 py-4">{asset.archiveReason ?? "Other"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-8 text-slate-500" colSpan={4}>
                      No archived wealth assets.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            aria-label="Close wealth asset drawer"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Wealth Asset</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {draft.id ? "Edit Asset" : "Add Asset"}
                </h2>
              </div>
              <button
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300"
                onClick={() => setIsOpen(false)}
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
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Asset Name</span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Asset Type</span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.assetClass}
                  onChange={(event) => setDraft((current) => ({ ...current, assetClass: event.target.value as AssetClass }))}
                >
                  {primaryAssetClasses.map((assetClass) => (
                    <option key={assetClass} value={assetClass}>{assetClass}</option>
                  ))}
                  {assetClasses
                    .filter((assetClass) => !primaryAssetClasses.includes(assetClass))
                    .map((assetClass) => (
                      <option key={assetClass} value={assetClass}>{assetClass}</option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Institution</span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.institution}
                  onChange={(event) => setDraft((current) => ({ ...current, institution: event.target.value as Institution }))}
                >
                  {institutions.map((institution) => (
                    <option key={institution} value={institution}>{institution}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Currency</span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.currency}
                  onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value as Currency }))}
                >
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current Value</span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  inputMode="decimal"
                  value={draft.currentValue}
                  onChange={(event) => setDraft((current) => ({ ...current, currentValue: event.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cost Basis</span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  inputMode="decimal"
                  value={draft.costBasis}
                  onChange={(event) => setDraft((current) => ({ ...current, costBasis: event.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Notes</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                onClick={submitDraft}
                type="button"
              >
                {draft.id ? "Save Changes" : "Save Asset"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-md border border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            {confirmState.type === "archive" ? (
              <>
                <h3 className="text-xl font-semibold text-white">Archive this wealth asset?</h3>
                <div className="mt-5 rounded-md border border-white/10 bg-white/[0.03] p-4">
                  {assetSummary(confirmState.asset).map((row) => (
                    <div className="flex items-center justify-between gap-4 py-2 text-sm" key={row.label}>
                      <span className="text-slate-500">{row.label}</span>
                      <span className="font-semibold text-slate-100">{row.value}</span>
                    </div>
                  ))}
                </div>
                <label className="mt-5 block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Archive Reason</span>
                  <select
                    className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                    value={confirmState.reason}
                    onChange={(event) =>
                      setConfirmState((current) =>
                        current && current.type === "archive"
                          ? {
                              ...current,
                              reason: isArchiveReason(event.target.value)
                                ? event.target.value
                                : current.reason,
                            }
                          : current,
                      )
                    }
                  >
                    {archiveReasons.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </label>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                    onClick={() => setConfirmState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300"
                    onClick={applyArchive}
                    type="button"
                  >
                    Archive Asset
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-white">Save changes to this asset?</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[confirmState.before, confirmState.after].map((asset, index) => (
                    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4" key={index === 0 ? "before" : "after"}>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {index === 0 ? "Before" : "After"}
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        {assetSummary(asset).map((row) => (
                          <div className="flex items-center justify-between gap-4" key={row.label}>
                            <span className="text-slate-500">{row.label}</span>
                            <span className="font-semibold text-slate-100">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white"
                    onClick={() => setConfirmState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                    onClick={applySave}
                    type="button"
                  >
                    Save Changes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
