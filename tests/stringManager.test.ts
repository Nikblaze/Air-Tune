import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import { createBus } from "../src/events";
import { StringManager } from "../src/scene/StringManager";

const P = (x: number) => ({ x, y: 0 });
function setup() {
  const bus = createBus();
  const created: number[] = [];
  const removed: number[] = [];
  bus.on("stringCreated", (e) => created.push(e.string.id));
  bus.on("stringRemoved", (e) => removed.push(e.stringId));
  return { m: new StringManager(bus), created, removed };
}

describe("StringManager", () => {
  it("add creates a string and emits stringCreated", () => {
    const { m, created } = setup();
    const s = m.add(P(0), P(100), 0);
    expect(m.strings).toEqual([s]);
    expect(created).toEqual([s.id]);
    expect(s.fadeStart).toBeNull();
  });

  it("over the cap, fades the oldest live string", () => {
    const { m } = setup();
    for (let i = 0; i < config.maxStrings + 1; i++) m.add(P(0), P(100), i);
    expect(m.strings).toHaveLength(config.maxStrings + 1);
    expect(m.strings[0].fadeStart).toBe(config.maxStrings);
    expect(m.strings.filter((s) => s.fadeStart === null)).toHaveLength(config.maxStrings);
  });

  it("removes faded strings after stringFadeMs and emits stringRemoved", () => {
    const { m, removed } = setup();
    const s = m.add(P(0), P(100), 0);
    m.undo(10);
    m.update(10 + config.stringFadeMs - 1);
    expect(m.strings).toHaveLength(1);
    m.update(10 + config.stringFadeMs);
    expect(m.strings).toHaveLength(0);
    expect(removed).toEqual([s.id]);
  });

  it("alpha goes 1 -> 0 over the fade", () => {
    const { m } = setup();
    const s = m.add(P(0), P(100), 0);
    expect(m.alpha(s, 5)).toBe(1);
    m.undo(100);
    expect(m.alpha(s, 100)).toBe(1);
    expect(m.alpha(s, 100 + config.stringFadeMs / 2)).toBeCloseTo(0.5);
    expect(m.alpha(s, 100 + config.stringFadeMs * 2)).toBe(0);
  });

  it("undo fades the most recent non-fading string, skipping already-fading ones", () => {
    const { m } = setup();
    const a = m.add(P(0), P(100), 0);
    const b = m.add(P(0), P(100), 1);
    m.undo(2);
    expect(b.fadeStart).toBe(2);
    m.undo(3);
    expect(a.fadeStart).toBe(3);
    m.undo(4); // nothing live: no-op
    expect(b.fadeStart).toBe(2);
  });

  it("clear fades everything without resetting strings already fading", () => {
    const { m } = setup();
    const a = m.add(P(0), P(100), 0);
    const b = m.add(P(0), P(100), 1);
    m.undo(2);
    m.clear(5);
    expect(a.fadeStart).toBe(5);
    expect(b.fadeStart).toBe(2);
  });
});
