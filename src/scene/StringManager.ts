import { config } from "../config";
import type { Vec2 } from "../core/vec2";
import type { Bus } from "../events";
import type { StringEntity } from "./StringEntity";

/** Owns the scene's strings: creation, FIFO cap, fade-out removal. Pure (time is passed in). */
export class StringManager {
  strings: StringEntity[] = [];
  private nextId = 1;

  constructor(private bus: Bus) {}

  add(a: Vec2, b: Vec2, now: number): StringEntity {
    const s: StringEntity = { id: this.nextId++, a, b, createdAt: now, fadeStart: null };
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
      if (done) this.bus.emit("stringRemoved", { stringId: s.id });
      return !done;
    });
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
