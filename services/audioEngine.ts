import * as Tone from 'tone';

// Define the shape of our "Sandbox" instruments
interface SandboxContext {
  synth: Tone.MonoSynth;
  kick: Tone.MembraneSynth;
  hat: Tone.MetalSynth;
  snare: Tone.NoiseSynth;
  poly: Tone.PolySynth;
  loop: (name: string, interval: string, callback: (time: number) => void) => void;
  Tone: typeof Tone; // Expose raw Tone for advanced users
}

export interface ExecutionResult {
  success: boolean;
  error?: string;
}

class AudioEngine {
  private synth: Tone.MonoSynth | null = null;
  private kick: Tone.MembraneSynth | null = null;
  private hat: Tone.MetalSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private poly: Tone.PolySynth | null = null;
  
  // Public analyser for visualization
  public analyser: Tone.Analyser | null = null;
  
  // Track scheduled event IDs to clear them later
  private scheduledEvents: number[] = [];

  constructor() {
    this.scheduledEvents = [];
  }

  public async initialize() {
    await Tone.start();
    
    // Initialize Analyser (Waveform default)
    if (!this.analyser) {
        // Use a larger size for better FFT resolution
        this.analyser = new Tone.Analyser("waveform", 2048); 
        this.analyser.toDestination();
    }

    if (!this.synth) {
      // Acid Bass Synth
      this.synth = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 1 },
        filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.1, baseFrequency: 200, octaves: 3 }
      }).connect(this.analyser);
    }

    if (!this.kick) {
      // Punchy Kick
      this.kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
      }).connect(this.analyser);
    }

    if (!this.hat) {
      // Metallic Hat
      this.hat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).connect(this.analyser);
      this.hat.volume.value = -10;
    }

    if (!this.snare) {
        // Noise Snare
        this.snare = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
        }).connect(this.analyser);
        this.snare.volume.value = -8;
    }

    if (!this.poly) {
        // Polyphonic Synth for Chords
        this.poly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
        }).connect(this.analyser);
        this.poly.volume.value = -12;
    }
  }

  public setAnalyserType(type: 'waveform' | 'fft') {
    if (this.analyser) {
      this.analyser.type = type;
    }
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  public stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Clears all scheduled events
    this.scheduledEvents = [];
    
    // Release all instruments to prevent stuck notes
    if (this.poly) this.poly.releaseAll();
    if (this.synth) this.synth.triggerRelease();
  }

  public async runCode(code: string, logCallback: (msg: string, type: 'info'|'error') => void): Promise<ExecutionResult> {
    try {
      await this.initialize();
      
      // Stop and clear previous run
      this.stop();

      // Define the custom loop function for the user
      const customLoop = (name: string, interval: string, callback: (time: number) => void) => {
        logCallback(`Scheduling loop: ${name} @ ${interval}`, 'info');
        const id = Tone.Transport.scheduleRepeat((time) => {
          try {
            callback(time);
          } catch (err: any) {
            console.error(err);
            // Runtime errors inside loop are async, hard to catch in the initial runCode Promise
            // But we log them for the user
            logCallback(`Runtime Error inside loop '${name}': ${err.message}`, 'error');
          }
        }, interval);
        this.scheduledEvents.push(id);
      };

      // Create the Function constructor to act as a sandbox
      const runUserScript = new Function(
        'synth', 
        'kick', 
        'hat', 
        'snare',
        'poly',
        'loop', 
        'Tone',
        `"use strict";\n${code}`
      );

      // Execute the user's code
      runUserScript(
        this.synth,
        this.kick,
        this.hat,
        this.snare,
        this.poly,
        customLoop,
        Tone
      );

      // Start the transport
      Tone.Transport.start();
      return { success: true };

    } catch (error: any) {
      logCallback(`Compilation Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }
}

export const audioService = new AudioEngine();