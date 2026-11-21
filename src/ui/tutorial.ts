// First-visit tutorial (SPEC §10.4). Steps complete only when the app DETECTS the action.
import { config } from "../config";
import type { Bus } from "../events";
import type { GestureState } from "../scene/gestureController";
import type { Hand } from "../tracking/pipeline";

const STEPS = [
  { text: "Show both hands", hint: "Tip: hold both hands up in front of the camera" },
  { text: "Pinch both hands and pull them apart", hint: "Tip: thumb and index finger touch, then move your hands apart" },
  { text: "Let go", hint: "Tip: open your fingers to release the string" },
  { text: "Swipe a finger through the string", hint: "Tip: flick a fingertip across the string, like plucking a harp" },
];
const DONE = STEPS.length; // step index after the last one: "You're playing!"

export interface TutorialSignals {
  hands: number; // live (not held) hands
  drawing: boolean;
  created: boolean; // stringCreated seen since last update
  plucked: boolean; // stringPlucked seen since last update
}

/** Pure progress rule: advance at most one step per call. */
export function tutorialStep(step: number, s: TutorialSignals): number {
  const ok = [s.hands >= 2, s.drawing, s.created, s.plucked][step];
  return ok ? step + 1 : step;
}

export function startTutorial({ bus, onDone }: { bus: Bus; onDone: () => void }) {
  const card = document.createElement("div");
  card.id = "tutorial";
  card.innerHTML = `<div class="tut-head"><span class="tut-count"></span><span class="tut-tick">✓</span><button type="button" class="tut-skip">Skip</button></div>
    <div class="tut-text"></div><div class="tut-hint" hidden></div>`;
  document.body.append(card);
  const $ = (sel: string) => card.querySelector<HTMLElement>(sel)!;
  const countEl = $(".tut-count"), textEl = $(".tut-text"), hintEl = $(".tut-hint"), tickEl = $(".tut-tick");

  let step = 0;
  let stepSince: number | null = null; // set on first update (we only know "now" there)
  let doneAt = 0;
  let created = false;
  let plucked = false;
  let finished = false;
  const offs = [bus.on("stringCreated", () => (created = true)), bus.on("stringPlucked", () => (plucked = true))];

  const show = () => {
    const done = step >= DONE;
    countEl.textContent = done ? "" : `${step + 1}/${DONE}`;
    textEl.textContent = done ? "You're playing!" : STEPS[step].text;
    hintEl.hidden = true;
  };
  show();

  const finish = () => {
    if (finished) return;
    finished = true;
    offs.forEach((off) => off());
    card.remove(); // the tutorial string stays: it belongs to the manager, not us
    onDone();
  };
  $(".tut-skip").addEventListener("click", finish);

  return {
    update(hands: readonly Hand[], gesture: GestureState, now: number) {
      if (finished) return;
      stepSince ??= now;
      if (step >= DONE) {
        if (now - doneAt >= config.tutorial.doneShowMs) finish();
        return;
      }
      const next = tutorialStep(step, { hands: hands.filter((h) => !h.held).length, drawing: gesture === "DRAWING", created, plucked });
      // Events only count for the step that was active when they fired.
      created = plucked = false;
      if (next !== step) {
        step = next;
        stepSince = now;
        if (step >= DONE) doneAt = now;
        show();
        // Restart the CSS pop animation (remove, force reflow, re-add).
        tickEl.classList.remove("pop");
        void tickEl.offsetWidth;
        tickEl.classList.add("pop");
      } else if (now - stepSince >= config.tutorial.hintAfterMs && hintEl.hidden) {
        hintEl.textContent = STEPS[step].hint;
        hintEl.hidden = false;
      }
    },
    destroy: finish,
  };
}
