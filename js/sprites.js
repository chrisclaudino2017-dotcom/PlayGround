/* ============================================================
   SPRITES — every object in the game is drawn procedurally
   ============================================================ */

const TAU = Math.PI * 2;

function surface(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  return [cv, x];
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grain(x, w, h, amount = 0.06, seed = 7) {
  const r = rng(seed);
  const im = x.getImageData(0, 0, w, h);
  const d = im.data;
  const amt = amount * 0.42;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const n = (r() - 0.5) * 255 * amt;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  x.putImageData(im, 0, 0);
}

/* dark furniture palette */
const C = {
  black: '#070706',
  body: '#14120f',
  body2: '#1c1915',
  edge: '#41382d',
  rim: '#6b5a44',
  warm: '#a37c4e',
  cloth: '#1b1a15',
  metal: '#2a2a2a',
  paper: '#c9bda3',
  blood: '#7e1118',
  brass: '#c49a4a',
  screen: '#5c7871',
};

function woodTop(x, cx, cy, rx, ry, col = '#2a231b') {
  const g = x.createLinearGradient(cx, cy - ry, cx, cy + ry);
  g.addColorStop(0, '#383026');
  g.addColorStop(1, col);
  x.fillStyle = g;
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(120,98,68,.28)'; x.lineWidth = 1.2; x.stroke();
}

/* ============================================================
   Furniture
   ============================================================ */

function drawSofa() {
  const [cv, x] = surface(240, 120);
  const g = x.createLinearGradient(0, 20, 0, 118);
  g.addColorStop(0, '#2a2820'); g.addColorStop(1, '#0d0c0a');
  x.fillStyle = g;
  // back
  x.beginPath(); x.roundRect(18, 16, 204, 62, 12); x.fill();
  // arms
  x.beginPath(); x.roundRect(4, 40, 44, 66, 13); x.fill();
  x.beginPath(); x.roundRect(192, 40, 44, 66, 13); x.fill();
  // seat
  x.fillStyle = '#171510';
  x.beginPath(); x.roundRect(40, 62, 160, 40, 8); x.fill();
  // cushion seams
  x.strokeStyle = 'rgba(120,105,78,.25)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(93, 66); x.lineTo(93, 100); x.moveTo(147, 66); x.lineTo(147, 100); x.stroke();
  // top rim
  x.strokeStyle = 'rgba(155,132,96,.16)'; x.lineWidth = 1.2;
  x.beginPath(); x.roundRect(18, 16, 204, 62, 12); x.stroke();
  // legs
  x.fillStyle = '#0a0907';
  x.fillRect(16, 102, 10, 14); x.fillRect(214, 102, 10, 14);
  // grime
  const r = rng(11);
  x.fillStyle = 'rgba(0,0,0,.18)';
  for (let i = 0; i < 24; i++) x.fillRect(r() * 230, 30 + r() * 75, 2 + r() * 7, 1 + r() * 2);
  grain(x, 240, 120, .09, 3);
  return cv;
}

function drawCoffeeTable() {
  const [cv, x] = surface(160, 90);
  x.fillStyle = '#0a0907';
  x.fillRect(24, 44, 8, 40); x.fillRect(128, 44, 8, 40);
  woodTop(x, 80, 40, 72, 14);
  x.fillStyle = 'rgba(0,0,0,.5)';
  x.beginPath(); x.ellipse(80, 43, 58, 8, 0, 0, TAU); x.fill();
  // a mug and a phone
  x.fillStyle = '#4a4236';
  x.fillRect(50, 26, 14, 14); x.fillStyle = '#171410'; x.fillRect(53, 29, 8, 8);
  x.fillStyle = '#0b0b0a'; x.fillRect(90, 28, 26, 12);
  x.fillStyle = '#2f3a37'; x.fillRect(91, 29, 23, 6);
  grain(x, 160, 90, .1, 5);
  return cv;
}

function drawTV() {
  const [cv, x] = surface(150, 180);
  // stand
  x.fillStyle = '#0b0a08';
  x.fillRect(20, 104, 110, 72);
  x.strokeStyle = 'rgba(110,92,68,.25)'; x.strokeRect(20, 104, 110, 72);
  x.fillStyle = '#181410'; x.fillRect(16, 98, 118, 10);
  // tv body
  x.fillStyle = '#12110f';
  x.beginPath(); x.roundRect(26, 10, 98, 92, 6); x.fill();
  x.strokeStyle = 'rgba(140,120,90,.3)'; x.lineWidth = 1.5;
  x.beginPath(); x.roundRect(26, 10, 98, 92, 6); x.stroke();
  // screen
  const sg = x.createRadialGradient(72, 50, 2, 72, 50, 56);
  sg.addColorStop(0, '#6d8a83'); sg.addColorStop(.55, '#2c3a37'); sg.addColorStop(1, '#0a0d0c');
  x.fillStyle = sg;
  x.beginPath(); x.roundRect(33, 17, 76, 62, 4); x.fill();
  // static bands
  const r = rng(21);
  x.fillStyle = 'rgba(190,220,210,.10)';
  for (let i = 0; i < 9; i++) x.fillRect(34, 20 + r() * 55, 74, 1 + r() * 1.5);
  // knobs
  x.fillStyle = '#2c271f'; x.fillRect(108, 20, 9, 4); x.fillRect(108, 28, 9, 4);
  grain(x, 150, 180, .08, 9);
  return cv;
}

function drawShelf() {
  const [cv, x] = surface(120, 250);
  x.fillStyle = '#0d0b09';
  x.fillRect(10, 4, 100, 244);
  x.strokeStyle = 'rgba(130,110,80,.28)'; x.lineWidth = 1.4;
  x.strokeRect(10, 4, 100, 244);
  // shelves + books
  const r = rng(31);
  const shelves = [44, 100, 156, 210];
  for (const sy of shelves) {
    x.fillStyle = '#241f18'; x.fillRect(12, sy, 96, 5);
    let bx = 16;
    while (bx < 102) {
      const bw = 3 + r() * 7;
      if (r() > .18) {
        x.fillStyle = `hsl(${20 + r() * 30} ${12 + r() * 18}% ${16 + r() * 14}%)`;
        const bh = 18 + r() * 26;
        x.fillRect(bx, sy - bh, bw, bh);
        x.fillStyle = 'rgba(200,180,140,.10)';
        x.fillRect(bx, sy - bh, 1, bh);
      }
      bx += bw + 1.5;
    }
  }
  grain(x, 120, 250, .1, 13);
  return cv;
}

function drawArmchair() {
  const [cv, x] = surface(140, 140);
  const g = x.createLinearGradient(0, 10, 0, 138);
  g.addColorStop(0, '#2b2822'); g.addColorStop(1, '#0c0b09');
  x.fillStyle = g;
  x.beginPath(); x.roundRect(30, 8, 80, 92, 14); x.fill();
  x.beginPath(); x.roundRect(8, 46, 40, 76, 14); x.fill();
  x.beginPath(); x.roundRect(92, 46, 40, 76, 14); x.fill();
  x.fillStyle = '#16140f';
  x.beginPath(); x.roundRect(40, 64, 60, 44, 8); x.fill();
  x.strokeStyle = 'rgba(160,135,98,.16)'; x.lineWidth = 1.2;
  x.beginPath(); x.roundRect(30, 8, 80, 92, 14); x.stroke();
  x.fillStyle = '#090806'; x.fillRect(14, 118, 10, 16); x.fillRect(116, 118, 10, 16);
  grain(x, 140, 140, .09, 17);
  return cv;
}

function drawLamp() {
  const [cv, x] = surface(70, 230);
  x.strokeStyle = '#211d18'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(35, 226); x.lineTo(35, 74); x.stroke();
  x.fillStyle = '#0a0908';
  x.beginPath(); x.ellipse(35, 226, 24, 5, 0, 0, TAU); x.fill();
  const g = x.createLinearGradient(0, 18, 0, 90);
  g.addColorStop(0, '#a8895c'); g.addColorStop(.5, '#6a5231'); g.addColorStop(1, '#2d2215');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(12, 82); x.lineTo(22, 16); x.lineTo(48, 16); x.lineTo(58, 82); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,220,160,.35)';
  x.beginPath(); x.ellipse(35, 82, 23, 5, 0, 0, TAU); x.fill();
  grain(x, 70, 230, .07, 19);
  return cv;
}

function drawBed() {
  const [cv, x] = surface(280, 160);
  // base
  x.fillStyle = '#0b0a08'; x.fillRect(16, 82, 248, 68);
  x.fillStyle = '#191611'; x.fillRect(10, 70, 260, 22);
  // mattress
  x.fillStyle = '#2b2820';
  x.beginPath(); x.roundRect(24, 44, 232, 40, 8); x.fill();
  // blanket
  const g = x.createLinearGradient(0, 52, 0, 150);
  g.addColorStop(0, '#33302a'); g.addColorStop(1, '#121110');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(80, 46); x.lineTo(258, 50); x.lineTo(252, 142); x.lineTo(74, 148); x.closePath(); x.fill();
  // body lump under blanket
  x.fillStyle = '#3a362e';
  x.beginPath(); x.ellipse(176, 78, 46, 24, -.1, 0, TAU); x.fill();
  x.fillStyle = 'rgba(0,0,0,.22)';
  x.beginPath(); x.ellipse(176, 82, 48, 8, -.1, 0, TAU); x.fill();
  // pillow
  x.fillStyle = '#4a4437';
  x.beginPath(); x.roundRect(32, 40, 52, 28, 9); x.fill();
  x.strokeStyle = 'rgba(190,175,145,.18)'; x.stroke();
  // seams
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(86, 48); x.lineTo(80, 144); x.stroke();
  grain(x, 280, 160, .1, 23);
  return cv;
}

function drawWardrobe() {
  const [cv, x] = surface(140, 270);
  x.fillStyle = '#100e0b'; x.fillRect(8, 4, 124, 264);
  x.strokeStyle = 'rgba(140,115,82,.3)'; x.lineWidth = 1.5; x.strokeRect(8, 4, 124, 264);
  x.fillStyle = '#1b1712';
  x.fillRect(14, 12, 50, 248);
  // right door ajar
  x.fillStyle = '#0a0907'; x.fillRect(66, 12, 60, 248);
  x.fillStyle = '#17130f'; x.beginPath(); x.moveTo(66, 12); x.lineTo(96, 20); x.lineTo(96, 252); x.lineTo(66, 260); x.closePath(); x.fill();
  x.fillStyle = '#030303'; x.beginPath(); x.moveTo(96, 20); x.lineTo(124, 14); x.lineTo(124, 258); x.lineTo(96, 252); x.closePath(); x.fill();
  // handles
  x.fillStyle = '#6f5c3e'; x.fillRect(57, 128, 4, 16); x.fillRect(103, 132, 4, 16);
  grain(x, 140, 270, .1, 27);
  return cv;
}

function drawNightstand() {
  const [cv, x] = surface(100, 100);
  x.fillStyle = '#12100d'; x.fillRect(8, 18, 84, 76);
  x.fillStyle = '#241e17'; x.fillRect(12, 22, 76, 22);
  x.fillStyle = '#191510'; x.fillRect(12, 48, 76, 42);
  x.fillStyle = '#7a6543'; x.fillRect(46, 30, 8, 3); x.fillRect(46, 60, 8, 3);
  x.strokeStyle = 'rgba(150,125,90,.26)'; x.strokeRect(8, 18, 84, 76);
  grain(x, 100, 100, .09, 29);
  return cv;
}

function drawDesk() {
  const [cv, x] = surface(200, 130);
  x.fillStyle = '#0a0907'; x.fillRect(20, 52, 10, 74); x.fillRect(170, 52, 10, 74);
  x.fillStyle = '#211b14'; x.fillRect(10, 40, 180, 18);
  x.strokeStyle = 'rgba(150,125,90,.3)'; x.strokeRect(10, 40, 180, 18);
  x.fillStyle = '#15110d'; x.fillRect(130, 58, 56, 50);
  x.fillStyle = '#2c251c'; x.fillRect(134, 62, 48, 12); x.fillRect(134, 78, 48, 12);
  // lamp + papers
  x.fillStyle = '#c2a46e'; x.beginPath(); x.moveTo(44, 38); x.lineTo(52, 16); x.lineTo(70, 16); x.lineTo(78, 38); x.closePath(); x.fill();
  x.fillStyle = '#e8dcc0'; x.save(); x.translate(86, 34); x.rotate(-.06); x.fillRect(0, 0, 34, 8); x.restore();
  grain(x, 200, 130, .1, 33);
  return cv;
}

function drawChair() {
  const [cv, x] = surface(80, 140);
  x.fillStyle = '#17130e';
  x.fillRect(20, 8, 40, 60);
  x.fillStyle = '#0d0b08';
  x.fillRect(14, 60, 52, 12);
  x.fillRect(18, 92, 8, 40); x.fillRect(54, 92, 8, 40);
  x.fillRect(22, 72, 6, 26); x.fillRect(52, 72, 6, 26);
  x.strokeStyle = 'rgba(130,108,78,.25)'; x.strokeRect(20, 8, 40, 60);
  grain(x, 80, 140, .08, 37);
  return cv;
}

function drawBench() {
  const [cv, x] = surface(250, 120);
  x.fillStyle = '#0b0a08'; x.fillRect(12, 54, 226, 56);
  x.fillStyle = '#2a2219'; x.fillRect(6, 40, 238, 20);
  x.strokeStyle = 'rgba(155,130,92,.32)'; x.lineWidth = 1.5; x.strokeRect(6, 40, 238, 20);
  // pegboard
  x.fillStyle = '#14110d'; x.fillRect(20, 4, 210, 36);
  x.strokeStyle = 'rgba(100,85,62,.18)';
  for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(30 + i * 17, 16, 1.1, 0, TAU); x.stroke(); }
  // tools
  x.strokeStyle = '#5c5040'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(50, 8); x.lineTo(50, 32); x.moveTo(43, 8); x.lineTo(57, 8); x.stroke();
  x.beginPath(); x.moveTo(90, 10); x.lineTo(104, 30); x.moveTo(100, 8); x.lineTo(110, 22); x.stroke();
  x.fillStyle = '#3a332a'; x.fillRect(130, 14, 26, 8); x.fillRect(170, 16, 6, 16);
  // vise + clutter
  x.fillStyle = '#2c2a27'; x.fillRect(196, 22, 22, 14);
  x.fillStyle = '#43392c'; x.fillRect(30, 44, 30, 8); x.fillRect(120, 44, 40, 7);
  // legs
  x.fillStyle = '#080807'; x.fillRect(18, 100, 12, 14); x.fillRect(220, 100, 12, 14);
  grain(x, 250, 120, .1, 41);
  return cv;
}

function drawCrate() {
  const [cv, x] = surface(130, 110);
  x.fillStyle = '#17130f'; x.fillRect(8, 18, 114, 88);
  x.strokeStyle = 'rgba(150,125,90,.24)'; x.lineWidth = 2;
  x.strokeRect(8, 18, 114, 88);
  x.beginPath(); x.moveTo(8, 18); x.lineTo(122, 106); x.moveTo(122, 18); x.lineTo(8, 106); x.stroke();
  x.fillStyle = '#2a231a'; x.fillRect(8, 18, 114, 8); x.fillRect(8, 98, 114, 8);
  grain(x, 130, 110, .12, 43);
  return cv;
}

function drawTub() {
  const [cv, x] = surface(270, 120);
  x.fillStyle = '#151513';
  x.beginPath(); x.roundRect(8, 26, 254, 78, 16); x.fill();
  x.fillStyle = '#d8d2c4';
  x.beginPath(); x.roundRect(16, 22, 238, 54, 22); x.fill();
  x.fillStyle = '#3c3c37';
  x.beginPath(); x.roundRect(28, 32, 214, 34, 16); x.fill();
  x.fillStyle = 'rgba(20,25,22,.75)';
  x.beginPath(); x.ellipse(135, 49, 100, 14, 0, 0, TAU); x.fill();
  x.fillStyle = 'rgba(160,170,155,.12)';
  x.beginPath(); x.ellipse(120, 46, 80, 6, 0, 0, TAU); x.fill();
  x.fillStyle = '#100f0d';
  x.fillRect(30, 78, 12, 34); x.fillRect(228, 78, 12, 34);
  grain(x, 270, 120, .12, 47);
  return cv;
}

function drawToilet() {
  const [cv, x] = surface(90, 140);
  x.fillStyle = '#d5cfc1';
  x.beginPath(); x.roundRect(18, 46, 54, 34, 10); x.fill();
  x.fillStyle = '#3a3934';
  x.beginPath(); x.ellipse(45, 52, 22, 9, 0, 0, TAU); x.fill();
  x.fillStyle = '#cfc9bb'; x.fillRect(26, 78, 38, 34);
  x.fillStyle = '#bdb6a7'; x.fillRect(22, 110, 46, 18);
  x.fillStyle = '#d5cfc1'; x.fillRect(18, 10, 54, 40);
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeRect(18, 10, 54, 40);
  grain(x, 90, 140, .13, 53);
  return cv;
}

function drawSink() {
  const [cv, x] = surface(110, 130);
  x.fillStyle = '#cfc9bb';
  x.beginPath(); x.roundRect(8, 26, 94, 30, 12); x.fill();
  x.fillStyle = '#3a3a35';
  x.beginPath(); x.ellipse(55, 40, 38, 9, 0, 0, TAU); x.fill();
  x.fillStyle = '#b9b2a3'; x.fillRect(16, 54, 78, 62);
  x.strokeStyle = 'rgba(0,0,0,.22)'; x.strokeRect(16, 54, 78, 62);
  x.fillStyle = '#6d6a62'; x.fillRect(52, 14, 6, 18);
  x.fillRect(48, 10, 22, 5);
  x.fillStyle = '#10100e'; x.fillRect(16, 116, 78, 10);
  grain(x, 110, 130, .14, 59);
  return cv;
}

function drawCounter() {
  const [cv, x] = surface(240, 120);
  x.fillStyle = '#0c0b09'; x.fillRect(8, 44, 224, 66);
  x.fillStyle = '#2b241b'; x.fillRect(4, 34, 232, 16);
  x.strokeStyle = 'rgba(165,140,100,.32)'; x.lineWidth = 1.5; x.strokeRect(4, 34, 232, 16);
  // cabinet doors
  x.strokeStyle = 'rgba(130,105,75,.18)';
  for (let i = 0; i < 4; i++) x.strokeRect(12 + i * 55, 56, 50, 48);
  x.fillStyle = '#6f5a3c';
  for (let i = 0; i < 4; i++) x.fillRect(56 + i * 55, 78, 3, 10);
  // sink basin
  x.fillStyle = '#5d5b54'; x.beginPath(); x.ellipse(84, 33, 38, 9, 0, 0, TAU); x.fill();
  x.fillStyle = '#161614'; x.beginPath(); x.ellipse(84, 33, 31, 6, 0, 0, TAU); x.fill();
  x.fillStyle = '#77736a'; x.fillRect(82, 8, 5, 18); x.fillRect(76, 6, 18, 4);
  // clutter
  x.fillStyle = '#3a3126'; x.fillRect(160, 18, 18, 16);
  x.fillStyle = '#4b3f2e'; x.fillRect(185, 24, 26, 10);
  grain(x, 240, 120, .1, 61);
  return cv;
}

function drawFridge() {
  const [cv, x] = surface(140, 250);
  x.fillStyle = '#171613'; x.fillRect(10, 6, 120, 238);
  x.fillStyle = '#25241f'; x.fillRect(16, 12, 108, 226);
  x.strokeStyle = 'rgba(180,175,160,.22)'; x.lineWidth = 1.6; x.strokeRect(16, 12, 108, 226);
  x.fillStyle = '#151410'; x.fillRect(16, 88, 108, 8);
  x.fillStyle = '#6b5b42'; x.fillRect(106, 40, 5, 34); x.fillRect(106, 108, 5, 40);
  // notes/magnets
  x.fillStyle = '#8a8068'; x.fillRect(40, 30, 22, 28);
  x.fillStyle = '#5b1a1a'; x.fillRect(70, 44, 10, 10);
  x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(24, 20, 30, 180);
  grain(x, 140, 250, .1, 67);
  return cv;
}

function drawIsland() {
  const [cv, x] = surface(270, 120);
  x.fillStyle = '#0d0c0a'; x.fillRect(12, 40, 246, 70);
  x.fillStyle = '#332b20'; x.fillRect(4, 30, 262, 18);
  x.strokeStyle = 'rgba(170,145,105,.32)'; x.lineWidth = 1.5; x.strokeRect(4, 30, 262, 18);
  x.strokeStyle = 'rgba(130,105,75,.16)';
  for (let i = 0; i < 3; i++) x.strokeRect(20 + i * 80, 54, 74, 48);
  // bowl + knife
  x.fillStyle = '#3a3a35'; x.beginPath(); x.ellipse(80, 28, 22, 7, 0, 0, TAU); x.fill();
  x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(80, 28, 15, 4, 0, 0, TAU); x.fill();
  x.fillStyle = '#6a6252'; x.fillRect(150, 26, 48, 3); x.fillRect(192, 24, 12, 6);
  grain(x, 270, 120, .09, 71);
  return cv;
}

function drawTable() {
  const [cv, x] = surface(260, 130);
  x.fillStyle = '#0a0907';
  x.fillRect(38, 70, 10, 56); x.fillRect(212, 70, 10, 56);
  woodTop(x, 130, 66, 112, 20);
  x.fillStyle = 'rgba(0,0,0,.58)';
  x.beginPath(); x.ellipse(130, 70, 104, 10, 0, 0, TAU); x.fill();
  // dinner setting for two
  for (const cx of [80, 180]) {
    x.fillStyle = '#b9b0a0'; x.beginPath(); x.ellipse(cx, 62, 18, 6, 0, 0, TAU); x.fill();
    x.fillStyle = '#3d3a33'; x.beginPath(); x.ellipse(cx, 61, 11, 3.2, 0, 0, TAU); x.fill();
  }
  // candles
  x.fillStyle = '#c7b995';
  x.fillRect(124, 32, 5, 28); x.fillRect(136, 38, 5, 22);
  x.fillStyle = '#ffc06a';
  x.beginPath(); x.ellipse(126.5, 29, 3.4, 6, 0, 0, TAU); x.fill();
  x.beginPath(); x.ellipse(138.5, 35, 3, 5.4, 0, 0, TAU); x.fill();
  grain(x, 260, 130, .1, 73);
  return cv;
}

function drawCoatrack() {
  const [cv, x] = surface(90, 240);
  x.strokeStyle = '#211c15'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(45, 236); x.lineTo(45, 22); x.stroke();
  x.beginPath(); x.moveTo(45, 190); x.lineTo(20, 226); x.moveTo(45, 190); x.lineTo(70, 226); x.stroke();
  x.fillStyle = '#0c0b09';
  x.beginPath(); x.ellipse(45, 236, 26, 5, 0, 0, TAU); x.fill();
  // hooks and coats
  x.strokeStyle = '#3a3126'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(45, 36); x.lineTo(24, 52); x.moveTo(45, 36); x.lineTo(66, 52); x.moveTo(45, 30); x.lineTo(45, 54); x.stroke();
  const g = x.createLinearGradient(0, 40, 0, 160);
  g.addColorStop(0, '#2a2620'); g.addColorStop(1, '#0e0d0b');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(24, 50); x.quadraticCurveTo(8, 100, 16, 156); x.lineTo(38, 150); x.quadraticCurveTo(32, 100, 42, 56); x.closePath(); x.fill();
  x.fillStyle = '#141210';
  x.beginPath(); x.moveTo(64, 50); x.quadraticCurveTo(78, 96, 72, 132); x.lineTo(58, 128); x.quadraticCurveTo(60, 92, 54, 56); x.closePath(); x.fill();
  grain(x, 90, 240, .1, 79);
  return cv;
}

function drawShoeBench() {
  const [cv, x] = surface(130, 80);
  x.fillStyle = '#17130f'; x.fillRect(8, 22, 114, 26);
  x.strokeStyle = 'rgba(140,118,86,.28)'; x.strokeRect(8, 22, 114, 26);
  x.fillStyle = '#0a0907'; x.fillRect(14, 48, 8, 28); x.fillRect(108, 48, 8, 28);
  // shoes
  x.fillStyle = '#26221c'; x.beginPath(); x.ellipse(38, 68, 18, 9, 0, 0, TAU); x.fill();
  x.beginPath(); x.ellipse(72, 68, 18, 9, 0, 0, TAU); x.fill();
  grain(x, 130, 80, .1, 83);
  return cv;
}

function drawWasher() {
  const [cv, x] = surface(130, 130);
  x.fillStyle = '#20201d'; x.fillRect(8, 8, 114, 116);
  x.strokeStyle = 'rgba(180,180,165,.2)'; x.strokeRect(8, 8, 114, 116);
  x.fillStyle = '#121211'; x.beginPath(); x.arc(65, 70, 40, 0, TAU); x.fill();
  x.strokeStyle = '#4a4a42'; x.lineWidth = 3; x.beginPath(); x.arc(65, 70, 38, 0, TAU); x.stroke();
  x.fillStyle = '#2a2b28'; x.beginPath(); x.arc(65, 70, 30, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(190,200,190,.12)'; x.lineWidth = 2;
  x.beginPath(); x.arc(65, 70, 22, .4, 2.1); x.stroke();
  x.fillStyle = '#3a3a33'; x.fillRect(18, 16, 94, 14);
  x.fillStyle = '#7a715c'; x.fillRect(100, 20, 8, 6);
  grain(x, 130, 130, .1, 89);
  return cv;
}

function drawCar() {
  const [cv, x] = surface(400, 160);
  // ground shadow
  const shadow = x.createRadialGradient(200, 142, 10, 200, 142, 180);
  shadow.addColorStop(0, 'rgba(0,0,0,.7)'); shadow.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = shadow; x.fillRect(0, 110, 400, 50);

  // body
  const g = x.createLinearGradient(0, 58, 0, 134);
  g.addColorStop(0, '#2b2321'); g.addColorStop(.45, '#191413'); g.addColorStop(1, '#080707');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(22, 118);
  x.lineTo(22, 92);
  x.quadraticCurveTo(30, 74, 86, 70);
  x.lineTo(118, 40);
  x.quadraticCurveTo(132, 28, 200, 27);
  x.quadraticCurveTo(280, 28, 320, 48);
  x.lineTo(352, 66);
  x.quadraticCurveTo(384, 70, 388, 96);
  x.lineTo(388, 118);
  x.closePath();
  x.fill();
  // roof rim
  x.strokeStyle = 'rgba(180,160,130,.28)'; x.lineWidth = 1.6;
  x.beginPath(); x.moveTo(118, 40); x.quadraticCurveTo(132, 28, 200, 27); x.quadraticCurveTo(280, 28, 320, 48); x.stroke();

  // windows
  const wg = x.createLinearGradient(0, 40, 0, 78);
  wg.addColorStop(0, '#38464a'); wg.addColorStop(1, '#101618');
  for (const [x0, x1] of [[128, 176], [184, 236], [244, 308]]) {
    x.fillStyle = wg;
    x.beginPath();
    x.moveTo(x0, 74); x.lineTo(x0 + 8, 42); x.lineTo(x1 - 6, 42); x.lineTo(x1, 74);
    x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.stroke();
  }
  // windshield glint
  x.strokeStyle = 'rgba(190,210,210,.18)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(140, 70); x.lineTo(152, 44); x.stroke();

  // doors + handles
  x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(238, 78); x.lineTo(238, 120); x.moveTo(322, 80); x.lineTo(322, 120); x.stroke();
  x.fillStyle = '#655947';
  x.fillRect(260, 86, 22, 4); x.fillRect(336, 88, 20, 4);

  // wheels
  for (const cx of [104, 320]) {
    x.fillStyle = '#050505';
    x.beginPath(); x.arc(cx, 124, 28, 0, TAU); x.fill();
    x.fillStyle = '#17161a';
    x.beginPath(); x.arc(cx, 124, 17, 0, TAU); x.fill();
    x.strokeStyle = '#4a4740'; x.lineWidth = 2.5;
    x.beginPath(); x.arc(cx, 124, 12, 0, TAU); x.stroke();
    x.fillStyle = '#2c2b2e';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      x.beginPath(); x.arc(cx + Math.cos(a) * 7, 124 + Math.sin(a) * 7, 2.2, 0, TAU); x.fill();
    }
  }

  // lights
  const tl = x.createRadialGradient(26, 92, 1, 26, 92, 20);
  tl.addColorStop(0, 'rgba(255,40,40,.9)'); tl.addColorStop(1, 'rgba(120,0,0,0)');
  x.fillStyle = tl; x.fillRect(6, 76, 44, 36);
  x.fillStyle = '#8e1016'; x.fillRect(22, 88, 6, 12);

  const hl = x.createRadialGradient(386, 96, 1, 386, 96, 22);
  hl.addColorStop(0, 'rgba(255,235,190,.5)'); hl.addColorStop(1, 'rgba(255,220,160,0)');
  x.fillStyle = hl; x.fillRect(366, 78, 34, 34);

  // rust / grime
  const r = rng(97);
  x.fillStyle = 'rgba(110,60,30,.16)';
  for (let i = 0; i < 40; i++) x.fillRect(30 + r() * 340, 80 + r() * 40, 2 + r() * 12, 1 + r() * 3);
  grain(x, 400, 160, .08, 99);
  return cv;
}

/* ============================================================
   Pickups
   ============================================================ */

function drawGas() {
  const [cv, x] = surface(90, 110);
  x.fillStyle = 'rgba(0,0,0,.5)';
  x.beginPath(); x.ellipse(45, 104, 34, 5, 0, 0, TAU); x.fill();
  const g = x.createLinearGradient(16, 0, 78, 0);
  g.addColorStop(0, '#7e1013'); g.addColorStop(.4, '#c62828'); g.addColorStop(1, '#5d0a0c');
  x.fillStyle = g;
  x.beginPath(); x.roundRect(16, 18, 58, 84, 6); x.fill();
  x.strokeStyle = '#e05a4a'; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = '#3a090a'; x.fillRect(24, 34, 42, 3);
  // handle
  x.strokeStyle = '#8c1a1a'; x.lineWidth = 7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(24, 20); x.lineTo(24, 10); x.lineTo(64, 10); x.lineTo(64, 20); x.stroke();
  // cap
  x.fillStyle = '#1b1b18'; x.fillRect(58, 12, 12, 12);
  x.fillStyle = '#2c2c26'; x.fillRect(33, 28, 14, 5);
  grain(x, 90, 110, .1, 101);
  return cv;
}

function drawKeys() {
  const [cv, x] = surface(70, 60);
  x.strokeStyle = '#d9b25e'; x.lineWidth = 3;
  x.beginPath(); x.arc(22, 24, 11, 0, TAU); x.stroke();
  x.fillStyle = '#c49a4a';
  x.fillRect(32, 21, 26, 6);
  x.fillRect(52, 27, 5, 9); x.fillRect(44, 27, 4, 7);
  x.save(); x.translate(38, 22); x.rotate(.5);
  x.fillRect(0, 0, 20, 5); x.fillRect(15, 5, 4, 7);
  x.restore();
  x.strokeStyle = 'rgba(255,230,160,.4)'; x.lineWidth = 1;
  x.beginPath(); x.arc(22, 24, 11, -.9, .6); x.stroke();
  grain(x, 70, 60, .08, 103);
  return cv;
}

function drawBattery() {
  const [cv, x] = surface(46, 78);
  x.fillStyle = 'rgba(0,0,0,.45)';
  x.beginPath(); x.ellipse(23, 73, 16, 4, 0, 0, TAU); x.fill();
  const g = x.createLinearGradient(10, 0, 36, 0);
  g.addColorStop(0, '#1a1a18'); g.addColorStop(.5, '#3b3b35'); g.addColorStop(1, '#141412');
  x.fillStyle = g;
  x.beginPath(); x.roundRect(11, 10, 24, 62, 4); x.fill();
  x.fillStyle = '#b58b3e'; x.fillRect(11, 30, 24, 14);
  x.fillStyle = '#8c6a2c'; x.fillRect(11, 44, 24, 2);
  x.fillStyle = '#8f8b80'; x.fillRect(18, 4, 10, 7);
  x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(14, 14, 3, 48);
  grain(x, 46, 78, .1, 107);
  return cv;
}

function drawNote() {
  const [cv, x] = surface(60, 74);
  x.save(); x.translate(30, 37); x.rotate(-.06);
  x.fillStyle = '#c8bda3'; x.fillRect(-20, -26, 40, 52);
  x.strokeStyle = 'rgba(90,75,55,.4)'; x.strokeRect(-20, -26, 40, 52);
  x.strokeStyle = 'rgba(70,55,40,.5)'; x.lineWidth = 1;
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-14, -18 + i * 7); x.lineTo(8 + (i % 2) * 5, -18 + i * 7); x.stroke(); }
  x.fillStyle = 'rgba(110,20,20,.5)'; x.fillRect(-8, 20, 16, 2);
  x.restore();
  grain(x, 60, 74, .1, 109);
  return cv;
}

/* ============================================================
   MILO
   ============================================================ */

function drawMiloHead(x, cx, cy, rx, ry, detail = 1) {
  // ---- neck column and exposed cable
  x.fillStyle = '#0c0b09';
  x.fillRect(cx - rx * 0.3, cy + ry * 0.55, rx * 0.6, ry * 0.75);
  x.strokeStyle = 'rgba(90,22,22,.5)'; x.lineWidth = Math.max(1, detail * 0.8);
  x.beginPath(); x.moveTo(cx - rx * 0.12, cy + ry * 0.62); x.lineTo(cx + rx * 0.05, cy + ry * 0.95); x.stroke();

  // ---- head shell
  const g = x.createRadialGradient(cx - rx * 0.34, cy - ry * 0.42, 2, cx + rx * 0.1, cy + ry * 0.2, rx * 1.55);
  g.addColorStop(0, '#d8cdb6');
  g.addColorStop(0.42, '#a99d84');
  g.addColorStop(0.78, '#6d6453');
  g.addColorStop(1, '#3d382e');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  x.fill();

  // ---- jaw (slightly wider, shadowed)
  const jg = x.createLinearGradient(cx, cy + ry * 0.2, cx, cy + ry);
  jg.addColorStop(0, '#8d826c');
  jg.addColorStop(1, '#4b4438');
  x.fillStyle = jg;
  x.beginPath();
  x.ellipse(cx + rx * 0.03, cy + ry * 0.47, rx * 0.85, ry * 0.5, 0, 0, Math.PI);
  x.fill();

  // ---- hair / scalp panel (uneven)
  x.fillStyle = '#1c1712';
  x.beginPath();
  x.moveTo(cx - rx * 0.95, cy - ry * 0.28);
  x.quadraticCurveTo(cx - rx * 0.9, cy - ry * 0.98, cx, cy - ry * 1.02);
  x.quadraticCurveTo(cx + rx * 0.92, cy - ry * 0.98, cx + rx * 0.96, cy - ry * 0.24);
  x.lineTo(cx + rx * 0.7, cy - ry * 0.46);
  x.lineTo(cx + rx * 0.42, cy - ry * 0.3);
  x.lineTo(cx + rx * 0.16, cy - ry * 0.55);
  x.lineTo(cx - rx * 0.12, cy - ry * 0.32);
  x.lineTo(cx - rx * 0.38, cy - ry * 0.58);
  x.lineTo(cx - rx * 0.62, cy - ry * 0.35);
  x.closePath(); x.fill();

  // ---- brow shelf
  x.fillStyle = 'rgba(30,24,18,.6)';
  x.beginPath();
  x.ellipse(cx, cy - ry * 0.29, rx * 0.78, ry * 0.2, 0, 0, Math.PI);
  x.fill();

  // ---- eye sockets
  for (const s of [-1, 1]) {
    const ex = cx + s * rx * 0.37;
    const ey = cy - ry * (s < 0 ? 0.1 : 0.07);
    // outer socket
    x.fillStyle = '#060505';
    x.beginPath();
    x.ellipse(ex, ey, rx * 0.235, ry * 0.195, s * 0.14, 0, TAU);
    x.fill();
    // inner shadow ring
    const sg = x.createRadialGradient(ex, ey, rx * 0.02, ex, ey, rx * 0.26);
    sg.addColorStop(0, 'rgba(0,0,0,1)');
    sg.addColorStop(0.62, 'rgba(0,0,0,.9)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sg;
    x.beginPath(); x.ellipse(ex, ey, rx * 0.26, ry * 0.22, s * 0.14, 0, TAU); x.fill();
    // rim highlight
    x.strokeStyle = 'rgba(190,175,145,.22)'; x.lineWidth = Math.max(0.8, detail * 0.9);
    x.beginPath(); x.ellipse(ex, ey, rx * 0.235, ry * 0.195, s * 0.14, 0, TAU); x.stroke();
    // eye pinprick
    x.fillStyle = '#ff5a28';
    x.beginPath(); x.arc(ex + s * rx * 0.03, ey + ry * 0.02, Math.max(1.1, rx * 0.048), 0, TAU); x.fill();
    x.fillStyle = '#ffe4b8';
    x.beginPath(); x.arc(ex + s * rx * 0.03, ey + ry * 0.02, Math.max(0.5, rx * 0.018), 0, TAU); x.fill();
    // grime tear
    if (detail > 1.2) {
      x.strokeStyle = 'rgba(40,28,20,.55)'; x.lineWidth = Math.max(1, rx * 0.012);
      x.beginPath();
      x.moveTo(ex + s * rx * 0.05, ey + ry * 0.17);
      x.lineTo(ex + s * rx * 0.02, ey + ry * 0.34);
      x.stroke();
    }
  }

  // ---- nose cavity
  x.fillStyle = 'rgba(10,8,6,.75)';
  x.beginPath();
  x.moveTo(cx, cy + ry * 0.12);
  x.lineTo(cx - rx * 0.055, cy + ry * 0.22);
  x.lineTo(cx + rx * 0.05, cy + ry * 0.24);
  x.closePath(); x.fill();

  // ---- grin
  const my = cy + ry * 0.48;
  const mouth = new Path2D();
  mouth.moveTo(cx - rx * 0.6, my - ry * 0.06);
  mouth.quadraticCurveTo(cx - rx * 0.1, my + ry * 0.3, cx + rx * 0.66, my - ry * 0.02);
  mouth.quadraticCurveTo(cx + rx * 0.08, my + ry * 0.14, cx - rx * 0.6, my - ry * 0.06);
  x.fillStyle = '#050404';
  x.fill(mouth);
  // lips / torn edge
  x.strokeStyle = 'rgba(25,18,14,.9)'; x.lineWidth = Math.max(1, detail * 1.1);
  x.stroke(mouth);

  // teeth (uneven)
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    if (i === 4 && detail > 1.4) continue; // a missing tooth
    const t = i / (teeth - 1);
    const tx = cx - rx * 0.5 + t * rx * 1.06;
    const ty = my - ry * 0.03 + Math.sin(t * Math.PI) * ry * 0.075;
    const hgt = ry * (0.085 + (i % 3) * 0.014);
    x.save(); x.translate(tx, ty); x.rotate((t - 0.5) * 0.3);
    x.fillStyle = i === 2 || i === 6 ? '#8c816a' : '#cfc5ab';
    x.fillRect(-rx * 0.028, 0, rx * 0.056, hgt);
    x.fillStyle = 'rgba(60,50,38,.35)';
    x.fillRect(-rx * 0.028, hgt * 0.72, rx * 0.056, hgt * 0.28);
    x.restore();
  }

  // ---- cheek damage / exposed mechanism
  x.fillStyle = '#40352a';
  x.beginPath();
  x.moveTo(cx - rx * 0.78, cy + ry * 0.04);
  x.lineTo(cx - rx * 0.57, cy + ry * 0.19);
  x.lineTo(cx - rx * 0.69, cy + ry * 0.35);
  x.lineTo(cx - rx * 0.86, cy + ry * 0.18);
  x.closePath(); x.fill();
  x.strokeStyle = 'rgba(150,130,95,.35)'; x.lineWidth = Math.max(0.8, detail * 0.7);
  x.beginPath(); x.moveTo(cx - rx * 0.74, cy + ry * 0.09); x.lineTo(cx - rx * 0.78, cy + ry * 0.29); x.stroke();

  // ---- jaw hinge plate
  x.fillStyle = '#29251f';
  x.beginPath(); x.arc(cx + rx * 0.82, cy + ry * 0.4, rx * 0.1, 0, TAU); x.fill();
  x.fillStyle = '#6b604d';
  x.beginPath(); x.arc(cx + rx * 0.82, cy + ry * 0.4, rx * 0.04, 0, TAU); x.fill();

  // ---- cracks
  x.strokeStyle = 'rgba(28,22,17,.7)'; x.lineWidth = Math.max(1, detail * 1.1);
  x.beginPath();
  x.moveTo(cx - rx * 0.06, cy - ry * 1.0);
  x.lineTo(cx + rx * 0.02, cy - ry * 0.68);
  x.lineTo(cx - rx * 0.14, cy - ry * 0.46);
  x.lineTo(cx - rx * 0.03, cy - ry * 0.24);
  x.stroke();
  x.beginPath();
  x.moveTo(cx + rx * 0.62, cy - ry * 0.52);
  x.lineTo(cx + rx * 0.4, cy - ry * 0.23);
  x.lineTo(cx + rx * 0.5, cy + ry * 0.02);
  x.stroke();
  if (detail > 2) {
    x.beginPath();
    x.moveTo(cx - rx * 0.3, cy + ry * 0.55);
    x.lineTo(cx - rx * 0.12, cy + ry * 0.66);
    x.lineTo(cx - rx * 0.2, cy + ry * 0.8);
    x.stroke();
  }

  // ---- party hat
  const hx = cx + rx * 0.16, hy = cy - ry * 0.86;
  x.save(); x.translate(hx, hy); x.rotate(0.26);
  const hg = x.createLinearGradient(-rx * 0.4, 0, rx * 0.4, 0);
  hg.addColorStop(0, '#4e1218');
  hg.addColorStop(0.45, '#8e2830');
  hg.addColorStop(1, '#3c0e13');
  x.fillStyle = hg;
  x.beginPath(); x.moveTo(-rx * 0.44, 0); x.lineTo(rx * 0.44, 0); x.lineTo(0, -ry * 0.66); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(220,180,130,.18)'; x.lineWidth = 1; x.stroke();
  x.fillStyle = 'rgba(220,200,165,.18)';
  x.beginPath(); x.moveTo(-rx * 0.3, -ry * 0.17); x.lineTo(rx * 0.3, -ry * 0.17); x.lineTo(0, -ry * 0.4); x.closePath(); x.fill();
  x.fillStyle = '#c9baa0'; x.beginPath(); x.arc(0, -ry * 0.68, rx * 0.08, 0, TAU); x.fill();
  x.restore();

  // ---- grime
  if (detail > 1) {
    const r = rng(131);
    x.fillStyle = 'rgba(25,19,14,.10)';
    for (let i = 0; i < 34; i++) {
      x.fillRect(cx - rx + r() * rx * 2, cy - ry + r() * ry * 2, rx * 0.07, ry * 0.018);
    }
  }
}

function drawMiloFrame(pose = 'idle') {
  const [cv, x] = surface(170, 330);
  const cx = 85;
  // ground shadow
  x.fillStyle = 'rgba(0,0,0,.55)';
  x.beginPath(); x.ellipse(cx, 322, 44, 7, 0, 0, TAU); x.fill();

  // legs
  x.strokeStyle = '#0b0a09'; x.lineWidth = 16; x.lineCap = 'round';
  const spread = pose === 'walk1' ? 15 : pose === 'walk2' ? -11 : pose === 'lunge' ? 8 : 7;
  x.beginPath(); x.moveTo(cx - 12, 236); x.lineTo(cx - 12 - spread, 316); x.stroke();
  x.beginPath(); x.moveTo(cx + 12, 236); x.lineTo(cx + 12 + spread, 316); x.stroke();
  // shoes
  x.fillStyle = '#050505';
  x.beginPath(); x.ellipse(cx - 12 - spread, 320, 15, 6, 0, 0, TAU); x.fill();
  x.beginPath(); x.ellipse(cx + 12 + spread, 320, 15, 6, 0, 0, TAU); x.fill();

  // torso
  const tg = x.createLinearGradient(cx - 40, 110, cx + 40, 240);
  tg.addColorStop(0, '#211d19'); tg.addColorStop(.5, '#100e0c'); tg.addColorStop(1, '#060605');
  x.fillStyle = tg;
  x.beginPath();
  x.moveTo(cx - 34, 170); x.quadraticCurveTo(cx - 46, 210, cx - 30, 244);
  x.lineTo(cx + 30, 244); x.quadraticCurveTo(cx + 46, 210, cx + 34, 170);
  x.quadraticCurveTo(cx + 26, 146, cx, 144);
  x.quadraticCurveTo(cx - 26, 146, cx - 34, 170);
  x.fill();
  // shirt / braces
  x.fillStyle = '#3a382f';
  x.beginPath();
  x.moveTo(cx - 20, 154); x.lineTo(cx + 20, 154); x.lineTo(cx + 26, 206); x.lineTo(cx - 26, 206); x.closePath(); x.fill();
  x.fillStyle = '#8d241f';
  x.fillRect(cx - 6, 156, 12, 34);
  x.fillStyle = '#b8862f'; x.fillRect(cx - 3, 158, 6, 6);
  // buttons
  x.fillStyle = '#0a0908';
  for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(cx, 186 + i * 16, 2.6, 0, TAU); x.fill(); }

  // arms
  x.strokeStyle = '#191510'; x.lineWidth = 13; x.lineCap = 'round';
  if (pose === 'lunge') {
    x.beginPath(); x.moveTo(cx - 32, 168); x.lineTo(cx - 66, 130); x.lineTo(cx - 74, 86); x.stroke();
    x.beginPath(); x.moveTo(cx + 32, 168); x.lineTo(cx + 66, 130); x.lineTo(cx + 74, 86); x.stroke();
    // hands
    x.fillStyle = '#a99d86';
    for (const s of [-1, 1]) {
      x.beginPath(); x.arc(cx + s * 76, 80, 9, 0, TAU); x.fill();
      for (let i = 0; i < 3; i++) {
        x.fillRect(cx + s * 76 + (s < 0 ? -14 : 2), 68 + i * 6, 12, 3);
      }
    }
  } else {
    const sway = pose === 'walk1' ? 6 : pose === 'walk2' ? -6 : 0;
    x.beginPath(); x.moveTo(cx - 32, 168); x.lineTo(cx - 44, 214 + sway); x.lineTo(cx - 42, 248 + sway); x.stroke();
    x.beginPath(); x.moveTo(cx + 32, 168); x.lineTo(cx + 44, 214 - sway); x.lineTo(cx + 42, 248 - sway); x.stroke();
    x.fillStyle = '#9b907b';
    x.beginPath(); x.arc(cx - 42, 250 + sway, 7, 0, TAU); x.fill();
    x.beginPath(); x.arc(cx + 42, 250 - sway, 7, 0, TAU); x.fill();
  }

  // bow tie
  x.fillStyle = '#8d141c';
  x.beginPath(); x.moveTo(cx, 164); x.lineTo(cx - 13, 156); x.lineTo(cx - 13, 172); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(cx, 164); x.lineTo(cx + 13, 156); x.lineTo(cx + 13, 172); x.closePath(); x.fill();
  x.fillStyle = '#c9a24e'; x.beginPath(); x.arc(cx, 164, 3, 0, TAU); x.fill();

  // head
  const hy = pose === 'lunge' ? 96 : 92;
  drawMiloHead(x, cx + (pose === 'lunge' ? 4 : 0), hy, 36, 42, 1.6);

  // neck seam
  x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(cx - 12, 132); x.lineTo(cx + 12, 132); x.stroke();

  grain(x, 170, 330, .09, 137);
  return cv;
}

function drawFace() {
  const [cv, x] = surface(512, 512);
  // dark backdrop with dirty halo
  const bg = x.createRadialGradient(256, 250, 30, 256, 270, 330);
  bg.addColorStop(0, '#15110d');
  bg.addColorStop(0.55, '#080605');
  bg.addColorStop(1, '#020202');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 512);

  // shoulders
  x.fillStyle = '#060505';
  x.beginPath();
  x.moveTo(-20, 512); x.quadraticCurveTo(40, 372, 196, 352);
  x.lineTo(322, 352); x.quadraticCurveTo(480, 372, 540, 512);
  x.closePath(); x.fill();
  // shirt
  x.fillStyle = '#211f1a';
  x.beginPath();
  x.moveTo(168, 512); x.lineTo(196, 366); x.lineTo(318, 366); x.lineTo(346, 512);
  x.closePath(); x.fill();
  x.fillStyle = '#5e0d12'; x.fillRect(242, 370, 30, 104);
  // bow tie
  x.fillStyle = '#741017';
  x.beginPath(); x.moveTo(256, 404); x.lineTo(198, 374); x.lineTo(198, 434); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(256, 404); x.lineTo(314, 374); x.lineTo(314, 434); x.closePath(); x.fill();
  x.fillStyle = '#a9863e'; x.beginPath(); x.arc(256, 404, 10, 0, TAU); x.fill();

  // huge head, cropped by the frame
  drawMiloHead(x, 256, 248, 176, 200, 5);

  // deep socket shadow
  const sh = x.createLinearGradient(0, 120, 0, 470);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(0.55, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.55)');
  x.fillStyle = sh; x.fillRect(0, 0, 512, 512);

  // extra damage details
  x.strokeStyle = 'rgba(18,13,10,.8)'; x.lineWidth = 2.4;
  x.beginPath();
  x.moveTo(226, 40); x.lineTo(244, 118); x.lineTo(220, 156); x.lineTo(238, 204);
  x.moveTo(132, 272); x.lineTo(186, 246); x.lineTo(206, 282);
  x.moveTo(392, 190); x.lineTo(350, 224); x.lineTo(366, 276);
  x.stroke();

  // hanging cable from one socket
  x.strokeStyle = '#2e251c'; x.lineWidth = 1.8;
  x.beginPath(); x.moveTo(318, 240); x.bezierCurveTo(330, 286, 292, 306, 306, 352); x.stroke();

  // hot eye cores
  for (const ex of [192, 320]) {
    const eg = x.createRadialGradient(ex, 232, 0, ex, 232, 26);
    eg.addColorStop(0, 'rgba(255,240,210,.95)');
    eg.addColorStop(0.18, 'rgba(255,120,40,.75)');
    eg.addColorStop(0.55, 'rgba(180,30,10,.18)');
    eg.addColorStop(1, 'rgba(120,0,0,0)');
    x.fillStyle = eg;
    x.beginPath(); x.arc(ex, 232, 26, 0, TAU); x.fill();
  }

  // film grain
  grain(x, 512, 512, .14, 149);

  // vignette
  const vg = x.createRadialGradient(256, 240, 110, 256, 256, 340);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.7, 'rgba(0,0,0,.25)');
  vg.addColorStop(1, 'rgba(0,0,0,.85)');
  x.fillStyle = vg; x.fillRect(0, 0, 512, 512);
  return cv;
}

/* ============================================================
   Wall / floor textures
   ============================================================ */

function tex(wallpaper, seed) {
  const [cv, x] = surface(64, 64);
  const r = rng(seed);
  if (wallpaper === 'wallpaper') {
    x.fillStyle = '#39332a'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? 'rgba(72,62,48,.30)' : 'rgba(52,46,37,.30)';
      x.fillRect(i * 8, 0, 8, 64);
    }
    x.fillStyle = 'rgba(110,94,68,.16)';
    for (let y = 0; y < 64; y += 16) for (let xx = 0; xx < 64; xx += 16) {
      x.beginPath(); x.arc(xx + 8, y + 8, 2.2, 0, TAU); x.fill();
      x.fillRect(xx + 5, y + 15, 6, 1);
    }
    x.fillStyle = 'rgba(18,14,10,.22)'; x.fillRect(0, 52, 64, 12);
  } else if (wallpaper === 'tile') {
    x.fillStyle = '#3d423d'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(18,20,18,.5)'; x.lineWidth = 1;
    for (let i = 0; i <= 64; i += 16) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke();
    }
    x.fillStyle = 'rgba(120,130,115,.05)';
    for (let i = 0; i < 20; i++) x.fillRect(r() * 64, r() * 64, 4 + r() * 10, 2 + r() * 8);
  } else if (wallpaper === 'concrete') {
    x.fillStyle = '#3a3733'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 240; i++) {
      const v = r();
      x.fillStyle = `rgba(${v > .5 ? 90 : 20},${v > .5 ? 86 : 19},${v > .5 ? 78 : 17},${.05 + r() * .12})`;
      x.fillRect(r() * 64, r() * 64, 1 + r() * 3, 1 + r() * 3);
    }
    x.strokeStyle = 'rgba(15,13,11,.4)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(10, 0); x.lineTo(18, 30); x.lineTo(14, 64); x.stroke();
  } else if (wallpaper === 'plaster') {
    x.fillStyle = '#474038'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 180; i++) {
      x.fillStyle = `rgba(20,17,14,${.03 + r() * .1})`;
      x.fillRect(r() * 64, r() * 64, 2 + r() * 7, 1 + r() * 3);
    }
    x.fillStyle = 'rgba(120,104,80,.06)';
    for (let i = 0; i < 6; i++) x.fillRect(0, r() * 64, 64, 1 + r() * 3);
  } else if (wallpaper === 'door') {
    x.fillStyle = '#2a221a'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(120,96,64,.3)'; x.lineWidth = 2;
    x.strokeRect(8, 4, 48, 56);
    x.strokeRect(14, 10, 36, 20); x.strokeRect(14, 36, 36, 18);
    x.fillStyle = '#a08045'; x.fillRect(53, 32, 3, 6);
  }
  return cv;
}

/* ============================================================
   Public
   ============================================================ */

export function buildSprites() {
  const s = {};
  s.sofa = { cv: drawSofa(), w: 240, h: 120 };
  s.coffee = { cv: drawCoffeeTable(), w: 160, h: 90 };
  s.tv = { cv: drawTV(), w: 150, h: 180 };
  s.shelf = { cv: drawShelf(), w: 120, h: 250 };
  s.armchair = { cv: drawArmchair(), w: 140, h: 140 };
  s.lamp = { cv: drawLamp(), w: 70, h: 230 };
  s.bed = { cv: drawBed(), w: 280, h: 160 };
  s.wardrobe = { cv: drawWardrobe(), w: 140, h: 270 };
  s.nightstand = { cv: drawNightstand(), w: 100, h: 100 };
  s.desk = { cv: drawDesk(), w: 200, h: 130 };
  s.chair = { cv: drawChair(), w: 80, h: 140 };
  s.bench = { cv: drawBench(), w: 250, h: 120 };
  s.crate = { cv: drawCrate(), w: 130, h: 110 };
  s.tub = { cv: drawTub(), w: 270, h: 120 };
  s.toilet = { cv: drawToilet(), w: 90, h: 140 };
  s.sink = { cv: drawSink(), w: 110, h: 130 };
  s.counter = { cv: drawCounter(), w: 240, h: 120 };
  s.fridge = { cv: drawFridge(), w: 140, h: 250 };
  s.island = { cv: drawIsland(), w: 270, h: 120 };
  s.table = { cv: drawTable(), w: 260, h: 130 };
  s.coatrack = { cv: drawCoatrack(), w: 90, h: 240 };
  s.shoebench = { cv: drawShoeBench(), w: 130, h: 80 };
  s.washer = { cv: drawWasher(), w: 130, h: 130 };
  s.car = { cv: drawCar(), w: 400, h: 160 };
  s.gas = { cv: drawGas(), w: 90, h: 110 };
  s.key = { cv: drawKeys(), w: 70, h: 60 };
  s.battery = { cv: drawBattery(), w: 46, h: 78 };
  s.note = { cv: drawNote(), w: 60, h: 74 };

  s.miloIdle = { cv: drawMiloFrame('idle'), w: 170, h: 330 };
  s.miloWalk1 = { cv: drawMiloFrame('walk1'), w: 170, h: 330 };
  s.miloWalk2 = { cv: drawMiloFrame('walk2'), w: 170, h: 330 };
  s.miloLunge = { cv: drawMiloFrame('lunge'), w: 170, h: 330 };

  s.face = { cv: drawFace(), w: 512, h: 512 };

  s.texWallpaper = tex('wallpaper', 201);
  s.texTile = tex('tile', 202);
  s.texConcrete = tex('concrete', 203);
  s.texPlaster = tex('plaster', 204);
  s.texDoor = tex('door', 205);

  return s;
}
