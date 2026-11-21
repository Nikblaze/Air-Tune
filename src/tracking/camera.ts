import { config } from "../config";

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: config.camera.width, height: config.camera.height, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  await video.play();
  return stream;
}

export function classifyCameraError(err: unknown): "denied" | "noDevice" {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotFoundError" || name === "OverconstrainedError") return "noDevice";
  return "denied"; // NotAllowedError, SecurityError and anything unknown
}
