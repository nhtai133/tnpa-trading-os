import {
  archiveReasons,
  type ArchiveReason,
  type WealthAsset,
  type WealthStatus,
} from "@/app/_lib/wealth-types";

export const wealthAssetsStorageKey = "tnpa.wealth-assets.v1";
export const wealthAssetsUpdatedEvent = "tnpa:wealth-assets-updated";
export const emptyWealthAssets: WealthAsset[] = [];

let lastRaw: string | null = null;
let lastParsed: WealthAsset[] = emptyWealthAssets;

export function isArchiveReason(value: string): value is ArchiveReason {
  return archiveReasons.includes(value as ArchiveReason);
}

function sanitizeAsset(value: unknown): WealthAsset | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const asset = value as Partial<WealthAsset>;

  if (!asset.id || !asset.name || !asset.assetClass || !asset.institution || !asset.currency) {
    return null;
  }

  if (typeof asset.currentValue !== "number" || !Number.isFinite(asset.currentValue)) {
    return null;
  }

  const status: WealthStatus =
    asset.status === "Archived" ? "Archived" : "Active";

  return {
    id: asset.id,
    name: asset.name,
    assetClass: asset.assetClass,
    institution: asset.institution,
    currency: asset.currency,
    currentValue: asset.currentValue,
    status,
    archiveReason:
      status === "Archived" &&
      typeof asset.archiveReason === "string" &&
      isArchiveReason(asset.archiveReason)
        ? asset.archiveReason
        : undefined,
    archivedAt:
      status === "Archived" && typeof asset.archivedAt === "string"
        ? asset.archivedAt
        : undefined,
    costBasis:
      typeof asset.costBasis === "number" && Number.isFinite(asset.costBasis)
        ? asset.costBasis
        : undefined,
    accountId: typeof asset.accountId === "string" ? asset.accountId : undefined,
    notes: typeof asset.notes === "string" ? asset.notes : undefined,
  };
}

function sanitizeAssets(value: unknown) {
  if (!Array.isArray(value)) {
    return emptyWealthAssets;
  }

  return value
    .map((asset) => sanitizeAsset(asset))
    .filter((asset): asset is WealthAsset => Boolean(asset));
}

export function readStoredWealthAssets() {
  if (typeof window === "undefined") {
    return emptyWealthAssets;
  }

  const raw = window.localStorage.getItem(wealthAssetsStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = emptyWealthAssets;
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeAssets(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(wealthAssetsStorageKey);
    lastRaw = null;
    lastParsed = emptyWealthAssets;
    return lastParsed;
  }
}

export function writeWealthAssets(assets: WealthAsset[]) {
  const raw = JSON.stringify(assets);
  lastRaw = raw;
  lastParsed = assets;
  window.localStorage.setItem(wealthAssetsStorageKey, raw);
  window.dispatchEvent(new CustomEvent(wealthAssetsUpdatedEvent, { detail: assets }));
}

export function subscribeToWealthAssets(onStoreChange: () => void) {
  window.addEventListener(wealthAssetsUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(wealthAssetsUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
