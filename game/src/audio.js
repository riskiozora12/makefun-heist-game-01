// Night Vault — synthesised sound, no audio files.
// Every effect is built from oscillators and filtered noise at run
// time, so the game ships no samples and plays the same anywhere.
// The context is created lazily on the first user gesture; until
// then every call is a silent no-op, which also keeps headless runs
// (screenshots, tests) free of audio errors.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.droneNodes = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
  }

  tone(freq, duration, type, volume, slideTo) {
    if (!this.ensure() || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noiseBurst(duration, volume, filterFreq) {
    if (!this.ensure() || this.muted) return;
    const now = this.ctx.currentTime;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  footstep() {
    this.noiseBurst(0.07, 0.12, 500);
  }

  coinRing() {
    this.tone(2093, 0.35, 'sine', 0.25, 1568);
    this.tone(2637, 0.3, 'sine', 0.12, 2093);
  }

  pickup() {
    this.tone(523, 0.12, 'triangle', 0.25);
    setTimeout(() => this.tone(784, 0.18, 'triangle', 0.25), 90);
    setTimeout(() => this.tone(1047, 0.25, 'triangle', 0.2), 180);
  }

  alert() {
    this.tone(440, 0.18, 'square', 0.16, 660);
  }

  caught() {
    this.tone(220, 0.5, 'sawtooth', 0.2, 110);
    this.noiseBurst(0.25, 0.15, 900);
  }

  smoke() {
    this.noiseBurst(0.4, 0.18, 1200);
  }

  emp() {
    this.tone(1200, 0.4, 'sawtooth', 0.12, 120);
  }

  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 0.4, 'triangle', 0.25), i * 140);
    });
  }

  startDrone() {
    if (!this.ensure() || this.muted || this.droneNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const wobble = this.ctx.createOscillator();
    wobble.frequency.value = 0.07;
    const wobbleGain = this.ctx.createGain();
    wobbleGain.gain.value = 6;
    wobble.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    wobble.start();
    this.droneNodes = { osc, wobble, gain };
  }

  stopDrone() {
    if (!this.droneNodes) return;
    try {
      this.droneNodes.osc.stop();
      this.droneNodes.wobble.stop();
    } catch (err) {
      // Already stopped; nothing to do.
    }
    this.droneNodes = null;
  }
}
