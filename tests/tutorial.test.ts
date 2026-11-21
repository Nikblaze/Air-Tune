import { describe, expect, it } from "vitest";
import { tutorialStep, type TutorialSignals } from "../src/ui/tutorial";

const none: TutorialSignals = { hands: 0, drawing: false, created: false, plucked: false };

describe("tutorialStep", () => {
  it("each step advances only on its own signal", () => {
    expect(tutorialStep(0, { ...none, hands: 1 })).toBe(0);
    expect(tutorialStep(0, { ...none, hands: 2 })).toBe(1);
    expect(tutorialStep(1, { ...none, hands: 2 })).toBe(1);
    expect(tutorialStep(1, { ...none, drawing: true })).toBe(2);
    expect(tutorialStep(2, { ...none, drawing: true })).toBe(2);
    expect(tutorialStep(2, { ...none, created: true })).toBe(3);
    expect(tutorialStep(3, { ...none, created: true })).toBe(3);
    expect(tutorialStep(3, { ...none, plucked: true })).toBe(4);
  });
  it("advances at most one step per call", () => {
    expect(tutorialStep(0, { hands: 2, drawing: true, created: true, plucked: true })).toBe(1);
  });
});
