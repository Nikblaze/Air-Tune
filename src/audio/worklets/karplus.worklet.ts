// Polyphonic Karplus-Strong on the audio thread. One node renders every voice, so pan lives here.
import { createVoice, excite, INSTRUMENTS, tick, type InstrumentId, type Voice } from "../../core/karplus";

const VOICES = 16;
const LOWEST_HZ = 30;

interface PluckMsg {
  type: "pluck";
  hz: number;
  velocity: number;
  pan: number; // -1..1
  instrument: InstrumentId;
}

class KarplusProcessor extends AudioWorkletProcessor {
  // Everything is allocated here; process() never allocates (GC pauses = audible glitches).
  private voices: Voice[] = Array.from({ length: VOICES }, () => createVoice(sampleRate, Math.ceil(sampleRate / LOWEST_HZ) + 8));
  private gl = new Float32Array(VOICES);
  private gr = new Float32Array(VOICES);
  private born = new Float64Array(VOICES); // pluck counter, for stealing the oldest
  private count = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<PluckMsg>) => {
      const m = e.data;
      if (m.type !== "pluck") return;
      let slot = this.voices.findIndex((v) => !v.active);
      if (slot < 0) slot = this.born.indexOf(Math.min(...this.born));
      const inst = INSTRUMENTS[m.instrument] ?? INSTRUMENTS.harp;
      excite(this.voices[slot], { ...inst, hz: m.hz, velocity: m.velocity }, Math.random);
      // Equal-power pan: L² + R² = 1, so loudness doesn't dip when a note sits mid-screen.
      const a = ((m.pan + 1) * Math.PI) / 4;
      this.gl[slot] = Math.cos(a);
      this.gr[slot] = Math.sin(a);
      this.born[slot] = ++this.count;
    };
  }

  process(_in: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [L, R] = outputs[0];
    L.fill(0);
    R.fill(0);
    for (let s = 0; s < VOICES; s++) {
      const v = this.voices[s];
      for (let k = 0; v.active && k < L.length; k++) {
        const y = tick(v);
        L[k] += y * this.gl[s];
        R[k] += y * this.gr[s];
      }
    }
    return true; // keep alive; silent voices cost nothing
  }
}

registerProcessor("karplus", KarplusProcessor);
