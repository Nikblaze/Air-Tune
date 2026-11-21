import type { Vec2 } from "../core/vec2";

export interface CoverTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  videoW: number;
  videoH: number;
}

/** object-fit: cover. Scale so the video fills the canvas, centered; overflow is cropped (offsets <= 0). */
export function coverTransform(videoW: number, videoH: number, canvasW: number, canvasH: number): CoverTransform {
  const scale = Math.max(canvasW / videoW, canvasH / videoH);
  return {
    scale,
    offsetX: (canvasW - videoW * scale) / 2,
    offsetY: (canvasH - videoH * scale) / 2,
    videoW,
    videoH,
  };
}

/** MediaPipe normalized (0..1 of the video frame) -> canvas px, using the same transform as the video draw. */
export function toCanvas(nx: number, ny: number, t: CoverTransform, canvasW: number, mirror: boolean): Vec2 {
  const x = nx * t.videoW * t.scale + t.offsetX;
  return { x: mirror ? canvasW - x : x, y: ny * t.videoH * t.scale + t.offsetY };
}
