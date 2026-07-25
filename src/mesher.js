// =====================================================================
// mesher.js — mengubah data voxel sebuah chunk menjadi BufferGeometry.
// Hanya sisi blok yang terlihat yang dibuat (face culling), dan tiap
// vertex diberi warna berdasarkan arah muka + paparan langit sehingga
// gua terasa gelap tanpa perlu sistem lighting penuh.
// =====================================================================
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, AIR, BLOCKS, isTransparent, isLiquid } from './config.js';
import { getBlock, surfaceHeight } from './world.js';
import { tileUV } from './atlas.js';

// corner: [x, y, z, u, v]
const FACES = [
  { dir: [-1, 0, 0], shade: 0.72, corners: [[0,1,0,0,1],[0,0,0,0,0],[0,1,1,1,1],[0,0,1,1,0]] },
  { dir: [ 1, 0, 0], shade: 0.72, corners: [[1,1,1,0,1],[1,0,1,0,0],[1,1,0,1,1],[1,0,0,1,0]] },
  { dir: [0, -1, 0], shade: 0.52, corners: [[1,0,1,1,0],[0,0,1,0,0],[1,0,0,1,1],[0,0,0,0,1]] },
  { dir: [0,  1, 0], shade: 1.00, corners: [[0,1,1,1,1],[1,1,1,0,1],[0,1,0,1,0],[1,1,0,0,0]] },
  { dir: [0, 0, -1], shade: 0.86, corners: [[1,0,0,0,0],[0,0,0,1,0],[1,1,0,0,1],[0,1,0,1,1]] },
  { dir: [0, 0,  1], shade: 0.86, corners: [[0,0,1,0,0],[1,0,1,1,0],[0,1,1,0,1],[1,1,1,1,1]] },
];

function tileFor(id, dir) {
  const t = BLOCKS[id].tiles;
  if (dir[1] ===  1) return t[0];
  if (dir[1] === -1) return t[1];
  return t[2];
}

function emptyBuffers() {
  return { pos: [], nor: [], uv: [], col: [], idx: [] };
}

function toGeometry(b) {
  if (!b.pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(b.nor, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(b.uv, 2));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(b.col, 3));
  geo.setIndex(b.idx);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Bangun geometri sebuah chunk.
 * @returns {{ opaque: THREE.BufferGeometry|null, water: THREE.BufferGeometry|null }}
 */
export function buildChunkGeometry(chunk) {
  const solidBuf = emptyBuffers();
  const waterBuf = emptyBuffers();
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = baseX + lx, wz = baseZ + lz;
      const surface = chunk.heights[lz * CHUNK_SIZE + lx];

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const id = chunk.get(lx, y, lz);
        if (id === AIR) continue;

        const liquid = isLiquid(id);
        const buf = liquid ? waterBuf : solidBuf;
        const emissive = (BLOCKS[id].light || 0) > 0;

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          const nx = lx + dx, ny = y + dy, nz = lz + dz;

          // ambil tetangga: dalam chunk jika memungkinkan, kalau tidak lewat world
          let neighbor;
          if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
            neighbor = chunk.get(nx, ny, nz);
          } else {
            neighbor = getBlock(wx + dx, y + dy, wz + dz);
          }

          if (liquid) {
            // air hanya digambar bila bersentuhan dengan udara
            if (neighbor !== AIR) continue;
          } else {
            if (neighbor !== AIR && !BLOCKS[neighbor].transparent) continue;
            if (neighbor === id) continue;   // kaca/es berdampingan tidak digambar
          }

          // paparan langit: blok di atas permukaan kolom = terang penuh
          let sky = y >= surface ? 1 : 0.42 + Math.max(0, 1 - (surface - y) / 16) * 0.3;
          if (emissive) sky = 1.15;
          const shade = face.shade * sky;

          const tile = tileFor(id, face.dir);
          const base = buf.pos.length / 3;

          for (const [cx, cy, cz, u, v] of face.corners) {
            buf.pos.push(wx + cx, y + cy - (liquid ? 0.12 : 0), wz + cz);
            buf.nor.push(dx, dy, dz);
            const [uu, vv] = tileUV(tile, u, v);
            buf.uv.push(uu, vv);
            buf.col.push(shade, shade, shade);
          }
          buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }
  }

  return { opaque: toGeometry(solidBuf), water: toGeometry(waterBuf) };
}
