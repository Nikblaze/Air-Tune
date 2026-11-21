// AudioWorkletGlobalScope globals. TS's DOM lib has AudioWorkletNode but not these.
// No import/export on purpose: this must stay a global script declaration.
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;
declare const sampleRate: number;
