import { describe, expect, it } from "vitest";
import { denormalizeLayout, loadLayout, serializeLayout, validateLayout } from "../src/app/layouts";

const s = { a: { x: 100, y: 50 }, b: { x: 500, y: 250 } };

describe("layouts", () => {
  it("serialize normalizes to the canvas size and denormalize inverts it", () => {
    const n = serializeLayout([s], 1000, 500);
    expect(n[0]).toEqual({ a: { x: 0.1, y: 0.1 }, b: { x: 0.5, y: 0.5 } });
    expect(denormalizeLayout(n, 1000, 500)).toEqual([s]);
    expect(denormalizeLayout(n, 2000, 1000)[0].b).toEqual({ x: 1000, y: 500 }); // other window size
  });
  it("validate accepts good data, including empty", () => {
    expect(validateLayout([], 12)).toEqual([]);
    expect(validateLayout(serializeLayout([s], 1000, 500), 12)).toHaveLength(1);
  });
  it("validate rejects bad shapes, ranges and too many items", () => {
    const good = { a: { x: 0.1, y: 0.1 }, b: { x: 0.5, y: 0.5 } };
    expect(validateLayout("x", 12)).toEqual([]);
    expect(validateLayout({}, 12)).toEqual([]);
    expect(validateLayout([good, { a: { x: 2, y: 0 }, b: good.b }], 12)).toEqual([]);
    expect(validateLayout([{ a: { x: NaN, y: 0 }, b: good.b }], 12)).toEqual([]);
    expect(validateLayout([{ a: { x: "0.1", y: 0 }, b: good.b }], 12)).toEqual([]);
    expect(validateLayout([good, null], 12)).toEqual([]);
    expect(validateLayout(Array(13).fill(good), 12)).toEqual([]);
  });
  it("loadLayout survives corrupt or throwing storage", () => {
    expect(loadLayout({ getItem: () => "{nope" })).toEqual([]);
    expect(loadLayout({ getItem: () => null })).toEqual([]);
    expect(loadLayout({ getItem: () => { throw new Error("blocked"); } })).toEqual([]);
  });
});
