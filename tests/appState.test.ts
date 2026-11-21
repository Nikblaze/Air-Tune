import { describe, expect, it } from "vitest";
import { createAppState, transition, type AppEvent } from "../src/app/appState";

const run = (events: AppEvent[]) => {
  const app = createAppState(() => {});
  events.forEach((e) => app.send(e));
  return app.get();
};

describe("appState", () => {
  it("happy path reaches PLAYING", () => {
    expect(run(["start", "granted", "modelReady"])).toBe("PLAYING");
  });
  it("denied -> retry -> granted", () => {
    expect(run(["start", "denied"])).toBe("CAMERA_DENIED");
    expect(run(["start", "denied", "retry", "granted"])).toBe("LOADING_MODEL");
  });
  it("noDevice then retry", () => {
    expect(run(["start", "noDevice"])).toBe("NO_CAMERA");
    expect(run(["start", "noDevice", "retry"])).toBe("REQUESTING_CAMERA");
  });
  it("invalid event is a no-op", () => {
    expect(transition("LANDING", "modelReady")).toBe("LANDING");
    const changes: string[] = [];
    createAppState((s) => changes.push(s)).send("granted");
    expect(changes).toEqual([]);
  });
});
