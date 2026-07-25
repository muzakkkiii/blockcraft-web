// =====================================================================
// ui.js — seluruh antarmuka: HUD, hotbar, inventory + crafting,
// furnace, recipe book, layar mati, dan kontrol sentuh untuk HP/tablet.
// Semua elemen dibuat dari JavaScript agar index.html tetap ringkas.
// =====================================================================
import { ITEMS, MAX_HEALTH, MAX_HUNGER } from './config.js';
import { tileToCanvas } from './atlas.js';
import {
  player, HOTBAR_SIZE, INV_SIZE, addItem, countItem, removeItem, savePlayer,
} from './player.js';
import {
  findRecipe, consumeGrid, availableRecipes, recipeNeeds,
  tickFurnace, isFuel, smeltResult, SMELT_TIME,
} from './crafting.js';

export const isTouchDevice =
  ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// state kontrol sentuh yang dibaca main.js tiap frame
export const touchState = {
  moveX: 0, moveY: 0,      // -1..1 dari joystick
  jump: false,
  sneak: false,
  mining: false,           // tombol tambang ditahan
  placeQueued: false,      // ketukan pasang blok
  lookDX: 0, lookDY: 0,    // delta putar kamera (dikonsumsi tiap frame)
};

export const settings = {
  sensitivity: 1,
  renderDistance: isTouchDevice ? 3 : 5,
  sound: true,
};

let callbacks = {};
let screenMode = null;      // null | 'inventory' | 'furnace' | 'settings'
let craftSize = 2;
let craftGrid = new Array(9).fill(null);
let cursorStack = null;     // item yang sedang "digenggam" di layar inventory
let activeFurnace = null;

const el = {};
const iconCache = new Map();

// ---------------------------------------------------------------------
// Utilitas DOM
// ---------------------------------------------------------------------
function div(cls, parent, text) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (text !== undefined) d.textContent = text;
  if (parent) parent.appendChild(d);
  return d;
}

function button(cls, parent, text, onClick) {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', (e) => { e.preventDefault(); onClick(e); });
  if (parent) parent.appendChild(b);
  return b;
}

export function itemIcon(id, px = 34) {
  const key = id + ':' + px;
  if (!iconCache.has(key)) {
    const item = ITEMS[id];
    const c = item ? tileToCanvas(item.tile, px) : document.createElement('canvas');
    iconCache.set(key, c);
  }
  return iconCache.get(key).cloneNode(true);
}

function renderSlot(node, stack, px = 34) {
  node.innerHTML = '';
  if (!stack) return;
  node.appendChild(itemIcon(stack.id, px));
  if (stack.count > 1) div('count', node, String(stack.count));
}

// ---------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------
function buildHUD() {
  el.crosshair = div('crosshair', document.body);

  el.hud = div('hud', document.body);
  el.hudStats = div('hud-stats', el.hud);
  el.fps = div('stat', el.hudStats);
  el.coords = div('stat', el.hudStats);
  el.biome = div('stat', el.hudStats);
  el.clock = div('stat', el.hudStats);

  el.bars = div('bars', document.body);
  el.hearts = div('bar hearts', el.bars);
  el.hungerBar = div('bar hunger', el.bars);
  el.oxygenBar = div('bar oxygen', el.bars);

  el.hotbar = div('hotbar', document.body);
  el.hotbarSlots = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const s = div('slot', el.hotbar);
    div('key', s, String(i + 1));
    const content = div('content', s);
    s.addEventListener('click', () => {
      player.hotbar = i;
      refreshHotbar();
    });
    el.hotbarSlots.push({ slot: s, content });
  }

  el.itemName = div('item-name', document.body);
  el.toast = div('toast', document.body);
  el.damageFlash = div('damage-flash', document.body);
  el.waterOverlay = div('water-overlay', document.body);
}

export function refreshHotbar() {
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const { slot, content } = el.hotbarSlots[i];
    slot.classList.toggle('active', i === player.hotbar);
    renderSlot(content, player.inventory[i], 32);
  }
  const held = player.inventory[player.hotbar];
  if (held && ITEMS[held.id]) {
    el.itemName.textContent = ITEMS[held.id].name;
    el.itemName.classList.add('show');
    clearTimeout(el.itemNameTimer);
    el.itemNameTimer = setTimeout(() => el.itemName.classList.remove('show'), 1600);
  } else {
    el.itemName.classList.remove('show');
  }
}

function renderBar(node, value, max, cls) {
  node.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const unit = div('unit ' + cls, node);
    if (value >= i + 1) unit.classList.add('full');
    else if (value > i) unit.classList.add('half');
  }
}

let lastStats = '';

export function updateHUD(info) {
  el.fps.textContent = 'FPS ' + info.fps;
  el.coords.textContent = 'XYZ ' + info.x + ' ' + info.y + ' ' + info.z;
  el.biome.textContent = info.biome;
  el.clock.textContent = info.time;

  const sig = [player.health, player.hunger, Math.ceil(player.oxygen), player.headInWater].join('|');
  if (sig !== lastStats) {
    lastStats = sig;
    renderBar(el.hearts, player.health / 2, MAX_HEALTH / 2, 'heart');
    renderBar(el.hungerBar, player.hunger / 2, MAX_HUNGER / 2, 'food');
    if (player.headInWater || player.oxygen < 10) {
      el.oxygenBar.style.display = 'flex';
      renderBar(el.oxygenBar, player.oxygen, 10, 'bubble');
    } else {
      el.oxygenBar.style.display = 'none';
    }
  }

  el.damageFlash.style.opacity = Math.max(0, player.hurtFlash) * 0.9;
  el.waterOverlay.style.opacity = player.headInWater ? 0.32 : 0;
}

export function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(el.toastTimer);
  el.toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2000);
}

// ---------------------------------------------------------------------
// Layar mati
// ---------------------------------------------------------------------
function buildDeathScreen() {
  el.death = div('screen death hidden', document.body);
  const panel = div('panel', el.death);
  div('title', panel, 'Kamu Mati!');
  div('sub', panel, 'Semua barang tetap tersimpan.');
  button('big-btn', panel, 'Respawn', () => {
    hideDeath();
    if (callbacks.onRespawn) callbacks.onRespawn();
  });
}

export function showDeath() { el.death.classList.remove('hidden'); }
export function hideDeath() { el.death.classList.add('hidden'); }

// ---------------------------------------------------------------------
// Inventory + crafting
// ---------------------------------------------------------------------
function buildScreen() {
  el.screen = div('screen hidden', document.body);
  el.screenPanel = div('panel wide', el.screen);

  el.screen.addEventListener('pointerdown', (e) => {
    if (e.target === el.screen) closeScreen();
  });

  el.cursor = div('cursor-stack hidden', document.body);
  document.addEventListener('pointermove', (e) => {
    if (!cursorStack) return;
    el.cursor.style.left = e.clientX + 'px';
    el.cursor.style.top = e.clientY + 'px';
  });
}

function updateCursorVisual() {
  el.cursor.classList.toggle('hidden', !cursorStack);
  renderSlot(el.cursor, cursorStack, 34);
}

/** Klik slot: ambil, taruh, gabung, atau tukar isi. */
function slotClick(getStack, setStack, half) {
  const stack = getStack();

  if (!cursorStack) {
    if (!stack) return;
    if (half && stack.count > 1) {
      const take = Math.ceil(stack.count / 2);
      cursorStack = { id: stack.id, count: take };
      stack.count -= take;
      setStack(stack.count > 0 ? stack : null);
    } else {
      cursorStack = stack;
      setStack(null);
    }
  } else if (!stack) {
    if (half && cursorStack.count > 1) {
      setStack({ id: cursorStack.id, count: 1 });
      cursorStack.count -= 1;
    } else {
      setStack(cursorStack);
      cursorStack = null;
    }
  } else if (stack.id === cursorStack.id) {
    const max = ITEMS[stack.id].stack || 64;
    const move = Math.min(half ? 1 : cursorStack.count, max - stack.count);
    stack.count += move;
    cursorStack.count -= move;
    if (cursorStack.count <= 0) cursorStack = null;
    setStack(stack);
  } else {
    const tmp = stack;
    setStack(cursorStack);
    cursorStack = tmp;
  }

  updateCursorVisual();
  renderScreen();
  savePlayer();
}

function makeSlot(parent, getStack, setStack, extraClass) {
  const s = div('inv-slot ' + (extraClass || ''), parent);
  renderSlot(s, getStack());

  let pressTimer = null;
  s.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pressTimer = setTimeout(() => { pressTimer = null; slotClick(getStack, setStack, true); }, 380);
  });
  const finish = (e) => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; slotClick(getStack, setStack, e.button === 2); }
  };
  s.addEventListener('pointerup', finish);
  s.addEventListener('pointerleave', () => { clearTimeout(pressTimer); pressTimer = null; });
  s.addEventListener('contextmenu', (e) => e.preventDefault());
  return s;
}

function craftingOutput() {
  const match = findRecipe(craftGrid.slice(0, craftSize * craftSize), craftSize);
  return match ? { id: match.out[0], count: match.out[1] } : null;
}

function renderInventoryScreen() {
  const p = el.screenPanel;
  p.innerHTML = '';

  const head = div('panel-head', p);
  div('title', head, craftSize === 3 ? 'Crafting Table' : 'Inventory');
  button('x-btn', head, '✕', closeScreen);

  // ---- area crafting ----
  const craftRow = div('craft-row', p);
  const grid = div('craft-grid size' + craftSize, craftRow);
  for (let i = 0; i < craftSize * craftSize; i++) {
    makeSlot(grid, () => craftGrid[i], (v) => { craftGrid[i] = v; });
  }

  div('arrow', craftRow, '→');

  const outStack = craftingOutput();
  const outSlot = div('inv-slot output', craftRow);
  renderSlot(outSlot, outStack);
  outSlot.addEventListener('click', () => {
    const result = craftingOutput();
    if (!result) return;
    const left = addItem(result.id, result.count);
    if (left > 0) { toast('Inventory penuh'); return; }
    consumeGrid(craftGrid);
    if (callbacks.onSfx) callbacks.onSfx('craft');
    renderScreen();
    refreshHotbar();
  });

  // ---- recipe book (praktis untuk layar sentuh) ----
  const book = div('recipe-book', p);
  div('section-title', book, 'Resep tersedia');
  const list = div('recipe-list', book);
  const recipes = availableRecipes(countItem, craftSize);
  for (const entry of recipes) {
    const [outId, outCount] = entry.recipe.out;
    const card = div('recipe' + (entry.ok ? '' : ' locked'), list);
    card.appendChild(itemIcon(outId, 30));
    const info = div('info', card);
    div('n', info, (ITEMS[outId] ? ITEMS[outId].name : outId) + (outCount > 1 ? ' ×' + outCount : ''));
    div('need', info, Object.keys(entry.need)
      .map((id) => (ITEMS[id] ? ITEMS[id].name : id) + ' ×' + entry.need[id])
      .join(', '));
    if (entry.ok) {
      card.addEventListener('click', () => {
        for (const id in entry.need) removeItem(id, entry.need[id]);
        addItem(outId, outCount);
        if (callbacks.onSfx) callbacks.onSfx('craft');
        toast('Dibuat: ' + (ITEMS[outId] ? ITEMS[outId].name : outId));
        renderScreen();
        refreshHotbar();
      });
    }
  }

  // ---- inventory utama ----
  div('section-title', p, 'Penyimpanan');
  const invGrid = div('inv-grid', p);
  for (let i = HOTBAR_SIZE; i < INV_SIZE; i++) {
    makeSlot(invGrid, () => player.inventory[i], (v) => { player.inventory[i] = v; });
  }

  div('section-title', p, 'Hotbar');
  const hotGrid = div('inv-grid hot', p);
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    makeSlot(hotGrid, () => player.inventory[i], (v) => { player.inventory[i] = v; });
  }
}

// ---------------------------------------------------------------------
// Furnace
// ---------------------------------------------------------------------
function renderFurnaceScreen() {
  const f = activeFurnace;
  const p = el.screenPanel;
  p.innerHTML = '';

  const head = div('panel-head', p);
  div('title', head, 'Furnace');
  button('x-btn', head, '✕', closeScreen);

  const wrap = div('furnace', p);

  const colIn = div('col', wrap);
  div('label', colIn, 'Bahan');
  makeSlot(colIn, () => f.input, (v) => { f.input = v; });
  div('flame' + (f.burnLeft > 0 ? ' lit' : ''), colIn);
  div('label', colIn, 'Bahan bakar');
  makeSlot(colIn, () => f.fuel, (v) => { f.fuel = v; });

  const mid = div('col', wrap);
  const barWrap = div('progress', mid);
  div('fill', barWrap).style.width = Math.round((f.progress / SMELT_TIME) * 100) + '%';
  div('hint', mid, f.input && smeltResult(f.input.id)
    ? 'Melebur → ' + (ITEMS[smeltResult(f.input.id)] ? ITEMS[smeltResult(f.input.id)].name : '')
    : 'Masukkan bahan yang bisa dilebur');

  const colOut = div('col', wrap);
  div('label', colOut, 'Hasil');
  makeSlot(colOut, () => f.output, (v) => { f.output = v; }, 'output');

  div('section-title', p, 'Inventory');
  const invGrid = div('inv-grid', p);
  for (let i = 0; i < INV_SIZE; i++) {
    makeSlot(invGrid, () => player.inventory[i], (v) => { player.inventory[i] = v; });
  }
}

// ---------------------------------------------------------------------
// Pengaturan
// ---------------------------------------------------------------------
function renderSettingsScreen() {
  const p = el.screenPanel;
  p.innerHTML = '';
  const head = div('panel-head', p);
  div('title', head, 'Pengaturan');
  button('x-btn', head, '✕', closeScreen);

  const mk = (label, min, max, step, value, onInput) => {
    const row = div('setting', p);
    div('label', row, label);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = value;
    const out = div('value', row, String(value));
    input.addEventListener('input', () => {
      out.textContent = input.value;
      onInput(parseFloat(input.value));
    });
    row.insertBefore(input, out);
  };

  mk('Sensitivitas', 0.3, 2.5, 0.1, settings.sensitivity, (v) => { settings.sensitivity = v; });
  mk('Jarak pandang (chunk)', 2, 8, 1, settings.renderDistance, (v) => {
    settings.renderDistance = v;
    if (callbacks.onRenderDistance) callbacks.onRenderDistance(v);
  });

  const row = div('setting', p);
  button('big-btn', row, settings.sound ? 'Suara: ON' : 'Suara: OFF', (e) => {
    settings.sound = !settings.sound;
    if (callbacks.onToggleSound) callbacks.onToggleSound(settings.sound);
    e.target.textContent = settings.sound ? 'Suara: ON' : 'Suara: OFF';
  });

  div('section-title', p, 'Zona berbahaya');
  button('danger-btn', p, 'Reset dunia & inventory', () => {
    if (confirm('Hapus seluruh progres dan mulai dunia baru?')) {
      if (callbacks.onReset) callbacks.onReset();
    }
  });
}

// ---------------------------------------------------------------------
// Kontrol layar
// ---------------------------------------------------------------------
function renderScreen() {
  if (screenMode === 'inventory') renderInventoryScreen();
  else if (screenMode === 'furnace') renderFurnaceScreen();
  else if (screenMode === 'settings') renderSettingsScreen();
}

export function screenOpen() { return screenMode !== null; }

export function openInventory(size = 2) {
  craftSize = size;
  screenMode = 'inventory';
  el.screen.classList.remove('hidden');
  renderScreen();
  if (callbacks.onScreenOpen) callbacks.onScreenOpen();
}

export function openFurnace(furnace) {
  activeFurnace = furnace;
  screenMode = 'furnace';
  el.screen.classList.remove('hidden');
  renderScreen();
  if (callbacks.onScreenOpen) callbacks.onScreenOpen();
}

export function openSettings() {
  screenMode = 'settings';
  el.screen.classList.remove('hidden');
  renderScreen();
  if (callbacks.onScreenOpen) callbacks.onScreenOpen();
}

export function closeScreen() {
  // kembalikan isi grid crafting & genggaman ke inventory
  for (let i = 0; i < craftGrid.length; i++) {
    if (craftGrid[i]) { addItem(craftGrid[i].id, craftGrid[i].count); craftGrid[i] = null; }
  }
  if (cursorStack) { addItem(cursorStack.id, cursorStack.count); cursorStack = null; }
  updateCursorVisual();

  screenMode = null;
  activeFurnace = null;
  el.screen.classList.add('hidden');
  refreshHotbar();
  if (callbacks.onScreenClose) callbacks.onScreenClose();
}

/** Dipanggil tiap frame oleh main.js agar progres furnace terlihat hidup. */
export function tickOpenFurnace(dt) {
  if (screenMode !== 'furnace' || !activeFurnace) return;
  if (tickFurnace(activeFurnace, dt)) {
    el._furnaceAccum = (el._furnaceAccum || 0) + dt;
    if (el._furnaceAccum > 0.25) { el._furnaceAccum = 0; renderScreen(); }
  }
}

// ---------------------------------------------------------------------
// Kontrol sentuh (HP & tablet)
// ---------------------------------------------------------------------
function buildTouchControls() {
  el.touch = div('touch', document.body);

  // --- joystick kiri ---
  const joy = div('joystick', el.touch);
  const knob = div('knob', joy);
  let joyId = null;
  const R = 52;

  const joyMove = (e) => {
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    touchState.moveX = dx / R;
    touchState.moveY = -dy / R;
  };

  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    joyMove(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    knob.style.transform = 'translate(0,0)';
    touchState.moveX = touchState.moveY = 0;
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  // --- tombol kanan ---
  const pad = div('btn-pad', el.touch);
  const holdBtn = (label, cls, onDown, onUp) => {
    const b = div('tbtn ' + cls, pad, label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); onDown(); });
    const up = (e) => { e.preventDefault(); b.classList.remove('down'); if (onUp) onUp(); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    return b;
  };

  holdBtn('⛏', 'mine', () => { touchState.mining = true; }, () => { touchState.mining = false; });
  holdBtn('■', 'place', () => { touchState.placeQueued = true; });
  holdBtn('⬆', 'jump', () => { touchState.jump = true; }, () => { touchState.jump = false; });
  holdBtn('⬇', 'sneak', () => { touchState.sneak = true; }, () => { touchState.sneak = false; });

  // --- tombol menu atas ---
  el.topBtns = div('top-btns', document.body);
  button('tbtn small', el.topBtns, '🎒', () => (screenOpen() ? closeScreen() : openInventory(2)));
  button('tbtn small', el.topBtns, '✈', () => { if (callbacks.onToggleFly) callbacks.onToggleFly(); });
  button('tbtn small', el.topBtns, '⚙', () => (screenMode === 'settings' ? closeScreen() : openSettings()));
  button('tbtn small', el.topBtns, '⛶', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
}

export function setTouchVisible(v) {
  el.touch.style.display = v ? 'block' : 'none';
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
export function initUI(cb) {
  callbacks = cb || {};
  buildHUD();
  buildScreen();
  buildDeathScreen();
  buildTouchControls();
  setTouchVisible(isTouchDevice);
  refreshHotbar();

  // cegah zoom dua jari & scroll bounce di HP
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (!screenOpen() && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  return el;
}

export function uiElements() { return el; }
