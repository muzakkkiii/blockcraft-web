// =====================================================================
// config.js — konstanta dunia, definisi blok, item, tool, resep crafting
// =====================================================================

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 72;
export const WATER_LEVEL  = 26;
export const SEED         = 20260726;
export const REACH        = 6;

export const GRAVITY      = 28;
export const JUMP_SPEED   = 9.0;
export const WALK_SPEED   = 4.6;
export const SPRINT_SPEED = 7.1;
export const FLY_SPEED    = 16;
export const SWIM_SPEED   = 3.6;

export const MAX_HEALTH   = 20;
export const MAX_HUNGER   = 20;
export const DAY_LENGTH   = 600;   // detik untuk satu siklus siang-malam penuh

// ---------------------------------------------------------------------
// Indeks tile pada texture atlas (8 x 8 = 64 tile)
// ---------------------------------------------------------------------
export const T = {
  GRASS_TOP: 0,  DIRT: 1,  GRASS_SIDE: 2,  STONE: 3,
  SAND: 4,       LOG_SIDE: 5, LEAVES: 6,   PLANKS: 7,
  BRICK: 8,      LOG_TOP: 9,  COBBLE: 10,  GRAVEL: 11,
  WATER: 12,     BEDROCK: 13, COAL_ORE: 14, IRON_ORE: 15,
  GOLD_ORE: 16,  DIAMOND_ORE: 17, SNOW: 18, ICE: 19,
  CACTUS_SIDE: 20, CACTUS_TOP: 21, GLASS: 22, TORCH: 23,
  TABLE_TOP: 24, TABLE_SIDE: 25, FURNACE_FRONT: 26, FURNACE_SIDE: 27,
  WOOL: 28,      IRON_BLOCK: 29, GOLD_BLOCK: 30, DIAMOND_BLOCK: 31,
  // ikon item
  STICK: 32,     COAL: 33,    IRON_INGOT: 34, GOLD_INGOT: 35,
  DIAMOND: 36,   PICK_W: 37,  PICK_S: 38,  PICK_I: 39,
  PICK_D: 40,    SWORD_W: 41, SWORD_S: 42, SWORD_I: 43,
  SWORD_D: 44,   AXE_W: 45,   AXE_S: 46,   SHOVEL_W: 47,
  SHOVEL_S: 48,  APPLE: 49,   PORK_RAW: 50, PORK_COOKED: 51,
  BREAD: 52,     WHEAT: 53,   COAL_BLOCK: 54, SANDSTONE: 55,
};

// ---------------------------------------------------------------------
// Blok
//   tiles      : [atas, bawah, samping]
//   hardness   : lama menambang (detik dasar)
//   tool       : jenis tool yang efektif
//   level      : level tool minimum agar blok menghasilkan drop
//   drop       : id item yang dijatuhkan (default = item blok itu sendiri)
// ---------------------------------------------------------------------
export const AIR = 0;

export const BLOCKS = {
  1:  { name: 'Grass Block', item: 'grass',        tiles: [T.GRASS_TOP, T.DIRT, T.GRASS_SIDE], hardness: 0.6, tool: 'shovel', drop: 'dirt' },
  2:  { name: 'Dirt',        item: 'dirt',         tiles: [T.DIRT, T.DIRT, T.DIRT],            hardness: 0.5, tool: 'shovel' },
  3:  { name: 'Stone',       item: 'stone',        tiles: [T.STONE, T.STONE, T.STONE],         hardness: 1.5, tool: 'pickaxe', level: 1, drop: 'cobblestone' },
  4:  { name: 'Sand',        item: 'sand',         tiles: [T.SAND, T.SAND, T.SAND],            hardness: 0.5, tool: 'shovel', gravity: true },
  5:  { name: 'Oak Log',     item: 'log',          tiles: [T.LOG_TOP, T.LOG_TOP, T.LOG_SIDE],  hardness: 2.0, tool: 'axe' },
  6:  { name: 'Leaves',      item: 'leaves',       tiles: [T.LEAVES, T.LEAVES, T.LEAVES],      hardness: 0.2, tool: 'axe', decay: true },
  7:  { name: 'Planks',      item: 'planks',       tiles: [T.PLANKS, T.PLANKS, T.PLANKS],      hardness: 2.0, tool: 'axe' },
  8:  { name: 'Bricks',      item: 'brick',        tiles: [T.BRICK, T.BRICK, T.BRICK],         hardness: 2.0, tool: 'pickaxe', level: 1 },
  9:  { name: 'Cobblestone', item: 'cobblestone',  tiles: [T.COBBLE, T.COBBLE, T.COBBLE],      hardness: 2.0, tool: 'pickaxe', level: 1 },
  10: { name: 'Gravel',      item: 'gravel',       tiles: [T.GRAVEL, T.GRAVEL, T.GRAVEL],      hardness: 0.6, tool: 'shovel', gravity: true },
  11: { name: 'Water',       item: null,           tiles: [T.WATER, T.WATER, T.WATER],         hardness: -1,  liquid: true, transparent: true, noCollide: true },
  12: { name: 'Bedrock',     item: null,           tiles: [T.BEDROCK, T.BEDROCK, T.BEDROCK],   hardness: -1 },
  13: { name: 'Coal Ore',    item: 'coal_ore',     tiles: [T.COAL_ORE, T.COAL_ORE, T.COAL_ORE],       hardness: 3.0, tool: 'pickaxe', level: 1, drop: 'coal' },
  14: { name: 'Iron Ore',    item: 'iron_ore',     tiles: [T.IRON_ORE, T.IRON_ORE, T.IRON_ORE],       hardness: 3.0, tool: 'pickaxe', level: 2 },
  15: { name: 'Gold Ore',    item: 'gold_ore',     tiles: [T.GOLD_ORE, T.GOLD_ORE, T.GOLD_ORE],       hardness: 3.0, tool: 'pickaxe', level: 3 },
  16: { name: 'Diamond Ore', item: 'diamond_ore',  tiles: [T.DIAMOND_ORE, T.DIAMOND_ORE, T.DIAMOND_ORE], hardness: 3.5, tool: 'pickaxe', level: 3, drop: 'diamond' },
  17: { name: 'Snow Block',  item: 'snow',         tiles: [T.SNOW, T.SNOW, T.SNOW],            hardness: 0.4, tool: 'shovel' },
  18: { name: 'Ice',         item: 'ice',          tiles: [T.ICE, T.ICE, T.ICE],               hardness: 0.5, tool: 'pickaxe', level: 1, transparent: true, slippery: true },
  19: { name: 'Cactus',      item: 'cactus',       tiles: [T.CACTUS_TOP, T.CACTUS_TOP, T.CACTUS_SIDE], hardness: 0.4, damage: 1 },
  20: { name: 'Glass',       item: 'glass',        tiles: [T.GLASS, T.GLASS, T.GLASS],         hardness: 0.3, transparent: true, drop: null },
  21: { name: 'Torch',       item: 'torch',        tiles: [T.TORCH, T.TORCH, T.TORCH],         hardness: 0.1, light: 14, noCollide: true, transparent: true },
  22: { name: 'Crafting Table', item: 'crafting_table', tiles: [T.TABLE_TOP, T.PLANKS, T.TABLE_SIDE], hardness: 2.5, tool: 'axe', interact: 'crafting' },
  23: { name: 'Furnace',     item: 'furnace',      tiles: [T.FURNACE_SIDE, T.FURNACE_SIDE, T.FURNACE_FRONT], hardness: 3.5, tool: 'pickaxe', level: 1, interact: 'furnace' },
  24: { name: 'Wool',        item: 'wool',         tiles: [T.WOOL, T.WOOL, T.WOOL],            hardness: 0.8 },
  25: { name: 'Iron Block',  item: 'iron_block',   tiles: [T.IRON_BLOCK, T.IRON_BLOCK, T.IRON_BLOCK],       hardness: 5.0, tool: 'pickaxe', level: 2 },
  26: { name: 'Gold Block',  item: 'gold_block',   tiles: [T.GOLD_BLOCK, T.GOLD_BLOCK, T.GOLD_BLOCK],       hardness: 3.0, tool: 'pickaxe', level: 3 },
  27: { name: 'Diamond Block', item: 'diamond_block', tiles: [T.DIAMOND_BLOCK, T.DIAMOND_BLOCK, T.DIAMOND_BLOCK], hardness: 5.0, tool: 'pickaxe', level: 3 },
  28: { name: 'Coal Block',  item: 'coal_block',   tiles: [T.COAL_BLOCK, T.COAL_BLOCK, T.COAL_BLOCK],       hardness: 5.0, tool: 'pickaxe', level: 1 },
  29: { name: 'Sandstone',   item: 'sandstone',    tiles: [T.SANDSTONE, T.SANDSTONE, T.SANDSTONE],          hardness: 0.8, tool: 'pickaxe', level: 1 },
};

export const isSolid       = (id) => id !== AIR && !BLOCKS[id].noCollide && !BLOCKS[id].liquid;
export const isTransparent = (id) => id === AIR || !!BLOCKS[id].transparent;
export const isLiquid      = (id) => id !== AIR && !!BLOCKS[id].liquid;
export const lightOf       = (id) => (id === AIR ? 0 : BLOCKS[id].light || 0);

// ---------------------------------------------------------------------
// Item
//   place : id blok yang dipasang saat klik kanan
//   tool  : { kind, level, speed }
//   food  : jumlah hunger yang dipulihkan
// ---------------------------------------------------------------------
function blockItems() {
  const out = {};
  for (const id in BLOCKS) {
    const b = BLOCKS[id];
    if (!b.item) continue;
    out[b.item] = { name: b.name, tile: b.tiles[2], place: Number(id), stack: 64 };
  }
  return out;
}

export const ITEMS = Object.assign(blockItems(), {
  stick:           { name: 'Stick',            tile: T.STICK,       stack: 64 },
  coal:            { name: 'Coal',             tile: T.COAL,        stack: 64, fuel: 8 },
  iron_ingot:      { name: 'Iron Ingot',       tile: T.IRON_INGOT,  stack: 64 },
  gold_ingot:      { name: 'Gold Ingot',       tile: T.GOLD_INGOT,  stack: 64 },
  diamond:         { name: 'Diamond',          tile: T.DIAMOND,     stack: 64 },
  apple:           { name: 'Apple',            tile: T.APPLE,       stack: 64, food: 4 },
  porkchop:        { name: 'Raw Porkchop',     tile: T.PORK_RAW,    stack: 64, food: 2 },
  cooked_porkchop: { name: 'Cooked Porkchop',  tile: T.PORK_COOKED, stack: 64, food: 8 },
  bread:           { name: 'Bread',            tile: T.BREAD,       stack: 64, food: 5 },
  wheat:           { name: 'Wheat',            tile: T.WHEAT,       stack: 64 },

  wood_pickaxe:    { name: 'Wooden Pickaxe',   tile: T.PICK_W,   stack: 1, tool: { kind: 'pickaxe', level: 1, speed: 2 },  damage: 2 },
  stone_pickaxe:   { name: 'Stone Pickaxe',    tile: T.PICK_S,   stack: 1, tool: { kind: 'pickaxe', level: 2, speed: 4 },  damage: 3 },
  iron_pickaxe:    { name: 'Iron Pickaxe',     tile: T.PICK_I,   stack: 1, tool: { kind: 'pickaxe', level: 3, speed: 6 },  damage: 4 },
  diamond_pickaxe: { name: 'Diamond Pickaxe',  tile: T.PICK_D,   stack: 1, tool: { kind: 'pickaxe', level: 4, speed: 8 },  damage: 5 },
  wood_sword:      { name: 'Wooden Sword',     tile: T.SWORD_W,  stack: 1, damage: 4 },
  stone_sword:     { name: 'Stone Sword',      tile: T.SWORD_S,  stack: 1, damage: 5 },
  iron_sword:      { name: 'Iron Sword',       tile: T.SWORD_I,  stack: 1, damage: 6 },
  diamond_sword:   { name: 'Diamond Sword',    tile: T.SWORD_D,  stack: 1, damage: 7 },
  wood_axe:        { name: 'Wooden Axe',       tile: T.AXE_W,    stack: 1, tool: { kind: 'axe', level: 1, speed: 2 },     damage: 3 },
  stone_axe:       { name: 'Stone Axe',        tile: T.AXE_S,    stack: 1, tool: { kind: 'axe', level: 2, speed: 4 },     damage: 4 },
  wood_shovel:     { name: 'Wooden Shovel',    tile: T.SHOVEL_W, stack: 1, tool: { kind: 'shovel', level: 1, speed: 2 },  damage: 2 },
  stone_shovel:    { name: 'Stone Shovel',     tile: T.SHOVEL_S, stack: 1, tool: { kind: 'shovel', level: 2, speed: 4 },  damage: 3 },
});

// bahan bakar furnace (detik pembakaran)
export const FUEL = { coal: 8, coal_block: 80, planks: 1.5, log: 1.5, stick: 0.5 };

// resep peleburan furnace
export const SMELTING = {
  iron_ore:  'iron_ingot',
  gold_ore:  'gold_ingot',
  sand:      'glass',
  porkchop:  'cooked_porkchop',
  cobblestone: 'stone',
  log:       'coal',
  wheat:     'bread',
};

// ---------------------------------------------------------------------
// Resep crafting
//   pattern : baris grid, spasi = kosong
//   keys    : huruf -> id item
//   size    : 2 = bisa di inventory, 3 = butuh crafting table
// ---------------------------------------------------------------------
export const RECIPES = [
  { out: ['planks', 4],          size: 2, pattern: ['L'],                keys: { L: 'log' } },
  { out: ['stick', 4],           size: 2, pattern: ['P', 'P'],           keys: { P: 'planks' } },
  { out: ['crafting_table', 1],  size: 2, pattern: ['PP', 'PP'],         keys: { P: 'planks' } },
  { out: ['torch', 4],           size: 2, pattern: ['C', 'S'],           keys: { C: 'coal', S: 'stick' } },

  { out: ['furnace', 1],         size: 3, pattern: ['CCC', 'C C', 'CCC'], keys: { C: 'cobblestone' } },
  { out: ['glass', 1],           size: 2, pattern: ['S'],                keys: { S: 'sandstone' } },
  { out: ['sandstone', 1],       size: 2, pattern: ['SS', 'SS'],         keys: { S: 'sand' } },
  { out: ['coal_block', 1],      size: 3, pattern: ['CCC', 'CCC', 'CCC'], keys: { C: 'coal' } },
  { out: ['iron_block', 1],      size: 3, pattern: ['III', 'III', 'III'], keys: { I: 'iron_ingot' } },
  { out: ['gold_block', 1],      size: 3, pattern: ['GGG', 'GGG', 'GGG'], keys: { G: 'gold_ingot' } },
  { out: ['diamond_block', 1],   size: 3, pattern: ['DDD', 'DDD', 'DDD'], keys: { D: 'diamond' } },
  { out: ['brick', 4],           size: 2, pattern: ['CC', 'CC'],         keys: { C: 'cobblestone' } },

  { out: ['wood_pickaxe', 1],    size: 3, pattern: ['PPP', ' S ', ' S '], keys: { P: 'planks', S: 'stick' } },
  { out: ['stone_pickaxe', 1],   size: 3, pattern: ['CCC', ' S ', ' S '], keys: { C: 'cobblestone', S: 'stick' } },
  { out: ['iron_pickaxe', 1],    size: 3, pattern: ['III', ' S ', ' S '], keys: { I: 'iron_ingot', S: 'stick' } },
  { out: ['diamond_pickaxe', 1], size: 3, pattern: ['DDD', ' S ', ' S '], keys: { D: 'diamond', S: 'stick' } },

  { out: ['wood_sword', 1],      size: 2, pattern: ['P', 'P', 'S'],      keys: { P: 'planks', S: 'stick' } },
  { out: ['stone_sword', 1],     size: 2, pattern: ['C', 'C', 'S'],      keys: { C: 'cobblestone', S: 'stick' } },
  { out: ['iron_sword', 1],      size: 2, pattern: ['I', 'I', 'S'],      keys: { I: 'iron_ingot', S: 'stick' } },
  { out: ['diamond_sword', 1],   size: 2, pattern: ['D', 'D', 'S'],      keys: { D: 'diamond', S: 'stick' } },

  { out: ['wood_axe', 1],        size: 3, pattern: ['PP ', 'PS ', ' S '], keys: { P: 'planks', S: 'stick' } },
  { out: ['stone_axe', 1],       size: 3, pattern: ['CC ', 'CS ', ' S '], keys: { C: 'cobblestone', S: 'stick' } },
  { out: ['wood_shovel', 1],     size: 2, pattern: ['P', 'S', 'S'],      keys: { P: 'planks', S: 'stick' } },
  { out: ['stone_shovel', 1],    size: 2, pattern: ['C', 'S', 'S'],      keys: { C: 'cobblestone', S: 'stick' } },
];
