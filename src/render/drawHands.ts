import { HandLandmarker } from "@mediapipe/tasks-vision";
import { config } from "../config";
import type { Vec2 } from "../core/vec2";
import type { Hand } from "../tracking/pipeline";

/** Hands are already in canvas pixels (see tracking/coords.ts). */
export function drawHands(ctx: CanvasRenderingContext2D, hands: readonly Hand[]): void {
  const { bones, joints, boneWidth, jointRadius } = config.skeleton;
  ctx.lineWidth = boneWidth;
  for (const hand of hands) {
    if (config.debug.showSkeleton) {
      ctx.strokeStyle = bones;
      ctx.beginPath();
      for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
        ctx.moveTo(hand.points[start].x, hand.points[start].y);
        ctx.lineTo(hand.points[end].x, hand.points[end].y);
      }
      ctx.stroke();
      ctx.fillStyle = joints;
      for (const p of hand.points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, jointRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (hand.pinchPoint) {
      const { ringColor, fillColor, radius } = config.pinch;
      ctx.beginPath();
      ctx.arc(hand.pinchPoint.x, hand.pinchPoint.y, radius, 0, Math.PI * 2);
      if (hand.pinching) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      } else {
        ctx.strokeStyle = ringColor;
        ctx.stroke();
      }
    }
  }
}

export interface PalmRing {
  center: Vec2;
  radius: number;
  progress: number; // 0..1
}

/** Open-palm clear progress (SPEC §3.3): an arc that fills clockwise from 12 o'clock. Gameplay feedback, so it is on the canvas. */
export function drawPalmRings(ctx: CanvasRenderingContext2D, rings: readonly PalmRing[]): void {
  ctx.strokeStyle = config.palmClear.ringColor;
  ctx.lineWidth = config.palmClear.ringWidth;
  ctx.lineCap = "round";
  for (const r of rings) {
    ctx.beginPath();
    ctx.arc(r.center.x, r.center.y, r.radius, -Math.PI / 2, -Math.PI / 2 + r.progress * Math.PI * 2);
    ctx.stroke();
  }
}
