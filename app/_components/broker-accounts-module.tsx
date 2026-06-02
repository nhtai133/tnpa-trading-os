"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  isBrokerArchiveReason,
  readStoredBrokerAccounts,
  subscribeToBrokerAccounts,
  writeBrokerAccounts,
} from "@/app/_lib/broker-account-storage";
import {
  archiveReasons,
  brokerInstitutions,
  currencies,
  portfolioTypes,
  type ArchiveReason,
  type WealthBrokerAccount,
} from "@/app/_lib/wealth-types";

type BrokerDraft = {
  id?: string;
  broker: WealthBrokerAccount["broker"] | "";
  name: string;
  currency: WealthBrokerAccount["currency"] | "";
  cashBalance: string;
  stockMarketValue: string;
  fundEtfValue: string;
  portfolioType: WealthBrokerAccount["portfolioType"] | "";
};

type ConfirmState =
  | {
      type: "archive";
      account: WealthBrokerAccount;
      reason: ArchiveReason;
    }
  | {
      type: "save";
      before: WealthBrokerAccount;
      after: WealthBrokerAccount;
    }
  | null;

const emptyAccounts: WealthBrokerAccount[] = [];

const initialDraft: BrokerDraft = {
  broker: "VCBS",
  name: "",
  currency: "VND",
  cashBalance: "",
  stockMarketValue: "",
  fundEtfValue: "",
  portfolioType: "Other",
};

function formatMoney(value: number, currency: string) {
  const sign = value >= 0 ? "" : "-";
  const prefix = currency === "VND" ? "VND " : "$";

  return `${sign}${prefix}${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function accountSummary(account: WealthBrokerAccount) {
  return [
    { label: "Broker", value: account.broker },
    { label: "Account Name", value: account.name },
    { label: "Currency", value: account.currency },
    { label: "Cash Balance", value: formatMoney(account.cashBalance, account.currency) },
    {
      label: "Stock Market Value",
      value: formatMoney(account.stockMarketValue, account.currency),
    },
    {
      label: "Fund/ETF Value",
      value: formatMoney(account.fundEtfValue, account.currency),
    },
    { label: "Total Equity", value: formatMoney(account.totalEquity, account.currency) },
    { label: "Portfolio Type", value: account.portfolioType },
  ];
}

function statusBadgeClass(status: WealthBrokerAccount["status"]) {
  return status === "Active"
    ? "bg-emerald-400/10 text-emerald-300"
    : "bg-slate-400/10 text-slate-300";
}

export function BrokerAccountsModule() {
  const accounts = useSyncExternalStore(
    subscribeToBrokerAccounts,
    readStoredBrokerAccounts,
    () => emptyAccounts,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [draft, setDraft] = useState<BrokerDraft>(initialDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status !== "Archived"),
    [accounts],
  );
  const archivedAccounts = useMemo(
    () => accounts.filter((account) => account.status === "Archived"),
    [accounts],
  );
  const activeTotalEquity = useMemo(
    () => activeAccounts.reduce((sum, account) => sum + account.totalEquity, 0),
    [activeAccounts],
  );
  const activeStocksValue = useMemo(
    () =>
      activeAccounts.reduce(
        (sum, account) => sum + account.stockMarketValue + account.fundEtfValue,
        0,
      ),
    [activeAccounts],
  );
  const actionDisabled = isSubmitting || Boolean(confirmState);

  function openCreate() {
    setDraft(initialDraft);
    setError("");
    setIsOpen(true);
  }

  function openEdit(account: WealthBrokerAccount) {
    setDraft({
      id: account.id,
      broker: account.broker,
      name: account.name,
      currency: account.currency,
      cashBalance: String(account.cashBalance),
      stockMarketValue: String(account.stockMarketValue),
      fundEtfValue: String(account.fundEtfValue),
      portfolioType: account.portfolioType,
    });
    setError("");
    setIsOpen(true);
  }

  function buildValidatedAccount() {
    if (!draft.broker) {
      setError("Broker is required.");
      return null;
    }

    if (!draft.name.trim()) {
      setError("Account Name is required.");
      return null;
    }

    if (!draft.currency) {
      setError("Currency is required.");
      return null;
    }

    if (!draft.portfolioType) {
      setError("Portfolio Type is required.");
      return null;
    }

    const cashBalance = Number(draft.cashBalance);
    const stockMarketValue = Number(draft.stockMarketValue);
    const fundEtfValue = Number(draft.fundEtfValue);

    if (
      !Number.isFinite(cashBalance) ||
      !Number.isFinite(stockMarketValue) ||
      !Number.isFinite(fundEtfValue)
    ) {
      setError("All value fields must be numbers.");
      return null;
    }

    return {
      id: draft.id ?? `BROKER-${Date.now()}`,
      broker: draft.broker,
      name: draft.name.trim(),
      currency: draft.currency,
      cashBalance,
      stockMarketValue,
      fundEtfValue,
      totalEquity: cashBalance + stockMarketValue + fundEtfValue,
      portfolioType: draft.portfolioType,
      status: "Active" as const,
    } satisfies WealthBrokerAccount;
  }

  function submitDraft() {
    const nextAccount = buildValidatedAccount();
    if (!nextAccount) {
      return;
    }

    if (!draft.id) {
      setIsSubmitting(true);
      writeBrokerAccounts([nextAccount, ...accounts]);
      setIsSubmitting(false);
      setIsOpen(false);
      return;
    }

    const before = accounts.find((account) => account.id === draft.id);
    if (!before) {
      setError("The account no longer exists.");
      return;
    }

    setConfirmState({
      type: "save",
      before,
      after: {
        ...before,
        ...nextAccount,
        status: before.status,
        archiveReason: before.archiveReason,
        archivedAt: before.archivedAt,
      },
    });
  }

  function requestArchive(account: WealthBrokerAccount) {
    setConfirmState({
      type: "archive",
      account,
      reason: "Closed Account",
    });
  }

  function applyArchive() {
    if (!confirmState || confirmState.type !== "archive") {
      return;
    }

    setIsSubmitting(true);
    writeBrokerAccounts(
      accounts.map((account) =>
        account.id === confirmState.account.id
          ? {
              ...account,
              status: "Archived",
              archiveReason: confirmState.reason,
              archivedAt: new Date().toISOString(),
            }
          : account,
      ),
    );
    setIsSubmitting(false);
    setConfirmState(null);
  }

  function applySave() {
    if (!confirmState || confirmState.type !== "save") {
      return;
    }

    setIsSubmitting(true);
    writeBrokerAccounts(
      accounts.map((account) =>
        account.id === confirmState.before.id ? confirmState.after : account,
      ),
    );
    setIsSubmitting(false);
    setConfirmState(null);
    setIsOpen(false);
  }

  return (
    <AppShell
      eyebrow="Wealth"
      title="Broker Accounts"
      action={
        <button
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={actionDisabled}
          onClick={openCreate}
          type="button"
        >
          Add Broker Account
        </button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Active Accounts</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {activeAccounts.length}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Archived</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {archivedAccounts.length}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Broker Equity</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {formatMoney(activeTotalEquity, "VND")}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium text-slate-400">Stocks Value</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {formatMoney(activeStocksValue, "VND")}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <h2 className="text-base font-semibold text-white">Active Broker Accounts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Broker cash, stock market value, and ETF value roll into net worth.
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
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Broker</th>
                <th className="px-5 py-4 font-semibold">Account Name</th>
                <th className="px-5 py-4 font-semibold">Currency</th>
                <th className="px-5 py-4 font-semibold">Cash Balance</th>
                <th className="px-5 py-4 font-semibold">Stock Market Value</th>
                <th className="px-5 py-4 font-semibold">Fund/ETF Value</th>
                <th className="px-5 py-4 font-semibold">Total Equity</th>
                <th className="px-5 py-4 font-semibold">Portfolio Type</th>
                <th className="px-5 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {activeAccounts.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-slate-500" colSpan={10}>
                    No active broker accounts saved yet.
                  </td>
                </tr>
              ) : (
                activeAccounts.map((account) => (
                  <tr className="text-slate-300" key={account.id}>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                          account.status,
                        )}`}
                      >
                        {account.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {account.broker}
                    </td>
                    <td className="px-5 py-4">{account.name}</td>
                    <td className="px-5 py-4">{account.currency}</td>
                    <td className="px-5 py-4">{formatMoney(account.cashBalance, account.currency)}</td>
                    <td className="px-5 py-4">
                      {formatMoney(account.stockMarketValue, account.currency)}
                    </td>
                    <td className="px-5 py-4">
                      {formatMoney(account.fundEtfValue, account.currency)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-emerald-300">
                      {formatMoney(account.totalEquity, account.currency)}
                    </td>
                    <td className="px-5 py-4">{account.portfolioType}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={actionDisabled}
                          onClick={() => openEdit(account)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/40 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={actionDisabled}
                          onClick={() => requestArchive(account)}
                          type="button"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showArchived ? (
        <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-base font-semibold text-white">Archived Broker Accounts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Archived broker items remain in localStorage and archive history.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Broker</th>
                  <th className="px-5 py-4 font-semibold">Account Name</th>
                  <th className="px-5 py-4 font-semibold">Currency</th>
                  <th className="px-5 py-4 font-semibold">Cash Balance</th>
                  <th className="px-5 py-4 font-semibold">Stock Market Value</th>
                  <th className="px-5 py-4 font-semibold">Fund/ETF Value</th>
                  <th className="px-5 py-4 font-semibold">Total Equity</th>
                  <th className="px-5 py-4 font-semibold">Portfolio Type</th>
                  <th className="px-5 py-4 font-semibold">Archive Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {archivedAccounts.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-slate-500" colSpan={9}>
                      No archived broker accounts.
                    </td>
                  </tr>
                ) : (
                  archivedAccounts.map((account) => (
                    <tr className="text-slate-300" key={account.id}>
                      <td className="px-5 py-4 font-semibold text-white">
                        {account.broker}
                      </td>
                      <td className="px-5 py-4">{account.name}</td>
                      <td className="px-5 py-4">{account.currency}</td>
                      <td className="px-5 py-4">
                        {formatMoney(account.cashBalance, account.currency)}
                      </td>
                      <td className="px-5 py-4">
                        {formatMoney(account.stockMarketValue, account.currency)}
                      </td>
                      <td className="px-5 py-4">
                        {formatMoney(account.fundEtfValue, account.currency)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-300">
                        {formatMoney(account.totalEquity, account.currency)}
                      </td>
                      <td className="px-5 py-4">{account.portfolioType}</td>
                      <td className="px-5 py-4">{account.archiveReason ?? "Other"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            aria-label="Close broker account drawer"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                  Wealth Brokerage
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {draft.id ? "Edit Broker Account" : "Add Broker Account"}
                </h2>
              </div>
              <button
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
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
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Broker
                </span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.broker}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      broker: event.target.value as WealthBrokerAccount["broker"],
                    }))
                  }
                >
                  {brokerInstitutions.map((broker) => (
                    <option key={broker} value={broker}>
                      {broker}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Account Name
                </span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Currency
                </span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      currency: event.target.value as WealthBrokerAccount["currency"],
                    }))
                  }
                >
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Portfolio Type
                </span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={draft.portfolioType}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      portfolioType: event.target.value as WealthBrokerAccount["portfolioType"],
                    }))
                  }
                >
                  {portfolioTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Cash Balance
                </span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  inputMode="decimal"
                  value={draft.cashBalance}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, cashBalance: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Stock Market Value
                </span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  inputMode="decimal"
                  value={draft.stockMarketValue}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      stockMarketValue: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fund/ETF Value
                </span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  inputMode="decimal"
                  value={draft.fundEtfValue}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      fundEtfValue: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Total Equity
                </span>
                <input
                  className="h-11 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-slate-400 outline-none"
                  readOnly
                  value={formatMoney(
                    Number(draft.cashBalance || 0) +
                      Number(draft.stockMarketValue || 0) +
                      Number(draft.fundEtfValue || 0),
                    draft.currency || "VND",
                  )}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={submitDraft}
                type="button"
              >
                {draft.id ? "Save Changes" : "Save Broker Account"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-md border border-white/10 bg-[#0b1019] p-6 shadow-2xl shadow-black">
            {confirmState.type === "archive" ? (
              <>
                <h3 className="text-xl font-semibold text-white">
                  Archive this broker account?
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Select a reason before archiving.
                </p>
                <div className="mt-5 rounded-md border border-white/10 bg-white/[0.03] p-4">
                  {accountSummary(confirmState.account).map((row) => (
                    <div
                      className="flex items-center justify-between gap-4 py-2 text-sm"
                      key={row.label}
                    >
                      <span className="text-slate-500">{row.label}</span>
                      <span className="font-semibold text-slate-100">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <label className="mt-5 block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Archive Reason
                  </span>
                  <select
                    className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                    value={confirmState.reason}
                    onChange={(event) =>
                      setConfirmState((current) =>
                        current && current.type === "archive"
                          ? {
                              ...current,
                              reason: isBrokerArchiveReason(event.target.value)
                                ? event.target.value
                                : current.reason,
                            }
                          : current,
                      )
                    }
                  >
                    {archiveReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={() => setConfirmState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={applyArchive}
                    type="button"
                  >
                    Archive Account
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-white">
                  Save changes to this broker account?
                </h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Before
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      {accountSummary(confirmState.before).map((row) => (
                        <div
                          className="flex items-center justify-between gap-4"
                          key={row.label}
                        >
                          <span className="text-slate-500">{row.label}</span>
                          <span className="font-semibold text-slate-100">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      After
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      {accountSummary(confirmState.after).map((row) => (
                        <div
                          className="flex items-center justify-between gap-4"
                          key={row.label}
                        >
                          <span className="text-slate-500">{row.label}</span>
                          <span className="font-semibold text-slate-100">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={() => setConfirmState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
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
