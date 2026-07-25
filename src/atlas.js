// =====================================================================
// atlas.js — seluruh tekstur digambar prosedural dengan Canvas API,
// jadi game ini tidak butuh satu pun file gambar.
// =====================================================================
import * as THREE from 'three';
import { T } from './config.js';

export const ATLAS_COLS = 8;
export const TILE_PX    = 32;
const SIZE = ATLAS_COLS * TILE_PX;

const canvas = document.createElement('canvas');
canvas.width = canvas.height = SIZE;
const g = canvas.getContext('2d');

// pseudo-random deterministik supaya tekstur konsisten tiap load
let _s = 1337;
function rnd() {
  _s = (_s * 1664525 + 1013904223) % 4294967296;
  return _s / 4294967296;
}

function origin(index) {
  return [(index % ATLAS_COLS) * TILE_PX, Math.floor(index / ATLAS_COLS) * TILE_PX];
}

function clear(index) {
  const [ox, oy] = origin(index);
  g.clearRect(ox, oy, TILE_PX, TILE_PX);
  return [ox, oy];
}

// blok padat: warna dasar + bintik noise
function solid(index, base, speck, extra) {
  const [ox, oy] = clear(index);
  g.fillStyle = base;
  g.fillRect(ox, oy, TILE_PX, TILE_PX);
  g.fillStyle = speck;
  for (let i = 0; i < 150; i++) {
    g.globalAlpha = 0.1 + rnd() * 0.3;
    g.fillRect(ox + ((rnd() * TILE_PX) | 0), oy + ((rnd() * TILE_PX) | 0), 1 + ((rnd() * 2) | 0), 1 + ((rnd() * 2) | 0));
  }
  g.globalAlpha = 1;
  if (extra) extra(ox, oy);
}

// bijih: batu + gumpalan mineral
function ore(index, color, dark) {
  solid(index, '#8a8a8a', '#6c6c6c');
  const [ox, oy] = origin(index);
  const spots = [[7, 8], [19, 6], [11, 20], [22, 21], [16, 14]];
  for (const [x, y] of spots) {
    g.fillStyle = dark;
    g.fillRect(ox + x - 1, oy + y - 1, 7, 7);
    g.fillStyle = color;
    g.fillRect(ox + x, oy + y, 5, 5);
  }
}

// ikon item: gambar di atas latar transparan
function icon(index, draw) {
  const [ox, oy] = clear(index);
  g.save();
  g.translate(ox, oy);
  draw();
  g.restore();
}

function tool(headColor, headDark, shape) {
  return () => {
    // gagang kayu
    g.strokeStyle = '#6b4a2a';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(10, 26); g.lineTo(21, 11); g.stroke();
    g.fillStyle = headDark;
    shape(2);
    g.fillStyle = headColor;
    shape(0);
  };
}

const PICK_SHAPE   = (p) => { g.fillRect(15 - p, 4 - p, 14 + p * 2, 5 + p); g.fillRect(13 - p, 7 - p, 5, 4); g.fillRect(24, 7 - p, 5, 4); };
const SWORD_SHAPE  = (p) => { g.fillRect(17 - p, 4 - p, 6 + p * 2, 16 + p); g.fillRect(11 - p, 19 - p, 12 + p * 2, 4 + p); };
const AXE_SHAPE    = (p) => { g.fillRect(16 - p, 4 - p, 11 + p * 2, 12 + p * 2); g.fillRect(13 - p, 7 - p, 4, 7); };
const SHOVEL_SHAPE = (p) => { g.fillRect(17 - p, 4 - p, 10 + p * 2, 10 + p * 2); };

// =====================================================================
// Menggambar seluruh tile
// =====================================================================
function paintAll() {
  // --- blok alam ---
  solid(T.GRASS_TOP, '#5fa03a', '#3f7a24');
  solid(T.DIRT, '#8b6239', '#6d4a2a');
  solid(T.GRASS_SIDE, '#8b6239', '#6d4a2a', (ox, oy) => {
    g.fillStyle = '#5fa03a';
    g.fillRect(ox, oy, TILE_PX, 8);
    g.fillStyle = '#4c8b2e';
    for (let i = 0; i < 26; i++) g.fillRect(ox + ((rnd() * TILE_PX) | 0), oy + 6 + ((rnd() * 5) | 0), 1, 3);
  });
  solid(T.STONE, '#8a8a8a', '#6c6c6c');
  solid(T.SAND, '#ddcb8f', '#c2ad6d');
  solid(T.SANDSTONE, '#d8c48b', '#bda householder'.slice(0, 7), (ox, oy) => {
    g.strokeStyle = 'rgba(150,130,90,.7)'; g.lineWidth = 1;
    for (let y = 8; y < TILE_PX; y += 8) { g.beginPath(); g.moveTo(ox, oy + y); g.lineTo(ox + TILE_PX, oy + y); g.stroke(); }
  });
  solid(T.GRAVEL, '#8d8579', '#6a635a', (ox, oy) => {
    for (let i = 0; i < 14; i++) {
      g.fillStyle = ['#a9a094', '#6f675d', '#bdb4a6'][(rnd() * 3) | 0];
      g.fillRect(ox + ((rnd() * 28) | 0), oy + ((rnd() * 28) | 0), 4, 4);
    }
  });
  solid(T.COBBLE, '#7e7e7e', '#5f5f5f', (ox, oy) => {
    for (let i = 0; i < 12; i++) {
      g.fillStyle = ['#9a9a9a', '#6a6a6a', '#8c8c8c'][(rnd() * 3) | 0];
      g.fillRect(ox + ((rnd() * 26) | 0), oy + ((rnd() * 26) | 0), 6, 5);
    }
  });
  solid(T.BEDROCK, '#3a3a3a', '#1e1e1e', (ox, oy) => {
    for (let i = 0; i < 12; i++) {
      g.fillStyle = ['#565656', '#252525'][(rnd() * 2) | 0];
      g.fillRect(ox + ((rnd() * 26) | 0), oy + ((rnd() * 26) | 0), 6, 6);
    }
  });
  solid(T.SNOW, '#f2f7fb', '#dbe7f2');
  solid(T.ICE, '#96c9f0', '#7fb6e6');
  solid(T.WATER, '#2f6fd0', '#2a63bb');

  // --- kayu & tanaman ---
  solid(T.LOG_SIDE, '#6b4a2a', '#4f3620', (ox, oy) => {
    g.strokeStyle = 'rgba(58,38,20,.7)'; g.lineWidth = 2;
    for (let i = 5; i < TILE_PX; i += 8) { g.beginPath(); g.moveTo(ox + i, oy); g.lineTo(ox + i, oy + TILE_PX); g.stroke(); }
  });
  solid(T.LOG_TOP, '#a9793f', '#8a6132', (ox, oy) => {
    g.strokeStyle = 'rgba(88,62,30,.7)'; g.lineWidth = 1;
    for (let r = 4; r < 16; r += 4) { g.beginPath(); g.arc(ox + 16, oy + 16, r, 0, Math.PI * 2); g.stroke(); }
  });
  solid(T.LEAVES, '#3f8f31', '#2b6a21', (ox, oy) => {
    g.fillStyle = 'rgba(18,58,14,.55)';
    for (let i = 0; i < 18; i++) g.fillRect(ox + ((rnd() * 29) | 0), oy + ((rnd() * 29) | 0), 3, 3);
  });
  solid(T.PLANKS, '#b58a4e', '#96703c', (ox, oy) => {
    g.strokeStyle = 'rgba(88,62,30,.8)'; g.lineWidth = 2;
    for (let i = 8; i < TILE_PX; i += 8) { g.beginPath(); g.moveTo(ox, oy + i); g.lineTo(ox + TILE_PX, oy + i); g.stroke(); }
  });
  solid(T.CACTUS_SIDE, '#3f7a35', '#2f5f28', (ox, oy) => {
    g.strokeStyle = '#2a5423'; g.lineWidth = 2;
    g.strokeRect(ox + 3.5, oy + 0.5, TILE_PX - 7, TILE_PX);
  });
  solid(T.CACTUS_TOP, '#4a8a3e', '#356a2d');

  // --- blok buatan ---
  solid(T.BRICK, '#9c4b3c', '#7d3a2d', (ox, oy) => {
    g.strokeStyle = '#d9cfc6'; g.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      const yy = oy + r * 8;
      g.beginPath(); g.moveTo(ox, yy); g.lineTo(ox + TILE_PX, yy); g.stroke();
      const off = r % 2 ? 0 : 16;
      g.beginPath(); g.moveTo(ox + off, yy); g.lineTo(ox + off, yy + 8); g.stroke();
    }
  });
  solid(T.WOOL, '#eeeeee', '#d5d5d5');
  solid(T.GLASS, 'rgba(190,225,240,.35)', 'rgba(255,255,255,.5)', (ox, oy) => {
    g.strokeStyle = '#cfe9f5'; g.lineWidth = 2;
    g.strokeRect(ox + 1, oy + 1, TILE_PX - 2, TILE_PX - 2);
  });
  solid(T.TABLE_TOP, '#8a6134', '#6d4c28', (ox, oy) => {
    g.strokeStyle = '#5c3f21'; g.lineWidth = 2;
    g.strokeRect(ox + 4, oy + 4, 24, 24);
    g.beginPath(); g.moveTo(ox + 16, oy + 4); g.lineTo(ox + 16, oy + 28); g.stroke();
  });
  solid(T.TABLE_SIDE, '#b58a4e', '#96703c', (ox, oy) => {
    g.fillStyle = '#7a5730'; g.fillRect(ox, oy, TILE_PX, 9);
    g.strokeStyle = '#5c3f21'; g.lineWidth = 1;
    for (let i = 12; i < TILE_PX; i += 7) { g.beginPath(); g.moveTo(ox, oy + i); g.lineTo(ox + TILE_PX, oy + i); g.stroke(); }
  });
  solid(T.FURNACE_SIDE, '#787878', '#5c5c5c');
  solid(T.FURNACE_FRONT, '#787878', '#5c5c5c', (ox, oy) => {
    g.fillStyle = '#3a3a3a'; g.fillRect(ox + 6, oy + 14, 20, 13);
    g.fillStyle = '#ff9a35'; g.fillRect(ox + 9, oy + 20, 14, 6);
    g.fillStyle = '#ffd479'; g.fillRect(ox + 12, oy + 22, 8, 4);
  });
  solid(T.TORCH, '#2b2b2b', '#1c1c1c', (ox, oy) => {
    g.fillStyle = '#8b6239'; g.fillRect(ox + 14, oy + 12, 5, 20);
    g.fillStyle = '#ff9a35'; g.fillRect(ox + 12, oy + 5, 9, 9);
    g.fillStyle = '#ffe9a8'; g.fillRect(ox + 14, oy + 7, 5, 5);
  });
  solid(T.IRON_BLOCK, '#d8d8d8', '#bcbcbc');
  solid(T.GOLD_BLOCK, '#f4d448', '#d4b52f');
  solid(T.DIAMOND_BLOCK, '#5ce0d8', '#3bbdb4');
  solid(T.COAL_BLOCK, '#1f1f1f', '#101010');

  // --- bijih ---
  ore(T.COAL_ORE, '#2a2a2a', '#141414');
  ore(T.IRON_ORE, '#d0a17a', '#a97e58');
  ore(T.GOLD_ORE, '#f4d448', '#c9a92c');
  ore(T.DIAMOND_ORE, '#5ce0d8', '#33b3ab');

  // --- ikon item ---
  icon(T.STICK, () => {
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(10, 25); g.lineTo(22, 7); g.stroke();
  });
  icon(T.COAL, () => {
    g.fillStyle = '#1c1c1c';
    g.beginPath(); g.arc(16, 17, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d3d3d'; g.fillRect(11, 11, 5, 4);
  });
  const ingot = (c1, c2) => () => {
    g.fillStyle = c2; g.fillRect(6, 14, 20, 9);
    g.fillStyle = c1; g.fillRect(8, 12, 16, 8);
  };
  icon(T.IRON_INGOT, ingot('#e8e8e8', '#b4b4b4'));
  icon(T.GOLD_INGOT, ingot('#ffe066', '#d4a72c'));
  icon(T.DIAMOND, () => {
    g.fillStyle = '#5ce0d8';
    g.beginPath(); g.moveTo(16, 5); g.lineTo(27, 16); g.lineTo(16, 27); g.lineTo(5, 16); g.closePath(); g.fill();
    g.fillStyle = '#b6fffa';
    g.beginPath(); g.moveTo(16, 9); g.lineTo(22, 15); g.lineTo(16, 16); g.closePath(); g.fill();
  });
  icon(T.APPLE, () => {
    g.fillStyle = '#d2372c';
    g.beginPath(); g.arc(16, 19, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3f8f31'; g.fillRect(17, 6, 7, 4);
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(16, 11); g.lineTo(16, 6); g.stroke();
  });
  icon(T.PORK_RAW, () => {
    g.fillStyle = '#f0a0a8'; g.fillRect(6, 10, 20, 13);
    g.fillStyle = '#e2d9c8'; g.fillRect(6, 10, 20, 4);
  });
  icon(T.PORK_COOKED, () => {
    g.fillStyle = '#c07a45'; g.fillRect(6, 10, 20, 13);
    g.fillStyle = '#e2d9c8'; g.fillRect(6, 10, 20, 4);
  });
  icon(T.BREAD, () => {
    g.fillStyle = '#c08a45';
    g.beginPath(); g.ellipse(16, 17, 12, 7, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9a6a30'; g.lineWidth = 2;
    for (let i = -6; i <= 6; i += 6) { g.beginPath(); g.moveTo(16 + i, 12); g.lineTo(16 + i + 2, 21); g.stroke(); }
  });
  icon(T.WHEAT, () => {
    g.strokeStyle = '#d8b34a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(16, 28); g.lineTo(16, 6); g.stroke();
    g.fillStyle = '#e6c860';
    for (let y = 8; y < 24; y += 5) { g.fillRect(9, y, 6, 3); g.fillRect(18, y, 6, 3); }
  });

  icon(T.PICK_W, tool('#b58a4e', '#8a6134', PICK_SHAPE));
  icon(T.PICK_S, tool('#9a9a9a', '#6f6f6f', PICK_SHAPE));
  icon(T.PICK_I, tool('#e8e8e8', '#b4b4b4', PICK_SHAPE));
  icon(T.PICK_D, tool('#5ce0d8', '#33b3ab', PICK_SHAPE));
  icon(T.SWORD_W, tool('#b58a4e', '#8a6134', SWORD_SHAPE));
  icon(T.SWORD_S, tool('#9a9a9a', '#6f6f6f', SWORD_SHAPE));
  icon(T.SWORD_I, tool('#e8e8e8', '#b4b4b4', SWORD_SHAPE));
  icon(T.SWORD_D, tool('#5ce0d8', '#33b3ab', SWORD_SHAPE));
  icon(T.AXE_W, tool('#b58a4e', '#8a6134', AXE_SHAPE));
  icon(T.AXE_S, tool('#9a9a9a', '#6f6f6f', AXE_SHAPE));
  icon(T.SHOVEL_W, tool('#b58a4e', '#8a6134', SHOVEL_SHAPE));
  icon(T.SHOVEL_S, tool('#9a9a9a', '#6f6f6f', SHOVEL_SHAPE));
}

paintAll();

export const atlasCanvas = canvas;

export const atlasTexture = new THREE.CanvasTexture(canvas);
atlasTexture.magFilter  = THREE.NearestFilter;
atlasTexture.minFilter  = THREE.NearestFilter;
atlasTexture.colorSpace = THREE.SRGBColorSpace;

// Menggambar satu tile ke elemen canvas kecil (dipakai untuk ikon UI)
export function tileToCanvas(tileIndex, px = 32) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const [sx, sy] = origin(tileIndex);
  ctx.drawImage(canvas, sx, sy, TILE_PX, TILE_PX, 0, 0, px, px);
  return c;
}

// Koordinat UV untuk satu tile (dipakai mesher)
export function tileUV(tileIndex, u, v) {
  const col = tileIndex % ATLAS_COLS;
  const row = Math.floor(tileIndex / ATLAS_COLS);
  return [(col + u) / ATLAS_COLS, (ATLAS_COLS - row - 1 + v) / ATLAS_COLS];
}
