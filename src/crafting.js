// =====================================================================
// crafting.js — pencocokan resep crafting berpola (shaped) dan
// state machine furnace (bahan bakar + peleburan).
// =====================================================================
import { RECIPES, ITEMS, FUEL, SMELTING } from './config.js';

// ---------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------

/** Ubah pattern resep menjadi matriks id item. */
function recipeMatrix(recipe) {
  return recipe.pattern.map((row) =>
    row.split('').map((ch) => (ch === ' ' ? null : recipe.keys[ch]))
  );
}

/** Buang baris & kolom kosong di tepi supaya resep bisa digeser bebas. */
function trim(matrix) {
  let top = 0, bottom = matrix.length - 1;
  const width = matrix[0] ? matrix[0].length : 0;
  const rowEmpty = (r) => matrix[r].every((c) => c === null);

  while (top <= bottom && rowEmpty(top)) top++;
  while (bottom >= top && rowEmpty(bottom)) bottom--;
  if (top > bottom) return [];

  let left = 0, right = width - 1;
  const colEmpty = (c) => {
    for (let r = top; r <= bottom; r++) if (matrix[r][c] !== null) return false;
    return true;
  };
  while (left <= right && colEmpty(left)) left++;
  while (right >= left && colEmpty(right)) right--;

  const out = [];
  for (let r = top; r <= bottom; r++) out.push(matrix[r].slice(left, right + 1));
  return out;
}

function sameMatrix(a, b) {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) if (a[r][c] !== b[r][c]) return false;
  }
  return true;
}

/**
 * Cari resep yang cocok dengan isi grid crafting.
 * @param grid array datar berisi { id, count } atau null, panjang size*size
 * @param size 2 atau 3
 * @returns { out: [id, count], recipe } atau null
 */
export function findRecipe(grid, size) {
  const matrix = [];
  for (let r = 0; r < size; r++) {
    matrix.push(grid.slice(r * size, r * size + size).map((s) => (s ? s.id : null)));
  }
  const trimmed = trim(matrix);
  if (!trimmed.length) return null;

  for (const recipe of RECIPES) {
    if (recipe.size > size) continue;                        // butuh crafting table
    const target = trim(recipeMatrix(recipe));
    if (sameMatrix(trimmed, target)) return { out: recipe.out, recipe };
  }
  return null;
}

/** Kurangi satu bahan dari tiap slot grid setelah crafting. */
export function consumeGrid(grid) {
  for (let i = 0; i < grid.length; i++) {
    const s = grid[i];
    if (!s) continue;
    s.count -= 1;
    if (s.count <= 0) grid[i] = null;
  }
}

/** Daftar resep yang bisa dibuat dengan bahan yang dimiliki (untuk panduan UI). */
export function availableRecipes(countOf, maxSize) {
  const out = [];
  for (const recipe of RECIPES) {
    if (recipe.size > maxSize) continue;
    const need = {};
    for (const row of recipe.pattern) {
      for (const ch of row.split('')) {
        if (ch === ' ') continue;
        const id = recipe.keys[ch];
        need[id] = (need[id] || 0) + 1;
      }
    }
    const ok = Object.keys(need).every((id) => countOf(id) >= need[id]);
    out.push({ recipe, need, ok });
  }
  return out;
}

/** Isi grid otomatis dari resep (dipakai tombol "craft cepat" di HP). */
export function recipeNeeds(recipe) {
  const need = {};
  for (const row of recipe.pattern) {
    for (const ch of row.split('')) {
      if (ch === ' ') continue;
      const id = recipe.keys[ch];
      need[id] = (need[id] || 0) + 1;
    }
  }
  return need;
}

// ---------------------------------------------------------------------
// Furnace
// ---------------------------------------------------------------------
export const SMELT_TIME = 4;   // detik per item

export function createFurnace() {
  return {
    input: null,     // { id, count }
    fuel: null,
    output: null,
    burnLeft: 0,     // sisa detik bahan bakar yang menyala
    burnTotal: 0,
    progress: 0,     // 0..SMELT_TIME
  };
}

function canSmelt(f) {
  if (!f.input) return false;
  const result = SMELTING[f.input.id];
  if (!result) return false;
  if (!f.output) return true;
  if (f.output.id !== result) return false;
  return f.output.count < (ITEMS[result].stack || 64);
}

/** Jalankan satu tick furnace. Mengembalikan true jika ada perubahan tampilan. */
export function tickFurnace(f, dt) {
  let changed = false;

  if (f.burnLeft > 0) {
    f.burnLeft -= dt;
    changed = true;
  }

  // nyalakan bahan bakar baru bila perlu
  if (f.burnLeft <= 0 && canSmelt(f) && f.fuel && FUEL[f.fuel.id]) {
    f.burnTotal = FUEL[f.fuel.id];
    f.burnLeft = f.burnTotal;
    f.fuel.count -= 1;
    if (f.fuel.count <= 0) f.fuel = null;
    changed = true;
  }

  if (f.burnLeft > 0 && canSmelt(f)) {
    f.progress += dt;
    changed = true;
    if (f.progress >= SMELT_TIME) {
      f.progress = 0;
      const result = SMELTING[f.input.id];
      f.input.count -= 1;
      if (f.input.count <= 0) f.input = null;
      if (f.output && f.output.id === result) f.output.count += 1;
      else f.output = { id: result, count: 1 };
    }
  } else if (f.progress > 0) {
    f.progress = Math.max(0, f.progress - dt * 2);   // mundur pelan saat api mati
    changed = true;
  }

  return changed;
}

export function isFuel(id)       { return !!FUEL[id]; }
export function smeltResult(id)  { return SMELTING[id] || null; }
