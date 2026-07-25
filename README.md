# 🧱 Blockcraft — Minecraft Clone Berbasis Web

Voxel sandbox game yang berjalan langsung di browser. Dibangun dengan **Three.js**, tanpa build step dan tanpa dependency lokal.

![status](https://img.shields.io/badge/status-playable-brightgreen) ![tech](https://img.shields.io/badge/three.js-r160-blue) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

## ✨ Fitur

- **Terrain procedural** — perbukitan dari value noise + fBm (4 oktaf), pantai berpasir, danau, dan pohon yang tumbuh acak
- **Voxel engine dengan chunk mesh** — dunia 96×96 dibagi jadi chunk 16×16; hanya sisi blok yang terlihat yang dirender (face culling), dan hanya chunk terdampak yang di-rebuild saat blok berubah
- **Break & place block** — raycast voxel presisi dengan algoritma Amanatides & Woo, bukan raycast mesh
- **Physics + collision** — gravitasi, lompat, sprint, AABB collision per sumbu
- **Mode terbang** — tekan `F` untuk creative fly
- **Texture atlas prosedural** — semua tekstur digambar lewat Canvas API saat runtime, jadi repo ini tidak butuh satu pun file gambar
- **Hotbar 8 slot** — grass, dirt, stone, sand, log, leaves, planks, brick
- **Auto-save** — setiap perubahan blok tersimpan di `localStorage`

## 🎮 Kontrol

| Tombol | Aksi |
| --- | --- |
| `W` `A` `S` `D` | Jalan |
| `Spasi` | Lompat (naik saat mode fly) |
| `Shift` | Lari (turun saat mode fly) |
| Klik kiri | Hancurkan blok |
| Klik kanan | Pasang blok |
| `1` – `8` / scroll | Pilih blok di hotbar |
| `F` | Toggle mode terbang |
| `R` | Reset dunia |
| `Esc` | Lepas pointer lock |

## 🚀 Menjalankan Secara Lokal

Karena memakai ES modules, file harus disajikan lewat HTTP server (tidak bisa dibuka langsung via `file://`):

```bash
git clone https://github.com/muzakkkiii/blockcraft-web.git
cd blockcraft-web

# pilih salah satu
python3 -m http.server 8080
npx serve .
```

Lalu buka <http://localhost:8080>.

## 🌐 Deploy ke GitHub Pages

Aktifkan lewat **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `root`**.

Setelah aktif, game bisa dimainkan di `https://muzakkkiii.github.io/blockcraft-web/`.

## 📁 Struktur

```
blockcraft-web/
├── index.html      # markup, HUD, overlay menu, importmap Three.js
├── style.css       # HUD, crosshair, hotbar, menu
└── src/
    └── main.js     # seluruh engine: atlas, noise, chunk mesh,
                    # raycast voxel, physics, kontrol, game loop
```

## 🔧 Menambah Blok Baru

1. Gambar tile baru di `buildAtlasCanvas()` memakai `paintTile(g, index, warnaDasar, warnaBintik, extra)`
2. Daftarkan di objek `BLOCKS` dengan format `tiles: [top, bottom, side]`
3. Tambahkan id-nya ke array `HOTBAR`

## 🗺️ Ide Pengembangan

- [ ] Ambient occlusion per-vertex
- [ ] Greedy meshing untuk menekan jumlah tris
- [ ] Chunk streaming / dunia tak terbatas
- [ ] Siklus siang–malam
- [ ] Inventory penuh & crafting
- [ ] Multiplayer via WebSocket

## 📄 Lisensi

MIT. Proyek belajar, tidak berafiliasi dengan Mojang atau Microsoft.
