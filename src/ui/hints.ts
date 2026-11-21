import { config } from "../config";
import { LM } from "../core/pinch";
import { dist } from "../core/vec2";
import type { Hand } from "../tracking/pipeline";

const SAMPLE_W = 32;
const SAMPLE_H = 18;
const DARK_CHECK_MS = 1000;

/** One non-blocking hint pill at a time. Call once per frame; it hides itself when the condition clears. */
export function createHints() {
  const pill = document.createElement("div");
  pill.id = "hint";
  pill.hidden = true;
  document.body.append(pill);

  const probe = document.createElement("canvas");
  probe.width = SAMPLE_W;
  probe.height = SAMPLE_H;
  const pctx = probe.getContext("2d", { willReadFrequently: true })!;
  let dark = false;
  let lastDarkCheck = -Infinity;
  let noHandsSince: number | null = null;

  return {
    update({ hands, now, video }: { hands: readonly Hand[]; now: number; video: HTMLVideoElement }) {
      // Dark check is throttled: getImageData forces a GPU readback.
      if (now - lastDarkCheck >= DARK_CHECK_MS && video.readyState >= 2) {
        lastDarkCheck = now;
        pctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
        const px = pctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
        let sum = 0;
        // Rec. 601 luma weights: green dominates perceived brightness.
        for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        dark = sum / (px.length / 4) < config.hints.darkLuma;
      }

      const live = hands.filter((h) => !h.held);
      if (live.length) noHandsSince = null;
      else noHandsSince ??= now;
      const tooClose = live.some(
        (h) => dist(h.points[LM.WRIST], h.points[LM.MIDDLE_MCP]) > config.hints.tooCloseFrac * window.innerHeight,
      );

      // Priority: dark > no hands > too close (no hands is meaningless in the dark).
      const msg = dark
        ? "Too dark, add some light"
        : noHandsSince !== null && now - noHandsSince >= config.hints.noHandsMs
          ? "Hands not visible"
          : tooClose
            ? "Move back a little"
            : "";
      pill.hidden = !msg;
      if (msg && pill.textContent !== msg) pill.textContent = msg;
    },
  };
}
