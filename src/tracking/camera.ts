import { config } from "../config";

/**
 * With a deviceId we ask for exactly that camera. If it is gone (unplugged since last visit) we fall
 * back to the default silently. An already-granted permission covers every camera: no new prompt.
 */
export async function startCamera(video: HTMLVideoElement, deviceId = ""): Promise<MediaStream> {
  const { width, height } = config.camera;
  const get = (v: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video: v, audio: false });
  let stream: MediaStream;
  try {
    stream = await get(deviceId ? { width, height, deviceId: { exact: deviceId } } : { width, height, facingMode: "user" });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    if (!deviceId || (name !== "OverconstrainedError" && name !== "NotFoundError")) throw err;
    stream = await get({ width, height, facingMode: "user" });
  }
  video.srcObject = stream;
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  await video.play();
  return stream;
}

/** Turns the camera light off. */
export const stopCamera = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

/** Labels are empty strings until camera permission is granted, so call this after startCamera. */
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
}

export function classifyCameraError(err: unknown): "denied" | "noDevice" {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotFoundError" || name === "OverconstrainedError") return "noDevice";
  return "denied"; // NotAllowedError, SecurityError and anything unknown
}
