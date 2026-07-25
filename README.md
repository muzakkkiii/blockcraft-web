# 🧱 Blockcraft — Minecraft Clone Berbasis Web (v2)

Voxel sandbox yang berjalan langsung di browser — **komputer, HP, maupun tablet**. Dibangun dengan **Three.js**, tanpa build step, tanpa dependency lokal, tanpa satu pun file gambar.

🎮 **Mainkan:** <https://muzakkkiii.github.io/blockcraft-web/>

![status](https://img.shields.io/badge/status-playable-brightgreen) ![tech](https://img.shields.io/badge/three.js-r160-blue) ![mobile](https://img.shields.io/badge/mobile-supported-orange) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✨ Fitur

### Dunia
- **Dunia tak terbatas** dengan chunk streaming — chunk dibuat & dibuang otomatis mengikuti pemain
- **6 bioma**: Plains, Forest, Desert, Mountain, Snowy, Beach — tiap bioma punya blok permukaan, pohon, dan kaktus sendiri
- **Gua & terowongan** dari 3D noise, **danau/laut** dengan air tembus pandang
- **4 jenis bijih berlapis kedalaman**: batu bara, besi, emas, dan berlian (makin dalam makin langka)
- **Bedrock** di dasar dunia yang tidak bisa dihancurkan
- **Siklus siang & malam** penuh — matahari, bulan, bintang, warna langit dan kabut yang berubah halus
- **Obor menyala** memberi cahaya nyata di gua saat malam
- **Blok gravitasi** — pasir dan kerikil jatuh saat penyangganya hilang

### Bertahan Hidup
- **Nyawa 20 (10 hati)**, **lapar 20**, **saturasi**, dan **oksigen** saat menyelam
- Kerusakan karena **jatuh, tenggelam, kelaparan, kaktus, dan mob**
- **Makan** untuk memulihkan lapar; nyawa beregenerasi saat kenyang
- **Layar kematian & respawn**, plus penyimpanan otomatis dunia + inventori
- **Berenang**, **mengendap** (tidak jatuh dari tepi), **berlari**, dan **mode terbang**

### Menambang & Membangun
- **Sistem tier alat**: kayu → batu → besi → berlian, masing-masing punya kecepatan & level
- Blok tertentu **hanya menghasilkan drop dengan alat yang tepat** (mis. berlian butuh beliung besi)
- **Progres menambang** dengan animasi retakan dan suara
- **29 jenis blok** + puluhan item, semuanya dengan tekstur prosedural
- Raycast voxel presisi (algoritma Amanatides & Woo)

### Crafting
- **Inventori 36 slot + hotbar 9 slot**, drag & drop antar slot
- **Grid crafting 2×2** (tangan) dan **3×3** (meja kerja)
- **Buku resep** yang menandai resep mana yang bahannya sudah cukup
- **Tungku** dengan bahan bakar, api menyala, dan progres peleburan real-time (tetap berjalan walau UI ditutup)
- Resep lengkap: papan, tongkat, obor, meja kerja, tungku, semua beliung/pedang/kapak/sekop, blok penyimpanan, kaca, batu bata, roti, dan lainnya

### Mob
- **Babi, domba, sapi** (pasif) dan **zombie** (hostile, muncul saat malam & mengejar pemain)
- Mob berjalan, melompat, mengeluarkan suara, terkena knockback, dan **menjatuhkan item** saat dikalahkan

### Audio
- Semua efek suara dibuat dengan **Web Audio API** — langkah kaki, menggali, memecah, memasang, air, makan, crafting, mob, dan tungku

---

## 📱 Dukungan HP & Tablet

UI otomatis beradaptasi saat perangkat sentuh terdeteksi:

- **Joystick virtual** untuk bergerak (dorong penuh = berlari)
- **Geser layar** untuk melihat sekeliling
- **Ketuk layar** untuk memasang blok / menyerang / membuka meja kerja & tungku
- **Tombol ⛏ tahan** untuk menambang terus-menerus
- Tombol **lompat**, **mengendap**, **inventori**, dan **pengaturan** di layar
- Layout responsif untuk potret & lanskap, menghormati **safe-area** (poni / gestur bar)
- **Jarak render bisa diatur** agar tetap lancar di perangkat kelas menengah (default lebih rendah di HP)

---

## 🎮 Kontrol

### Komputer

| Tombol | Aksi |
| --- | --- |
| `W` `A` `S` `D` | Jalan |
| `Spasi` | Lompat / naik saat terbang |
| `Shift` | Lari / turun saat terbang |
| `Ctrl` | Mengendap |
| Klik kiri (tahan) | Menambang / menyerang |
| Klik kanan | Pasang blok, makan, buka meja kerja / tungku |
| `E` | Inventori & crafting |
| `1` – `9` / scroll | Pilih slot hotbar |
| `F` | Mode terbang |
| `M` | Bisukan suara |
| `Esc` | Tutup panel / lepas pointer lock |

### HP & Tablet

| Kontrol | Aksi |
| --- | --- |
| Joystick kiri | Jalan / lari |
| Geser layar | Melihat sekeliling |
| Ketuk layar | Pasang / serang / buka |
| Tombol ⛏ (tahan) | Menambang |
| Tombol ⬆ / ⬇ | Lompat / mengendap |
| Ikon tas | Inventori & crafting |
| Ikon ⚙ | Pengaturan, sensitivitas, jarak render |

---

## 🚀 Menjalankan Secara Lokal

Karena memakai ES modules, file harus disajikan lewat HTTP server (tidak bisa `file://`):

```bash
git clone https://github.com/muzakkkiii/blockcraft-web.git
cd blockcraft-web

# pilih salah satu
python3 -m http.server 8080
npx serve .
```

Lalu buka <http://localhost:8080>.

---

## 📁 Struktur Modul

```
blockcraft-web/
├── index.html        # importmap Three.js + layar mulai
├── style.css         # HUD, inventori, tungku, kontrol sentuh, responsif
└── src/
    ├── config.js     # konstanta, definisi blok, item, resep, peleburan
    ├── atlas.js      # texture atlas prosedural (Canvas API)
    ├── mesher.js     # pembentuk geometri chunk + ambient occlusion
    ├── world.js      # noise, bioma, gua, bijih, chunk, simpan/muat dunia
    ├── player.js     # fisika, tabrakan, nyawa, lapar, oksigen, inventori
    ├── crafting.js   # pencocokan resep & logika tungku
    ├── mobs.js       # mob pasif & hostile, AI, drop
    ├── audio.js      # efek suara Web Audio API
    ├── ui.js         # HUD, hotbar, inventori, tungku, kontrol sentuh
    └── main.js       # render, chunk streaming, siang-malam, input, game loop
```

---

## 🗺️ Belum Ada / Ide Berikutnya

- [ ] Redstone & mekanisme logika
- [ ] Dimensi Nether & End
- [ ] Multiplayer via WebSocket
- [ ] Enchanting, potion, dan XP
- [ ] Bertani (menanam & memanen)
- [ ] Greedy meshing untuk performa lebih tinggi

## 📄 Lisensi

MIT. Proyek belajar, tidak berafiliasi dengan Mojang atau Microsoft.
