export type ReviewNoteScope = "daily" | "weekly" | "monthly";

export type ReviewNotes = {
  daily: Record<string, string>;
  weekly: Record<string, string>;
  monthly: Record<string, string>;
  updatedAt?: string;
};

export const reviewNotesStorageKey = "tnpa.review-notes.v1";
export const reviewNotesUpdatedEvent = "tnpa:review-notes-updated";

export const emptyReviewNotes: ReviewNotes = {
  daily: {},
  monthly: {},
  weekly: {},
};

let lastRaw: string | null = null;
let lastParsed: ReviewNotes = emptyReviewNotes;

function sanitizeNoteMap(value: unknown) {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      const [key, note] = entry;
      return key.trim().length > 0 && typeof note === "string";
    }),
  );
}

function sanitizeReviewNotes(value: unknown): ReviewNotes {
  if (!value || typeof value !== "object") return emptyReviewNotes;

  const notes = value as Partial<ReviewNotes>;

  return {
    daily: sanitizeNoteMap(notes.daily),
    monthly: sanitizeNoteMap(notes.monthly),
    updatedAt: typeof notes.updatedAt === "string" ? notes.updatedAt : undefined,
    weekly: sanitizeNoteMap(notes.weekly),
  };
}

export function readReviewNotes() {
  if (typeof window === "undefined") return emptyReviewNotes;

  const raw = window.localStorage.getItem(reviewNotesStorageKey);
  if (raw === lastRaw) return lastParsed;

  lastRaw = raw;
  if (!raw) {
    lastParsed = emptyReviewNotes;
    return lastParsed;
  }

  try {
    lastParsed = sanitizeReviewNotes(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(reviewNotesStorageKey);
    lastRaw = null;
    lastParsed = emptyReviewNotes;
  }

  return lastParsed;
}

export function writeReviewNote(scope: ReviewNoteScope, periodKey: string, note: string) {
  if (typeof window === "undefined") return;

  const normalizedKey = periodKey.trim();
  if (!normalizedKey) return;

  const current = readReviewNotes();
  const next: ReviewNotes = {
    ...current,
    [scope]: {
      ...current[scope],
      [normalizedKey]: note,
    },
    updatedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(reviewNotesStorageKey, raw);
  window.dispatchEvent(new CustomEvent(reviewNotesUpdatedEvent, { detail: next }));
}

export function subscribeToReviewNotes(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener(reviewNotesUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(reviewNotesUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
