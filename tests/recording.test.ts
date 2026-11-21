import { describe, expect, it } from "vitest";
import { formatTimer, pickMime, recordingFilename } from "../src/core/recording";

describe("recording helpers", () => {
  const prefs = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  it("pickMime takes the first supported type in preference order", () => {
    expect(pickMime(prefs, () => true)).toBe(prefs[0]);
    expect(pickMime(prefs, (m) => m.startsWith("video/webm"))).toBe("video/webm;codecs=vp9,opus");
    expect(pickMime(prefs, (m) => m === "video/webm")).toBe("video/webm");
    expect(pickMime(prefs, () => false)).toBeNull();
  });
  it("filename is timestamped and the extension follows the mime", () => {
    const d = new Date(2026, 10, 5, 9, 3, 7); // local time: 2026-11-05 09:03:07
    expect(recordingFilename("video/mp4", d)).toBe("air-strings-20261105-090307.mp4");
    expect(recordingFilename("video/webm;codecs=vp9,opus", d)).toBe("air-strings-20261105-090307.webm");
  });
  it("formatTimer is mm:ss", () => {
    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(59.9)).toBe("00:59");
    expect(formatTimer(60)).toBe("01:00");
  });
});
