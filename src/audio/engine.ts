import { config } from "../config";
import { playSimpleVoice } from "./simpleVoice";
import karplusUrl from "./worklets/karplus.worklet.ts?worker&url";

const MAX_PAN = 0.8; // hard-panned voices feel disconnected from the screen

function createEngine() {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  // voices -> master -> compressor -> dry --------------> destination
  //                               \-> convolver -> wet -/
  const master = new GainNode(ctx);
  const comp = new DynamicsCompressorNode(ctx); // stops chords from clipping
  const dry = new GainNode(ctx);
  const wet = new GainNode(ctx);
  const reverb = new ConvolverNode(ctx, { buffer: makeImpulse(ctx, config.audio.reverbSeconds) });
  master.connect(comp);
  comp.connect(dry).connect(ctx.destination);
  comp.connect(reverb).connect(wet).connect(ctx.destination);
  // The recorder taps the same final dry+wet sum the speakers get (SPEC §10.7).
  const recordDest = ctx.createMediaStreamDestination();
  dry.connect(recordDest);
  wet.connect(recordDest);

  // Karplus-Strong worklet loads async; until it is ready plucks use the Phase 3 oscillator voice.
  const synthGain = new GainNode(ctx);
  synthGain.connect(master);
  let synth: AudioWorkletNode | null = null;
  ctx.audioWorklet
    .addModule(karplusUrl)
    .then(() => {
      synth = new AudioWorkletNode(ctx, "karplus", { numberOfInputs: 0, outputChannelCount: [2] });
      synth.connect(synthGain);
    })
    .catch((err) => console.warn("Karplus worklet failed to load; using the simple voice", err));

  return {
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    recordStream: () => recordDest.stream,
    pluck({ hz, velocity, pan }: { hz: number; velocity: number; pan: number }) {
      // Read live so debug-panel edits apply to the next note.
      master.gain.value = config.audio.volume;
      wet.gain.value = config.audio.reverb;
      synthGain.gain.value = config.audio.karplusGain;
      pan = Math.min(MAX_PAN, Math.max(-MAX_PAN, pan));
      if (synth) {
        synth.port.postMessage({ type: "pluck", hz, velocity, pan, instrument: config.audio.instrument });
        return;
      }
      const panner = new StereoPannerNode(ctx, { pan });
      panner.connect(master);
      playSimpleVoice(ctx, panner, hz, velocity).addEventListener("ended", () => panner.disconnect());
    },
  };
}

/** Synthetic room: stereo white noise with a cubic fade-out. Cheap and sounds fine for a harp. */
function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  }
  return buf;
}

let engine: ReturnType<typeof createEngine> | null = null;
/** Lazily creates the single AudioContext. First call must happen inside a user click (autoplay rules). */
export const getAudio = () => (engine ??= createEngine());
