// =====================================================================
// main.js — penyatu seluruh sistem: render, chunk streaming,
// siklus siang-malam, input (keyboard/mouse + sentuh), menambang,
// memasang blok, interaksi, dan game loop.
// =====================================================================
import * as THREE from 'three';
import {
  CHUNK_SIZE, CHUNK_HEIGHT, REACH, DAY_LENGTH,
  AIR, BLOCKS, ITEMS, isSolid,
} from './config.js';
import { atlasTexture } from './atlas.js';
import {
  chunks, ensureChunk, getChunk, getBlock, setBlock, chunkCoords,
  loadWorldSave, resetWorld, safeSpawn, biomeAt,
} from './world.js';
import { buildChunkGeometry } from './mesher.js';
import {
  player, updatePlayer, addItem, heldItem, heldTool, heldDamage,
  consumeHeld, eatHeld, respawn, savePlayer, loadPlayer,
  resetPlayer, setPlayerEventHandler, boxOverlapsPlayer, HOTBAR_SIZE,
} from './player.js';
import { initMobs, updateMobs, pickMob, hitMob, clearMobs } from './mobs.js';
import { createFurnace, tickFurnace } from './crafting.js';
import { initAudio, resumeAudio, SFX, toggleMute } from './audio.js';
import {
  initUI, updateHUD, refreshHotbar, toast, openInventory, openFurnace,
  closeScreen, screenOpen, touchState, settings,
  isTouchDevice, showDeath, tickOpenFurnace,
} from './ui.js';

// =====================================================================
// Renderer & scene
// =====================================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 600);

const renderer = new THREE.WebGLRenderer({ antialias: !isTouchDevice, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.id = 'game';
document.body.appendChild(renderer.domElement);

const SKY_DAY   = new THREE.Color(0x8fc6ee);
const SKY_NIGHT = new THREE.Color(0x070b1c);
const SKY_DUSK  = new THREE.Color(0xf0885a);
const skyColor = new THREE.Color();
scene.background = skyColor;
scene.fog = new THREE.Fog(0x8fc6ee, 30, 190);

const ambient  = new THREE.AmbientLight(0xffffff, 0.62);
const hemi     = new THREE.HemisphereLight(0xbfe3ff, 0x4a3a28, 0.35);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.85);
scene.add(ambient, hemi, sunLight, sunLight.target);

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(9, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
);
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(6, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xdfe7ff, fog: false })
);
scene.add(sunMesh, moonMesh);

// bintang malam
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 700; i++) {
  const v = new THREE.Vector3().randomDirection().multiplyScalar(320);
  if (v.y < 0) v.y = -v.y;
  starPos.push(v.x, v.y, v.z);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false })
);
scene.add(stars);

const solidMaterial = new THREE.MeshLambertMaterial({
  map: atlasTexture, vertexColors: true, alphaTest: 0.5,
});
const waterMaterial = new THREE.MeshLambertMaterial({
  map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false,
});

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 })
);
highlight.visible = false;
scene.add(highlight);

// kotak progres menambang
const crackMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.02, 1.02, 1.02),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
);
crackMesh.visible = false;
scene.add(crackMesh);

// lampu obor (pool terbatas)
const torchLights = [];
for (let i = 0; i < 6; i++) {
  const l = new THREE.PointLight(0xffb14d, 0, 13);
  scene.add(l);
  torchLights.push(l);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// =====================================================================
// Chunk streaming
// =====================================================================
function disposeChunkMeshes(chunk) {
  for (const key of ['mesh', 'waterMesh']) {
    const m = chunk[key];
    if (m) { scene.remove(m); m.geometry.dispose(); chunk[key] = null; }
  }
}

function buildChunk(chunk) {
  disposeChunkMeshes(chunk);
  const { opaque, water } = buildChunkGeometry(chunk);
  if (opaque) { chunk.mesh = new THREE.Mesh(opaque, solidMaterial); scene.add(chunk.mesh); }
  if (water)  { chunk.waterMesh = new THREE.Mesh(water, waterMaterial); scene.add(chunk.waterMesh); }
  chunk.dirty = false;
}

function streamChunks() {
  const R = settings.renderDistance;
  const [pcx, pcz] = chunkCoords(player.pos.x, player.pos.z);

  const targets = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > R + 0.5) continue;
      targets.push([pcx + dx, pcz + dz, d]);
    }
  }
  targets.sort((a, b) => a[2] - b[2]);

  let generated = 0, meshed = 0;
  for (const t of targets) {
    const cx = t[0], cz = t[1];
    let chunk = getChunk(cx, cz);
    if (!chunk) {
      if (generated >= 1) continue;
      chunk = ensureChunk(cx, cz);
      generated++;
      for (const off of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = getChunk(cx + off[0], cz + off[1]);
        if (n) n.dirty = true;
      }
    }
    if (chunk.dirty && meshed < 2) { buildChunk(chunk); meshed++; }
  }

  for (const [key, chunk] of chunks) {
    if (Math.hypot(chunk.cx - pcx, chunk.cz - pcz) > R + 2.5) {
      disposeChunkMeshes(chunk);
      chunks.delete(key);
    }
  }
}

function markAreaDirty(x, z) {
  const [cx, cz] = chunkCoords(x, z);
  for (const off of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = getChunk(cx + off[0], cz + off[1]);
    if (c) c.dirty = true;
  }
}

function flushDirtyNear() {
  const [pcx, pcz] = chunkCoords(player.pos.x, player.pos.z);
  for (const chunk of chunks.values()) {
    if (chunk.dirty && Math.hypot(chunk.cx - pcx, chunk.cz - pcz) <= 2) buildChunk(chunk);
  }
}

// =====================================================================
// Raycast voxel (Amanatides & Woo)
// =====================================================================
const tmpOrigin = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function viewRay() {
  tmpOrigin.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  tmpEuler.set(player.pitch, player.yaw, 0, 'YXZ');
  tmpDir.set(0, 0, -1).applyEuler(tmpEuler).normalize();
  return [tmpOrigin, tmpDir];
}

function raycastVoxel(maxDist) {
  const limit = maxDist || REACH;
  const ray = viewRay();
  const origin = ray[0], dir = ray[1];
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tdX = Math.abs(1 / dir.x), tdY = Math.abs(1 / dir.y), tdZ = Math.abs(1 / dir.z);
  let tMaxX = (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tdX;
  let tMaxY = (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tdY;
  let tMaxZ = (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tdZ;
  let nx = 0, ny = 0, nz = 0, t = 0;

  while (t <= limit) {
    const id = getBlock(x, y, z);
    if (id !== AIR && !BLOCKS[id].liquid) return { x: x, y: y, z: z, nx: nx, ny: ny, nz: nz, id: id };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tdX; nx = -stepX; ny = 0; nz = 0; }
    else if (tMaxY < tMaxZ)             { y += stepY; t = tMaxY; tMaxY += tdY; nx = 0; ny = -stepY; nz = 0; }
    else                                { z += stepZ; t = tMaxZ; tMaxZ += tdZ; nx = 0; ny = 0; nz = -stepZ; }
  }
  return null;
}

// =====================================================================
// Menambang, memasang, interaksi
// =====================================================================
const furnaces = new Map();
let openFurnaceKey = null;

let mineTarget = null;
let mineProgress = 0;
let mineTotal = 0;
let digSoundAccum = 0;

function breakTime(blockId) {
  const b = BLOCKS[blockId];
  if (!b || b.hardness < 0) return Infinity;
  const tool = heldTool();
  let time = b.hardness * 1.5;
  if (tool && b.tool === tool.kind) time /= tool.speed;
  else time *= 1.6;
  if ((b.level || 0) > (tool ? tool.level : 0)) time *= 3;
  return Math.max(0.08, time);
}

function canHarvest(blockId) {
  const b = BLOCKS[blockId];
  const need = b.level || 0;
  if (!need) return true;
  const tool = heldTool();
  return !!tool && tool.kind === b.tool && tool.level >= need;
}

function breakBlock(x, y, z) {
  const id = getBlock(x, y, z);
  if (id === AIR || BLOCKS[id].hardness < 0) return;

  setBlock(x, y, z, AIR);
  markAreaDirty(x, z);
  SFX.break_();

  if (BLOCKS[id].interact === 'furnace') furnaces.delete(x + ',' + y + ',' + z);

  if (canHarvest(id)) {
    const dropId = 'drop' in BLOCKS[id] ? BLOCKS[id].drop : BLOCKS[id].item;
    if (dropId) { addItem(dropId, 1); SFX.pop(); }
    if (id === 6 && Math.random() < 0.07) addItem('apple', 1);   // daun → apel
  }

  // pasir & kerikil di atasnya ikut jatuh
  let above = y + 1;
  for (let guard = 0; guard < 24; guard++) {
    const fid = getBlock(x, above, z);
    if (!fid || !BLOCKS[fid] || !BLOCKS[fid].gravity) break;
    setBlock(x, above, z, AIR);
    setBlock(x, above - 1, z, fid);
    above++;
  }

  refreshHotbar();
  flushDirtyNear();
}

function placeBlock(hit) {
  const stack = heldItem();
  if (!stack) return;
  const item = ITEMS[stack.id];
  if (!item || !item.place) return;

  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (y < 1 || y >= CHUNK_HEIGHT) return;
  const existing = getBlock(x, y, z);
  if (existing !== AIR && !BLOCKS[existing].liquid) return;
  if (!BLOCKS[item.place].noCollide && boxOverlapsPlayer(x, y, z)) return;

  setBlock(x, y, z, item.place);
  markAreaDirty(x, z);
  consumeHeld(1);
  SFX.place();
  refreshHotbar();
  flushDirtyNear();
}

function interactBlock(hit) {
  const b = BLOCKS[hit.id];
  if (!b || !b.interact) return false;

  if (b.interact === 'crafting') { openInventory(3); SFX.click(); return true; }

  if (b.interact === 'furnace') {
    const key = hit.x + ',' + hit.y + ',' + hit.z;
    if (!furnaces.has(key)) furnaces.set(key, createFurnace());
    openFurnaceKey = key;
    openFurnace(furnaces.get(key));
    SFX.click();
    return true;
  }
  return false;
}

function attack() {
  const ray = viewRay();
  const mob = pickMob(ray[0], ray[1], 4);
  if (!mob) return false;
  hitMob(mob, heldDamage(), ray[1]);
  return true;
}

function primaryAction(dt) {
  const hit = raycastVoxel();
  if (!hit) { mineTarget = null; mineProgress = 0; crackMesh.visible = false; return; }

  if (!mineTarget || mineTarget.x !== hit.x || mineTarget.y !== hit.y || mineTarget.z !== hit.z) {
    mineTarget = { x: hit.x, y: hit.y, z: hit.z };
    mineProgress = 0;
    mineTotal = breakTime(hit.id);
  }
  if (mineTotal === Infinity) return;

  mineProgress += dt;
  digSoundAccum += dt;
  if (digSoundAccum > 0.22) { digSoundAccum = 0; SFX.dig(); }

  crackMesh.visible = true;
  crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  crackMesh.material.opacity = Math.min(0.55, (mineProgress / mineTotal) * 0.55);

  if (mineProgress >= mineTotal) {
    breakBlock(hit.x, hit.y, hit.z);
    mineTarget = null;
    mineProgress = 0;
    crackMesh.visible = false;
  }
}

function secondaryAction() {
  const stack = heldItem();
  if (stack && ITEMS[stack.id] && ITEMS[stack.id].food) {
    if (eatHeld()) { refreshHotbar(); return; }
  }
  const hit = raycastVoxel();
  if (!hit) return;
  if (interactBlock(hit)) return;
  placeBlock(hit);
}

// =====================================================================
// Input
// =====================================================================
const keys = {};
let locked = false;
let mouseDown = false;

const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('play');

function startGame() {
  initAudio();
  resumeAudio();
  overlay.classList.add('hidden');
  if (isTouchDevice) locked = true;
  else renderer.domElement.requestPointerLock();
}

playBtn.addEventListener('click', startGame);

document.addEventListener('pointerlockchange', () => {
  if (isTouchDevice) return;
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && !screenOpen()) overlay.classList.remove('hidden');
  else overlay.classList.add('hidden');
});

document.addEventListener('mousemove', (e) => {
  if (!locked || screenOpen() || isTouchDevice) return;
  player.yaw   -= e.movementX * 0.0022 * settings.sensitivity;
  player.pitch -= e.movementY * 0.0022 * settings.sensitivity;
  const lim = Math.PI / 2 - 0.001;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!locked || screenOpen()) return;
  if (e.button === 0) { if (!attack()) mouseDown = true; }
  if (e.button === 2) secondaryAction();
});
addEventListener('mouseup', () => { mouseDown = false; mineTarget = null; crackMesh.visible = false; });
addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Escape') { if (screenOpen()) closeScreen(); return; }
  if (screenOpen()) return;

  if (e.code === 'KeyE') { openInventory(2); return; }
  if (e.code === 'KeyF') {
    player.fly = !player.fly;
    player.vel.set(0, 0, 0);
    toast(player.fly ? 'Mode terbang: ON' : 'Mode terbang: OFF');
  }
  if (e.code === 'KeyM') toast(toggleMute() ? 'Suara dimatikan' : 'Suara dinyalakan');

  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= HOTBAR_SIZE) { player.hotbar = n - 1; refreshHotbar(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

addEventListener('wheel', (e) => {
  if (!locked || screenOpen()) return;
  player.hotbar = (player.hotbar + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE;
  refreshHotbar();
}, { passive: true });

// ---- sentuh: geser untuk melihat, ketuk untuk memasang/menyerang ----
let lookPointer = null;
let lookMoved = 0;
let lookStart = 0;
let lastTouch = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || screenOpen()) return;
  lookPointer = e.pointerId;
  lookMoved = 0;
  lookStart = performance.now();
  lastTouch.x = e.clientX; lastTouch.y = e.clientY;
  overlay.classList.add('hidden');
  initAudio(); resumeAudio();
  locked = true;
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookPointer) return;
  const dx = e.clientX - lastTouch.x;
  const dy = e.clientY - lastTouch.y;
  lastTouch.x = e.clientX; lastTouch.y = e.clientY;
  lookMoved += Math.abs(dx) + Math.abs(dy);
  player.yaw   -= dx * 0.005 * settings.sensitivity;
  player.pitch -= dy * 0.005 * settings.sensitivity;
  const lim = Math.PI / 2 - 0.001;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});

function endLook(e) {
  if (e.pointerId !== lookPointer) return;
  const held = performance.now() - lookStart;
  if (lookMoved < 16 && held < 320 && !screenOpen() && player.alive) {
    if (!attack()) secondaryAction();
  }
  lookPointer = null;
}
renderer.domElement.addEventListener('pointerup', endLook);
renderer.domElement.addEventListener('pointercancel', endLook);

// =====================================================================
// Siklus siang & malam
// =====================================================================
let worldTime = DAY_LENGTH * 0.2;
let isNight = false;

function updateSky(dt) {
  worldTime = (worldTime + dt) % DAY_LENGTH;
  const angle = (worldTime / DAY_LENGTH) * Math.PI * 2;
  const sunY = Math.sin(angle);
  const sunX = Math.cos(angle);
  isNight = sunY < -0.05;

  const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
  sunMesh.position.set(px + sunX * 260, py + sunY * 260, pz);
  moonMesh.position.set(px - sunX * 260, py - sunY * 260, pz);
  stars.position.set(px, py, pz);

  sunLight.position.set(px + sunX * 100, py + Math.max(sunY, -0.2) * 100, pz + 40);
  sunLight.target.position.set(px, py, pz);

  const day  = Math.max(0, Math.min(1, sunY * 2 + 0.35));
  const dusk = Math.max(0, 1 - Math.abs(sunY) * 4.5);

  skyColor.copy(SKY_NIGHT).lerp(SKY_DAY, day);
  skyColor.lerp(SKY_DUSK, dusk * 0.45);
  scene.fog.color.copy(skyColor);

  sunLight.intensity = 0.15 + day * 0.75;
  ambient.intensity  = 0.18 + day * 0.48;
  hemi.intensity     = 0.10 + day * 0.30;
  stars.material.opacity = Math.max(0, 1 - day * 2.4);

  scene.fog.near = isTouchDevice ? 24 : 38;
  scene.fog.far  = Math.max(60, settings.renderDistance * CHUNK_SIZE * 0.95);
}

function clockLabel() {
  const total = (worldTime / DAY_LENGTH) * 24 + 6;
  const hours = Math.floor(total) % 24;
  const mins = Math.floor(((total % 1) * 60) / 10) * 10;
  return (isNight ? '🌙 ' : '☀ ') + String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

let torchScan = 0;
function updateTorchLights(dt) {
  torchScan -= dt;
  if (torchScan > 0) return;
  torchScan = 0.9;

  const found = [];
  const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
  for (let x = px - 9; x <= px + 9 && found.length < torchLights.length; x++) {
    for (let y = py - 7; y <= py + 7 && found.length < torchLights.length; y++) {
      for (let z = pz - 9; z <= pz + 9 && found.length < torchLights.length; z++) {
        if (getBlock(x, y, z) === 21) found.push([x, y, z]);
      }
    }
  }
  for (let i = 0; i < torchLights.length; i++) {
    if (i < found.length) {
      torchLights[i].position.set(found[i][0] + 0.5, found[i][1] + 0.6, found[i][2] + 0.5);
      torchLights[i].intensity = 1.1;
    } else {
      torchLights[i].intensity = 0;
    }
  }
}

// =====================================================================
// Game loop
// =====================================================================
const fps = { frames: 0, timer: 0, value: 0 };
let last = performance.now();
let deathShown = false;

function gatherInput() {
  const input = { forward: 0, right: 0, jump: false, sneak: false, sprint: false };
  if (screenOpen()) return input;

  if (keys['KeyW']) input.forward += 1;
  if (keys['KeyS']) input.forward -= 1;
  if (keys['KeyD']) input.right += 1;
  if (keys['KeyA']) input.right -= 1;
  if (keys['Space']) input.jump = true;
  if (keys['ShiftLeft']) input.sprint = true;
  if (keys['ControlLeft']) input.sneak = true;

  input.forward += touchState.moveY;
  input.right   += touchState.moveX;
  if (touchState.jump)  input.jump = true;
  if (touchState.sneak) input.sneak = true;
  if (Math.hypot(touchState.moveX, touchState.moveY) > 0.85) input.sprint = true;

  input.forward = Math.max(-1, Math.min(1, input.forward));
  input.right   = Math.max(-1, Math.min(1, input.right));
  player.sneaking = input.sneak && !player.fly;
  return input;
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  updateSky(dt);
  streamChunks();
  updateTorchLights(dt);

  if (locked && player.alive) {
    updatePlayer(dt, gatherInput());
    updateMobs(dt, isNight);
  }

  if ((mouseDown || touchState.mining) && !screenOpen() && player.alive) {
    primaryAction(dt);
  } else if (!touchState.mining && !mouseDown && crackMesh.visible) {
    crackMesh.visible = false;
    mineTarget = null;
  }

  if (touchState.placeQueued) {
    touchState.placeQueued = false;
    if (!screenOpen() && player.alive) secondaryAction();
  }

  for (const entry of furnaces) {
    if (entry[0] !== openFurnaceKey) tickFurnace(entry[1], dt);
  }
  tickOpenFurnace(dt);

  const bobbing = player.onGround && !player.fly;
  camera.position.set(
    player.pos.x + (bobbing ? Math.cos(player.bob * 0.5) * 0.03 : 0),
    player.pos.y + player.eye - (player.sneaking ? 0.25 : 0) + (bobbing ? Math.sin(player.bob) * 0.045 : 0),
    player.pos.z
  );
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

  const hit = screenOpen() ? null : raycastVoxel();
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  if (!player.alive && !deathShown) { deathShown = true; SFX.death(); showDeath(); }

  fps.frames++; fps.timer += dt;
  if (fps.timer >= 0.5) {
    fps.value = Math.round(fps.frames / fps.timer);
    fps.frames = 0; fps.timer = 0;
  }

  updateHUD({
    fps: fps.value,
    x: player.pos.x.toFixed(0),
    y: player.pos.y.toFixed(0),
    z: player.pos.z.toFixed(0),
    biome: biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z)).name,
    time: clockLabel(),
  });

  renderer.render(scene, camera);
}

// =====================================================================
// Bootstrap
// =====================================================================
function giveStarterKit() {
  addItem('wood_pickaxe', 1);
  addItem('wood_sword', 1);
  addItem('torch', 16);
  addItem('planks', 32);
  addItem('apple', 5);
}

function doReset() {
  for (const chunk of chunks.values()) disposeChunkMeshes(chunk);
  resetWorld();
  resetPlayer();
  clearMobs();
  furnaces.clear();
  openFurnaceKey = null;
  closeScreen();
  const [scx, scz] = chunkCoords(8, 8);
  ensureChunk(scx, scz);
  player.pos.set(8.5, safeSpawn(8, 8), 8.5);
  player.vel.set(0, 0, 0);
  deathShown = false;
  giveStarterKit();
  refreshHotbar();
  streamChunks();
  toast('Dunia baru dibuat');
}

function boot() {
  loadWorldSave();
  const hadSave = loadPlayer();

  initUI({
    onRespawn: () => { deathShown = false; respawn(); refreshHotbar(); },
    onReset: doReset,
    onToggleFly: () => {
      player.fly = !player.fly;
      player.vel.set(0, 0, 0);
      toast(player.fly ? 'Mode terbang: ON' : 'Mode terbang: OFF');
    },
    onToggleSound: () => toggleMute(),
    onRenderDistance: () => streamChunks(),
    onSfx: (name) => { if (SFX[name]) SFX[name](); },
    onScreenOpen: () => { if (document.pointerLockElement) document.exitPointerLock(); },
    onScreenClose: () => {
      openFurnaceKey = null;
      refreshHotbar();
      if (!isTouchDevice && locked) renderer.domElement.requestPointerLock();
    },
  });

  setPlayerEventHandler((event) => {
    if (event === 'step')   SFX.step();
    if (event === 'hurt')   SFX.hurt();
    if (event === 'eat')    SFX.eat();
    if (event === 'splash') SFX.splash();
  });

  initMobs(scene, (name) => { if (SFX[name]) SFX[name](); });

  const [scx, scz] = chunkCoords(player.pos.x, player.pos.z);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) ensureChunk(scx + dx, scz + dz);
  }

  if (!hadSave) {
    player.pos.set(8.5, safeSpawn(8, 8), 8.5);
    giveStarterKit();
  } else if (isSolid(getBlock(player.pos.x, player.pos.y, player.pos.z))) {
    player.pos.y = safeSpawn(Math.floor(player.pos.x), Math.floor(player.pos.z));
  }

  refreshHotbar();
  streamChunks();
  savePlayer();

  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');

  requestAnimationFrame(animate);
}

addEventListener('beforeunload', savePlayer);
boot();
