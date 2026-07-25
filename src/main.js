import * as THREE from 'three';

/* =========================================================
   BLOCKCRAFT — Minecraft clone berbasis web
   Voxel engine sederhana: chunk mesh, terrain generator,
   break/place block, physics + collision, pointer lock.
   ========================================================= */

// ---------- konfigurasi dunia ----------
const CHUNK_SIZE   = 16;
const WORLD_CHUNKS = 6;                            // 6x6 chunk
const WORLD_SIZE   = CHUNK_SIZE * WORLD_CHUNKS;    // 96 x 96 blok
const WATER_LEVEL  = 6;
const SEED         = 20260726;
const REACH        = 6;                            // jangkauan tangan (blok)

// ---------- definisi blok: [top, bottom, side] ----------
const BLOCKS = {
  1: { name: 'Grass',  tiles: [0, 1, 2] },
  2: { name: 'Dirt',   tiles: [1, 1, 1] },
  3: { name: 'Stone',  tiles: [3, 3, 3] },
  4: { name: 'Sand',   tiles: [4, 4, 4] },
  5: { name: 'Log',    tiles: [9, 9, 5] },
  6: { name: 'Leaves', tiles: [6, 6, 6] },
  7: { name: 'Planks', tiles: [7, 7, 7] },
  8: { name: 'Brick',  tiles: [8, 8, 8] },
};
const HOTBAR = [1, 2, 3, 4, 5, 6, 7, 8];

// =========================================================
// 1. TEXTURE ATLAS (digambar prosedural, tanpa file gambar)
// =========================================================
const ATLAS_COLS = 4;
const TILE_PX    = 64;

function paintTile(g, index, base, speckle, extra) {
  const ox = (index % ATLAS_COLS) * TILE_PX;
  const oy = Math.floor(index / ATLAS_COLS) * TILE_PX;
  g.fillStyle = base;
  g.fillRect(ox, oy, TILE_PX, TILE_PX);
  g.fillStyle = speckle;
  for (let i = 0; i < 500; i++) {
    const x = ox + Math.floor(Math.random() * TILE_PX);
    const y = oy + Math.floor(Math.random() * TILE_PX);
    const s = 1 + Math.floor(Math.random() * 3);
    g.globalAlpha = 0.12 + Math.random() * 0.32;
    g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1;
  if (extra) extra(g, ox, oy);
}

function buildAtlasCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = ATLAS_COLS * TILE_PX;
  const g = c.getContext('2d');

  paintTile(g, 0, '#5fa03a', '#3f7a24');                       // 0 grass top
  paintTile(g, 1, '#8b6239', '#6d4a2a');                       // 1 dirt
  paintTile(g, 2, '#8b6239', '#6d4a2a', (g, x, y) => {         // 2 grass side
    g.fillStyle = '#5fa03a';
    g.fillRect(x, y, TILE_PX, 15);
    g.fillStyle = '#4c8b2e';
    for (let i = 0; i < 70; i++) {
      g.fillRect(x + Math.random() * TILE_PX, y + 11 + Math.random() * 9, 2, 5);
    }
  });
  paintTile(g, 3, '#8a8a8a', '#6c6c6c');                       // 3 stone
  paintTile(g, 4, '#ddcb8f', '#c2ad6d');                       // 4 sand
  paintTile(g, 5, '#6b4a2a', '#4f3620', (g, x, y) => {         // 5 log side
    g.strokeStyle = 'rgba(58,38,20,.7)'; g.lineWidth = 3;
    for (let i = 9; i < TILE_PX; i += 15) {
      g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i, y + TILE_PX); g.stroke();
    }
  });
  paintTile(g, 6, '#3f8f31', '#2b6a21', (g, x, y) => {         // 6 leaves
    g.fillStyle = 'rgba(18,58,14,.55)';
    for (let i = 0; i < 45; i++) {
      g.fillRect(x + Math.random() * TILE_PX, y + Math.random() * TILE_PX, 5, 5);
    }
  });
  paintTile(g, 7, '#b58a4e', '#96703c', (g, x, y) => {         // 7 planks
    g.strokeStyle = 'rgba(88,62,30,.8)'; g.lineWidth = 3;
    for (let i = 16; i < TILE_PX; i += 16) {
      g.beginPath(); g.moveTo(x, y + i); g.lineTo(x + TILE_PX, y + i); g.stroke();
    }
  });
  paintTile(g, 8, '#9c4b3c', '#7d3a2d', (g, x, y) => {         // 8 brick
    g.strokeStyle = '#d9cfc6'; g.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      const yy = y + r * 16;
      g.beginPath(); g.moveTo(x, yy); g.lineTo(x + TILE_PX, yy); g.stroke();
      const off = r % 2 ? 0 : 32;
      g.beginPath(); g.moveTo(x + off, yy); g.lineTo(x + off, yy + 16); g.stroke();
    }
  });
  paintTile(g, 9, '#a9793f', '#8a6132', (g, x, y) => {         // 9 log top
    g.strokeStyle = 'rgba(88,62,30,.7)'; g.lineWidth = 2;
    for (let r = 6; r < 32; r += 6) {
      g.beginPath(); g.arc(x + 32, y + 32, r, 0, Math.PI * 2); g.stroke();
    }
  });

  return c;
}

const atlasCanvas  = buildAtlasCanvas();
const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.magFilter  = THREE.NearestFilter;
atlasTexture.minFilter  = THREE.NearestFilter;
atlasTexture.colorSpace = THREE.SRGBColorSpace;

// =========================================================
// 2. NOISE & TERRAIN GENERATOR
// =========================================================
function hash2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed),     b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, y, seed) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    sum  += valueNoise(x * freq, y * freq, seed + o * 17) * amp;
    norm += amp;
    amp  *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function heightAt(x, z) {
  const base  = fbm(x / 42, z / 42, SEED) * 16;
  const hills = fbm(x / 14, z / 14, SEED + 99) * 5;
  return Math.floor(4 + base + hills);
}

// =========================================================
// 3. PENYIMPANAN DUNIA
// =========================================================
const world  = new Map();   // "x,y,z" -> blockId
const chunks = new Map();   // "cx,cz" -> { blocks:Map, mesh }
let   edits  = {};          // perubahan pemain (disimpan ke localStorage)

const key  = (x, y, z) => x + ',' + y + ',' + z;
const ckey = (cx, cz)  => cx + ',' + cz;

function getBlock(x, y, z) {
  return world.get(key(x, y, z)) || 0;
}

function chunkOf(x, z) {
  return ckey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
}

function rawSet(x, y, z, id) {
  const k  = key(x, y, z);
  const ck = chunkOf(x, z);
  if (!chunks.has(ck)) chunks.set(ck, { blocks: new Map(), mesh: null });
  const chunk = chunks.get(ck);
  if (id === 0) {
    world.delete(k);
    chunk.blocks.delete(k);
  } else {
    world.set(k, id);
    chunk.blocks.set(k, id);
  }
}

function plantTree(x, y, z) {
  const trunk = 4 + Math.floor(hash2(x, z, SEED + 3) * 3);
  for (let i = 0; i < trunk; i++) rawSet(x, y + i, z, 5);
  const top = y + trunk;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -2; dy <= 1; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) continue;
        const bx = x + dx, by = top + dy, bz = z + dz;
        if (bx < 0 || bz < 0 || bx >= WORLD_SIZE || bz >= WORLD_SIZE) continue;
        if (getBlock(bx, by, bz) === 0) rawSet(bx, by, bz, 6);
      }
    }
  }
}

function generateWorld() {
  world.clear();
  chunks.clear();

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = heightAt(x, z);
      for (let y = Math.max(0, h - 5); y <= h; y++) {
        let id;
        if (y === h)         id = h <= WATER_LEVEL + 1 ? 4 : 1;   // pantai berpasir
        else if (y >= h - 2) id = h <= WATER_LEVEL + 1 ? 4 : 2;
        else                 id = 3;
        rawSet(x, y, z, id);
      }
      rawSet(x, 0, z, 3);   // lantai dasar

      if (h > WATER_LEVEL + 2 && hash2(x, z, SEED + 7) > 0.992) {
        plantTree(x, h + 1, z);
      }
    }
  }

  // terapkan kembali perubahan pemain yang tersimpan
  for (const k in edits) {
    const [x, y, z] = k.split(',').map(Number);
    rawSet(x, y, z, edits[k]);
  }
}

// =========================================================
// 4. MEMBANGUN MESH CHUNK
// =========================================================
// corner: [x, y, z, u, v]
const FACES = [
  { dir: [-1, 0, 0], corners: [[0,1,0,0,1],[0,0,0,0,0],[0,1,1,1,1],[0,0,1,1,0]] },
  { dir: [ 1, 0, 0], corners: [[1,1,1,0,1],[1,0,1,0,0],[1,1,0,1,1],[1,0,0,1,0]] },
  { dir: [0, -1, 0], corners: [[1,0,1,1,0],[0,0,1,0,0],[1,0,0,1,1],[0,0,0,0,1]] },
  { dir: [0,  1, 0], corners: [[0,1,1,1,1],[1,1,1,0,1],[0,1,0,1,0],[1,1,0,0,0]] },
  { dir: [0, 0, -1], corners: [[1,0,0,0,0],[0,0,0,1,0],[1,1,0,0,1],[0,1,0,1,1]] },
  { dir: [0, 0,  1], corners: [[0,0,1,0,0],[1,0,1,1,0],[0,1,1,0,1],[1,1,1,1,1]] },
];

function tileFor(id, dir) {
  const t = BLOCKS[id].tiles;
  if (dir[1] ===  1) return t[0];
  if (dir[1] === -1) return t[1];
  return t[2];
}

function buildChunkMesh(ck) {
  const chunk = chunks.get(ck);
  if (!chunk) return;
  if (chunk.mesh) {
    scene.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    chunk.mesh = null;
  }

  const positions = [], normals = [], uvs = [], indices = [];

  for (const [k, id] of chunk.blocks) {
    const [x, y, z] = k.split(',').map(Number);
    for (const face of FACES) {
      const [dx, dy, dz] = face.dir;
      if (getBlock(x + dx, y + dy, z + dz) !== 0) continue;   // sisi tertutup, skip

      const tile = tileFor(id, face.dir);
      const col  = tile % ATLAS_COLS;
      const row  = Math.floor(tile / ATLAS_COLS);
      const base = positions.length / 3;

      for (const [cx, cy, cz, ux, uy] of face.corners) {
        positions.push(x + cx, y + cy, z + cz);
        normals.push(dx, dy, dz);
        uvs.push((col + ux) / ATLAS_COLS, (ATLAS_COLS - row - 1 + uy) / ATLAS_COLS);
      }
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }

  if (!positions.length) return;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(geo, blockMaterial);
  chunk.mesh = mesh;
  scene.add(mesh);
}

function rebuildAll() {
  for (const ck of chunks.keys()) buildChunkMesh(ck);
}

function setBlock(x, y, z, id) {
  if (x < 0 || z < 0 || y < 1 || x >= WORLD_SIZE || z >= WORLD_SIZE) return;
  rawSet(x, y, z, id);
  edits[key(x, y, z)] = id;
  saveEdits();

  const dirty = new Set([
    chunkOf(x, z),
    chunkOf(x - 1, z), chunkOf(x + 1, z),
    chunkOf(x, z - 1), chunkOf(x, z + 1),
  ]);
  for (const ck of dirty) if (chunks.has(ck)) buildChunkMesh(ck);
}

// =========================================================
// 5. SIMPAN / MUAT
// =========================================================
const SAVE_KEY = 'blockcraft:edits';

function loadEdits() {
  try { edits = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); }
  catch (e) { edits = {}; }
}
function saveEdits() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(edits)); } catch (e) {}
}

// =========================================================
// 6. SETUP THREE.JS
// =========================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc6ee);
scene.fog = new THREE.Fog(0x8fc6ee, 40, 115);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 400);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const blockMaterial = new THREE.MeshLambertMaterial({ map: atlasTexture });

scene.add(new THREE.AmbientLight(0xffffff, 0.68));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(60, 100, 30);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x5c4a34, 0.35));

// air
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3),
  new THREE.MeshLambertMaterial({ color: 0x3b7bd4, transparent: true, opacity: 0.62 })
);
water.rotation.x = -Math.PI / 2;
water.position.set(WORLD_SIZE / 2, WATER_LEVEL + 0.85, WORLD_SIZE / 2);
scene.add(water);

// kotak sorot blok yang dibidik
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000 })
);
highlight.visible = false;
scene.add(highlight);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// =========================================================
// 7. PEMAIN & KONTROL
// =========================================================
const player = {
  pos: new THREE.Vector3(WORLD_SIZE / 2, 30, WORLD_SIZE / 2),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: false,
  fly: false,
  width: 0.3,
  height: 1.8,
  eye: 1.62,
};

const keys = {};
let selected = 0;
let locked = false;

const overlay = document.getElementById('overlay');
const loading = document.getElementById('loading');

document.getElementById('play').addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle('hidden', locked);
});

document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  player.yaw   -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  const lim = Math.PI / 2 - 0.001;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});

addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'KeyF') {
    player.fly = !player.fly;
    player.vel.set(0, 0, 0);
    document.getElementById('mode').textContent = player.fly ? 'Fly' : 'Survival';
  }

  if (e.code === 'KeyR' && confirm('Reset dunia dan hapus semua perubahan?')) {
    edits = {}; saveEdits();
    generateWorld(); rebuildAll();
    spawnPlayer();
  }

  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= HOTBAR.length) selectSlot(n - 1);
});

addEventListener('keyup', (e) => { keys[e.code] = false; });

addEventListener('wheel', (e) => {
  if (!locked) return;
  selectSlot((selected + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length);
}, { passive: true });

addEventListener('mousedown', (e) => {
  if (!locked) return;
  const hit = raycastVoxel();
  if (!hit) return;

  if (e.button === 0) {
    if (hit.y > 0) setBlock(hit.x, hit.y, hit.z, 0);                 // hancurkan
  } else if (e.button === 2) {
    const nx = hit.x + hit.nx, ny = hit.y + hit.ny, nz = hit.z + hit.nz;
    if (!overlapsPlayer(nx, ny, nz)) setBlock(nx, ny, nz, HOTBAR[selected]);
  }
});

addEventListener('contextmenu', (e) => e.preventDefault());

// =========================================================
// 8. RAYCAST VOXEL (algoritma Amanatides & Woo)
// =========================================================
function raycastVoxel() {
  const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'))
    .normalize();

  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const tdX = Math.abs(1 / dir.x), tdY = Math.abs(1 / dir.y), tdZ = Math.abs(1 / dir.z);
  let tMaxX = (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tdX;
  let tMaxY = (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tdY;
  let tMaxZ = (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tdZ;
  let nx = 0, ny = 0, nz = 0, t = 0;

  while (t <= REACH) {
    if (getBlock(x, y, z) !== 0) return { x, y, z, nx, ny, nz };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tdX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tdY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tdZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

// =========================================================
// 9. FISIKA & TABRAKAN (AABB per sumbu)
// =========================================================
function collides(p) {
  const minX = Math.floor(p.x - player.width), maxX = Math.floor(p.x + player.width);
  const minY = Math.floor(p.y),                maxY = Math.floor(p.y + player.height);
  const minZ = Math.floor(p.z - player.width), maxZ = Math.floor(p.z + player.width);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        if (getBlock(x, y, z) !== 0) return true;
  return false;
}

function overlapsPlayer(x, y, z) {
  const p = player.pos;
  return (
    x + 1 > p.x - player.width && x < p.x + player.width &&
    z + 1 > p.z - player.width && z < p.z + player.width &&
    y + 1 > p.y && y < p.y + player.height
  );
}

function tryMove(dx, dy, dz) {
  const p = player.pos;

  p.x += dx; if (collides(p)) p.x -= dx;
  p.z += dz; if (collides(p)) p.z -= dz;

  p.y += dy;
  if (collides(p)) {
    p.y -= dy;
    if (dy < 0) player.onGround = true;
    player.vel.y = 0;
  }
}

function updatePlayer(dt) {
  const speed   = player.fly ? 14 : (keys['ShiftLeft'] ? 8.4 : 5.2);
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right   = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

  const wish = new THREE.Vector3();
  if (keys['KeyW']) wish.add(forward);
  if (keys['KeyS']) wish.sub(forward);
  if (keys['KeyD']) wish.add(right);
  if (keys['KeyA']) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

  if (player.fly) {
    let vy = 0;
    if (keys['Space'])     vy += speed;
    if (keys['ShiftLeft']) vy -= speed;
    tryMove(wish.x * dt, vy * dt, wish.z * dt);
    return;
  }

  player.vel.y = Math.max(player.vel.y - 26 * dt, -48);   // gravitasi
  if (keys['Space'] && player.onGround) {
    player.vel.y = 8.6;
    player.onGround = false;
  }

  player.onGround = false;
  tryMove(wish.x * dt, player.vel.y * dt, wish.z * dt);

  if (player.pos.y < -20) spawnPlayer();                  // jatuh keluar dunia
}

function spawnPlayer() {
  const sx = Math.floor(WORLD_SIZE / 2), sz = Math.floor(WORLD_SIZE / 2);
  let sy = 45;
  while (sy > 1 && getBlock(sx, sy - 1, sz) === 0) sy--;
  player.pos.set(sx + 0.5, sy + 1, sz + 0.5);
  player.vel.set(0, 0, 0);
}

// =========================================================
// 10. UI HOTBAR
// =========================================================
function drawSlotIcon(blockId) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_PX;
  const g = c.getContext('2d');
  const tile = BLOCKS[blockId].tiles[2];
  const sx = (tile % ATLAS_COLS) * TILE_PX;
  const sy = Math.floor(tile / ATLAS_COLS) * TILE_PX;
  g.drawImage(atlasCanvas, sx, sy, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
  return c;
}

function buildHotbar() {
  const bar = document.getElementById('hotbar');
  bar.innerHTML = '';
  HOTBAR.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selected ? ' active' : '');
    slot.title = BLOCKS[id].name;
    slot.appendChild(drawSlotIcon(id));
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = i + 1;
    slot.appendChild(num);
    slot.addEventListener('click', () => selectSlot(i));
    bar.appendChild(slot);
  });
}

function selectSlot(i) {
  selected = i;
  document.querySelectorAll('.slot').forEach((s, idx) => {
    s.classList.toggle('active', idx === i);
  });
}

// =========================================================
// 11. LOOP UTAMA
// =========================================================
const fpsEl    = document.getElementById('fps');
const coordsEl = document.getElementById('coords');
let last = performance.now();
let frames = 0, fpsTimer = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (locked) updatePlayer(dt);

  camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

  const hit = raycastVoxel();
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  water.material.opacity = 0.55 + Math.sin(now / 900) * 0.06;

  frames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = Math.round(frames / fpsTimer);
    coordsEl.textContent =
      player.pos.x.toFixed(1) + ' / ' + player.pos.y.toFixed(1) + ' / ' + player.pos.z.toFixed(1);
    frames = 0; fpsTimer = 0;
  }

  renderer.render(scene, camera);
}

// =========================================================
// 12. START
// =========================================================
function start() {
  loadEdits();
  generateWorld();
  rebuildAll();
  buildHotbar();
  spawnPlayer();

  loading.classList.add('hidden');
  requestAnimationFrame(animate);
}

setTimeout(start, 30);
