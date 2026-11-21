// Saved layout (Phase 6B): strings survive a reload. Endpoints are stored NORMALIZED (x/W, y/H)
// so a different window size still puts them in the same relative place. Pure helpers + injected storage.
import { config } from "../config";
import type { Vec2 } from "../core/vec2";

export interface SavedString {
  a: Vec2;
  b: Vec2;
}

const KEY = "airStrings.layout.v1";

export function serializeLayout(strings: readonly SavedString[], W: number, H: number): SavedString[] {
  const n = (p: Vec2): Vec2 => ({ x: p.x / W, y: p.y / H });
  return strings.map((s) => ({ a: n(s.a), b: n(s.b) }));
}

/** Anything malformed (not an array, too long, non-finite or out-of-range numbers) -> empty layout. */
export function validateLayout(raw: unknown, max: number): SavedString[] {
  if (!Array.isArray(raw) || raw.length > max) return [];
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
  const pt = (p: unknown): p is Vec2 => !!p && typeof p === "object" && ok((p as Vec2).x) && ok((p as Vec2).y);
  const out: SavedString[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object" || !pt((s as SavedString).a) || !pt((s as SavedString).b)) return [];
    const { a, b } = s as SavedString;
    out.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
  }
  return out;
}

export function denormalizeLayout(saved: readonly SavedString[], W: number, H: number): SavedString[] {
  const d = (p: Vec2): Vec2 => ({ x: p.x * W, y: p.y * H });
  return saved.map((s) => ({ a: d(s.a), b: d(s.b) }));
}

const defaultStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function loadLayout(storage: Pick<Storage, "getItem"> | null = defaultStorage()): SavedString[] {
  try {
    return validateLayout(JSON.parse(storage?.getItem(KEY) ?? "null"), config.maxStrings);
  } catch {
    return [];
  }
}

export function saveLayout(layout: SavedString[], storage: Pick<Storage, "setItem"> | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(layout));
  } catch {
    // private mode / quota: the layout just won't persist
  }
}

/** Debounced saver: bursts of create/remove events write once. flush() writes now (pagehide). */
export function createLayoutSaver(get: () => { strings: readonly SavedString[]; W: number; H: number }) {
  let timer: number | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    const { strings, W, H } = get();
    saveLayout(serializeLayout(strings, W, H));
  };
  return {
    schedule() {
      clearTimeout(timer);
      timer = window.setTimeout(flush, config.layout.saveDebounceMs);
    },
    flush,
  };
}
