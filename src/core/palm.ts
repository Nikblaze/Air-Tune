// Open-palm clear gesture (SPEC §3.3). Pure: no DOM, no MediaPipe.
import { pinchRatio } from "./pinch";
import { dist, type Vec2 } from "./vec2";

const WRIST = 0;
const FINGER_TIPS = [8, 12, 16, 20]; // index, middle, ring, pinky
const FINGER_PIPS = [6, 10, 14, 18];

/**
 * All four fingers extended and the thumb not pinching the index.
 * A finger is extended when its tip is clearly farther from the wrist than its PIP joint; a curled
 * finger folds the tip back toward the palm. Ratio of distances, so it is scale-invariant.
 * @param hand 21 landmarks in canvas pixels.
 */
export function isOpenPalm(hand: readonly Vec2[], extendFactor: number, pinchOff: number): boolean {
  if (hand.length < 21) return false;
  if (!(pinchRatio(hand) > pinchOff)) return false;
  return FINGER_TIPS.every((tip, i) => dist(hand[WRIST], hand[tip]) > extendFactor * dist(hand[WRIST], hand[FINGER_PIPS[i]]));
}

export interface PalmHoldState {
  since: number | null; // ms when the current hold began
  fired: boolean; // latched until the hands stop being open (re-arm)
}
export const palmHoldInitial = (): PalmHoldState => ({ since: null, fired: false });

/**
 * One step of the hold timer. Fires once after `holdMs` of "both open AND still".
 * Breaking either condition restarts the timer; after a fire it stays quiet until fewer than two
 * hands are open (so keeping your palms up after a clear doesn't clear again).
 */
export function palmHold(
  state: PalmHoldState,
  input: { openCount: number; still: boolean; now: number },
  holdMs: number,
): { state: PalmHoldState; progress: number; fire: boolean } {
  if (input.openCount < 2) return { state: palmHoldInitial(), progress: 0, fire: false };
  if (!input.still || state.fired) return { state: { since: null, fired: state.fired }, progress: 0, fire: false };
  const since = state.since ?? input.now;
  const progress = Math.min(1, (input.now - since) / holdMs);
  if (progress >= 1) return { state: { since: null, fired: true }, progress: 0, fire: true };
  return { state: { since, fired: false }, progress, fire: false };
}
