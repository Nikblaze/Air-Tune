import { config } from "../config";
import { segmentIntersect } from "../core/intersect";
import { energy, pluckCoefficients } from "../core/stringModes";
import { dist, type Vec2 } from "../core/vec2";
import type { Bus } from "../events";
import type { StringEntity } from "./StringEntity";

/** Owns the scene's strings: creation, FIFO cap, fade-out removal. Pure (time is passed in). */
export interface FingerMove {
  key: string; // identifies hand+finger, e.g. "Left:8"
  p0: Vec2;
  p1: Vec2;
  dt: number; // seconds between p0 and p1
}

export class StringManager {
  strings: StringEntity[] = [];
  private nextId = 1;
  private lastHit = new Map<string, number>(); // `${stringId}|${fingerKey}` -> ms

  constructor(private bus: Bus) {}

  /** `pitch` is computed by the caller so this class stays free of canvas-size/scale knowledge. */
  add(a: Vec2, b: Vec2, now: number, pitch = { midi: 0, hz: 0 }): StringEntity {
    const s: StringEntity = {
      id: this.nextId++,
      a,
      b,
      createdAt: now,
      fadeStart: null,
      ...pitch,
      lastPluck: null,
      coeffs: new Float64Array(config.vibration.modes),
      omega1: 0,
      e0: 0,
    };
    this.strings.push(s);
    this.bus.emit("stringCreated", { string: s });
    // Over the cap: fade the oldest live string instead of erroring (SPEC §10.5).
    // Fading strings are excluded from the count so they can finish their fade.
    const live = this.strings.filter((x) => x.fadeStart === null);
    if (live.length > config.maxStrings) live[0].fadeStart = now;
    return s;
  }

  /** Drop strings whose fade finished. Call once per frame. */
  update(now: number): void {
    this.strings = this.strings.filter((s) => {
      const done = s.fadeStart !== null && now - s.fadeStart >= config.stringFadeMs;
      if (done) {
        this.bus.emit("stringRemoved", { stringId: s.id });
        for (const k of this.lastHit.keys()) if (k.startsWith(`${s.id}|`)) this.lastHit.delete(k);
      }
      return !done;
    });
  }

  /** Swept test of each finger move against each live string (SPEC §3.2). One pluck per cooldown window. */
  detectPlucks(fingers: readonly FingerMove[], now: number): void {
    for (const s of this.strings) {
      if (s.fadeStart !== null) continue;
      for (const f of fingers) {
        const hit = segmentIntersect(f.p0, f.p1, s.a, s.b);
        if (!hit) continue;
        const k = `${s.id}|${f.key}`;
        const prev = this.lastHit.get(k);
        if (prev !== undefined && now - prev < config.pluckCooldownMs) continue;
        this.lastHit.set(k, now);
        const speed = dist(f.p0, f.p1) / f.dt; // px/s
        const velocity = Math.min(1, Math.max(config.pluckMinVelocity, speed / config.pluckMaxVelocity));
        s.lastPluck = { at: now, velocity, t: hit.t, direction: hit.direction };
        this.excite(s, hit.t, hit.direction, velocity);
        this.bus.emit("stringPlucked", { stringId: s.id, t: hit.t, velocity, direction: hit.direction });
      }
    }
  }

  /**
   * Set the string vibrating. A new pluck REPLACES the previous excitation.
   * ponytail: superposition of multiple excitations if the restart looks abrupt.
   */
  private excite(s: StringEntity, t: number, direction: 1 | -1, velocity: number): void {
    const v = config.vibration;
    const m = config.music;
    // direction = side the finger came from, so the finger pushes the string the OTHER way (-direction).
    pluckCoefficients(t, -direction * velocity * v.maxAmplitudePx, v.modes, s.coeffs);
    const pitchFactor = Math.min(1, Math.max(0, (s.midi - (m.rootMidi + m.minSemis)) / (m.maxSemis - m.minSemis)));
    s.omega1 = 2 * Math.PI * (v.freqBase + pitchFactor * v.freqRange);
    s.e0 = energy(0, s.coeffs, v.damping);
  }

  undo(now: number): void {
    const live = this.strings.filter((s) => s.fadeStart === null);
    if (live.length) live[live.length - 1].fadeStart = now;
  }

  clear(now: number): void {
    for (const s of this.strings) s.fadeStart ??= now;
  }

  /** 1 = fully visible, 0 = gone. */
  alpha(s: StringEntity, now: number): number {
    if (s.fadeStart === null) return 1;
    return Math.min(1, Math.max(0, 1 - (now - s.fadeStart) / config.stringFadeMs));
  }
}
