// Pure screen state machine (SPEC §10.1). No DOM.
// TUTORIAL / PAUSED / RECORDING etc. arrive in later phases.
export type AppState =
  | "LANDING"
  | "REQUESTING_CAMERA"
  | "CAMERA_DENIED"
  | "NO_CAMERA"
  | "LOADING_MODEL"
  | "PLAYING";

export type AppEvent = "start" | "granted" | "denied" | "noDevice" | "retry" | "modelReady";

const table: Record<AppState, Partial<Record<AppEvent, AppState>>> = {
  LANDING: { start: "REQUESTING_CAMERA" },
  REQUESTING_CAMERA: { granted: "LOADING_MODEL", denied: "CAMERA_DENIED", noDevice: "NO_CAMERA" },
  CAMERA_DENIED: { retry: "REQUESTING_CAMERA" },
  NO_CAMERA: { retry: "REQUESTING_CAMERA" },
  LOADING_MODEL: { modelReady: "PLAYING" },
  PLAYING: {},
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
