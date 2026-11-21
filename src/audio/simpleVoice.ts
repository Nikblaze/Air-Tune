import { config } from "../config";

/** Phase 3 voice: triangle oscillator with a fast attack and exponential decay. Replaced by Karplus-Strong in Phase 5. */
export function playSimpleVoice(ctx: AudioContext, out: AudioNode, hz: number, velocity: number): OscillatorNode {
  const { voiceGain, decaySeconds } = config.audio;
  const attack = 0.005; // short but non-zero: an instant jump to peak clicks
  const t0 = ctx.currentTime;
  const osc = new OscillatorNode(ctx, { type: "triangle", frequency: hz });
  const env = new GainNode(ctx, { gain: 0 });
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(velocity * voiceGain, t0 + attack);
  // Exponential ramps can't reach 0, so aim at an inaudible floor.
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decaySeconds);
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(t0 + attack + decaySeconds + 0.05);
  osc.addEventListener("ended", () => {
    osc.disconnect();
    env.disconnect();
  });
  return osc;
}
