// Pure screen state machine (SPEC §10.1). No DOM.
export type AppState =
  | "LANDING"
  | "REQUESTING_CAMERA"
  | "CAMERA_DENIED"
  | "NO_CAMERA"
  | "LOADING_MODEL"
  | "TUTORIAL"
  | "PLAYING"
  | "PAUSED"
  | "RECORDING"
  | "RECORD_PREVIEW";

export type AppEvent = "start" | "granted" | "denied" | "noDevice" | "retry" | "modelReady" | "modelReadyReturning" | "tutorialDone" | "pause" | "resume" | "record" | "stopRecord" | "closePreview";

const table: Record<AppState, Partial<Record<AppEvent, AppState>>> = {
  LANDING: { start: "REQUESTING_CAMERA" },
  REQUESTING_CAMERA: { granted: "LOADING_MODEL", denied: "CAMERA_DENIED", noDevice: "NO_CAMERA" },
  CAMERA_DENIED: { retry: "REQUESTING_CAMERA" },
  NO_CAMERA: { retry: "REQUESTING_CAMERA" },
  // First-time users get the tutorial; returning users (prefs.tutorialDone) skip it.
  LOADING_MODEL: { modelReady: "TUTORIAL", modelReadyReturning: "PLAYING" },
  TUTORIAL: { tutorialDone: "PLAYING" }, // finishing and Skip are the same event
  PLAYING: { pause: "PAUSED", record: "RECORDING" },
  PAUSED: { resume: "PLAYING" },
  RECORDING: { stopRecord: "RECORD_PREVIEW" }, // no pause here: a hidden tab stops the recording instead
  RECORD_PREVIEW: { closePreview: "PLAYING" }, // Download keeps the preview open; Re-record = close + countdown
};

/** Invalid events leave the state unchanged. */
export function transition(state: AppState, event: AppEvent): AppState {
  return table[state][event] ?? state;
}

export function createAppState(onChange: (state: AppState) => void) {
  let state: AppState = "LANDING";
  return {
    get: () => state,
    send(event: AppEvent) {
      const next = transition(state, event);
      if (next === state) return;
      state = next;
      onChange(state);
    },
  };
}
