// Record & share (SPEC §10.7). All UI here is DOM, so it never appears in the recording
// (the canvas only holds video, strings, particles and the skeleton).
import type { AppEvent, AppState } from "../app/appState";
import { config } from "../config";
import { formatTimer, pickMime, recordingFilename } from "../core/recording";

export const recorderSupported = () =>
  typeof MediaRecorder !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;

export function createRecorder(o: {
  canvas: HTMLCanvasElement;
  app: { get(): AppState; send(e: AppEvent): void };
  audioStream: () => MediaStream; // same master output the speakers get
}) {
  const cfg = config.recorder;
  const el = (id: string) => {
    const d = document.createElement("div");
    d.id = id;
    d.hidden = true;
    document.body.append(d);
    return d;
  };
  const countdownEl = el("countdown");
  const recEl = el("rec");

  let countdown: number | undefined;
  let rec: MediaRecorder | null = null;
  let timer: number | undefined;
  let modal: HTMLElement | null = null;
  let url = "";
  let mime = "";

  function cancelCountdown() {
    clearInterval(countdown);
    countdown = undefined;
    countdownEl.hidden = true;
  }

  // The countdown runs while still PLAYING; `record` is only sent once it hits zero.
  function startCountdown() {
    let n = cfg.countdownFrom;
    const show = () => {
      countdownEl.textContent = String(n);
      countdownEl.hidden = false;
    };
    show();
    countdown = window.setInterval(() => {
      if (o.app.get() !== "PLAYING") return cancelCountdown(); // paused / tab hidden meanwhile
      if (--n > 0) return show();
      cancelCountdown();
      start();
    }, 1000);
  }

  function start() {
    const picked = pickMime(cfg.mimeTypes, (m) => MediaRecorder.isTypeSupported(m));
    const stream = new MediaStream([...o.canvas.captureStream(cfg.fps).getVideoTracks(), ...o.audioStream().getAudioTracks()]);
    const chunks: Blob[] = [];
    try {
      rec = new MediaRecorder(stream, picked ? { mimeType: picked } : undefined);
    } catch (err) {
      console.warn("MediaRecorder failed to start", err);
      return;
    }
    const r = rec;
    mime = r.mimeType || picked || "video/webm";
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onerror = () => stop();
    r.onstop = () => {
      clearInterval(timer);
      recEl.hidden = true;
      // Only the canvas video track: the audio track belongs to the shared destination node and is reused next time.
      stream.getVideoTracks().forEach((t) => t.stop());
      rec = null;
      o.app.send("stopRecord");
      openPreview(new Blob(chunks, { type: mime }));
    };
    r.start(cfg.timesliceMs); // timeslice: chunks arrive every second instead of one big blob at the end
    o.app.send("record");
    const t0 = performance.now();
    recEl.textContent = "00:00";
    recEl.hidden = false;
    timer = window.setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      recEl.textContent = formatTimer(s);
      if (s >= cfg.maxSeconds) stop();
    }, 250);
  }

  function stop() {
    if (rec && rec.state !== "inactive") rec.stop(); // state change happens in onstop, when the blob is complete
  }

  function openPreview(blob: Blob) {
    url = URL.createObjectURL(blob);
    modal = el("rec-preview");
    modal.hidden = false;
    modal.innerHTML = `<video controls playsinline></video>
      <div class="row">
        <button type="button" data-act="download">Download</button>
        <button type="button" data-act="again" class="secondary">Re-record</button>
        <button type="button" data-act="close" class="secondary">Close</button>
      </div>`;
    modal.querySelector("video")!.src = url;
    const on = (act: string, fn: () => void) => modal!.querySelector(`[data-act="${act}"]`)!.addEventListener("click", fn);
    on("download", () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = recordingFilename(mime, new Date());
      a.click(); // preview stays open
    });
    on("close", closePreview);
    on("again", () => {
      closePreview();
      startCountdown();
    });
  }

  function closePreview() {
    if (!modal) return;
    modal.remove();
    modal = null;
    URL.revokeObjectURL(url);
    o.app.send("closePreview");
  }

  window.addEventListener("keydown", (e) => e.key === "Escape" && closePreview());

  return {
    /** HUD button and R key: start (countdown) from PLAYING, stop from RECORDING; a second press cancels a countdown. */
    toggle() {
      if (countdown !== undefined) return cancelCountdown();
      const s = o.app.get();
      if (s === "PLAYING") startCountdown();
      else if (s === "RECORDING") stop();
    },
    stop,
    cancelCountdown,
  };
}
