/* ============================================================
   MILO — main game
   ============================================================ */

import {
  createWorld, MAP_W, MAP_H, SHELL, DOORS,
  walkable, bfsPath, lineOfSight,
} from './house.js';
import { buildSprites } from './sprites.js';
import { AudioEngine } from './audio.js';

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const norm = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const fmtTime = (s) => {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
};

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('milo.' + k);
      return v == null ? d : JSON.parse(v);
    } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('milo.' + k, JSON.stringify(v)); } catch {}
  },
};

const isCoarse = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

/* ------------------------------------------------------------
   Boot art
   ------------------------------------------------------------ */
const SPR = buildSprites();
const audio = new AudioEngine();

/* title face */
(function drawTitleFace() {
  const cv = $('titleFace');
  if (!cv) return;
  cv.width = 512; cv.height = 512;
  const x = cv.getContext('2d');
  x.drawImage(SPR.face.cv, 0, 0);
  // dim it further and add a vignette so it melts into the title
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.fillRect(0, 0, 512, 512);
})();

/* ------------------------------------------------------------
   DOM
   ------------------------------------------------------------ */
const view = $('view');
const vctx = view.getContext('2d', { alpha: false });
const grain = $('grain');
const gctx = grain.getContext('2d');
const danger = $('danger');
const flash = $('flash');

const el = {
  hud: $('hud'),
  objText: $('objText'),
  chipGas: $('chipGas'),
  chipKey: $('chipKey'),
  battFill: $('battFill'),
  battPct: $('battPct'),
  toasts: $('toasts'),
  prompt: $('prompt'),
  promptText: $('promptText'),
  promptKey: $('promptKey'),
  status: $('statusLine'),
  stick: $('stick'),
  stickKnob: $('stickKnob'),
  stickHint: $('stickHint'),
  senseWrap: $('senseWrap'),
  senseArrow: $('senseArrow'),
  btnLight: $('btnLight'),
  btnSense: $('btnSense'),
  btnInteract: $('btnInteract'),
  btnMute: $('btnMute'),
  tiltBadge: $('tiltBadge'),
};

/* ------------------------------------------------------------
   State
   ------------------------------------------------------------ */
const FOV = (74 * Math.PI) / 180;
const PLANE_LEN = Math.tan(FOV / 2);
const PLAYER_R = 0.25;
const playerBody = { x: 0, y: 0 };

const G = {
  mode: 'title',
  world: null,
  car: null,

  px: 0, py: 0, yaw: 0, pitch: 0,
  vx: 0, vy: 0,
  bob: 0, bobPhase: 0, stepAccum: 0,

  battery: 100, lightOn: true, lightFlick: 1,
  hasGas: false, hasKey: false,

  time: 0, totalDeaths: 0, batteries: 0, notesRead: 0,

  senseTime: 0, senseCooldown: 0, senseTarget: null,
  action: null,

  milo: null,
  apparitionDone: false,
  wakeToastDone: false,

  cineT: 0, cineBeat: -1, cineDone: false,

  reducedFlash: !!store.get('calm', false),
  tiltOn: false,
  tiltAxis: 0,
  tiltZero: null,
  rotateDismissed: false,

  lastPrompt: '',
  hudAccum: 0,
  fps: 60,
};

let zbuf = new Float32Array(1);
let vw = 1, vh = 1;

/* input */
const keys = Object.create(null);
const joy = { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0 };
const look = { id: null, x: 0, y: 0 };
const tilt = { enabled: false };

/* ------------------------------------------------------------
   View sizing
   ------------------------------------------------------------ */
function resizeView() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  let target = clamp(Math.round(Math.min(w, 1100) * 0.58), 300, 560);
  if (h > w) target = clamp(Math.round(w * 0.82), 280, 430);
  vw = target;
  vh = Math.max(1, Math.round(vw * (h / w)));
  view.width = vw; view.height = vh;
  zbuf = new Float32Array(vw);
  vctx.imageSmoothingEnabled = false;
}

/* ------------------------------------------------------------
   Sprites / world helpers
   ------------------------------------------------------------ */
function propSolid(p) { return p.solid; }

function solidBlock(x, y, r) {
  if (x - r < 0 || y - r < 0 || x + r >= MAP_W || y + r >= MAP_H) return true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tx = Math.floor(x + Math.cos(a) * r);
    const ty = Math.floor(y + Math.sin(a) * r);
    if (!walkable(G.world, tx, ty)) return true;
  }
  const props = G.world.props;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (!p.solid) continue;
    if (x > p.x - p.w / 2 - r && x < p.x + p.w / 2 + r &&
        y > p.y - p.d / 2 - r && y < p.y + p.d / 2 + r) return true;
  }
  return false;
}

function moveEntity(e, dx, dy, r) {
  let moved = 0;
  if (!solidBlock(e.x + dx, e.y, r)) { e.x += dx; moved += Math.abs(dx); }
  if (!solidBlock(e.x, e.y + dy, r)) { e.y += dy; moved += Math.abs(dy); }
  return moved;
}

/* ------------------------------------------------------------
   Run setup
   ------------------------------------------------------------ */
function newRun() {
  const world = createWorld();
  G.world = world;
  G.car = world.props.find((p) => p.interact === 'car');

  G.px = world.start.x;
  G.py = world.start.y;
  G.yaw = world.start.yaw;
  G.pitch = 0;
  G.vx = G.vy = 0;
  G.bob = 0; G.bobPhase = 0; G.stepAccum = 0;

  G.battery = 100;
  G.lightOn = true;
  G.lightFlick = 1;
  G.hasGas = false;
  G.hasKey = false;
  G.time = 0;
  G.batteries = 0;
  G.notesRead = 0;

  G.senseTime = 0;
  G.senseCooldown = 0;
  G.senseTarget = null;
  G.action = null;
  G.lastPrompt = '';
  G.hudAccum = 0;
  danger.style.opacity = '0';

  G.milo = {
    x: world.miloStart.x,
    y: world.miloStart.y,
    active: false,
    seen: false,
    frozen: false,
    lit: false,
    path: [],
    pathTimer: 0,
    stare: 0,
    stepAccum: 0,
    anim: 0,
    grace: 0,
    wakeTimer: 9.5,
    apparitionTimer: 0,
    lunge: 0,
    moving: false,
  };
  G.apparitionDone = false;
  G.wakeToastDone = false;

  joy.x = joy.y = 0;
  joy.active = false;
  joy.id = null;
  look.id = null;
  el.stick.classList.remove('active');
  el.stickHint.style.opacity = '';

  updateObjective();
  updateBattery(true);
  el.btnLight.classList.add('lit');
  el.btnLight.classList.remove('hidden');
  el.btnSense.style.opacity = '1';
  el.prompt.classList.add('hidden');
  el.btnInteract.classList.add('hidden');
  el.senseWrap.classList.add('hidden');
  el.tiltBadge.classList.toggle('hidden', !G.tiltOn);
  el.toasts.innerHTML = '';
  hideAllScreens();
  el.hud.classList.remove('hidden');
  G.mode = 'play';
  audio.setScene('play');
  audio.ensureStarted = true;

  toast('THE CAR IS DEAD. THE HOUSE IS DARK.', 'accent');
  setTimeout(() => {
    if (G.mode === 'play' && G.time < 20) toast('FIND THE GAS CAN — AND YOUR KEYS');
  }, 2600);
  if (G.tiltOn) el.tiltBadge.classList.remove('hidden');
  checkOrientation();
}

/* ------------------------------------------------------------
   UI / screens
   ------------------------------------------------------------ */
function hideAllScreens() {
  for (const id of ['title', 'intro', 'pause', 'note', 'death', 'win', 'rotate']) {
    const n = $(id);
    if (n) n.classList.add('hidden');
  }
  $('cine').classList.add('hidden');
  $('howPanel').classList.add('hidden');
  $('settingsPanel').classList.add('hidden');
  $('pauseSettings').classList.add('hidden');
  $('title').classList.remove('panel-open');
}

function toast(text, cls = '') {
  if (!el.toasts) return;
  while (el.toasts.children.length >= 3) el.toasts.firstChild.remove();
  const d = document.createElement('div');
  d.className = 'toast ' + cls;
  d.textContent = text;
  el.toasts.appendChild(d);
  setTimeout(() => d.remove(), 3400);
}

function updateObjective() {
  let txt = 'FIND THE GAS CAN';
  if (G.hasGas && G.hasKey) txt = 'GET BACK TO THE CAR';
  else if (G.hasGas) txt = 'FIND THE CAR KEYS';
  else if (G.hasKey) txt = 'FIND THE GAS CAN';
  if (el.objText.textContent !== txt) el.objText.textContent = txt;
  el.chipGas.classList.toggle('got', G.hasGas);
  el.chipKey.classList.toggle('got', G.hasKey);
}

function updateBattery(force = false) {
  const pct = Math.max(0, Math.round(G.battery));
  if (!force && pct === G._lastPct) return;
  G._lastPct = pct;
  el.battFill.style.width = pct + '%';
  el.battPct.textContent = pct;
  el.battFill.classList.toggle('low', pct < 25);
}

function flashScreen() {
  if (G.reducedFlash) return;
  flash.classList.remove('hit');
  void flash.offsetWidth;
  flash.classList.add('hit');
}

function showDeathScreen() {
  G.mode = 'death';
  $('death').classList.remove('hidden');
  $('deathInner').classList.remove('hidden');
  const sc = $('scare');
  sc.classList.remove('play');
  sc.classList.add('settled');
  el.hud.classList.add('hidden');
  el.stick.classList.remove('active');
  audio.setScene('death');
  const hint = G.battery < 8
    ? 'Your light died in the dark. Batteries are scattered around the house — and he is faster when you cannot see.'
    : G.milo.stare > 3
      ? 'Staring does not hold him forever. Break his gaze, move, then light him up again.'
      : 'He freezes when your flashlight is on him. Keep it on him when he is close — but watch the battery.';
  $('deathHint').textContent = hint;
  $('deathStats').innerHTML =
    `TIME ${fmtTime(G.time)} &nbsp;·&nbsp; GAS ${G.hasGas ? 'YES' : 'NO'} &nbsp;·&nbsp; KEYS ${G.hasKey ? 'YES' : 'NO'}` +
    `<br>TOTAL DEATHS ${G.totalDeaths}`;
}

function die() {
  if (G.mode !== 'play') return;
  G.mode = 'dying';
  G.totalDeaths++;
  el.hud.classList.add('hidden');
  el.stick.classList.remove('active');
  joy.active = false;
  look.id = null;
  if (document.pointerLockElement) document.exitPointerLock?.();
  audio.scream();
  flashScreen();
  if (navigator.vibrate) { try { navigator.vibrate([60, 40, 140]); } catch {} }

  const sc = $('scare');
  sc.width = 512; sc.height = 512;
  sc.getContext('2d').drawImage(SPR.face.cv, 0, 0);
  $('death').classList.remove('hidden');
  $('deathInner').classList.add('hidden');
  sc.classList.remove('settled');
  sc.classList.remove('play');
  void sc.offsetWidth;
  sc.classList.add('play');

  setTimeout(() => {
    if (G.mode === 'dying') showDeathScreen();
  }, G.reducedFlash ? 900 : 1250);
}

/* ------------------------------------------------------------
   Light / sense
   ------------------------------------------------------------ */
function toggleLight(force) {
  if (G.mode !== 'play') return;
  const want = force === undefined ? !G.lightOn : force;
  if (want && G.battery <= 0) {
    toast('THE BATTERY IS DEAD', 'bad');
    audio.click();
    return;
  }
  G.lightOn = want;
  el.btnLight.classList.toggle('lit', want);
  audio.lightClick(want);
}

function objectiveTarget() {
  if (!G.world) return null;
  const objs = G.world.pickups.filter((p) => !p.taken && (p.kind === 'gas' || p.kind === 'key'));
  if (!objs.length) return G.car ? { x: G.car.x, y: G.car.y } : null;
  let best = null, bd = Infinity;
  for (const o of objs) {
    const d = Math.hypot(o.x - G.px, o.y - G.py);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function useSense() {
  if (G.mode !== 'play') return;
  if (G.senseCooldown > 0) {
    toast('CATCH YOUR BREATH');
    return;
  }
  if (G.battery < 9) {
    toast('NOT ENOUGH BATTERY', 'bad');
    audio.click();
    return;
  }
  if (!G.lightOn) toggleLight(true);
  G.battery = Math.max(0, G.battery - 8);
  G.senseCooldown = 5.5;
  G.senseTime = 3.4;
  G.senseTarget = objectiveTarget();
  audio.sensePing();
  el.senseWrap.classList.remove('hidden');
  updateBattery(true);
}

/* ------------------------------------------------------------
   Interaction
   ------------------------------------------------------------ */
function findAction() {
  if (!G.world) return null;
  let best = null, bd = Infinity;

  for (const p of G.world.pickups) {
    if (p.taken) continue;
    const d = Math.hypot(p.x - G.px, p.y - G.py);
    if (d < 1.85 && d < bd) {
      bd = d;
      let label = 'TAKE ' + p.label;
      if (p.kind === 'battery' && G.battery >= 97) label = 'BATTERY (FULL)';
      best = { kind: 'pickup', obj: p, label };
    }
  }
  for (const n of G.world.notes) {
    const d = Math.hypot(n.x - G.px, n.y - G.py);
    if (d < 1.8 && d < bd) {
      bd = d;
      best = { kind: 'note', obj: n, label: n.read ? 'READ IT AGAIN' : 'READ NOTE' };
    }
  }
  if (G.car) {
    const d = Math.hypot(G.car.x - G.px, G.car.y - G.py);
    if (d < 2.75 && d < bd + 0.4) {
      bd = d;
      const label = (G.hasGas && G.hasKey) ? 'GET IN AND GO' : 'INSPECT THE CAR';
      best = { kind: 'car', obj: G.car, label };
    }
  }
  return best;
}

function doAction() {
  if (G.mode !== 'play') return;
  const a = G.action;
  if (!a) return;

  if (a.kind === 'pickup') {
    const p = a.obj;
    if (p.kind === 'battery') {
      if (G.battery >= 97) { toast('BATTERY IS FULL'); return; }
      p.taken = true;
      G.battery = Math.min(100, G.battery + 42);
      G.batteries++;
      audio.battery();
      updateBattery(true);
      toast('BATTERY +42%', 'accent');
      return;
    }
    p.taken = true;
    audio.pickup(p.kind);
    if (p.kind === 'gas') {
      G.hasGas = true;
      toast('GAS CAN — THE CAR IS PARKED IN THE GARAGE', 'accent');
      updateObjective();
      wakeMilo('item');
    } else if (p.kind === 'key') {
      G.hasKey = true;
      toast('CAR KEYS — DON\'T DROP THEM', 'accent');
      updateObjective();
      wakeMilo('item');
    }
    return;
  }

  if (a.kind === 'note') {
    openNote(a.obj);
    return;
  }

  if (a.kind === 'car') {
    if (G.hasGas && G.hasKey) {
      startEscape();
    } else if (G.hasGas && !G.hasKey) {
      toast('THE TANK IS FULL. YOU STILL NEED THE KEYS.', 'bad');
      audio.click();
    } else if (!G.hasGas && G.hasKey) {
      toast('KEYS IN HAND. THE TANK IS BONE DRY.', 'bad');
      audio.click();
    } else {
      toast('EMPTY TANK. NO KEYS. THIS IS GOING TO HURT.', 'bad');
      audio.click();
    }
  }
}

function wakeMilo(reason) {
  const m = G.milo;
  if (!m || m.active) return;
  m.active = true;
  m.wakeTimer = 0;
  m.grace = 1.6;
  audio.stinger(0.8);
  if (!G.wakeToastDone) {
    G.wakeToastDone = true;
    toast('SOMETHING MOVES IN THE WORKSHOP', 'bad');
  }
  if (reason === 'item') flashScreen();
}

/* ------------------------------------------------------------
   Note
   ------------------------------------------------------------ */
function openNote(n) {
  G.mode = 'note';
  n.read = true;
  G.notesRead = G.world.notes.filter((x) => x.read).length;
  $('noteBody').textContent = n.text;
  $('note').classList.remove('hidden');
  el.stick.classList.remove('active');
  joy.active = false;
  audio.note();
  audio.setScene('note');
}

function closeNote() {
  $('note').classList.add('hidden');
  if (G.mode === 'note') {
    G.mode = 'play';
    audio.setScene('play');
  }
}

/* ------------------------------------------------------------
   Input
   ------------------------------------------------------------ */
function onKeyDown(e) {
  if (e.repeat) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    return;
  }
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys[k] = true;

  if (G.mode === 'title' || G.mode === 'intro') {
    if (k === 'enter' || k === ' ') {
      if (G.mode === 'title') $('btnBegin').click();
      else advanceIntro();
    }
    return;
  }

  if (k === 'escape') {
    if (G.mode === 'play') pauseGame();
    else if (G.mode === 'pause') resumeGame();
    else if (G.mode === 'note') closeNote();
    return;
  }
  if (G.mode !== 'play') return;

  if (k === 'f') toggleLight();
  if (k === 'e' || k === 'enter') doAction();
  if (k === 'q') useSense();
  if (k === 'm') toggleMute();
}

function onKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

function resetJoystick() {
  joy.x = joy.y = 0;
  joy.active = false;
  joy.id = null;
  el.stick.classList.remove('active');
}

function setStickVisual(x, y) {
  el.stick.style.left = x + 'px';
  el.stick.style.top = y + 'px';
}

function onPointerDown(e) {
  if (G.mode !== 'play') return;
  if (e.target.closest('button, .screen, #cine, #rotate, .panel')) return;

  if (e.pointerType === 'mouse' && !isCoarse() && !document.pointerLockElement && view.requestPointerLock) {
    try {
      const pr = view.requestPointerLock();
      if (pr && pr.catch) pr.catch(() => {});
    } catch {}
    return;
  }
  if (document.pointerLockElement) return;

  if (joy.id === null && e.clientX < window.innerWidth * 0.47) {
    joy.id = e.pointerId;
    joy.active = true;
    joy.ox = e.clientX;
    joy.oy = e.clientY;
    setStickVisual(e.clientX, e.clientY);
    el.stick.classList.add('active');
    el.stickKnob.style.transform = '';
    el.stickHint.style.opacity = '0';
    e.preventDefault();
    return;
  }
  if (look.id === null) {
    look.id = e.pointerId;
    look.x = e.clientX;
    look.y = e.clientY;
    e.preventDefault();
  }
}

function onPointerMove(e) {
  if (G.mode !== 'play') return;
  if (e.pointerId === joy.id) {
    const max = 54;
    let dx = e.clientX - joy.ox;
    let dy = e.clientY - joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    joy.x = dx / max;
    joy.y = dy / max;
    el.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    e.preventDefault();
  } else if (e.pointerId === look.id) {
    const dx = e.clientX - look.x;
    const dy = e.clientY - look.y;
    look.x = e.clientX;
    look.y = e.clientY;
    G.yaw += dx * 0.0048;
    G.pitch = clamp(G.pitch - dy * 0.0032, -0.32, 0.32);
    e.preventDefault();
  }
}

function onPointerUp(e) {
  if (e.pointerId === joy.id) resetJoystick();
  if (e.pointerId === look.id) look.id = null;
}

function onMouseMove(e) {
  if (G.mode !== 'play') return;
  if (document.pointerLockElement === view) {
    G.yaw += e.movementX * 0.0022;
    G.pitch = clamp(G.pitch - e.movementY * 0.0018, -0.32, 0.32);
  }
}

/* ------------------------------------------------------------
   Tilt
   ------------------------------------------------------------ */
function onOrient(e) {
  if (!tilt.enabled || G.mode !== 'play') return;
  if (e.gamma == null) return;
  if (G.tiltZero === null) G.tiltZero = e.gamma;
  const raw = clamp((e.gamma - G.tiltZero) / 24, -1, 1);
  const dead = Math.abs(raw) < 0.09 ? 0 : (raw - Math.sign(raw) * 0.09) / 0.91;
  G.tiltAxis = dead;
}

async function enableTilt(fromUser = true) {
  if (!window.DeviceOrientationEvent) {
    toast('NO TILT SENSOR FOUND');
    return false;
  }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        toast('MOTION ACCESS DENIED');
        return false;
      }
    }
  } catch {
    toast('MOTION ACCESS UNAVAILABLE');
    return false;
  }
  window.addEventListener('deviceorientation', onOrient);
  tilt.enabled = true;
  G.tiltOn = true;
  G.tiltZero = null;
  el.tiltBadge.classList.remove('hidden');
  store.set('tilt', true);
  return true;
}

function disableTilt() {
  window.removeEventListener('deviceorientation', onOrient);
  tilt.enabled = false;
  G.tiltOn = false;
  G.tiltAxis = 0;
  el.tiltBadge.classList.add('hidden');
  store.set('tilt', false);
}

/* ------------------------------------------------------------
   Pause
   ------------------------------------------------------------ */
function pauseGame() {
  if (G.mode !== 'play') return;
  G.mode = 'pause';
  joy.active = false;
  resetJoystick();
  look.id = null;
  if (document.pointerLockElement) document.exitPointerLock?.();
  $('pause').classList.remove('hidden');
  $('pauseSub').textContent = G.milo.active
    ? (G.milo.lit ? 'He is standing very still.' : 'He is still in the house.')
    : 'He is still in the house.';
  $('pauseStats').innerHTML =
    `TIME ${fmtTime(G.time)} &nbsp;·&nbsp; BATTERY ${Math.round(G.battery)}%<br>` +
    `GAS ${G.hasGas ? 'YES' : 'NO'} &nbsp;·&nbsp; KEYS ${G.hasKey ? 'YES' : 'NO'} &nbsp;·&nbsp; NOTES ${G.notesRead}/3`;
  audio.setScene('pause');
  audio.update(0.016, { miloDist: 99, miloActive: false, miloMoving: false, miloLit: false, threat: 0, miloPan: 0 });
}

function resumeGame() {
  if (G.mode !== 'pause') return;
  $('pause').classList.add('hidden');
  $('pauseSettings').classList.add('hidden');
  G.mode = 'play';
  audio.setScene('play');
}

function quitToTitle() {
  G.mode = 'title';
  hideAllScreens();
  el.hud.classList.add('hidden');
  $('title').classList.remove('hidden');
  audio.setScene('title');
  resetJoystick();
  keys.w = keys.a = keys.s = keys.d = false;
  audio.update(0.016, { miloDist: 99, miloActive: false, miloMoving: false, miloLit: false, threat: 0, miloPan: 0 });
}

/* ------------------------------------------------------------
   Intro story
   ------------------------------------------------------------ */
const STORY = [
  'You built him in the garage. Three months of servos, latex, and a smile you cut yourself.',
  'Tonight you drove Milo to the county fair. Somewhere past the county line, he turned his head and said your name.',
  'You swerved. You ran. The car died at the end of the drive. And the back seat was empty.',
  'Find the gas. Find your keys. Get out of the house.\n\nAnd whatever you do — keep the light on him.',
];
let introIdx = 0;
let typeTimer = null;
let typeFull = '';
let typePos = 0;
let typing = false;

function showIntroCard(i) {
  introIdx = i;
  const txt = STORY[i];
  typeFull = txt;
  typePos = 0;
  typing = true;
  clearInterval(typeTimer);
  const node = $('introText');
  node.textContent = '';
  const dots = $('introDots');
  dots.innerHTML = '';
  for (let d = 0; d < STORY.length; d++) {
    const el2 = document.createElement('i');
    if (d <= i) el2.className = 'on';
    dots.appendChild(el2);
  }
  $('introHint').textContent = 'TAP TO CONTINUE';
  $('introHint').style.visibility = 'visible';
  typeTimer = setInterval(() => {
    typePos++;
    node.textContent = typeFull.slice(0, typePos);
    if (typePos >= typeFull.length) {
      clearInterval(typeTimer);
      typing = false;
    }
  }, 24);
}

function advanceIntro() {
  if (typing) {
    clearInterval(typeTimer);
    typing = false;
    $('introText').textContent = typeFull;
    return;
  }
  if (introIdx < STORY.length - 1) {
    showIntroCard(introIdx + 1);
  } else {
    clearInterval(typeTimer);
    $('intro').classList.add('hidden');
    store.set('seenIntro', true);
    newRun();
  }
}

function startIntro() {
  hideAllScreens();
  G.mode = 'intro';
  $('intro').classList.remove('hidden');
  audio.setScene('intro');
  showIntroCard(0);
}

/* ------------------------------------------------------------
   Settings
   ------------------------------------------------------------ */
function setToggle(btn, on) {
  if (!btn) return;
  btn.classList.toggle('on', !!on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function syncSettings() {
  const muted = !!store.get('soundMuted', false);
  audio.setMuted(muted);
  [...document.querySelectorAll('#togSound,#togSound2')].forEach((b) => setToggle(b, !muted));
  [...document.querySelectorAll('#togTilt,#togTilt2')].forEach((b) => setToggle(b, G.tiltOn));
  [...document.querySelectorAll('#togFlash,#togFlash2')].forEach((b) => setToggle(b, G.reducedFlash));
  setToggle($('togFull'), !!document.fullscreenElement);
  document.body.classList.toggle('calm', G.reducedFlash);
  updateSoundIcons();
}

function updateSoundIcons() {
  const muted = audio.muted;
  const s = el.btnMute.querySelector('.ico-sound');
  const m = el.btnMute.querySelector('.ico-mute');
  if (s) s.classList.toggle('hidden', muted);
  if (m) m.classList.toggle('hidden', !muted);
}

function toggleMute() {
  const muted = !audio.muted;
  store.set('soundMuted', muted);
  audio.setMuted(muted);
  syncSettings();
  audio.click();
}

async function handleTiltToggle() {
  if (G.tiltOn) {
    disableTilt();
    syncSettings();
    return;
  }
  const ok = await enableTilt();
  if (!ok && G.mode === 'title') {
    const d = $('tiltDesc');
    if (d) d.textContent = 'Motion access was not granted.';
  }
  syncSettings();
}

function openPanel(id) {
  for (const p of ['howPanel', 'settingsPanel']) {
    const n = $(p);
    if (n) n.classList.toggle('hidden', p !== id);
  }
  $('title').classList.add('panel-open');
}

function closePanels() {
  $('howPanel').classList.add('hidden');
  $('settingsPanel').classList.add('hidden');
  $('title').classList.remove('panel-open');
}

/* ------------------------------------------------------------
   Milo update
   ------------------------------------------------------------ */
function updateMilo(dt) {
  const m = G.milo;
  if (!m) return;
  const pdx = G.px - m.x, pdy = G.py - m.y;
  const dist = Math.hypot(pdx, pdy);

  if (!m.active) {
    m.wakeTimer -= dt;
    if (m.wakeTimer <= 0.01) wakeMilo('timer');
    return;
  }

  if (m.apparitionTimer > 0) {
    m.apparitionTimer -= dt;
    m.moving = false;
    if (m.apparitionTimer <= 0) {
      // gone. re-seed him in the workshop.
      m.x = G.world.miloStart.x;
      m.y = G.world.miloStart.y;
      m.path = [];
      m.pathTimer = 0;
      m.grace = 2.2;
      audio.servoScare();
      flashScreen();
    }
    return;
  }

  const los = lineOfSight(G.world, m.x, m.y, G.px, G.py, 15);
  let observed = false;
  if (G.lightOn && G.battery > 0 && dist < 11.5 && los) {
    const ang = Math.atan2(-pdy, -pdx);
    const rel = norm(ang - G.yaw);
    observed = Math.abs(rel) < FOV * 0.62;
  }
  m.lit = observed;
  if (observed) m.stare += dt;
  else m.stare = Math.max(0, m.stare - dt * 2.2);

  const twitch = observed && m.stare > 3.0;
  m.frozen = observed && !twitch;

  if (m.grace > 0) m.grace -= dt;

  if (dist < 1.05 && los && m.grace <= 0) {
    die();
    return;
  }

  if (m.frozen) {
    m.moving = false;
    m.lunge = 0;
    return;
  }

  // stare too long: he inches forward even in the light
  if (dist < 1.5 && twitch) {
    m.moving = false;
    return;
  }

  let speed = 1.5;
  speed += (G.hasGas ? 0.08 : 0) + (G.hasKey ? 0.08 : 0);
  if (!G.lightOn) speed += 0.22;
  if (twitch) speed += 0.25;
  if (m.grace > 0) speed *= 0.55;

  m.pathTimer -= dt;
  if (m.pathTimer <= 0) {
    m.path = bfsPath(G.world, m.x, m.y, G.px, G.py);
    m.pathTimer = los ? 0.18 : 0.42;
  }

  let tx, ty;
  if (los && dist < 6.5) {
    tx = G.px; ty = G.py;
  } else if (m.path.length) {
    tx = m.path[0].x; ty = m.path[0].y;
  } else {
    m.moving = false;
    m.lunge = Math.max(0, m.lunge - dt);
    return;
  }

  const ddx = tx - m.x, ddy = ty - m.y;
  const len = Math.hypot(ddx, ddy);
  if (len < 0.04) {
    if (m.path.length) m.path.shift();
    m.moving = false;
    return;
  }
  const step = Math.min(len, speed * dt);
  const beforeX = m.x, beforeY = m.y;
  moveEntity(m, (ddx / len) * step, (ddy / len) * step, 0.27);
  let moved = Math.hypot(m.x - beforeX, m.y - beforeY);

  // A straight-line chase can snag on a furniture corner. Fall back to the
  // next navigation waypoint so he slides around it instead of stopping dead.
  if (moved < 0.001 && m.path.length && tx === G.px && ty === G.py) {
    const wp = m.path[0];
    const wx = wp.x - m.x, wy = wp.y - m.y;
    const wl = Math.hypot(wx, wy);
    if (wl > 0.04) {
      const s2 = Math.min(wl, step);
      moveEntity(m, (wx / wl) * s2, (wy / wl) * s2, 0.27);
      moved = Math.hypot(m.x - beforeX, m.y - beforeY);
    }
  }

  m.moving = moved > 0.001;
  if (!m.moving && m.path.length) m.path.shift();

  m.anim += moved;
  m.stepAccum += moved;
  if (m.stepAccum > 0.95) {
    m.stepAccum = 0;
    audio.footstep(0.45);
  }
  if (m.path.length) {
    const wp = m.path[0];
    if (Math.hypot(wp.x - m.x, wp.y - m.y) < 0.22) m.path.shift();
  }

  // occasional servo shriek when very close
  if (moved && Math.random() < dt * (dist < 4 ? 0.4 : 0.05)) audio.servoScare();

  m.lunge = Math.max(0, m.lunge - dt);
}

/* ------------------------------------------------------------
   Apparition script
   ------------------------------------------------------------ */
function maybeApparition() {
  if (G.apparitionDone || !G.milo || G.mode !== 'play') return;
  // first time in the upper hall
  if (G.py < 8 || G.py > 11.2 || G.px < 1 || G.px > 23) return;
  const m = G.milo;
  const d = Math.hypot(G.px - m.x, G.py - m.y);
  if (d < 7) return;

  const right = G.px < 12;
  const ax = right ? 22.4 : 1.6;
  const ay = 10.4;
  if (!walkable(G.world, Math.floor(ax), Math.floor(ay))) return;

  m.x = ax; m.y = ay;
  m.active = true;
  m.seen = true;
  m.frozen = true;
  m.apparitionTimer = 1.7;
  m.path = [];
  m.grace = 2.4;
  G.apparitionDone = true;
  audio.stinger(1.1);
  audio.servoScare();
  if (!G.reducedFlash) flashScreen();
  toast('HE IS AT THE END OF THE HALL', 'bad');
}

/* ------------------------------------------------------------
   Player update
   ------------------------------------------------------------ */
function updatePlayer(dt) {
  let f = 0, s = 0;
  if (keys.w || keys.arrowup) f += 1;
  if (keys.s || keys.arrowdown) f -= 1;
  if (keys.d || keys.arrowright) s += 1;
  if (keys.a || keys.arrowleft) s -= 1;
  f += -joy.y;
  s += joy.x;
  if (G.tiltOn && Math.abs(G.tiltAxis) > 0.01) {
    G.yaw += G.tiltAxis * 2.15 * dt;
  }

  const mag = Math.hypot(f, s);
  if (mag > 1) { f /= mag; s /= mag; }

  const speed = 2.62;
  const dirX = Math.cos(G.yaw), dirY = Math.sin(G.yaw);
  const rightX = -dirY, rightY = dirX;
  const wx = (dirX * f + rightX * s) * speed;
  const wy = (dirY * f + rightY * s) * speed;

  const k = 1 - Math.exp(-dt * 14);
  G.vx = lerp(G.vx, wx, k);
  G.vy = lerp(G.vy, wy, k);

  const beforeX = G.px, beforeY = G.py;
  playerBody.x = G.px; playerBody.y = G.py;
  moveEntity(playerBody, G.vx * dt, G.vy * dt, PLAYER_R);
  G.px = playerBody.x; G.py = playerBody.y;
  const moved = Math.hypot(G.px - beforeX, G.py - beforeY);

  if (moved > 0.0005) {
    G.stepAccum += moved;
    G.bobPhase += moved * 5.2;
    G.bob = Math.sin(G.bobPhase) * vh * 0.006;
    if (G.stepAccum > 0.92) {
      G.stepAccum = 0;
      audio.footstep(0.75);
    }
  } else {
    G.bob *= 0.9;
  }

  // stamina-ish breathing not modeled; the tension comes from the dark

  // battery
  if (G.lightOn) {
    G.battery = Math.max(0, G.battery - dt * 1.12);
    if (G.battery <= 0) {
      G.lightOn = false;
      el.btnLight.classList.remove('lit');
      audio.lightClick(false);
      toast('YOUR LIGHT DIES', 'bad');
      flashScreen();
    }
  }

  // light flicker
  let fl = 1;
  if (G.battery < 24) {
    if (Math.random() < 0.02) fl = 0.25 + Math.random() * 0.5;
  }
  if (G.milo && G.milo.lit) fl *= 0.9 + Math.random() * 0.1;
  G.lightFlick = lerp(G.lightFlick, fl, 0.5);

  // sense
  if (G.senseTime > 0) {
    G.senseTime -= dt;
    if (G.senseTime <= 0) {
      el.senseWrap.classList.add('hidden');
      G.senseTarget = null;
    }
  }
  if (G.senseCooldown > 0) {
    G.senseCooldown -= dt;
    el.btnSense.style.opacity = G.senseCooldown > 0 ? '0.5' : '1';
  }

  // target may have been picked up
  if (G.senseTarget && G.senseTarget.taken) G.senseTarget = objectiveTarget();

  maybeApparition();
  updateMilo(dt);
}

/* ------------------------------------------------------------
   HUD update
   ------------------------------------------------------------ */
function updateHUD(dt) {
  const a = findAction();
  G.action = a;
  const label = a ? a.label : '';
  if (label !== G.lastPrompt) {
    G.lastPrompt = label;
    if (a) {
      el.promptText.textContent = label;
      el.promptKey.textContent = isCoarse() ? 'USE' : 'E';
      el.prompt.classList.remove('hidden');
      el.btnInteract.classList.remove('hidden');
    } else {
      el.prompt.classList.add('hidden');
      el.btnInteract.classList.add('hidden');
    }
  }

  G.hudAccum += dt;
  if (G.hudAccum > 0.15) {
    G.hudAccum = 0;
    updateBattery();
    const m = G.milo;
    let threat = 0;
    if (m && m.active) {
      const d = Math.hypot(G.px - m.x, G.py - m.y);
      threat = clamp(1 - d / 13, 0, 1);
      if (m.lit) threat = Math.min(1, threat + 0.15);
    }
    danger.style.opacity = (threat * 0.55).toFixed(2);
    el.senseArrow.style.transform = 'rotate(0deg)';
  }

  if (G.senseTime > 0 && G.senseTarget) {
    const ang = Math.atan2(G.senseTarget.y - G.py, G.senseTarget.x - G.px);
    const rel = norm(ang - G.yaw);
    el.senseArrow.style.transform = `rotate(${(rel * 180 / Math.PI).toFixed(1)}deg)`;
  }

  if (G.milo && G.milo.active) {
    if (G.milo.lit) {
      el.status.textContent = G.milo.stare > 3 ? 'HE IS STILL MOVING' : 'HE IS STILL';
      el.status.classList.add('show');
    } else if (G.milo.apparitionTimer > 0) {
      el.status.textContent = 'DON\'T LOOK AWAY';
      el.status.classList.add('show');
    } else {
      el.status.classList.remove('show');
    }
  } else {
    el.status.classList.remove('show');
  }
}

/* ------------------------------------------------------------
   Renderer
   ------------------------------------------------------------ */
const TEX = {
  wallpaper: SPR.texWallpaper,
  tile: SPR.texTile,
  concrete: SPR.texConcrete,
  plaster: SPR.texPlaster,
  door: SPR.texDoor,
};

function render() {
  const ctx = vctx;
  const w = vw, h = vh;
  if (!G.world) return;

  const horizon = clamp(h * 0.5 + G.pitch * h * 0.9 + G.bob, h * 0.1, h * 0.9);
  const dirX = Math.cos(G.yaw), dirY = Math.sin(G.yaw);
  const planeX = -dirY * PLANE_LEN, planeY = dirX * PLANE_LEN;
  const px = G.px, py = G.py;
  const lightOn = G.lightOn && G.battery > 0;
  const flick = G.lightFlick;

  // ---- backdrop
  let g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#000000');
  g.addColorStop(1, '#0a0908');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon);

  g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, '#1b1610');
  g.addColorStop(0.35, '#0d0b08');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);

  // flashlight pool on the floor
  if (lightOn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.clip();
    const cy = horizon + h * 0.10;
    ctx.translate(w / 2, cy);
    ctx.scale(1, 0.42);
    const pr = w * 0.86;
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
    pool.addColorStop(0, `rgba(255,198,136,${0.24 * flick})`);
    pool.addColorStop(0.42, `rgba(190,140,84,${0.10 * flick})`);
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
    ctx.restore();
  }

  // ---- floor perspective grid
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  const fp = (wx, wy) => {
    const dx = wx - px, dy = wy - py;
    const tx = invDet * (dirY * dx - dirX * dy);
    const ty = invDet * (-planeY * dx + planeX * dy);
    if (ty <= 0.18) return null;
    return { x: (w / 2) * (1 + tx / ty), y: horizon + (h * 0.5) / ty };
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, w, h - horizon);
  ctx.clip();
  ctx.strokeStyle = 'rgba(205,182,142,.055)';
  ctx.lineWidth = 1;
  const baseX = Math.floor(px), baseY = Math.floor(py);
  for (let gx = baseX - 8; gx <= baseX + 8; gx += 2) {
    let prev = null;
    for (let gy = baseY - 8; gy <= baseY + 8; gy += 2) {
      const cur = fp(gx, gy);
      if (prev && cur) {
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(cur.x, cur.y); ctx.stroke();
      }
      prev = cur;
    }
  }
  for (let gy = baseY - 8; gy <= baseY + 8; gy += 2) {
    let prev = null;
    for (let gx = baseX - 8; gx <= baseX + 8; gx += 2) {
      const cur = fp(gx, gy);
      if (prev && cur) {
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(cur.x, cur.y); ctx.stroke();
      }
      prev = cur;
    }
  }
  ctx.restore();

  // ---- walls (DDA)
  const styleMap = ['wallpaper', 'tile', 'concrete', 'plaster', 'door'];
  for (let x = 0; x < w; x++) {
    const camX = (2 * (x + 0.5)) / w - 1;
    const rdx = dirX + planeX * camX;
    const rdy = dirY + planeY * camX;

    let mapX = Math.floor(px), mapY = Math.floor(py);
    const deltaX = Math.abs(1 / (rdx || 0.00001));
    const deltaY = Math.abs(1 / (rdy || 0.00001));
    let stepX, stepY, sideDistX, sideDistY;
    if (rdx < 0) { stepX = -1; sideDistX = (px - mapX) * deltaX; }
    else { stepX = 1; sideDistX = (mapX + 1 - px) * deltaX; }
    if (rdy < 0) { stepY = -1; sideDistY = (py - mapY) * deltaY; }
    else { stepY = 1; sideDistY = (mapY + 1 - py) * deltaY; }

    let side = 0, hit = false, guard = 0;
    while (!hit && guard++ < 80) {
      if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
      else { sideDistY += deltaY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) { hit = true; break; }
      if (SHELL.solid[mapY * MAP_W + mapX]) hit = true;
    }
    if (!hit) { zbuf[x] = 1e9; continue; }

    let perp = side === 0
      ? (mapX - px + (1 - stepX) / 2) / (rdx || 0.00001)
      : (mapY - py + (1 - stepY) / 2) / (rdy || 0.00001);
    if (perp < 0.05) perp = 0.05;
    zbuf[x] = perp;

    const lineH = h / perp;
    const top = horizon - lineH / 2;

    let wallX = side === 0 ? py + perp * rdy : px + perp * rdx;
    wallX -= Math.floor(wallX);
    let texX = Math.floor(wallX * 64);
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = 63 - texX;

    const wstyle = SHELL.wall[mapY * MAP_W + mapX] || 'wallpaper';
    const tx = TEX[wstyle] || TEX.wallpaper;

    const cone = Math.pow(Math.max(0, 1 - Math.abs(camX) * 0.94), 1.35);
    const fall = Math.pow(Math.max(0, 1 - perp / 11.6), 1.25);
    const beam = lightOn ? flick * 1.28 * cone * fall : 0;
    const light = clamp(0.072 + beam, 0, 1);

    ctx.drawImage(tx, texX, 0, 1, 64, x, top, 1, lineH);
    if (light < 0.985) {
      ctx.fillStyle = `rgba(0,0,0,${(1 - light).toFixed(3)})`;
      ctx.fillRect(x, top, 1, lineH);
    }
    // baseboard grounding
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillRect(x, top + lineH * 0.955, 1, Math.max(1, lineH * 0.045));
  }

  // ---- sprites
  const list = [];
  for (const p of G.world.props) {
    const spr = SPR[p.kind];
    if (!spr) continue;
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d > 300) continue;
    list.push({ kind: 'prop', p, spr, x: p.x, y: p.y, w: p.w, h: p.h, z: 0, d });
  }
  for (const p of G.world.pickups) {
    if (p.taken) continue;
    const spr = SPR[p.kind] || SPR.note;
    let wWorld = p.kind === 'gas' ? 0.52 : p.kind === 'key' ? 0.5 : p.kind === 'battery' ? 0.26 : 0.42;
    let hWorld = wWorld * (spr.h / spr.w);
    if (p.kind === 'key') hWorld = wWorld * 0.75;
    const z = (p.z || 0) + (p.kind === 'key' || p.kind === 'note' ? Math.sin(G.time * 1.8 + p.x) * 0.02 : 0);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d > 250) continue;
    list.push({ kind: 'pickup', p, spr, x: p.x, y: p.y, w: wWorld, h: hWorld, z, d, glow: p.kind });
  }
  for (const n of G.world.notes) {
    const spr = SPR.note;
    const d = (n.x - px) ** 2 + (n.y - py) ** 2;
    if (d > 200) continue;
    list.push({ kind: 'note', p: n, spr, x: n.x, y: n.y, w: 0.42, h: 0.52, z: n.z, d, glow: 'note' });
  }
  if (G.milo && G.milo.active) {
    const m = G.milo;
    const d = (m.x - px) ** 2 + (m.y - py) ** 2;
    if (d < 400) {
      let spr = SPR.miloIdle;
      if (m.apparitionTimer > 0) spr = SPR.miloIdle;
      else if (m.frozen) spr = SPR.miloIdle;
      else if (m.moving) spr = Math.floor(m.anim * 2) % 2 ? SPR.miloWalk2 : SPR.miloWalk1;
      if (!m.frozen && !m.moving && Math.hypot(G.px - m.x, G.py - m.y) < 3) spr = SPR.miloLunge;
      list.push({ kind: 'milo', p: m, spr, x: m.x, y: m.y, w: 1.0, h: 2.03, z: 0, d, glow: 'milo' });
    }
  }
  list.sort((a, b) => b.d - a.d);

  // sense beam through walls
  if (G.senseTime > 0 && G.senseTarget) {
    drawSenseBeam(G.senseTarget, horizon, dirX, dirY, planeX, planeY);
  }

  for (const s of list) drawSprite(s, horizon, dirX, dirY, planeX, planeY);

  // warm grade
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const grade = ctx.createRadialGradient(w / 2, horizon + h * 0.18, 0, w / 2, horizon + h * 0.18, w * 0.75);
  grade.addColorStop(0, lightOn ? 'rgba(255,180,110,.10)' : 'rgba(80,90,110,.035)');
  grade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function projectSprite(s, horizon, dirX, dirY, planeX, planeY) {
  const dx = s.x - G.px, dy = s.y - G.py;
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  const tx = invDet * (dirY * dx - dirX * dy);
  const ty = invDet * (-planeY * dx + planeX * dy);
  if (ty <= 0.12) return null;
  const scale = vh / ty;
  const drawH = s.h * scale;
  const drawW = s.w * scale;
  const bottom = horizon + (vh * 0.5) / ty - (s.z || 0) * scale;
  const top = bottom - drawH;
  const cx = (vw / 2) * (1 + tx / ty);
  const left = cx - drawW / 2;
  if (left > vw + 40 || left + drawW < -40) return null;
  return { ty, scale, drawH, drawW, top, bottom, left, cx };
}

function spriteLight(s, p) {
  const nx = Math.abs((p.cx / vw) * 2 - 1);
  const cone = Math.pow(Math.max(0, 1 - nx * 1.12), 1.5);
  const fall = Math.pow(Math.max(0, 1 - p.ty / 9.5), 1.2);
  return G.lightOn ? G.lightFlick * cone * fall : 0;
}

function drawSprite(s, horizon, dirX, dirY, planeX, planeY) {
  const ctx = vctx;
  const p = projectSprite(s, horizon, dirX, dirY, planeX, planeY);
  if (!p) return;

  const isMilo = s.kind === 'milo';
  const isPickup = s.kind === 'pickup';
  const isNote = s.kind === 'note';
  const target = G.senseTime > 0 && G.senseTarget === s.p;
  const xray = target && (isPickup || isNote);

  let lit = spriteLight(s, p);
  if (isMilo) lit = Math.max(lit, 0.12);
  let alpha = clamp(0.16 + lit * 1.8, 0, 1);
  if (isPickup) alpha = clamp(0.55 + lit, 0.55, 1);
  if (isNote) alpha = clamp(0.42 + lit, 0.42, 1);
  if (isMilo) alpha = clamp(0.56 + lit * 0.9, 0.56, 1);
  if (xray) alpha = Math.max(alpha, 0.42);
  if (G.milo && G.milo.apparitionTimer > 0 && isMilo) alpha *= 0.7 + Math.random() * 0.3;

  // ground shadow
  if (!isPickup && !isNote && s.z === 0) {
    const vis = p.ty < 12;
    if (vis) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha * 0.55, 0, 0.6);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(p.cx, p.bottom, p.drawW * 0.38, Math.max(1.5, p.drawH * 0.045), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // find visible runs
  const x0 = Math.max(0, Math.floor(p.left));
  const x1 = Math.min(vw - 1, Math.ceil(p.left + p.drawW));
  let any = false;
  ctx.globalAlpha = alpha;
  let runStart = -1;
  const flush = (a, b) => {
    if (b <= a) return;
    const u0 = (a - p.left) / p.drawW;
    const u1 = (b - p.left) / p.drawW;
    const sw = (u1 - u0) * s.spr.w;
    if (sw <= 0) return;
    ctx.drawImage(s.spr.cv, u0 * s.spr.w, 0, sw, s.spr.h, a, p.top, b - a, p.drawH);
    any = true;
  };
  for (let x = x0; x <= x1; x++) {
    const visible = xray || p.ty < zbuf[x] + 0.02;
    if (visible) {
      if (runStart < 0) runStart = x;
    } else if (runStart >= 0) {
      flush(runStart, x);
      runStart = -1;
    }
  }
  if (runStart >= 0) flush(runStart, x1 + 1);
  ctx.globalAlpha = 1;

  if (!any && !xray) return;

  // glows
  if (isPickup || isNote) {
    const col = s.p.kind === 'gas' ? '255,70,50'
      : s.p.kind === 'key' ? '255,200,90'
        : s.p.kind === 'battery' ? '255,210,120' : '220,210,185';
    const pulse = 0.55 + 0.45 * Math.sin(G.time * 2.6 + s.x * 2);
    const r = Math.max(12, p.drawH * (target ? 2.2 : 0.9));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(p.cx, p.bottom - p.drawH / 2, 0, p.cx, p.bottom - p.drawH / 2, r);
    gl.addColorStop(0, `rgba(${col},${(0.14 + pulse * 0.12) * (target ? 1.8 : 1)})`);
    gl.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gl;
    ctx.fillRect(p.cx - r, p.bottom - p.drawH / 2 - r, r * 2, r * 2);
    ctx.restore();
  }

  if (isMilo) {
    const litEyes = G.milo.lit || G.milo.apparitionTimer > 0;
    const inten = litEyes ? 1 : 0.35;
    for (const nx of [0.424, 0.576]) {
      const ex = p.left + p.drawW * nx;
      const ey = p.top + p.drawH * 0.268;
      const r = Math.max(2, p.drawH * 0.045);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
      gl.addColorStop(0, `rgba(255,90,40,${0.85 * inten})`);
      gl.addColorStop(0.35, `rgba(255,40,20,${0.35 * inten})`);
      gl.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
      ctx.restore();
    }
  }
}

function drawSenseBeam(target, horizon, dirX, dirY, planeX, planeY) {
  const p = projectSprite({ x: target.x, y: target.y, w: 0, h: 0, z: 0 }, horizon, dirX, dirY, planeX, planeY);
  if (!p) return;
  const top = horizon - vh * 0.6;
  const grad = ctxBeamGradient(p.cx, top, p.bottom);
  vctx.save();
  vctx.globalCompositeOperation = 'lighter';
  vctx.fillStyle = grad;
  vctx.fillRect(p.cx - 9, top, 18, p.bottom - top);
  vctx.restore();
}
function ctxBeamGradient(x, top, bottom) {
  const g = vctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(255,190,110,0)');
  g.addColorStop(0.5, 'rgba(255,190,110,.10)');
  g.addColorStop(1, 'rgba(255,190,110,0)');
  return g;
}

/* ------------------------------------------------------------
   HUD / audio frame
   ------------------------------------------------------------ */
function updateFrameAudio(dt) {
  if (!G.world || !G.milo) return;
  const m = G.milo;
  const dx = m.x - G.px, dy = m.y - G.py;
  const dist = Math.hypot(dx, dy);
  const rel = norm(Math.atan2(dy, dx) - G.yaw);
  const pan = clamp(Math.sin(rel), -1, 1);
  let threat = 0;
  if (m.active) {
    threat = clamp(1 - dist / 13, 0, 1);
    if (m.lit) threat = Math.min(1, threat + 0.15);
  }
  audio.update(dt, {
    miloDist: m.active ? dist : 99,
    miloActive: m.active,
    miloMoving: m.moving,
    miloLit: m.lit || m.apparitionTimer > 0,
    threat,
    miloPan: pan,
    inHouse: true,
  });
}

/* ------------------------------------------------------------
   Escape cutscene
   ------------------------------------------------------------ */
const CINE_BEATS = [
  { t: 0.4, html: 'The tank drinks the last of the gas.' },
  { t: 2.1, html: 'The key turns. The engine catches.' },
  { t: 4.2, html: 'Something hits the back of the car.' },
  { t: 6.0, html: 'You do not look in the mirror.' },
  { t: 7.8, html: 'You drive.' },
];

function startEscape() {
  G.mode = 'cine';
  G.cineT = 0;
  G.cineBeat = -1;
  G.cineDone = false;
  el.hud.classList.add('hidden');
  el.stick.classList.remove('active');
  resetJoystick();
  if (document.pointerLockElement) document.exitPointerLock?.();
  $('rotate').classList.add('hidden');
  danger.style.opacity = '0';
  $('cine').classList.remove('hidden');
  $('cineText').classList.remove('show');
  $('cineText').textContent = '';
  const cv = $('cineCanvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(window.innerWidth * dpr);
  cv.height = Math.round(window.innerHeight * dpr);
  audio.setScene('cine');
  audio.engineStart();
}

function setCineText(html) {
  const n = $('cineText');
  n.classList.remove('show');
  n.innerHTML = html;
  requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('show')));
}

function updateCine(dt) {
  G.cineT += dt;
  for (let i = 0; i < CINE_BEATS.length; i++) {
    if (G.cineT >= CINE_BEATS[i].t && G.cineBeat < i) {
      G.cineBeat = i;
      setCineText(CINE_BEATS[i].html);
    }
  }
  if (G.cineT >= 9.4 && !G.cineDone) finishWin();
  drawCine();
}

function drawCine() {
  const cv = $('cineCanvas');
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const t = G.cineT;
  const hz = h * 0.47;

  let shake = 0;
  if (t > 4.1 && t < 5.2) shake = (1 - Math.abs(t - 4.6) / 0.55) * w * 0.007;
  if (t < 1.1) shake = (1.1 - t) * w * 0.0015;
  ctx.save();
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // night sky
  let g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#010207');
  g.addColorStop(0.4, '#070a12');
  g.addColorStop(0.475, '#14121a');
  g.addColorStop(0.55, '#080807');
  g.addColorStop(1, '#030303');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // distant trees
  ctx.fillStyle = '#020305';
  ctx.beginPath();
  ctx.moveTo(0, hz);
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * w;
    const y = hz - (Math.sin(i * 1.37 + 1.2) * 0.5 + 0.5) * h * 0.05 - 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, hz); ctx.closePath(); ctx.fill();

  // road
  ctx.fillStyle = '#0b0b0d';
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - 4, hz); ctx.lineTo(w * 0.5 + 4, hz);
  ctx.lineTo(w * 1.03, h); ctx.lineTo(-w * 0.03, h);
  ctx.closePath(); ctx.fill();

  // shoulder lines
  ctx.strokeStyle = 'rgba(170,160,140,.18)';
  ctx.lineWidth = Math.max(1, w * 0.0015);
  ctx.beginPath(); ctx.moveTo(w * 0.5 - 4, hz); ctx.lineTo(-w * 0.03, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.5 + 4, hz); ctx.lineTo(w * 1.03, h); ctx.stroke();

  // center dashes
  const phase = (t * 0.34) % 1;
  for (let i = 0; i < 9; i++) {
    const u = (i + phase) / 9;
    const y = hz + (h - hz) * u * u;
    const sc = u * u;
    const len = h * 0.028 * sc + 1.5;
    const wid = w * 0.005 * sc + 1;
    ctx.fillStyle = `rgba(215,205,175,${0.10 + u * 0.5})`;
    ctx.fillRect(w / 2 - wid / 2, y, wid, len);
  }

  // headlight wash
  const hl = ctx.createRadialGradient(w / 2, h * 0.86, 10, w / 2, h * 0.86, h * 0.7);
  hl.addColorStop(0, 'rgba(255,235,190,.15)');
  hl.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, hz, w, h - hz);

  // rain
  for (let i = 0; i < 70; i++) {
    const rx = ((i * 97.13 + 13) % 1) * w;
    const speed = 0.5 + ((i * 37) % 100) / 100;
    const ry = ((i * 53.7 + t * 900 * speed) % (h * 1.1)) - h * 0.05;
    const len = h * (0.015 + speed * 0.02);
    ctx.strokeStyle = `rgba(150,175,200,${0.05 + speed * 0.1})`;
    ctx.lineWidth = Math.max(1, w * 0.0007);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - w * 0.004, ry + len);
    ctx.stroke();
  }

  // dashboard
  ctx.fillStyle = '#030303';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.81);
  ctx.quadraticCurveTo(w * 0.5, h * 0.73, w, h * 0.82);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // steering wheel
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = w * 0.016;
  ctx.beginPath();
  ctx.arc(w * 0.2, h * 1.06, w * 0.18, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
  ctx.lineWidth = w * 0.008;
  ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.94); ctx.lineTo(w * 0.2, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.08, h * 1.04); ctx.lineTo(w * 0.25, h * 0.98); ctx.stroke();

  // rearview mirror
  const mw = w * 0.2, mh = h * 0.085;
  const mx = w * 0.5 - mw / 2, my = h * 0.055;
  ctx.save();
  ctx.fillStyle = '#080808';
  ctx.beginPath(); ctx.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.strokeStyle = '#1d1a17'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 6); ctx.clip();
  const mg = ctx.createLinearGradient(0, my, 0, my + mh);
  mg.addColorStop(0, '#0c0f14'); mg.addColorStop(1, '#050505');
  ctx.fillStyle = mg; ctx.fillRect(mx, my, mw, mh);

  // the face in the mirror
  if (t > 4.35 && t < 6.6) {
    const a = clamp((t - 4.35) / 0.35, 0, 1) * clamp((6.6 - t) / 0.5, 0, 1);
    ctx.globalAlpha = a * 0.8;
    const fw = mh * 1.5;
    ctx.drawImage(SPR.face.cv, w / 2 - fw / 2, my + mh * 0.52 - fw / 2, fw, fw);
    ctx.globalAlpha = 1;
  }
  // mirror glass sheen
  const sheen = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
  sheen.addColorStop(0, 'rgba(180,200,210,.08)');
  sheen.addColorStop(.5, 'rgba(180,200,210,0)');
  ctx.fillStyle = sheen; ctx.fillRect(mx, my, mw, mh);
  ctx.restore();

  // wiper
  const wp = Math.sin(t * 1.1) * 0.5 + 0.5;
  ctx.save();
  ctx.translate(w * 0.62, h * 0.94);
  ctx.rotate(-0.5 + wp * 1.2);
  ctx.strokeStyle = 'rgba(10,10,10,.9)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.33); ctx.stroke();
  ctx.restore();

  // windshield frame
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w * 0.012, h);
  ctx.fillRect(w - w * 0.012, 0, w * 0.012, h);
  ctx.fillRect(0, 0, w, h * 0.028);

  // headlight cones on the road
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const cone = ctx.createLinearGradient(0, h * 0.8, 0, hz);
  cone.addColorStop(0, 'rgba(255,235,190,.14)');
  cone.addColorStop(1, 'rgba(255,235,190,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.84); ctx.lineTo(w * 0.42, hz);
  ctx.lineTo(w * 0.5, hz); ctx.lineTo(w * 0.49, h * 0.84);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.64, h * 0.84); ctx.lineTo(w * 0.58, hz);
  ctx.lineTo(w * 0.5, hz); ctx.lineTo(w * 0.51, h * 0.84);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.restore();
}

function finishWin() {
  if (G.cineDone) return;
  G.cineDone = true;
  G.mode = 'win';
  $('cine').classList.add('hidden');
  el.hud.classList.add('hidden');
  $('win').classList.remove('hidden');
  audio.setScene('win');
  audio.stinger(0.5);
  $('winStats').innerHTML =
    `<div class="win-stat"><b>${fmtTime(G.time)}</b><span>TIME</span></div>` +
    `<div class="win-stat"><b>${G.notesRead}/3</b><span>NOTES</span></div>` +
    `<div class="win-stat"><b>${G.batteries}</b><span>BATTERIES</span></div>` +
    `<div class="win-stat"><b>${G.totalDeaths}</b><span>DEATHS</span></div>`;
  const quotes = [
    'The back seat was empty. You did not look in the mirror.',
    'The road was empty for miles. You kept driving anyway.',
    'You could still hear the party horn when the sun came up.',
    'Milo is very good at waiting. He has all the time in the world.',
  ];
  $('winQuote').textContent = quotes[(Math.random() * quotes.length) | 0];
}

/* ------------------------------------------------------------
   Grain
   ------------------------------------------------------------ */
const grainCv = grain;
const GW = 160, GH = 96;
grainCv.width = GW; grainCv.height = GH;
let grainTimer = 0;
function updateGrain(dt) {
  grainTimer -= dt;
  if (grainTimer > 0) return;
  grainTimer = 0.09;
  const im = gctx.createImageData(GW, GH);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
    d[i + 3] = (Math.random() * 90) | 0;
  }
  gctx.putImageData(im, 0, 0);
}

/* ------------------------------------------------------------
   Main loop
   ------------------------------------------------------------ */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;

  updateGrain(dt);

  if (G.mode === 'play') {
    G.time += dt;
    updatePlayer(dt);
    updateHUD(dt);
    updateFrameAudio(dt);
    if (G.mode === 'play') render();
    updateBattery();
  } else if (G.mode === 'cine') {
    updateCine(dt);
  } else if (G.mode === 'pause' || G.mode === 'note' || G.mode === 'death' || G.mode === 'dying') {
    // keep the last frame; ambient continues at a lower level
  } else {
    audio.update(dt, { miloDist: 99, miloActive: false, miloMoving: false, miloLit: false, threat: 0, miloPan: 0 });
  }

  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------
   Wiring
   ------------------------------------------------------------ */
function checkOrientation() {
  const portrait = window.innerHeight > window.innerWidth * 1.05;
  const small = Math.min(window.innerWidth, window.innerHeight) < 620;
  const active = ['play', 'pause', 'note'].includes(G.mode);
  $('rotate').classList.toggle('hidden', !(portrait && small && active && !G.rotateDismissed));
}

function requestFull() {
  const d = document.documentElement;
  try {
    if (!document.fullscreenElement) {
      const p = d.requestFullscreen?.();
      if (p && p.catch) p.catch(() => {});
    } else {
      const p = document.exitFullscreen?.();
      if (p && p.catch) p.catch(() => {});
    }
  } catch {}
}

function bind() {
  window.addEventListener('resize', () => { resizeView(); checkOrientation(); });
  window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 250));
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', () => { keys.w = keys.a = keys.s = keys.d = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'play') pauseGame();
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && G.mode === 'play' && !isCoarse()) {
      // escaping the lock pauses the game rather than leaving you vulnerable
      pauseGame();
    }
  });

  // ---- title
  $('btnBegin').addEventListener('click', async () => {
    closePanels();
    if (isCoarse()) {
      try {
        const p = document.documentElement.requestFullscreen?.();
        if (p && p.catch) p.catch(() => {});
      } catch {}
    }
    // iOS requires motion permission inside the gesture. Start it first.
    const tiltReq = store.get('tilt', false) && !G.tiltOn ? enableTilt() : null;
    await audio.unlock();
    audio.click();
    if (tiltReq) {
      const ok = await tiltReq;
      if (ok) syncSettings();
    }
    if (store.get('seenIntro', false)) newRun();
    else startIntro();
    checkOrientation();
  });
  $('btnHow').addEventListener('click', () => { audio.click(); openPanel('howPanel'); });
  $('btnHowClose').addEventListener('click', () => { audio.click(); closePanels(); });
  $('btnSettings').addEventListener('click', async () => { await audio.unlock(); audio.click(); openPanel('settingsPanel'); });
  $('btnSettingsClose').addEventListener('click', () => { audio.click(); closePanels(); });

  // ---- intro
  $('intro').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    advanceIntro();
  });
  $('btnSkipIntro').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    clearInterval(typeTimer);
    typing = false;
    $('intro').classList.add('hidden');
    store.set('seenIntro', true);
    newRun();
  });

  // ---- HUD buttons
  el.btnLight.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleLight(); });
  el.btnSense.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); useSense(); });
  el.btnInteract.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); doAction(); });
  el.btnMute.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });
  $('btnPause').addEventListener('click', (e) => { e.stopPropagation(); pauseGame(); });

  // ---- pause
  $('btnResume').addEventListener('click', () => { audio.click(); resumeGame(); });
  $('btnPauseSettings').addEventListener('click', () => {
    audio.click();
    $('pauseSettings').classList.remove('hidden');
  });
  $('btnPauseSettingsClose').addEventListener('click', () => { audio.click(); $('pauseSettings').classList.add('hidden'); });
  $('btnRestart').addEventListener('click', () => {
    audio.click();
    $('pause').classList.add('hidden');
    newRun();
  });
  $('btnQuit').addEventListener('click', () => { audio.click(); quitToTitle(); });

  // ---- note
  $('btnNoteClose').addEventListener('click', () => { audio.click(); closeNote(); });

  // ---- death
  $('btnRetry').addEventListener('click', () => {
    audio.click();
    $('death').classList.add('hidden');
    $('deathInner').classList.add('hidden');
    newRun();
  });
  $('btnDeathTitle').addEventListener('click', () => { audio.click(); quitToTitle(); });

  // ---- win
  $('btnAgain').addEventListener('click', () => { audio.click(); $('win').classList.add('hidden'); newRun(); });
  $('btnWinTitle').addEventListener('click', () => { audio.click(); quitToTitle(); });

  // ---- cine
  $('btnSkipCine').addEventListener('click', () => { audio.click(); finishWin(); });

  // ---- rotate
  $('btnRotateAnyway').addEventListener('click', () => {
    G.rotateDismissed = true;
    checkOrientation();
  });

  // ---- settings toggles
  const onSound = () => { toggleMute(); };
  const onTilt = () => { handleTiltToggle(); };
  const onFlash = () => {
    G.reducedFlash = !G.reducedFlash;
    store.set('calm', G.reducedFlash);
    syncSettings();
    audio.click();
  };
  const onFull = () => { audio.click(); requestFull(); };

  for (const id of ['togSound', 'togSound2']) $(id)?.addEventListener('click', onSound);
  for (const id of ['togTilt', 'togTilt2']) $(id)?.addEventListener('click', onTilt);
  for (const id of ['togFlash', 'togFlash2']) $(id)?.addEventListener('click', onFlash);
  $('togFull')?.addEventListener('click', onFull);
  document.addEventListener('fullscreenchange', () => setToggle($('togFull'), !!document.fullscreenElement));

}

/* ------------------------------------------------------------
   Init
   ------------------------------------------------------------ */
resizeView();
bind();

audio.setMuted(!!store.get('soundMuted', false));
G.reducedFlash = !!store.get('calm', false);
document.body.classList.toggle('calm', G.reducedFlash);
if (store.get('tilt', false)) {
  // Permission can only be requested from a gesture on iOS, so we remember
  // the preference and re-arm it when the player taps BEGIN.
  G.tiltOn = false;
}
syncSettings();
setToggle($('togTilt'), false);

// title face easter egg: blink the eyes by re-drawing with a flicker handled in CSS
requestAnimationFrame(frame);

/* test hooks (harmless, useful for automated checks) */
window.__MILO = {
  G, audio, SPR,
  startRun: () => newRun(),
  teleport: (x, y, yaw) => { G.px = x; G.py = y; if (yaw !== undefined) G.yaw = yaw; },
  give: (what) => {
    if (what === 'gas' || what === 'all') { G.hasGas = true; const p = G.world.pickups.find(q => q.kind === 'gas'); if (p) p.taken = true; }
    if (what === 'key' || what === 'all') { G.hasKey = true; const p = G.world.pickups.find(q => q.kind === 'key'); if (p) p.taken = true; }
    updateObjective();
  },
  wake: () => wakeMilo('debug'),
  win: () => startEscape(),
  die: () => die(),
};
