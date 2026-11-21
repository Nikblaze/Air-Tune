import { describe, expect, it } from "vitest";
import { createAppState, transition, type AppEvent } from "../src/app/appState";

const run = (events: AppEvent[]) => {
  const app = createAppState(() => {});
  events.forEach((e) => app.send(e));
  return app.get();
};

describe("appState", () => {
  it("first visit goes through TUTORIAL", () => {
    expect(run(["start", "granted", "modelReady"])).toBe("TUTORIAL");
    expect(run(["start", "granted", "modelReady", "tutorialDone"])).toBe("PLAYING");
  });
  it("returning user skips TUTORIAL", () => {
    expect(run(["start", "granted", "modelReadyReturning"])).toBe("PLAYING");
  });
  it("tutorialDone is a no-op outside TUTORIAL", () => {
    expect(transition("PLAYING", "tutorialDone")).toBe("PLAYING");
  });
  it("denied -> retry -> granted", () => {
    expect(run(["start", "denied"])).toBe("CAMERA_DENIED");
    expect(run(["start", "denied", "retry", "granted"])).toBe("LOADING_MODEL");
  });
  it("noDevice then retry", () => {
    expect(run(["start", "noDevice"])).toBe("NO_CAMERA");
    expect(run(["start", "noDevice", "retry"])).toBe("REQUESTING_CAMERA");
  });
  it("PLAYING <-> PAUSED", () => {
    expect(transition("PLAYING", "pause")).toBe("PAUSED");
    expect(transition("PAUSED", "resume")).toBe("PLAYING");
  });
  it("pause/resume are no-ops elsewhere", () => {
    expect(transition("TUTORIAL", "pause")).toBe("TUTORIAL");
    expect(transition("PLAYING", "resume")).toBe("PLAYING");
    expect(transition("PAUSED", "pause")).toBe("PAUSED");
  });
  it("PLAYING -> RECORDING -> RECORD_PREVIEW -> PLAYING", () => {
    expect(transition("PLAYING", "record")).toBe("RECORDING");
    expect(transition("RECORDING", "stopRecord")).toBe("RECORD_PREVIEW");
    expect(transition("RECORD_PREVIEW", "closePreview")).toBe("PLAYING");
  });
  it("record only starts from PLAYING; recording cannot be paused", () => {
    expect(transition("TUTORIAL", "record")).toBe("TUTORIAL");
    expect(transition("PAUSED", "record")).toBe("PAUSED");
    expect(transition("RECORD_PREVIEW", "record")).toBe("RECORD_PREVIEW");
    expect(transition("RECORDING", "pause")).toBe("RECORDING");
    expect(transition("PLAYING", "stopRecord")).toBe("PLAYING");
  });
  it("invalid event is a no-op", () => {
    expect(transition("LANDING", "modelReady")).toBe("LANDING");
    const changes: string[] = [];
    createAppState((s) => changes.push(s)).send("granted");
    expect(changes).toEqual([]);
  });
});
