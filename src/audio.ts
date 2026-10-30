// Synthesized sound: no files, starts after the first gesture.

/** A sneaky pizzicato bass line per hall (Hz, 0 = rest), 16 steps. */
const THEMES: Record<string, number[]> = {
  menu: [110, 0, 131, 0, 147, 0, 131, 104, 110, 0, 165, 0, 147, 131, 0, 98],
  lengths: [110, 0, 131, 0, 147, 0, 131, 104, 110, 0, 165, 0, 147, 131, 0, 98],
  shadows: [98, 0, 0, 117, 0, 0, 104, 0, 98, 0, 0, 87, 0, 0, 92, 0],
  canvas: [131, 0, 165, 196, 0, 165, 147, 0, 131, 0, 165, 196, 220, 0, 196, 0],
  vault: [82, 82, 0, 98, 0, 87, 0, 82, 82, 0, 117, 0, 110, 0, 98, 0],
  rooftop: [147, 0, 185, 0, 220, 0, 185, 165, 147, 0, 196, 0, 220, 247, 0, 220],
};
export class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  private siren: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  private music: { nodes: AudioNode[]; gain: GainNode; timer: number } | null = null;
  theme = 'menu';

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol = 0.3, filter = 1200, delay = 0, q = 0.7): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  step(): void { this.noise(0.06, 0.06, 900); }
  grab(): void { this.tone(300, 0.35, 'sine', 0.18, 2.4); this.tone(900, 0.25, 'triangle', 0.06, 1.5, 0.05); }
  whoosh(): void { this.noise(0.4, 0.25, 2400, 0, 2); this.tone(700, 0.4, 'sine', 0.08, 0.4); }
  thunk(): void { this.tone(110, 0.25, 'sine', 0.5, 0.5); this.noise(0.12, 0.2, 500); }
  fit(): void {
    this.thunk();
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, 1, 0.12 + i * 0.09));
  }
  crash(): void {
    this.noise(1.2, 0.7, 5000);
    this.noise(0.8, 0.5, 300, 0.05);
    for (let i = 0; i < 8; i++) this.tone(2000 + Math.random() * 3000, 0.15, 'triangle', 0.05, 0.8, 0.05 + Math.random() * 0.6);
  }
  plop(): void { this.tone(500, 0.5, 'sine', 0.2, 0.25); }
  fan(): void { this.noise(0.9, 0.35, 1600, 0, 3); this.tone(200, 0.9, 'sawtooth', 0.04, 3); }
  jam(): void { this.tone(140, 0.15, 'square', 0.15); this.tone(110, 0.25, 'square', 0.15, 1, 0.16); }
  buzz(): void { this.tone(90, 0.4, 'sawtooth', 0.12); }
  climb(): void { this.tone(220, 0.15, 'triangle', 0.1, 1.6); }
  hint(): void { this.tone(880, 0.2, 'sine', 0.1); this.tone(1320, 0.3, 'sine', 0.08, 1, 0.1); }
  rotate(): void { this.tone(600, 0.08, 'square', 0.06); }
  hey(): void { this.tone(330, 0.12, 'square', 0.12, 1.3); this.tone(440, 0.25, 'square', 0.12, 0.7, 0.13); }
  cheer(): void { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'square', 0.05, 1, i * 0.07)); }
  win(): void { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, 1, i * 0.11)); }
  hide(): void { this.tone(180, 0.3, 'sine', 0.2, 0.6); this.noise(0.3, 0.15, 600); }
  caught(): void { this.tone(400, 0.6, 'sawtooth', 0.15, 0.3); this.noise(0.3, 0.4, 900, 0.3); }

  alarm(on: boolean): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (on && !this.siren) {
      const osc = c.createOscillator();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 700;
      lfo.frequency.value = 1.6;
      lg.gain.value = 260;
      lfo.connect(lg).connect(osc.frequency);
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.2);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      osc.connect(f).connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.siren = { osc, lfo, gain };
    } else if (!on && this.siren) {
      const s = this.siren;
      s.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.15);
      s.osc.stop(c.currentTime + 0.8);
      s.lfo.stop(c.currentTime + 0.8);
      this.siren = null;
    }
  }

  /** Sneaky pizzicato bass + soft pad, looping. */
  private startMusic(): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const gain = c.createGain();
    gain.gain.value = 0.35;
    gain.connect(this.master);
    let i = 0;
    const tick = () => {
      if (!this.ctx) return;
      const notes = THEMES[this.theme] ?? THEMES.menu;
      const f = notes[i++ % notes.length];
      if (f) {
        const t = c.currentTime;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g).connect(gain);
        o.start(t);
        o.stop(t + 0.3);
        if (i % 8 === 1) {
          const p = c.createOscillator();
          const pg = c.createGain();
          p.type = 'sine';
          p.frequency.value = f * 4;
          pg.gain.setValueAtTime(0.0001, t);
          pg.gain.exponentialRampToValueAtTime(0.025, t + 0.4);
          pg.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
          p.connect(pg).connect(gain);
          p.start(t);
          p.stop(t + 2.3);
        }
      }
    };
    const timer = window.setInterval(tick, 230);
    this.music = { nodes: [], gain, timer };
  }

  setMusicTension(alarm: boolean): void {
    if (this.music && this.ctx) this.music.gain.gain.setTargetAtTime(alarm ? 0.12 : 0.35, this.ctx.currentTime, 0.3);
  }
}
