// =====================================================================
// mobs.js — makhluk hidup: babi, domba, sapi (pasif) dan zombie (hostil).
// Model dibangun dari kotak sederhana bergaya Minecraft.
// =====================================================================
import * as THREE from 'three';
import { AIR, BLOCKS, isSolid, isLiquid } from './config.js';
import { getBlock, surfaceHeight, chunkCoords, getChunk } from './world.js';
import { player, damagePlayer, addItem } from './player.js';

export const mobs = [];
const MAX_MOBS = 14;

export const MOB_TYPES = {
  pig: {
    name: 'Pig', health: 10, speed: 1.5, hostile: false,
    body: 0xf0a0a8, head: 0xf6b4bb, legs: 0xd98f97,
    size: [0.9, 0.8, 1.3], drops: [['porkchop', 1, 3]], sound: 'pig',
  },
  sheep: {
    name: 'Sheep', health: 8, speed: 1.4, hostile: false,
    body: 0xf2f2f2, head: 0xe8ded2, legs: 0xd8d0c4,
    size: [0.9, 0.9, 1.2], drops: [['wool', 1, 2]], sound: 'cow',
  },
  cow: {
    name: 'Cow', health: 10, speed: 1.3, hostile: false,
    body: 0x4a3423, head: 0x5b4230, legs: 0x3c2a1c,
    size: [1.0, 1.0, 1.4], drops: [['wheat', 1, 2]], sound: 'cow',
  },
  zombie: {
    name: 'Zombie', health: 20, speed: 2.4, hostile: true, damage: 3,
    body: 0x3f7a4a, head: 0x5aa06a, legs: 0x2f3f6b,
    size: [0.7, 1.6, 0.5], drops: [['iron_ingot', 0, 1]], sound: 'zombie',
  },
};

let scene = null;
let sfx = () => {};

export function initMobs(threeScene, sfxHandler) {
  scene = threeScene;
  if (sfxHandler) sfx = sfxHandler;
}

// ---------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  return m;
}

function buildModel(type) {
  const t = MOB_TYPES[type];
  const [w, h, d] = t.size;
  const group = new THREE.Group();

  if (type === 'zombie') {
    group.add(box(w, 0.9, d, t.body, 0, 1.0, 0));                 // torso
    group.add(box(0.55, 0.55, 0.55, t.head, 0, 1.75, 0));         // kepala
    const armL = box(0.25, 0.8, 0.25, t.head, -0.48, 1.15, -0.28);
    const armR = box(0.25, 0.8, 0.25, t.head, 0.48, 1.15, -0.28);
    armL.rotation.x = armR.rotation.x = -Math.PI / 2.2;           // tangan menjulur
    group.add(armL, armR);
    const legL = box(0.26, 0.75, 0.26, t.legs, -0.18, 0.37, 0);
    const legR = box(0.26, 0.75, 0.26, t.legs, 0.18, 0.37, 0);
    group.add(legL, legR);
    group.userData.limbs = [legL, legR];
  } else {
    const bodyY = h * 0.62 + 0.28;
    group.add(box(w, h * 0.7, d, t.body, 0, bodyY, 0));
    group.add(box(w * 0.72, h * 0.62, w * 0.62, t.head, 0, bodyY + 0.12, -d / 2 - 0.16));
    const legY = 0.28, lx = w / 2 - 0.14, lz = d / 2 - 0.18;
    const legs = [
      box(0.24, 0.56, 0.24, t.legs, -lx, legY, -lz),
      box(0.24, 0.56, 0.24, t.legs,  lx, legY, -lz),
      box(0.24, 0.56, 0.24, t.legs, -lx, legY,  lz),
      box(0.24, 0.56, 0.24, t.legs,  lx, legY,  lz),
    ];
    legs.forEach((l) => group.add(l));
    group.userData.limbs = legs;
  }
  return group;
}

// ---------------------------------------------------------------------
// Spawn & despawn
// ---------------------------------------------------------------------
function spawnMob(type, x, y, z) {
  const t = MOB_TYPES[type];
  const mesh = buildModel(type);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  const mob = {
    type, def: t, mesh,
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2,
    health: t.health,
    onGround: false,
    wanderTimer: Math.random() * 3,
    attackCd: 0,
    hurtCd: 0,
    walk: 0,
    width: Math.max(t.size[0], t.size[2]) / 2,
    height: t.size[1] + 0.2,
  };
  mobs.push(mob);
  return mob;
}

function removeMob(mob) {
  scene.remove(mob.mesh);
  mob.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  const i = mobs.indexOf(mob);
  if (i >= 0) mobs.splice(i, 1);
}

export function clearMobs() {
  for (let i = mobs.length - 1; i >= 0; i--) removeMob(mobs[i]);
}

let spawnTimer = 0;

function trySpawn(isNight) {
  const passive = ['pig', 'sheep', 'cow'];
  const type = isNight && Math.random() < 0.62 ? 'zombie' : passive[(Math.random() * passive.length) | 0];

  const angle = Math.random() * Math.PI * 2;
  const dist  = 18 + Math.random() * 18;
  const x = Math.floor(player.pos.x + Math.cos(angle) * dist) + 0.5;
  const z = Math.floor(player.pos.z + Math.sin(angle) * dist) + 0.5;

  // hanya spawn di chunk yang sudah dimuat
  const [cx, cz] = chunkCoords(x, z);
  if (!getChunk(cx, cz)) return;

  const surface = surfaceHeight(x, z);
  const ground = getBlock(x, surface, z);
  if (ground === AIR || BLOCKS[ground].liquid) return;
  if (getBlock(x, surface + 1, z) !== AIR || getBlock(x, surface + 2, z) !== AIR) return;

  spawnMob(type, x, surface + 1, z);
}

// ---------------------------------------------------------------------
// Fisika mob
// ---------------------------------------------------------------------
function mobCollides(mob, x, y, z) {
  const w = mob.width;
  for (let bx = Math.floor(x - w); bx <= Math.floor(x + w); bx++)
    for (let by = Math.floor(y); by <= Math.floor(y + mob.height); by++)
      for (let bz = Math.floor(z - w); bz <= Math.floor(z + w); bz++)
        if (isSolid(getBlock(bx, by, bz))) return true;
  return false;
}

function mobMove(mob, dx, dy, dz) {
  const p = mob.pos;
  let blocked = false;

  if (!mobCollides(mob, p.x + dx, p.y, p.z)) p.x += dx; else blocked = true;
  if (!mobCollides(mob, p.x, p.y, p.z + dz)) p.z += dz; else blocked = true;

  if (!mobCollides(mob, p.x, p.y + dy, p.z)) {
    p.y += dy;
    mob.onGround = false;
  } else {
    if (dy < 0) mob.onGround = true;
    mob.vel.y = 0;
  }
  return blocked;
}

// ---------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------
export function updateMobs(dt, isNight) {
  if (!scene) return;

  // spawn bertahap
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = 2.5;
    if (mobs.length < MAX_MOBS) trySpawn(isNight);
  }

  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];
    const toPlayer = new THREE.Vector3().subVectors(player.pos, mob.pos);
    const dist = toPlayer.length();

    // despawn kalau terlalu jauh
    if (dist > 70) { removeMob(mob); continue; }

    if (mob.hurtCd > 0) mob.hurtCd -= dt;
    if (mob.attackCd > 0) mob.attackCd -= dt;

    let moveSpeed = 0;

    if (mob.def.hostile && dist < 20 && player.alive) {
      // mengejar pemain
      mob.yaw = Math.atan2(toPlayer.x, toPlayer.z);
      moveSpeed = mob.def.speed;
      if (dist < 1.4 && mob.attackCd <= 0) {
        damagePlayer(mob.def.damage);
        mob.attackCd = 1.1;
        // dorongan mundur
        player.vel.y = Math.max(player.vel.y, 3.2);
      }
      if (Math.random() < dt * 0.5) sfx(mob.def.sound);
    } else {
      // berkeliaran acak
      mob.wanderTimer -= dt;
      if (mob.wanderTimer <= 0) {
        mob.wanderTimer = 2 + Math.random() * 4;
        mob.moving = Math.random() < 0.65;
        mob.yaw = Math.random() * Math.PI * 2;
        if (Math.random() < 0.12) sfx(mob.def.sound);
      }
      if (mob.moving) moveSpeed = mob.def.speed * 0.45;
    }

    // gravitasi
    const inWater = isLiquid(getBlock(mob.pos.x, mob.pos.y + 0.2, mob.pos.z));
    mob.vel.y = inWater
      ? Math.min(mob.vel.y + 12 * dt, 2.0)
      : Math.max(mob.vel.y - 28 * dt, -40);

    const dx = Math.sin(mob.yaw) * moveSpeed * dt;
    const dz = Math.cos(mob.yaw) * moveSpeed * dt;
    const blocked = mobMove(mob, dx, mob.vel.y * dt, dz);

    // lompat kalau terhalang
    if (blocked && mob.onGround) {
      mob.vel.y = 8.2;
      mob.onGround = false;
    }

    // jatuh ke void
    if (mob.pos.y < -6) { removeMob(mob); continue; }

    // animasi kaki
    if (moveSpeed > 0) {
      mob.walk += dt * moveSpeed * 3.4;
      const limbs = mob.mesh.userData.limbs || [];
      limbs.forEach((l, idx) => {
        l.rotation.x = Math.sin(mob.walk + (idx % 2 ? Math.PI : 0)) * 0.55;
      });
    }

    mob.mesh.position.copy(mob.pos);
    mob.mesh.rotation.y = mob.yaw;
  }
}

// ---------------------------------------------------------------------
// Interaksi
// ---------------------------------------------------------------------
/** Cari mob terdekat yang terkena garis pandang pemain. */
export function pickMob(origin, dir, reach) {
  let best = null, bestT = reach;
  const ray = new THREE.Ray(origin, dir);
  const boxTmp = new THREE.Box3();
  const hit = new THREE.Vector3();

  for (const mob of mobs) {
    boxTmp.min.set(mob.pos.x - mob.width, mob.pos.y, mob.pos.z - mob.width);
    boxTmp.max.set(mob.pos.x + mob.width, mob.pos.y + mob.height, mob.pos.z + mob.width);
    if (ray.intersectBox(boxTmp, hit)) {
      const t = origin.distanceTo(hit);
      if (t < bestT) { bestT = t; best = mob; }
    }
  }
  return best;
}

/** Serang mob. Mengembalikan true jika mob mati. */
export function hitMob(mob, damage, knockDir) {
  mob.health -= damage;
  mob.hurtCd = 0.3;
  sfx('hit');

  if (knockDir) {
    mob.pos.x += knockDir.x * 0.55;
    mob.pos.z += knockDir.z * 0.55;
    mob.vel.y = 4.2;
  }

  // kedip merah
  mob.mesh.traverse((o) => {
    if (!o.material || !o.material.emissive) return;
    o.material.emissive.setHex(0x881111);
    setTimeout(() => o.material.emissive.setHex(0x000000), 220);
  });

  if (mob.health <= 0) {
    for (const [item, min, max] of mob.def.drops) {
      const n = min + Math.floor(Math.random() * (max - min + 1));
      if (n > 0) addItem(item, n);
    }
    sfx('pop');
    removeMob(mob);
    return true;
  }
  return false;
}
