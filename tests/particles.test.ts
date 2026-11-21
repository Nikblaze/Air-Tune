import { describe, expect, it } from "vitest";
import { createParticles } from "../src/core/particles";

const opts = { spread: 0.6, gravity: 100, lifeMin: 0.4, lifeMax: 0.9 };
const mid = () => 0.5; // spread 0, speed mid-range, life mid-range

describe("particles", () => {
  it("spawn adds `count` live particles", () => {
    const p = createParticles(100, opts);
    p.spawn(5, 6, 1, 0, 120, 30, 200, mid);
    expect(p.count).toBe(30);
    expect(p.x[0]).toBe(5);
    expect(p.y[0]).toBe(6);
  });

  it("update moves along the normal and gravity pulls down", () => {
    const p = createParticles(10, { ...opts, spread: 0 });
    p.spawn(0, 0, 1, 0, 0, 1, 100, mid); // speed = 100 * (0.4 + 0.6*0.5) = 70
    p.update(0.1);
    expect(p.x[0]).toBeCloseTo(7, 4);
    expect(p.y[0]).toBeGreaterThan(0); // gravity
  });

  it("dies after its life and frees the slot", () => {
    const p = createParticles(10, opts);
    p.spawn(0, 0, 1, 0, 0, 3, 100, mid); // life = 0.65
    p.update(0.5);
    expect(p.count).toBe(3);
    p.update(0.2);
    expect(p.count).toBe(0);
  });

  it("never exceeds capacity", () => {
    const p = createParticles(8, opts);
    p.spawn(0, 0, 1, 0, 0, 100, 100);
    expect(p.count).toBe(8);
    p.spawn(0, 0, 1, 0, 0, 5, 100);
    expect(p.count).toBe(8);
  });
});
