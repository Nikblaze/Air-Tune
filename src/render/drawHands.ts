import { HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { config } from "../config";

// ponytail: CSS object-fit + scaleX(-1) aligns canvas with video for now; Phase 1 coords.ts replaces this with real canvas-pixel space.
export function drawHands(
  ctx: CanvasRenderingContext2D,
  result: HandLandmarkerResult,
  width: number,
  height: number,
): void {
  const { bones, joints, boneWidth, jointRadius } = config.skeleton;
  ctx.lineWidth = boneWidth;
  for (const hand of result.landmarks) {
    ctx.strokeStyle = bones;
    ctx.beginPath();
    for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
      ctx.moveTo(hand[start].x * width, hand[start].y * height);
      ctx.lineTo(hand[end].x * width, hand[end].y * height);
    }
    ctx.stroke();
    ctx.fillStyle = joints;
    for (const p of hand) {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, jointRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
