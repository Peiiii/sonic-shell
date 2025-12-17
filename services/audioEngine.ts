import * as Tone from 'tone';

// Define the shape of our "Sandbox" instruments
interface SandboxContext {
  synth: Tone.MonoSynth;
  kick: Tone.MembraneSynth;
  hat: Tone.MetalSynth;
  loop: (name: string, interval: string, callback: (time: number) => void) => void;
  Tone: typeof Tone; // Expose raw Tone for advanced users
}

class AudioEngine {
  private synth: Tone.MonoSynth | null = null;
  private kick: Tone.MembraneSynth | null = null;
  private hat: Tone.MetalSynth | null = null;
  
  // Track scheduled event IDs to clear them later
  private scheduledEvents: number[] = [];

  constructor() {
    this.scheduledEvents = [];
  }

  public async initialize() {
    await Tone.start();
    
    if (!this.synth) {
      // Acid Bass Synth
      this.synth = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 1 },
        filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.1, baseFrequency: 200, octaves: 3 }
      }).toDestination();
    }

    if (!this.kick) {
      // Punchy Kick
      this.kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6, // Fixed: Value must be within [0.5, 8]
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
      }).toDestination();
    }

    if (!this.hat) {
      // Metallic Hat
      this.hat = new Tone.MetalSynth({
        frequency: 200,
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).toDestination();
      this.hat.volume.value = -10;
    }
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  public stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Clears all scheduled events
    this.scheduledEvents = [];
  }

  public async runCode(code: string, logCallback: (msg: string, type: 'info'|'error') => void) {
    try {
      await this.initialize();
      
      // Stop and clear previous run
      this.stop();

      // Define the custom loop function for the user
      // We wrap Tone.Transport.scheduleRepeat
      const customLoop = (name: string, interval: string, callback: (time: number) => void) => {
        logCallback(`Scheduling loop: ${name} @ ${interval}`, 'info');
        const id = Tone.Transport.scheduleRepeat((time) => {
          try {
            callback(time);
          } catch (err: any) {
            console.error(err);
            logCallback(`Runtime Error inside loop '${name}': ${err.message}`, 'error');
          }
        }, interval);
        this.scheduledEvents.push(id);
      };

      // Create the Function constructor to act as a sandbox
      // The arguments match the keys we pass in 'args' below
      const runUserScript = new Function(
        'synth', 
        'kick', 
        'hat', 
        'loop', 
        'Tone',
        `"use strict";\n${code}`
      );

      // Execute the user's code
      runUserScript(
        this.synth,
        this.kick,
        this.hat,
        customLoop,
        Tone
      );

      // Start the transport
      Tone.Transport.start();
      return true;

    } catch (error: any) {
      logCallback(`Compilation Error: ${error.message}`, 'error');
      return false;
    }
  }
}

export const audioService = new AudioEngine();