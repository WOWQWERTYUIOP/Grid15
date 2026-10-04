// Web Audio API procedural audio engine for GRID//15

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private boostGain: GainNode | null = null;
  private boostOsc: OscillatorNode | null = null;
  private lastGear: number = 1;
  private isEngineRunning: boolean = false;

  constructor() {
    // Initialized on first user interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.initEngineAudio();
      this.initSkidAudio();
      this.initWindAudio();
      this.initBoostAudio();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  private initEngineAudio() {
    if (!this.ctx || !this.masterGain) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(300, this.ctx.currentTime);

    // Multi-oscillator V6/V10 open-wheel harmonic timbre
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.isEngineRunning = true;
  }

  private initSkidAudio() {
    if (!this.ctx || !this.masterGain) return;

    // White noise buffer for tire screech
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.skidFilter = this.ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.skidFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.masterGain);

    whiteNoise.start();
  }

  private initWindAudio() {
    if (!this.ctx || !this.masterGain) return;

    // Pink/white noise for high-speed wind roar
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

    windNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    windNoise.start();
  }

  private initBoostAudio() {
    if (!this.ctx || !this.masterGain) return;

    this.boostOsc = this.ctx.createOscillator();
    this.boostOsc.type = 'sine';
    this.boostOsc.frequency.setValueAtTime(450, this.ctx.currentTime);

    this.boostGain = this.ctx.createGain();
    this.boostGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.boostOsc.connect(this.boostGain);
    this.boostGain.connect(this.masterGain);
    this.boostOsc.start();
  }

  public updateVehicleSound(speedKmh: number, isAccelerating: boolean, isDrifting: boolean, isBoosting: boolean) {
    if (!this.ctx || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const normSpeed = Math.min(1.0, Math.max(0, speedKmh / 320));

    // Calculate dynamic RPM & Gear
    let gear = 1;
    if (speedKmh < 55) gear = 1;
    else if (speedKmh < 100) gear = 2;
    else if (speedKmh < 145) gear = 3;
    else if (speedKmh < 190) gear = 4;
    else if (speedKmh < 235) gear = 5;
    else if (speedKmh < 280) gear = 6;
    else gear = 7;

    if (gear !== this.lastGear && isAccelerating) {
      this.playGearShiftPop(gear);
      this.lastGear = gear;
    }

    const gearFractions = [0, 55, 100, 145, 190, 235, 280, 350];
    const low = gearFractions[gear - 1];
    const high = gearFractions[gear];
    const fraction = Math.max(0, Math.min(1, (speedKmh - low) / (high - low)));

    const baseFreq = 58 + fraction * 145 + (isAccelerating ? 30 : 0);

    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter && this.engineGain) {
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, now, 0.04);

      const filterFreq = 350 + normSpeed * 3500 + (isAccelerating ? 1200 : 0);
      this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.04);

      const targetGain = 0.09 + normSpeed * 0.20 + (isAccelerating ? 0.08 : 0);
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.04);
    }

    // High-Speed Aerodynamic Wind Roar (Communicates difference between 80 km/h and 250+ km/h)
    if (this.windGain && this.windFilter) {
      const windTargetGain = speedKmh > 90 ? Math.min(0.22, ((speedKmh - 90) / 200) ** 1.5 * 0.22) : 0;
      this.windGain.gain.setTargetAtTime(windTargetGain, now, 0.08);
      const windCutoff = 300 + Math.min(1.0, speedKmh / 280) * 1400;
      this.windFilter.frequency.setTargetAtTime(windCutoff, now, 0.08);
    }

    // Skid noise
    if (this.skidGain) {
      const skidTargetGain = isDrifting ? Math.min(0.25, (speedKmh / 150) * 0.25) : 0;
      this.skidGain.gain.setTargetAtTime(skidTargetGain, now, 0.06);
    }

    // Boost whoosh
    if (this.boostGain && this.boostOsc) {
      const boostTargetGain = isBoosting ? 0.25 : 0;
      this.boostGain.gain.setTargetAtTime(boostTargetGain, now, 0.06);
      if (isBoosting) {
        this.boostOsc.frequency.setTargetAtTime(750 + normSpeed * 450, now, 0.06);
      }
    }
  }

  // Quick subtle backfire pop on gear upshift
  private playGearShiftPop(gear: number) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + gear * 15, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public stopVehicleSound() {
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, now, 0.1);
    if (this.skidGain) this.skidGain.gain.setTargetAtTime(0, now, 0.1);
    if (this.boostGain) this.boostGain.gain.setTargetAtTime(0, now, 0.1);
  }

  // Play countdown beep (high pitched for GO!, standard for 3, 2, 1)
  public playCountdownBeep(isFinal = false) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isFinal ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, now);
    if (isFinal) {
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.35);
    }

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.6 : 0.25));

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + (isFinal ? 0.6 : 0.25));
  }

  // Play powerup pickup chime
  public playPowerUpCollect() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  // Play power-up activation sound
  public playPowerUpUse(type: string) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'TURBO') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);
    } else if (type === 'EMP') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.5);
    } else if (type === 'SHIELD') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.3);
    }

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  private lastCollisionSoundTime: number = 0;
  private lastClickSoundTime: number = 0;

  // Play collision impact with polyphony limiting and throttle
  public playCollision(intensity = 1.0) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCollisionSoundTime < 0.12) return; // 120ms throttle
    this.lastCollisionSoundTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.14);

    const targetGain = Math.min(0.35, 0.12 * intensity);
    gain.gain.setValueAtTime(targetGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Play UI Click with throttle
  public playClick() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastClickSoundTime < 0.05) return;
    this.lastClickSoundTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.05);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Play Lap finish / Chequered flag
  public playFinishFanfare() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C major
    chord.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();
