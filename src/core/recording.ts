// Pure recorder helpers (SPEC §10.7). No DOM, so they are unit-tested.

/** First entry the browser can record, or null (then let MediaRecorder choose its default). */
export function pickMime(types: readonly string[], isSupported: (mime: string) => boolean): string | null {
  return types.find(isSupported) ?? null;
}

/** air-strings-YYYYMMDD-HHMMSS.mp4|webm (local time); the extension follows the container. */
export function recordingFilename(mime: string, d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `air-strings-${stamp}.${mime.startsWith("video/mp4") ? "mp4" : "webm"}`;
}

/** mm:ss for the recording timer. */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
