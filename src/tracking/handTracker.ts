import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { config } from "../config";

/** Download the model with progress. onProgress gets 0..1, or NaN if size is unknown. */
async function fetchModel(onProgress: (fraction: number) => void): Promise<Uint8Array> {
  const res = await fetch(config.modelUrl);
  if (!res.ok || !res.body) throw new Error(`Model download failed: ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(total ? received / total : NaN);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}

/** Started on page load so the ~8 MB download overlaps with the landing page (SPEC §10.2). */
export async function preloadHandTracker(onProgress: (fraction: number) => void): Promise<HandLandmarker> {
  const [fileset, bytes] = await Promise.all([
    FilesetResolver.forVisionTasks(config.wasmBaseUrl),
    fetchModel(onProgress),
  ]);
  const create = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(fileset, {
      // Fresh copy: the buffer may be transferred/consumed by a failed attempt.
      baseOptions: { modelAssetBuffer: bytes.slice(), delegate },
      runningMode: "VIDEO",
      numHands: config.numHands,
      minHandDetectionConfidence: config.minHandDetectionConfidence,
      minHandPresenceConfidence: config.minHandPresenceConfidence,
      minTrackingConfidence: config.minTrackingConfidence,
    });
  try {
    return await create("GPU");
  } catch (err) {
    console.warn("GPU delegate failed, falling back to CPU", err);
    return await create("CPU");
  }
}

let lastVideoTime = -1;
let lastTimestamp = -1;

/** Returns null when the video has no new frame (SPEC §9). */
export function detect(
  landmarker: HandLandmarker,
  video: HTMLVideoElement,
  nowMs: number,
): HandLandmarkerResult | null {
  if (video.currentTime === lastVideoTime) return null;
  lastVideoTime = video.currentTime;
  // detectForVideo requires strictly increasing timestamps.
  lastTimestamp = Math.max(nowMs, lastTimestamp + 1);
  return landmarker.detectForVideo(video, lastTimestamp);
}
