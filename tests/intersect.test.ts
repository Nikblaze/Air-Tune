import { describe, expect, it } from "vitest";
import { cross, segmentIntersect } from "../src/core/intersect";

const P = (x: number, y: number) => ({ x, y });
const A = P(0, 0);
const B = P(100, 0);

describe("cross", () => {
  it("is (a-o)x(b-o)", () => {
    expect(cross(P(0, 0), P(1, 0), P(0, 1))).toBe(1);
    expect(cross(P(0, 0), P(0, 1), P(1, 0))).toBe(-1);
  });
});

describe("segmentIntersect", () => {
  it("perpendicular crossing at the middle gives t=0.5", () => {
    expect(segmentIntersect(P(50, -10), P(50, 10), A, B)!.t).toBeCloseTo(0.5);
  });
  it("crossing near the end gives t≈0.1", () => {
    expect(segmentIntersect(P(10, -5), P(10, 5), A, B)!.t).toBeCloseTo(0.1);
  });
  it("misses when the motion stops short", () => {
    expect(segmentIntersect(P(50, -10), P(50, -1), A, B)).toBeNull();
  });
  it("misses when passing beyond the string end", () => {
    expect(segmentIntersect(P(150, -10), P(150, 10), A, B)).toBeNull();
  });
  it("parallel motion is null", () => {
    expect(segmentIntersect(P(0, 5), P(100, 5), A, B)).toBeNull();
  });
  it("a finger resting on the line does not trigger", () => {
    expect(segmentIntersect(P(50, 0), P(50, 10), A, B)).toBeNull();
  });
  it("catches a fast 150px jump that a point-distance test would miss", () => {
    const hit = segmentIntersect(P(50, -75), P(50, 75), A, B);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeCloseTo(0.5);
  });
  it("direction flips when swiping the other way", () => {
    const down = segmentIntersect(P(50, -10), P(50, 10), A, B)!;
    const up = segmentIntersect(P(50, 10), P(50, -10), A, B)!;
    // AB points +x; p0 below (y<0) has cross(a,b,p0) < 0.
    expect(down.direction).toBe(-1);
    expect(up.direction).toBe(1);
  });
});
