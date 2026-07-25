// =====================================================================
// world.js — penyimpanan chunk, generator terrain (bioma, gua, bijih),
// dan sistem save/load perubahan pemain.
// =====================================================================
import {
  CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, SEED, AIR, BLOCKS,
} from './config.js';

// ---------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------
function hash(x, y, z, s) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 419.2) * 43758.5453;
  return n - Math.floor(n);
}

function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, 0, s),     b = hash(xi + 1, yi, 0, s);
  const c = hash(xi, yi + 1, 0, s), d = hash(xi + 1, yi + 1, 0, s);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function noise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c000 = hash(xi, yi, zi, s),         c100 = hash(xi + 1, yi, zi, s);
  const c010 = hash(xi, yi + 1, zi, s),     c110 = hash(xi + 1, yi + 1, zi, s);
  const c001 = hash(xi, yi, zi + 1, s),     c101 = hash(xi + 1, yi, zi + 1, s);
  const c011 = hash(xi, yi + 1, zi + 1, s), c111 = hash(xi + 1, yi + 1, zi + 1, s);
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm2(x, y, s, oct = 4) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += noise2(x * f, y * f, s + i * 31) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

// ---------------------------------------------------------------------
// Terrain & bioma
// ---------------------------------------------------------------------
export function heightAt(x, z) {
  const continent = fbm2(x / 320, z / 320, SEED, 3);          // daratan besar
  const hills     = fbm2(x / 70,  z / 70,  SEED + 77, 4);     // perbukitan
  const detail    = fbm2(x / 22,  z / 22,  SEED + 155, 3);    // detail kecil
  const mountain  = Math.pow(Math.max(0, continent - 0.55) * 2.2, 1.8) * 34;
  return Math.floor(WATER_LEVEL - 4 + continent * 12 + hills * 12 + detail * 4 + mountain);
}

export const BIOMES = {
  PLAINS:   { id: 0, name: 'Plains',    top: 1,  filler: 2, treeChance: 0.004 },
  FOREST:   { id: 1, name: 'Forest',    top: 1,  filler: 2, treeChance: 0.045 },
  DESERT:   { id: 2, name: 'Desert',    top: 4,  filler: 4, treeChance: 0, cactusChance: 0.006 },
  MOUNTAIN: { id: 3, name: 'Mountains', top: 1,  filler: 2, treeChance: 0.006 },
  SNOWY:    { id: 4, name: 'Snowy',     top: 17, filler: 2, treeChance: 0.02 },
  BEACH:    { id: 5, name: 'Beach',     top: 4,  filler: 4, treeChance: 0 },
};

export function biomeAt(x, z) {
  const temp = fbm2(x / 260, z / 260, SEED + 500, 3);
  const wet  = fbm2(x / 190, z / 190, SEED + 900, 3);
  const hgt  = heightAt(x, z);

  if (hgt <= WATER_LEVEL + 1) return BIOMES.BEACH;
  if (hgt > WATER_LEVEL + 26) return BIOMES.MOUNTAIN;
  if (temp > 0.66 && wet < 0.42) return BIOMES.DESERT;
  if (temp < 0.32) return BIOMES.SNOWY;
  if (wet > 0.55) return BIOMES.FOREST;
  return BIOMES.PLAINS;
}

// ---------------------------------------------------------------------
// Chunk
// ---------------------------------------------------------------------
const AREA = CHUNK_SIZE * CHUNK_SIZE;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(AREA * CHUNK_HEIGHT);
    this.heights = new Uint8Array(AREA);   // blok padat tertinggi (untuk skylight)
    this.mesh = null;
    this.waterMesh = null;
    this.dirty = true;
    this.generated = false;
  }
  static index(x, y, z) { return y * AREA + z * CHUNK_SIZE + x; }
  get(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT || x < 0 || z < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE) return AIR;
    return this.data[Chunk.index(x, y, z)];
  }
  set(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT || x < 0 || z < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE) return;
    this.data[Chunk.index(x, y, z)] = id;
  }
  recalcHeights() {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        let h = 0;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const id = this.get(x, y, z);
          if (id !== AIR && !BLOCKS[id].transparent) { h = y; break; }
        }
        this.heights[z * CHUNK_SIZE + x] = h;
      }
    }
  }
}

export const chunks = new Map();
const ckey = (cx, cz) => cx + ',' + cz;

export function getChunk(cx, cz) { return chunks.get(ckey(cx, cz)) || null; }
export function chunkCoords(x, z) {
  return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

// ---------------------------------------------------------------------
// Perubahan pemain (disimpan permanen di localStorage)
// ---------------------------------------------------------------------
const SAVE_KEY = 'blockcraft:v2:world';
export let edits = {};

export function loadWorldSave() {
  try { edits = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); }
  catch (e) { edits = {}; }
}

let saveTimer = null;
export function saveWorld() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(edits)); } catch (e) {}
  }, 500);
}

export function resetWorld() {
  edits = {};
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  chunks.clear();
}

// ---------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------
function placeTree(chunk, lx, y, lz) {
  const wx = chunk.cx * CHUNK_SIZE + lx, wz = chunk.cz * CHUNK_SIZE + lz;
  const h = 4 + Math.floor(hash(wx, wz, 3, SEED) * 3);
  for (let i = 0; i < h; i++) chunk.set(lx, y + i, lz, 5);
  const top = y + h;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -2; dy <= 1; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) continue;
        const nx = lx + dx, nz = lz + dz, ny = top + dy;
        if (nx < 0 || nz < 0 || nx >= CHUNK_SIZE || nz >= CHUNK_SIZE) continue;
        if (chunk.get(nx, ny, nz) === AIR) chunk.set(nx, ny, nz, 6);
      }
    }
  }
}

function oreAt(wx, y, wz) {
  if (y < 5)  return noise3(wx / 7, y / 7, wz / 7, SEED + 61) > 0.80 ? 16 : 0;   // diamond
  if (y < 14) return noise3(wx / 7, y / 7, wz / 7, SEED + 62) > 0.82 ? 15 : 0;   // gold
  if (y < 34) return noise3(wx / 8, y / 8, wz / 8, SEED + 63) > 0.78 ? 14 : 0;   // iron
  return noise3(wx / 9, y / 9, wz / 9, SEED + 64) > 0.76 ? 13 : 0;               // coal
}

export function generateChunk(cx, cz) {
  const chunk = new Chunk(cx, cz);

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const h = Math.min(heightAt(wx, wz), CHUNK_HEIGHT - 12);
      const biome = biomeAt(wx, wz);

      for (let y = 0; y <= Math.max(h, WATER_LEVEL); y++) {
        let id = AIR;

        if (y === 0) {
          id = 12;                                   // bedrock
        } else if (y <= h) {
          if (y === h)         id = biome.top;
          else if (y >= h - 3) id = biome.filler;
          else                 id = 3;               // batu

          // gua: noise 3D, hanya di bawah permukaan
          if (y < h - 1 && y > 1) {
            const cave = noise3(wx / 17, y / 12, wz / 17, SEED + 21);
            const worm = noise3(wx / 33, y / 20, wz / 33, SEED + 22);
            if (cave > 0.70 || (worm > 0.62 && cave > 0.54)) id = AIR;
          }

          if (id === 3) {
            const o = oreAt(wx, y, wz);
            if (o) id = o;
          }
        } else if (y <= WATER_LEVEL) {
          id = 11;                                   // air
        }

        if (id !== AIR) chunk.set(lx, y, lz, id);
      }

      // pasir di tepi & dasar perairan
      if (h <= WATER_LEVEL + 1 && chunk.get(lx, h, lz) !== AIR) chunk.set(lx, h, lz, 4);

      // vegetasi
      const r = hash(wx, wz, 7, SEED + 3);
      if (h > WATER_LEVEL + 1 && chunk.get(lx, h, lz) !== AIR) {
        if (r < biome.treeChance) {
          placeTree(chunk, lx, h + 1, lz);
        } else if (biome.cactusChance && r > 1 - biome.cactusChance) {
          const ch = 2 + Math.floor(hash(wx, wz, 9, SEED) * 2);
          for (let i = 0; i < ch; i++) chunk.set(lx, h + 1 + i, lz, 19);
        }
      }
    }
  }

  // terapkan kembali perubahan pemain untuk chunk ini
  const prefix = cx + ':' + cz + ':';
  for (const k in edits) {
    if (k.indexOf(prefix) !== 0) continue;
    const p = k.split(':');
    chunk.set(+p[2], +p[3], +p[4], edits[k]);
  }

  chunk.recalcHeights();
  chunk.generated = true;
  chunks.set(ckey(cx, cz), chunk);
  return chunk;
}

export function ensureChunk(cx, cz) {
  return getChunk(cx, cz) || generateChunk(cx, cz);
}

// ---------------------------------------------------------------------
// Akses blok global
// ---------------------------------------------------------------------
export function getBlock(x, y, z) {
  y = Math.floor(y);
  if (y < 0 || y >= CHUNK_HEIGHT) return AIR;
  x = Math.floor(x); z = Math.floor(z);
  const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
  const chunk = getChunk(cx, cz);
  if (!chunk) return AIR;
  return chunk.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
}

function markDirty(cx, cz) {
  const c = getChunk(cx, cz);
  if (c) c.dirty = true;
}

export function setBlock(x, y, z, id, record = true) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (y < 1 || y >= CHUNK_HEIGHT) return false;
  const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
  const chunk = getChunk(cx, cz);
  if (!chunk) return false;

  const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
  chunk.set(lx, y, lz, id);
  chunk.recalcHeights();
  chunk.dirty = true;

  if (record) {
    edits[cx + ':' + cz + ':' + lx + ':' + y + ':' + lz] = id;
    saveWorld();
  }

  if (lx === 0)              markDirty(cx - 1, cz);
  if (lx === CHUNK_SIZE - 1) markDirty(cx + 1, cz);
  if (lz === 0)              markDirty(cx, cz - 1);
  if (lz === CHUNK_SIZE - 1) markDirty(cx, cz + 1);
  return true;
}

// tinggi permukaan padat pada kolom (skylight & spawn)
export function surfaceHeight(x, z) {
  x = Math.floor(x); z = Math.floor(z);
  const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
  const chunk = getChunk(cx, cz);
  if (!chunk) return heightAt(x, z);
  return chunk.heights[(z - cz * CHUNK_SIZE) * CHUNK_SIZE + (x - cx * CHUNK_SIZE)];
}

// cari titik pijak aman di atas permukaan
export function safeSpawn(x, z) {
  const [cx, cz] = chunkCoords(x, z);
  ensureChunk(cx, cz);
  for (let y = CHUNK_HEIGHT - 3; y > 1; y--) {
    const below = getBlock(x, y - 1, z);
    if (below !== AIR && !BLOCKS[below].liquid && !BLOCKS[below].noCollide &&
        getBlock(x, y, z) === AIR && getBlock(x, y + 1, z) === AIR) {
      return y;
    }
  }
  return WATER_LEVEL + 3;
}
