import type { WealthAccount } from "@/app/_lib/wealth-types";
import {
  archiveReasons,
  institutions,
  type ArchiveReason,
  type Currency,
  type Institution,
  type WealthStatus,
} from "@/app/_lib/wealth-types";

export type BankAccountInput = {
  institution: Institution;
  accountName: string;
  currency: Currency;
  currentBalance: string;
};

export type BankAccountArchiveInput = {
  reason: ArchiveReason;
};

export const bankAccountsStorageKey = "tnpa.bank-accounts.v1";
export const bankAccountsUpdatedEvent = "tnpa:bank-accounts-updated";

let lastRaw: string | null = null;
let lastParsed: WealthAccount[] = [];

export function isSupportedBankInstitution(value: string): value is Institution {
  return institutions.includes(value as Institution);
}

export function isArchiveReason(value: string): value is ArchiveReason {
  return archiveReasons.includes(value as ArchiveReason);
}

function sanitizeAccount(value: unknown): WealthAccount | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const account = value as Partial<WealthAccount> & { accountName?: string };

  if (
    !account.id ||
    !account.name ||
    !account.institution ||
    !account.currency ||
    typeof account.balance !== "number" ||
    !Number.isFinite(account.balance)
  ) {
    return null;
  }

  const status: WealthStatus =
    account.status === "Archived" ? "Archived" : "Active";

  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    currency: account.currency,
    balance: account.balance,
    status,
    archiveReason:
      status === "Archived" && typeof account.archiveReason === "string" && isArchiveReason(account.archiveReason)
        ? account.archiveReason
        : undefined,
    archivedAt:
      status === "Archived" && typeof account.archivedAt === "string"
        ? account.archivedAt
        : undefined,
    accountType: account.accountType ?? "Bank",
    notes: account.notes,
  };
}

function sanitizeAccounts(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((account) => sanitizeAccount(account))
    .filter((account): account is WealthAccount => Boolean(account));
}

export function readStoredBankAccounts() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(bankAccountsStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = [];
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeAccounts(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(bankAccountsStorageKey);
    lastRaw = null;
    lastParsed = [];
    return lastParsed;
  }
}

export function writeBankAccounts(accounts: WealthAccount[]) {
  const raw = JSON.stringify(accounts);
  lastRaw = raw;
  lastParsed = accounts;
  window.localStorage.setItem(bankAccountsStorageKey, raw);
  window.dispatchEvent(new CustomEvent(bankAccountsUpdatedEvent, { detail: accounts }));
}

export function subscribeToBankAccounts(onStoreChange: () => void) {
  window.addEventListener(bankAccountsUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(bankAccountsUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
