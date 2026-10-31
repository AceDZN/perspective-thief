// Synthesized sound: no files, starts after the first gesture.
// Music is a small lookahead sequencer: per-hall chord pad, pizzicato bass, brushed drums and a
// bell motif, all sent through one generated hall reverb. The alarm adds a chase layer; a
// heartbeat rises as the guard gets close.

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

interface Theme {
  bpm: number;
  /** Chord roots (MIDI) and qualities, one per bar. */
  chords: [number, 'm' | 'M'][];
  /** Bass per bar: 8 eighth notes, semitones above the chord root, null = rest. */
  bass: (number | null)[];
  drums: boolean;
  /** Bell arpeggio every few bars (chord tones, semitones above the root). */
  bell: number[];
  pad: OscillatorType;
}

const THEMES: Record<string, Theme> = {
  menu: { bpm: 92, chords: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'M']], bass: [0, null, 7, null, 12, null, 7, null], drums: false, bell: [12, 15, 19, 24], pad: 'sawtooth' },
  // Sneaky A minor tiptoe.
  lengths: { bpm: 104, chords: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'M']], bass: [0, null, 7, null, 12, null, 7, 5], drums: true, bell: [12, 15, 19, 15], pad: 'sawtooth' },
  // Slow noir D minor.
  shadows: { bpm: 84, chords: [[50, 'm'], [46, 'M'], [43, 'm'], [45, 'M']], bass: [0, null, null, 7, null, null, 0, null], drums: true, bell: [24, 19, 15, 12], pad: 'triangle' },
  // Playful C major.
  canvas: { bpm: 112, chords: [[48, 'M'], [45, 'm'], [53, 'M'], [55, 'M']], bass: [0, null, 7, 12, null, 7, 4, null], drums: true, bell: [12, 16, 19, 24], pad: 'sawtooth' },
  // Tense E phrygian ostinato.
  vault: { bpm: 96, chords: [[52, 'm'], [53, 'M'], [52, 'm'], [50, 'M']], bass: [0, 0, null, 0, null, 0, 1, null], drums: true, bell: [12, 13, 19, 12], pad: 'triangle' },
  // Bright G major dawn.
  rooftop: { bpm: 120, chords: [[55, 'M'], [50, 'M'], [52, 'm'], [48, 'M']], bass: [0, null, 7, null, 12, 7, null, 4], drums: true, bell: [12, 16, 19, 24], pad: 'sawtooth' },
};

const MUSIC = 0.8;
const triad = (q: 'm' | 'M') => (q === 'm' ? [0, 3, 7] : [0, 4, 7]);

export class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  private sfx: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private verb: GainNode | null = null;
  private siren: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  private seq = { step: 0, next: 0, timer: 0 };
  private tension = false;
  private danger = 0;
  private nextBeat = 0;
  private amb: { nodes: AudioScheduledSourceNode[]; gain: GainNode } | null = null;
  private _theme = 'menu';

  get theme(): string { return this._theme; }
  set theme(t: string) {
    if (t === this._theme) return;
    this._theme = t;
    this.startAmbience();
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const c = new AudioContext();
      this.ctx = c;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
      // Hall reverb: a generated stereo impulse (decaying noise).
      const conv = c.createConvolver();
      const len = Math.floor(c.sampleRate * 2.4);
      const ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
      }
      conv.buffer = ir;
      this.verb = c.createGain();
      this.verb.gain.value = 0.32;
      this.verb.connect(conv).connect(this.master);
      this.sfx = c.createGain();
      this.sfx.connect(this.master);
      const sfxSend = c.createGain();
      sfxSend.gain.value = 0.35;
      this.sfx.connect(sfxSend).connect(this.verb);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = MUSIC;
      this.musicBus.connect(this.master);
      const musicSend = c.createGain();
      musicSend.gain.value = 0.8;
      this.musicBus.connect(musicSend).connect(this.verb);
      this.seq.next = c.currentTime + 0.1;
      this.seq.timer = window.setInterval(() => this.schedule(), 50);
      this.startAmbience();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  // ───────────── primitives ─────────────

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0, out?: AudioNode, at?: number): void {
    const c = this.ctx;
    const dest = out ?? this.sfx;
    if (!c || !dest) return;
    const t = at ?? c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBuf(dur: number, shape = 2): AudioBuffer | null {
    const c = this.ctx;
    if (!c) return null;
    const len = Math.max(1, Math.ceil(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** shape;
    return buf;
  }

  private noise(dur: number, vol = 0.3, filter = 1200, delay = 0, q = 0.7, type: BiquadFilterType = 'lowpass', out?: AudioNode, at?: number): void {
    const c = this.ctx;
    const dest = out ?? this.sfx;
    if (!c || !dest) return;
    const t = at ?? c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf(dur);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = filter;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(dest);
    s.start(t);
  }

  // ───────────── sound effects ─────────────

  step(): void { this.noise(0.07, 0.07, 700 + Math.random() * 400); }
  grab(): void {
    this.tone(300, 0.35, 'sine', 0.18, 2.4);
    this.tone(900, 0.25, 'triangle', 0.06, 1.5, 0.05);
    [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.03, 1, 0.08 + i * 0.05));
  }
  whoosh(): void { this.noise(0.45, 0.25, 2400, 0, 2, 'bandpass'); this.tone(700, 0.4, 'sine', 0.08, 0.4); }
  thunk(): void { this.tone(110, 0.3, 'sine', 0.5, 0.5); this.noise(0.14, 0.22, 500); }
  fit(): void {
    this.thunk();
    this.duck(1.6);
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.14, 1, 0.12 + i * 0.09));
    [2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.035, 1, 0.5 + i * 0.07));
  }
  crash(): void {
    this.duck(2);
    this.tone(55, 1.2, 'sine', 0.6, 0.5);
    this.noise(1.4, 0.7, 5000);
    this.noise(0.9, 0.5, 300, 0.05);
    for (let i = 0; i < 12; i++) this.tone(2000 + Math.random() * 3500, 0.18, 'triangle', 0.05, 0.8, 0.05 + Math.random() * 0.8);
  }
  plop(): void { this.tone(500, 0.5, 'sine', 0.2, 0.25); }
  fan(): void { this.noise(0.9, 0.35, 1600, 0, 3, 'bandpass'); this.tone(200, 0.9, 'sawtooth', 0.04, 3); }
  jam(): void { this.tone(140, 0.15, 'square', 0.15); this.tone(110, 0.25, 'square', 0.15, 1, 0.16); this.noise(0.1, 0.2, 3000, 0.02); }
  buzz(): void { this.tone(90, 0.4, 'sawtooth', 0.12); }
  climb(): void { this.tone(220, 0.15, 'triangle', 0.1, 1.6); this.noise(0.1, 0.08, 900, 0.05); }
  hint(): void { this.tone(880, 0.3, 'sine', 0.1); this.tone(1320, 0.45, 'sine', 0.08, 1, 0.1); }
  rotate(): void { this.tone(600, 0.08, 'square', 0.06); this.noise(0.05, 0.08, 4000, 0, 1, 'highpass'); }
  hey(): void { this.tone(330, 0.12, 'square', 0.12, 1.3); this.tone(440, 0.25, 'square', 0.12, 0.7, 0.13); }
  cheer(): void { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, 'square', 0.05, 1, i * 0.07)); }
  win(): void {
    this.duck(3);
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.12, 1, i * 0.11));
    [523, 659, 784].forEach((f) => this.tone(f, 1.8, 'sine', 0.06, 1, 0.7));
  }
  hide(): void { this.tone(180, 0.3, 'sine', 0.2, 0.6); this.noise(0.3, 0.15, 600); }
  caught(): void { this.tone(400, 0.6, 'sawtooth', 0.15, 0.3); this.noise(0.3, 0.4, 900, 0.3); }

  alarm(on: boolean): void {
    const c = this.ctx;
    if (!c || !this.sfx) return;
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
      gain.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.2);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      osc.connect(f).connect(gain).connect(this.sfx);
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

  /** Alarm on: the music switches to its chase layer (faster, drums up, string stabs). */
  setMusicTension(alarm: boolean): void { this.tension = alarm; }

  /** 0 (safe) … 1 (the guard is right here): drives the heartbeat. */
  setDanger(d: number): void { this.danger = Math.max(0, Math.min(1, d)); }

  /** Music dips under big moments. */
  private duck(sec: number): void {
    const c = this.ctx;
    if (!c || !this.musicBus) return;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(c.currentTime);
    g.setTargetAtTime(MUSIC * 0.25, c.currentTime, 0.05);
    g.setTargetAtTime(MUSIC, c.currentTime + sec, 0.6);
  }

  // ───────────── music ─────────────

  private schedule(): void {
    const c = this.ctx;
    if (!c || !this.musicBus) return;
    if (this.seq.next < c.currentTime - 0.5) this.seq.next = c.currentTime + 0.05; // tab was asleep
    while (this.seq.next < c.currentTime + 0.25) {
      this.playStep(this.seq.step, this.seq.next);
      const th = THEMES[this._theme] ?? THEMES.menu;
      const bpm = th.bpm * (this.tension ? 1.3 : 1);
      this.seq.next += 60 / bpm / 2;
      this.seq.step++;
    }
    // Heartbeat (lub-dub) when the guard is near and the alarm isn't already blaring.
    if (this.danger > 0.05 && !this.tension && c.currentTime >= this.nextBeat) {
      const t = Math.max(c.currentTime, this.nextBeat);
      const v = 0.08 + this.danger * 0.22;
      this.tone(58, 0.16, 'sine', v, 0.6, 0, this.sfx!, t);
      this.tone(52, 0.18, 'sine', v * 0.7, 0.6, 0, this.sfx!, t + 0.2);
      this.nextBeat = t + 1.1 - this.danger * 0.55;
    }
  }

  private playStep(step: number, t: number): void {
    const th = THEMES[this._theme] ?? THEMES.menu;
    const out = this.musicBus!;
    const bar = Math.floor(step / 8) % th.chords.length;
    const beat = step % 8;
    const [root, q] = th.chords[bar];
    const tense = this.tension;
    const stepDur = 60 / (th.bpm * (tense ? 1.3 : 1)) / 2;

    // Pad: soft chord at the start of each bar (filtered, slow attack).
    if (beat === 0 && !tense) this.pad(triad(q).map((s) => midi(root + 12 + s)), stepDur * 8, th.pad, t);

    // Pizzicato bass.
    const b = th.bass[beat];
    if (b !== null) this.pluck(midi(root - 12 + b), tense ? 0.2 : 0.28, tense ? 0.16 : 0.11, t);

    // Drums.
    if (th.drums || tense) {
      if (beat % 2 === 1 || tense) this.noise(0.05, tense ? 0.07 : 0.035, 7000, 0, 0.7, 'highpass', out, t);
      if (beat === 0 || beat === 4 || (tense && beat % 2 === 0)) this.tone(110, 0.22, 'sine', tense ? 0.42 : 0.3, 0.4, 0, out, t);
      if (beat === 2 || beat === 6) this.noise(0.12, tense ? 0.14 : 0.06, 1800, 0, 1.2, 'bandpass', out, t);
    }

    // Bell motif every other bar (calm only).
    if (!tense && bar % 2 === 1 && beat < th.bell.length * 2 && beat % 2 === 0) {
      this.tone(midi(root + 12 + th.bell[beat / 2]), 0.9, 'sine', 0.05, 1, 0, out, t);
      this.tone(midi(root + 24 + th.bell[beat / 2]), 0.5, 'sine', 0.012, 1, 0, out, t);
    }

    // Chase: staccato string stabs on every eighth.
    if (tense) {
      const tones = triad(q);
      this.tone(midi(root + 12 + tones[beat % 3]), 0.12, 'sawtooth', 0.045, 1, 0, out, t);
    }
  }

  private pluck(f: number, dur: number, vol: number, t: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 8, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.musicBus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(freqs: number[], dur: number, type: OscillatorType, t: number): void {
    const c = this.ctx!;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    lp.connect(g).connect(this.musicBus!);
    for (const f of freqs) {
      for (const det of [-7, 7]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur * 1.1);
      }
    }
  }

  // ───────────── ambience ─────────────

  private startAmbience(): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (this.amb) {
      const old = this.amb;
      old.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
      for (const n of old.nodes) n.stop(c.currentTime + 2);
      this.amb = null;
    }
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master);
    const nodes: AudioScheduledSourceNode[] = [];
    const loopNoise = (filter: BiquadFilterType, freq: number, q: number, vol: number) => {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf(4, 0);
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = vol;
      s.connect(f).connect(g).connect(gain);
      s.start();
      nodes.push(s);
      return { f, g };
    };
    const t = this._theme;
    if (t === 'rooftop') {
      // Wind: band-passed noise whose pitch and level drift.
      const w = loopNoise('bandpass', 500, 0.8, 0.5);
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = c.createGain();
      lg.gain.value = 260;
      lfo.connect(lg).connect(w.f.frequency);
      const lfo2 = c.createOscillator();
      lfo2.frequency.value = 0.07;
      const lg2 = c.createGain();
      lg2.gain.value = 0.25;
      lfo2.connect(lg2).connect(w.g.gain);
      lfo.start();
      lfo2.start();
      nodes.push(lfo, lfo2);
    } else if (t === 'vault') {
      // Machine hum.
      loopNoise('lowpass', 160, 0.7, 0.35);
      for (const [f, v] of [[50, 0.05], [100, 0.02]] as const) {
        const o = c.createOscillator();
        o.frequency.value = f;
        const g = c.createGain();
        g.gain.value = v;
        o.connect(g).connect(gain);
        o.start();
        nodes.push(o);
      }
    } else if (t !== 'menu') {
      // Big quiet room: low air.
      loopNoise('lowpass', t === 'shadows' ? 220 : 320, 0.6, 0.4);
    }
    gain.gain.setTargetAtTime(t === 'menu' ? 0.0001 : 0.12, c.currentTime + 0.3, 0.8);
    this.amb = { nodes, gain };
  }
}
