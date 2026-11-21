import { describe, expect, it } from "vitest";
import { loadPrefs, savePrefs } from "../src/app/prefs";

const fake = (initial?: string) => {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set("airStrings.prefs.v1", initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};
const defaults = loadPrefs(fake());

describe("prefs", () => {
  it("empty storage -> defaults, tutorial not done", () => {
    expect(defaults.tutorialDone).toBe(false);
  });
  it("corrupt JSON -> defaults", () => {
    expect(loadPrefs(fake("{nope"))).toEqual(defaults);
    expect(loadPrefs(fake("42"))).toEqual(defaults);
  });
  it("throwing storage -> defaults, save does not throw", () => {
    expect(loadPrefs(throwing)).toEqual(defaults);
    expect(() => savePrefs(defaults, throwing)).not.toThrow();
  });
  it("partial / invalid fields are merged with defaults", () => {
    const p = loadPrefs(fake(JSON.stringify({ tutorialDone: true, scale: "bogus", volume: 7 })));
    expect(p).toEqual({ ...defaults, tutorialDone: true, volume: 1 });
  });
  it("round-trips", () => {
    const s = fake();
    const p = { ...defaults, tutorialDone: true, scale: "yaman" as const, rootMidi: 60, volume: 0.3, showSkeleton: false };
    savePrefs(p, s);
    expect(loadPrefs(s)).toEqual(p);
  });
});
