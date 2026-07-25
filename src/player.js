// =====================================================================
// player.js — fisika pemain, statistik (health/hunger/oksigen),
// dan inventory 36 slot.
// =====================================================================
import * as THREE from 'three';
import {
  GRAVITY, JUMP_SPEED, WALK_SPEED, SPRINT_SPEED, FLY_SPEED, SWIM_SPEED,
  MAX_HEALTH, MAX_HUNGER, AIR, BLOCKS, ITEMS, isSolid, isLiquid,
} from './config.js';
import { getBlock, safeSpawn } from './world.js';

export const HOTBAR_SIZE = 9;
export const INV_SIZE    = 36;   // 9 hotbar + 27 penyimpanan

export const player = {
  pos: new THREE.Vector3(8, 60, 8),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,

  width: 0.3,
  height: 1.8,
  eye: 1.62,

  onGround: false,
  inWater: false,
  headInWater: false,
  fly: false,
  sprinting: false,
  sneaking: false,

  health: MAX_HEALTH,
  hunger: MAX_HUNGER,
  saturation: 5,
  oxygen: 10,
  alive: true,

  hurtFlash: 0,
  invuln: 0,
  fallFrom: null,
  exhaustion: 0,
  bob: 0,

  inventory: new Array(INV_SIZE).fill(null),   // { id, count }
  hotbar: 0,
};

// callback yang diisi main.js: ('hurt' | 'eat' | 'step' | 'splash')
export let onEvent = () => {};
export function setPlayerEventHandler(fn) { onEvent = fn; }

// ---------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------
export function heldItem() {
  return player.inventory[player.hotbar];
}

export function heldTool() {
  const s = heldItem();
  return s && ITEMS[s.id] ? ITEMS[s.id].tool || null : null;
}

export function heldDamage() {
  const s = heldItem();
  return s && ITEMS[s.id] && ITEMS[s.id].damage ? ITEMS[s.id].damage : 1;
}

/** Menambah item ke inventory. Mengembalikan sisa yang tidak muat. */
export function addItem(id, count = 1) {
  if (!ITEMS[id]) return count;
  const max = ITEMS[id].stack || 64;

  // tumpuk ke slot yang sudah ada
  for (let i = 0; i < INV_SIZE && count > 0; i++) {
    const s = player.inventory[i];
    if (s && s.id === id && s.count < max) {
      const add = Math.min(max - s.count, count);
      s.count += add;
      count -= add;
    }
  }
  // isi slot kosong
  for (let i = 0; i < INV_SIZE && count > 0; i++) {
    if (!player.inventory[i]) {
      const add = Math.min(max, count);
      player.inventory[i] = { id, count: add };
      count -= add;
    }
  }
  savePlayer();
  return count;
}

export function countItem(id) {
  let n = 0;
  for (const s of player.inventory) if (s && s.id === id) n += s.count;
  return n;
}

export function removeItem(id, count = 1) {
  for (let i = 0; i < INV_SIZE && count > 0; i++) {
    const s = player.inventory[i];
    if (s && s.id === id) {
      const take = Math.min(s.count, count);
      s.count -= take;
      count -= take;
      if (s.count <= 0) player.inventory[i] = null;
    }
  }
  savePlayer();
  return count === 0;
}

export function consumeHeld(n = 1) {
  const s = heldItem();
  if (!s) return false;
  s.count -= n;
  if (s.count <= 0) player.inventory[player.hotbar] = null;
  savePlayer();
  return true;
}

export function eatHeld() {
  const s = heldItem();
  if (!s) return false;
  const food = ITEMS[s.id] && ITEMS[s.id].food;
  if (!food) return false;
  if (player.hunger >= MAX_HUNGER) return false;
  player.hunger = Math.min(MAX_HUNGER, player.hunger + food);
  player.saturation = Math.min(10, player.saturation + food * 0.5);
  consumeHeld(1);
  onEvent('eat');
  return true;
}

// ---------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------
export function damagePlayer(amount, ignoreInvuln = false) {
  if (!player.alive) return;
  if (player.invuln > 0 && !ignoreInvuln) return;
  player.health = Math.max(0, player.health - amount);
  player.invuln = 0.5;
  player.hurtFlash = 0.4;
  onEvent('hurt');
  if (player.health <= 0) {
    player.alive = false;
    onEvent('death');
  }
  savePlayer();
}

export function respawn() {
  const x = Math.round(player.pos.x);
  const z = Math.round(player.pos.z);
  const y = safeSpawn(x, z);
  player.pos.set(x + 0.5, y, z + 0.5);
  player.vel.set(0, 0, 0);
  player.health = MAX_HEALTH;
  player.hunger = MAX_HUNGER;
  player.saturation = 5;
  player.oxygen = 10;
  player.alive = true;
  player.fallFrom = null;
  savePlayer();
}

// ---------------------------------------------------------------------
// Tabrakan (AABB per sumbu)
// ---------------------------------------------------------------------
function collidesAt(px, py, pz) {
  const w = player.width;
  const minX = Math.floor(px - w), maxX = Math.floor(px + w);
  const minY = Math.floor(py),     maxY = Math.floor(py + player.height);
  const minZ = Math.floor(pz - w), maxZ = Math.floor(pz + w);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        if (isSolid(getBlock(x, y, z))) return true;
  return false;
}

export function boxOverlapsPlayer(x, y, z) {
  const p = player.pos, w = player.width;
  return (
    x + 1 > p.x - w && x < p.x + w &&
    z + 1 > p.z - w && z < p.z + w &&
    y + 1 > p.y && y < p.y + player.height
  );
}

function moveAxis(dx, dy, dz) {
  const p = player.pos;

  p.x += dx;
  if (collidesAt(p.x, p.y, p.z)) { p.x -= dx; player.vel.x = 0; }

  p.z += dz;
  if (collidesAt(p.x, p.y, p.z)) { p.z -= dz; player.vel.z = 0; }

  p.y += dy;
  if (collidesAt(p.x, p.y, p.z)) {
    p.y -= dy;
    if (dy < 0) player.onGround = true;
    player.vel.y = 0;
  }
}

// naik otomatis satu blok (step-up) supaya tidak nyangkut di tangga blok
function tryStepUp(dx, dz) {
  if (!player.onGround) return false;
  const p = player.pos;
  const nx = p.x + dx, nz = p.z + dz;
  if (!collidesAt(nx, p.y, nz)) return false;
  if (collidesAt(nx, p.y + 1, nz) || collidesAt(p.x, p.y + 1, p.z)) return false;
  p.y += 1;
  return true;
}

// ---------------------------------------------------------------------
// Update utama
// ---------------------------------------------------------------------
let stepDistance = 0;

export function updatePlayer(dt, input) {
  if (!player.alive) return;

  const p = player.pos;
  const feet = getBlock(p.x, p.y + 0.1, p.z);
  const head = getBlock(p.x, p.y + player.eye, p.z);
  const wasInWater = player.inWater;
  player.inWater = isLiquid(feet) || isLiquid(head);
  player.headInWater = isLiquid(head);

  if (player.inWater && !wasInWater && player.vel.y < -6) onEvent('splash');

  // ---- arah gerak ----
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right   = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const wish = new THREE.Vector3();
  if (input.forward) wish.addScaledVector(forward, input.forward);
  if (input.right)   wish.addScaledVector(right, input.right);
  const moving = wish.lengthSq() > 0.0001;
  if (moving) wish.normalize();

  player.sprinting = !!input.sprint && moving && !player.sneaking && player.hunger > 6;

  let speed = player.fly ? FLY_SPEED
            : player.inWater ? SWIM_SPEED
            : player.sprinting ? SPRINT_SPEED
            : WALK_SPEED;
  if (player.sneaking && !player.fly) speed *= 0.35;

  // ---- mode terbang (creative) ----
  if (player.fly) {
    let vy = 0;
    if (input.jump)  vy += FLY_SPEED;
    if (input.sneak) vy -= FLY_SPEED;
    if (moving && tryStepUp(wish.x * speed * dt, wish.z * speed * dt)) { /* naik tangga */ }
    moveAxis(wish.x * speed * dt, vy * dt, wish.z * speed * dt);
    player.fallFrom = null;
    tickStats(dt, false);
    return;
  }

  // ---- gravitasi & lompat ----
  if (player.inWater) {
    player.vel.y = Math.max(player.vel.y - GRAVITY * 0.22 * dt, -3.2);
    if (input.jump) player.vel.y = 3.4;             // berenang naik
    player.fallFrom = null;
  } else {
    player.vel.y = Math.max(player.vel.y - GRAVITY * dt, -55);
    if (input.jump && player.onGround) {
      player.vel.y = JUMP_SPEED;
      player.onGround = false;
      player.exhaustion += player.sprinting ? 0.2 : 0.05;
    }
  }

  // ---- catat ketinggian jatuh ----
  if (player.onGround) {
    player.fallFrom = null;
  } else if (player.vel.y < 0) {
    if (player.fallFrom === null) player.fallFrom = p.y;
  } else {
    player.fallFrom = null;
  }

  const wasOnGround = player.onGround;
  player.onGround = false;

  const dx = wish.x * speed * dt;
  const dz = wish.z * speed * dt;
  if (moving) tryStepUp(dx, dz);
  moveAxis(dx, player.vel.y * dt, dz);

  // ---- fall damage ----
  if (!wasOnGround && player.onGround && player.fallFrom !== null) {
    const dist = player.fallFrom - p.y;
    if (dist > 3.5 && !player.inWater) damagePlayer(Math.floor(dist - 3));
    player.fallFrom = null;
  }

  // ---- efek langkah & bobbing kamera ----
  if (moving && player.onGround) {
    const d = Math.hypot(dx, dz);
    stepDistance += d;
    player.bob += d * 6;
    player.exhaustion += d * (player.sprinting ? 0.06 : 0.02);
    if (stepDistance > 2.2) { stepDistance = 0; onEvent('step'); }
  }

  // ---- kontak blok berbahaya (kaktus) ----
  const w = player.width + 0.05;
  for (const [ox, oz] of [[w, 0], [-w, 0], [0, w], [0, -w]]) {
    const b = getBlock(p.x + ox, p.y + 0.9, p.z + oz);
    if (b !== AIR && BLOCKS[b].damage) damagePlayer(BLOCKS[b].damage);
  }

  // ---- jatuh ke void ----
  if (p.y < -8) damagePlayer(4, true);

  tickStats(dt, true);
}

function tickStats(dt, survival) {
  if (player.invuln > 0)    player.invuln -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
  if (!survival) return;

  // oksigen saat menyelam
  if (player.headInWater) {
    player.oxygen -= dt;
    if (player.oxygen <= 0) { player.oxygen = 0; damagePlayer(1); }
  } else if (player.oxygen < 10) {
    player.oxygen = Math.min(10, player.oxygen + dt * 4);
  }

  // lapar
  player.exhaustion += dt * 0.012;
  if (player.exhaustion >= 4) {
    player.exhaustion = 0;
    if (player.saturation > 0) player.saturation = Math.max(0, player.saturation - 1);
    else player.hunger = Math.max(0, player.hunger - 1);
  }

  // regenerasi & kelaparan
  if (player.hunger >= 18 && player.health < MAX_HEALTH) {
    player._regen = (player._regen || 0) + dt;
    if (player._regen > 3.5) {
      player._regen = 0;
      player.health = Math.min(MAX_HEALTH, player.health + 1);
      player.exhaustion += 1.2;
    }
  } else if (player.hunger <= 0) {
    player._starve = (player._starve || 0) + dt;
    if (player._starve > 4) { player._starve = 0; damagePlayer(1, true); }
  }
}

// ---------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------
const KEY = 'blockcraft:v2:player';
let saveTimer = null;

export function savePlayer() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        pos: [player.pos.x, player.pos.y, player.pos.z],
        yaw: player.yaw, pitch: player.pitch,
        health: player.health, hunger: player.hunger,
        inventory: player.inventory, hotbar: player.hotbar,
        fly: player.fly,
      }));
    } catch (e) {}
  }, 400);
}

export function loadPlayer() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    player.pos.set(d.pos[0], d.pos[1], d.pos[2]);
    player.yaw = d.yaw || 0;
    player.pitch = d.pitch || 0;
    player.health = d.health ?? MAX_HEALTH;
    player.hunger = d.hunger ?? MAX_HUNGER;
    player.hotbar = d.hotbar || 0;
    player.fly = !!d.fly;
    if (Array.isArray(d.inventory) && d.inventory.length === INV_SIZE) {
      player.inventory = d.inventory.map((s) => (s && ITEMS[s.id] ? { id: s.id, count: s.count } : null));
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function resetPlayer() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  player.inventory = new Array(INV_SIZE).fill(null);
  player.hotbar = 0;
  player.health = MAX_HEALTH;
  player.hunger = MAX_HUNGER;
  player.alive = true;
  player.fly = false;
}
