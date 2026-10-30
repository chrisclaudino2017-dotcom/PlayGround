/* ============================================================
   AUDIO — all procedural, no files, no libraries
   ============================================================ */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ready = false;
    this.threat = 0;
    this.beatTimer = 0;
    this.creakTimer = 6;
    this.whisperTimer = 20;
    this.engineNodes = null;
    this.pan = null;
    this.scene = 'menu';
  }

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch {} }
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    let ctx;
    try { ctx = new AC(); } catch { return false; }
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 7;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
    this.master = master;

    // reusable noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.55 + last * 2.2;
    }
    this.noiseBuffer = buf;

    this._buildAmbient();
    this.ready = true;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
    return true;
  }

  _buildAmbient() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.55;
    bus.connect(this.master);
    this.ambientBus = bus;

    // low drone
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.075;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 190; lp.Q.value = 0.7;
    droneGain.connect(lp).connect(bus);
    for (const [f, type, g] of [[46, 'sine', 0.9], [69.3, 'triangle', 0.32], [92.7, 'sine', 0.16], [139.1, 'sine', 0.05]]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      const gg = ctx.createGain(); gg.gain.value = g;
      o.connect(gg).connect(droneGain);
      o.start();
    }
    // beating detune
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 3.5;
    lfo.connect(lfoGain);
    lfo.start();

    // room air
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer; air.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.55;
    const airGain = ctx.createGain(); airGain.gain.value = 0.026;
    air.connect(bp).connect(airGain).connect(bus);
    air.start();

    // distant wind, very quiet
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer; wind.loop = true;
    const wlp = ctx.createBiquadFilter();
    wlp.type = 'lowpass'; wlp.frequency.value = 140;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    wind.connect(wlp).connect(wg).connect(bus);
    wind.start();

    // servo whine bus (spatial)
    const servoGain = ctx.createGain(); servoGain.gain.value = 0;
    let servoPan = null;
    if (ctx.createStereoPanner) {
      servoPan = ctx.createStereoPanner();
      servoGain.connect(servoPan).connect(this.master);
    } else {
      servoGain.connect(this.master);
    }
    this.servoPan = servoPan;
    this.servoGain = servoGain;

    const so1 = ctx.createOscillator();
    so1.type = 'sawtooth'; so1.frequency.value = 86;
    const so2 = ctx.createOscillator();
    so2.type = 'triangle'; so2.frequency.value = 172.5;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass'; sf.frequency.value = 760; sf.Q.value = 2.4;
    const sg = ctx.createGain(); sg.gain.value = 0.34;
    so1.connect(sf); so2.connect(sf); sf.connect(sg).connect(servoGain);
    so1.start(); so2.start();

    // mechanical rattle
    const rattle = ctx.createBufferSource();
    rattle.buffer = this.noiseBuffer; rattle.loop = true;
    const rbp = ctx.createBiquadFilter();
    rbp.type = 'bandpass'; rbp.frequency.value = 1800; rbp.Q.value = 3.2;
    const rg = ctx.createGain(); rg.gain.value = 0.11;
    const rlfo = ctx.createOscillator(); rlfo.frequency.value = 7.5;
    const rlfoGain = ctx.createGain(); rlfoGain.gain.value = 0.09;
    rlfo.connect(rlfoGain).connect(rg.gain);
    rattle.connect(rbp).connect(rg).connect(servoGain);
    rattle.start(); rlfo.start();

    // lit whine, only when stared at
    const whineGain = ctx.createGain(); whineGain.gain.value = 0;
    const wo = ctx.createOscillator();
    wo.type = 'sine'; wo.frequency.value = 1350;
    const wo2 = ctx.createOscillator();
    wo2.type = 'sine'; wo2.frequency.value = 2020;
    const wob = ctx.createGain(); wob.gain.value = 5;
    const wlfo = ctx.createOscillator(); wlfo.frequency.value = 5.2;
    wlfo.connect(wob);
    wob.connect(wo.frequency);
    wo.connect(whineGain); wo2.connect(whineGain);
    if (this.servoPan) whineGain.connect(this.servoPan); else whineGain.connect(this.master);
    wo.start(); wo2.start(); wlfo.start();
    this.whineGain = whineGain;

    // heartbeat / breath bus
    this.heartGain = ctx.createGain();
    this.heartGain.gain.value = 0;
    this.heartGain.connect(this.master);
  }

  _noise(dur = 0.2, gain = 0.2, freq = 500, q = 1, type = 'bandpass', pan = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f).connect(g);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      g.connect(p).connect(this.master);
    } else g.connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(m ? 0.0001 : 0.9, now, 0.05);
    }
  }

  setScene(scene) {
    this.scene = scene;
    if (!this.ambientBus) return;
    const now = this.ctx.currentTime;
    let target = 0.55;
    if (scene === 'title' || scene === 'intro') target = 0.32;
    if (scene === 'pause' || scene === 'note') target = 0.12;
    if (scene === 'death' || scene === 'win') target = 0.2;
    if (scene === 'cine') target = 0.22;
    this.ambientBus.gain.setTargetAtTime(target, now, 0.4);
  }

  /* ---------- one-shots ---------- */
  click() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 660;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.09);
  }

  footstep(strong = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380 + Math.random() * 220; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.11 * strong, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    src.connect(f).connect(g).connect(this.master);
    src.start(now); src.stop(now + 0.2);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, now);
    o.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.09 * strong, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    o.connect(og).connect(this.master);
    o.start(now); o.stop(now + 0.16);
  }

  pickup(kind = 'item') {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const base = kind === 'key' ? 520 : kind === 'gas' ? 220 : 440;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = base * 2.01;
    const mg = ctx.createGain(); mg.gain.value = base * 1.2;
    mod.connect(mg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    o.connect(g).connect(this.master);
    o.start(now); mod.start(now);
    o.stop(now + 1.6); mod.stop(now + 1.6);

    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(base * 2, now + 0.09);
    o2.frequency.exponentialRampToValueAtTime(base * 1.5, now + 1.2);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, now + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    o2.connect(g2).connect(this.master);
    o2.start(now + 0.05); o2.stop(now + 1.5);

    const thud = ctx.createOscillator(); thud.type = 'sine';
    thud.frequency.setValueAtTime(80, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.22, now);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    thud.connect(tg).connect(this.master);
    thud.start(now); thud.stop(now + 0.45);
  }

  battery() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = 880 + i * 220;
      const g = ctx.createGain();
      const t = now + i * 0.055;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.06);
    }
  }

  lightClick(on) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = on ? 1200 : 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.055, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.06);
  }

  note() {
    if (!this.ctx || this.muted) return;
    this._noise(0.5, 0.09, 2400, 1.4, 'bandpass');
    this.pickup('paper');
  }

  stinger(big = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const freqs = [110, 130.8, 155.6, 164.8];
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.05 * big, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      o.connect(flt).connect(g).connect(this.master);
      o.start(now); o.stop(now + 2.3);
    }
    this._noise(1.8, 0.16 * big, 900, 0.6, 'bandpass');
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(70, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 1.6);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.28 * big, now);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
    sub.connect(sg).connect(this.master);
    sub.start(now); sub.stop(now + 1.8);
  }

  scream() {
    if (!this.ctx || this.muted) return 1.4;
    const ctx = this.ctx, now = ctx.currentTime;
    const dur = 1.6;

    // distorted noise
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    src.playbackRate.value = 1.4;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(240, now + dur);
    const shaper = ctx.createWaveShaper();
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const xx = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(xx * 6);
    }
    shaper.curve = curve;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.42, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(shaper).connect(g).connect(this.master);
    src.start(now); src.stop(now + dur);

    // metal shriek
    for (const [f0, f1, gain] of [[1750, 90, 0.19], [1320, 60, 0.14], [880, 45, 0.1]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, now);
      o.frequency.exponentialRampToValueAtTime(f1, now + 1.2);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(gain, now + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
      o.connect(og).connect(this.master);
      o.start(now); o.stop(now + 1.5);
    }
    // body hit
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.9);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.55, now);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    sub.connect(sg).connect(this.master);
    sub.start(now); sub.stop(now + 1.2);
    return dur;
  }

  servoScare() {
    if (!this.ctx || this.muted) return;
    this._noise(0.35, 0.2, 2800, 2.5);
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, now);
    o.frequency.exponentialRampToValueAtTime(420, now + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.15, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.5);
  }

  whoosh() {
    this._noise(0.6, 0.18, 500, 0.5, 'lowpass');
  }

  sensePing() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.17;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = 880 + i * 220;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.085 - i * 0.018, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.55);
    }
    this._noise(0.5, 0.04, 3000, 2.5, 'bandpass');
  }

  doorCreak() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(120 + Math.random() * 60, now);
    o.frequency.linearRampToValueAtTime(210 + Math.random() * 90, now + 0.7);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 780; f.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.028, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    o.connect(f).connect(g).connect(this.master);
    o.start(now); o.stop(now + 1.2);
    this._noise(0.7, 0.035, 1500, 2, 'bandpass');
  }

  creak() {
    if (!this.ctx || this.muted) return;
    this.doorCreak();
  }

  heartbeat(strength = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const beat = (t, amp) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(62, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22 * amp * strength, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.2);
    };
    beat(now, 1);
    beat(now + 0.17, 0.55);
  }

  whisper() {
    if (!this.ctx || this.muted) return;
    this._noise(1.4, 0.02, 1800, 1.2, 'bandpass', (Math.random() * 2 - 1) * 0.7);
    this._noise(1.1, 0.014, 2600, 2, 'bandpass', (Math.random() * 2 - 1) * 0.7);
  }

  engineStart() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // starter
    const st = ctx.createOscillator(); st.type = 'sawtooth'; st.frequency.value = 48;
    const stg = ctx.createGain(); stg.gain.setValueAtTime(0.0001, now);
    stg.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
    stg.gain.setValueAtTime(0.1, now + 0.75);
    stg.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    st.connect(stg).connect(this.master);
    st.start(now); st.stop(now + 1);
    this._noise(0.9, 0.1, 220, 1.2, 'lowpass');
    // catch
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 46;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 92;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, now + 1.0);
    g.gain.exponentialRampToValueAtTime(0.12, now + 1.4);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 18;
    const lg = ctx.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg).connect(g.gain);
    o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
    o.start(now + 1.0); o2.start(now + 1.0); lfo.start(now + 1.0);
    o.stop(now + 4.5); o2.stop(now + 4.5); lfo.stop(now + 4.5);
  }

  /* ---------- per-frame ---------- */
  update(dt, state) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime;

    // servo presence
    const near = clamp(state.miloDist !== undefined ? 1 - state.miloDist / 12 : 0, 0, 1);
    const active = state.miloActive ? 1 : 0;
    const move = state.miloMoving ? 1 : 0.25;
    const servo = near * active * move;
    this.servoGain.gain.setTargetAtTime(servo * 0.2, now, 0.12);
    if (this.servoPan) {
      const p = clamp(state.miloPan || 0, -1, 1);
      this.servoPan.pan.setTargetAtTime(p, now, 0.1);
    }
    const lit = state.miloLit ? 1 : 0;
    this.whineGain.gain.setTargetAtTime(lit * (0.035 + near * 0.05), now, 0.08);

    // heartbeat
    const threat = clamp(state.threat || 0, 0, 1);
    this.threat = threat;
    if (threat > 0.06) {
      this.beatTimer -= dt;
      if (this.beatTimer <= 0) {
        this.heartbeat(0.4 + threat * 0.8);
        this.beatTimer = lerp(1.45, 0.38, threat);
      }
    } else {
      this.beatTimer = Math.min(this.beatTimer, 0.5);
    }

    // random house creaks
    this.creakTimer -= dt;
    if (this.creakTimer <= 0) {
      this.creakTimer = 9 + Math.random() * 16;
      if (Math.random() < 0.6) this.creak();
    }
    this.whisperTimer -= dt;
    if (this.whisperTimer <= 0) {
      this.whisperTimer = 24 + Math.random() * 30;
      if (state.inHouse) this.whisper();
    }
  }
}
