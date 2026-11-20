# Campus Go Mini

Miniproject UTS Prak. Augmented dan Virtual Reality (ITIA730591), Program Studi Teknologi Informasi, FIKTI UMSU, Topik 5.

Campus Go Mini adalah permainan AR berbasis web untuk menangkap makhluk orisinal di sekitar kampus. Makhluk muncul di lantai di sekitar pemain. Pemain harus **berjalan mendekat** dan baru bisa menangkapnya jika jaraknya ≤ radius tangkap. Hasil tangkapan disimpan di inventori pada perangkat.

> **Catatan keputusan teknis:** proyek ini **tidak memakai GPS**. Jarak diukur dengan **WebXR** (Three.js), yang memetakan lantai lewat kamera dalam satuan meter nyata. Koordinat spawn di `creatures.json` berupa posisi lokal (meter) relatif terhadap titik awal pemain.

## Tautan

- Aplikasi (HTTPS): `https://<username>.github.io/campus-go-mini/` ← ganti setelah deploy
- Kode QR: `docs/qr.png` ← buat setelah tautan aktif
- Video demo: `<tautan video>`

## Fitur

| Fitur | Status |
|---|---|
| 2 makhluk orisinal (Robot Kampus, Buku Terbang) dengan animasi Idle dan Catch | ✅ wajib |
| Spawn dari koordinat di `data/creatures.json` | ✅ wajib |
| Tangkap hanya berhasil dalam radius, dengan animasi, suara, dan getar | ✅ wajib |
| Inventori tersimpan (localStorage) dan bisa dilihat | ✅ wajib |
| Respawn dengan cooldown (`respawnSeconds`) | ✅ pilihan |
| Makhluk langka (`rarity`, `spawnChance`) | ✅ pilihan |
| Mode Simulasi untuk iPhone/laptop (giroskop + deteksi langkah, ketuk) | ✅ tambahan |
| Penanganan izin kamera ditolak dan perangkat tanpa AR | ✅ |

## Cara bermain

1. Buka tautan di **Chrome Android**, lalu tekan **Mulai AR** dan izinkan kamera.
2. Arahkan kamera ke lantai sampai **cincin hijau** muncul, lalu ketuk layar.
3. Makhluk muncul beberapa meter di depan. HUD menampilkan nama dan jaraknya.
4. Berjalanlah mendekat. Tombol **Tangkap!** berubah hijau saat jarak ≤ 2 m.
5. Ketuk tombol atau ketuk makhluknya. Hasil tangkapan masuk ke **Inventori**.

**Mode Simulasi** (iPhone, laptop, atau HP tanpa WebXR): makhluk diam di tempat seperti Pokémon GO. Putar HP untuk menoleh (giroskop) dan berjalanlah sungguhan untuk mendekat (langkah dideteksi akselerometer, ±0,7 m per langkah); makin dekat, makhluk makin besar. Di laptop tanpa sensor: seret untuk menoleh, ↑/↓ untuk berjalan (khusus uji).

Parameter uji: tambahkan `?skala=0.3` di akhir URL agar semua jarak spawn dikali 0,3 (untuk uji di ruangan sempit).

## Cara menjalankan

**Di laptop (Mode Simulasi):**
1. Buka folder di VS Code, pasang ekstensi **Live Server**.
2. Klik kanan `index.html`, lalu pilih **Open with Live Server**.
3. Pilih **Mode Simulasi**. Halaman harus dibuka lewat server; membuka `index.html` dengan klik ganda akan gagal memuat JSON dan model.

**Di HP (Mode AR):** butuh HTTPS. Push ke GitHub, lalu aktifkan GitHub Pages (Settings → Pages → Branch `main` / root). Buka tautannya di Chrome Android.

**Uji otomatis aturan permainan** (tanpa browser):
```
node tests/run-tests.mjs
```

**Membuat ulang aset** (butuh Python 3 + numpy, matplotlib, Pillow; ffmpeg untuk MP3):
```
python tools/make_glb.py
python tools/make_sfx.py
python tools/make_images.py
```

## Struktur folder

```
campus-go-mini/
├── index.html              halaman utama
├── css/style.css           tampilan HUD dan panel
├── js/
│   ├── main.js             titik awal, menyambungkan semua modul
│   ├── data.js             memuat + memvalidasi creatures.json
│   ├── ar.js               sesi WebXR: hit-test lantai, posisi HP, ketukan
│   ├── sim.js              Mode Simulasi (kamera biasa, giroskop + deteksi langkah)
│   ├── spawn.js            memuat GLB, memunculkan makhluk, animasi, respawn
│   ├── catch.js            aturan jarak dan radius (fungsi murni, teruji)
│   ├── inventory.js        inventori di localStorage
│   ├── feedback.js         suara dan getar
│   └── ui.js               layar, HUD, toast, panel inventori
├── data/creatures.json     data makhluk (bukan ditulis di kode)
├── assets/
│   ├── models/             robot.glb, buku.glb
│   ├── sfx/                catch.mp3, fail.mp3, spawn.mp3
│   └── img/                thumbnail inventori dan ikon
├── docs/                   brief, matriks perangkat, lisensi, alur, uji, issue log, tahapan
├── tests/run-tests.mjs     uji otomatis
└── tools/                  skrip pembuat aset
```

## Format `creatures.json`

| Field | Arti |
|---|---|
| `catchRadius` | jarak maksimal tangkap (meter) |
| `distanceScale` | pengali semua jarak spawn |
| `spawnJitter` | acakan posisi spawn ± meter |
| `id`, `name`, `description` | identitas makhluk |
| `model`, `thumbnail` | path file GLB dan gambar inventori |
| `idleClip`, `catchClip` | nama klip animasi di dalam GLB |
| `spawn.x`, `spawn.z` | posisi spawn: x = kanan (+), z = depan (−), dalam meter dari titik awal |
| `rarity`, `spawnChance` | `common`/`rare`, peluang muncul saat respawn (0–1) |
| `respawnSeconds` | jeda sebelum makhluk muncul lagi |

## Batasan yang diketahui

- **WebXR AR hanya berjalan di Chrome Android** dengan Google Play Services for AR. Safari di iPhone tidak mendukung WebXR, jadi iPhone memakai Mode Simulasi. Hasilnya dicatat di `docs/device-matrix.md`.
- Deteksi lantai sulit pada lantai polos mengkilap atau saat gelap. Lantai bertekstur (paving, keramik bermotif) lebih stabil.
- Tracking WebXR bisa bergeser (*drift*) jika pemain berjalan jauh atau bergerak terlalu cepat.
- Three.js dimuat dari CDN, jadi butuh internet saat pertama dibuka.
- `navigator.vibrate` tidak tersedia di iPhone, sehingga getar tidak berjalan di sana.

## Tim

| No | Nama | NPM | Peran |
|---|---|---|---|
| 1 | | | Project Manager dan Integrator |
| 2 | | | Engineer Tracking |
| 3 | | | Aset 3D dan Animasi |
| 4 | | | Interaksi dan UI/UX |
| 5 | | | Data dan Persistence |
| 6 | | | QA dan Dokumentasi |
