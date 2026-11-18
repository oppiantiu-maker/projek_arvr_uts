# Tahapan Pengerjaan Campus Go Mini (Topik 5)

Panduan ini mengikuti jadwal modul (Pertemuan 3–8). Semua kode, aset, dan dokumen sudah ada di repository ini. Tugas kelompok sekarang: **memahami, menjalankan, menguji, menyesuaikan, dan mendokumentasikan**. Ingat, tanya jawab UTS dilakukan per orang dan setiap anggota wajib punya commit.

---

## Tahap 0. Persiapan (sekali saja)

1. Pasang **Git**, **VS Code**, ekstensi **Live Server**, dan **Node.js** (untuk menjalankan uji).
2. Ketua (peran 1) membuat repository GitHub bernama `campus-go-mini` (Public), lalu mengundang semua anggota sebagai *collaborator*.
3. Ketua mengekstrak isi zip ke `D:\campus_go_mini` dan melakukan push pertama:
   ```bash
   cd D:\campus_go_mini
   git init
   git add README.md index.html .nojekyll
   git commit -m "Inisialisasi proyek Campus Go Mini"
   git branch -M main
   git remote add origin https://github.com/<username>/campus-go-mini.git
   git push -u origin main
   ```
   Folder lain **jangan di-commit oleh ketua**. Biarkan tiap pemilik peran yang meng-commit bagiannya (lihat tabel di bawah) supaya riwayat commit merata.
4. Anggota lain melakukan `git clone`, lalu bekerja di branch masing-masing:
   ```bash
   git clone https://github.com/<username>/campus-go-mini.git
   cd campus-go-mini
   git checkout -b <nama>-<fitur>     # contoh: rina-inventori
   # ... salin/ubah file bagianmu ...
   git add <file-bagianmu>
   git commit -m "Tambah modul inventori localStorage"
   git push -u origin rina-inventori
   ```
   Lalu buat **Pull Request** di GitHub. Ketua me-review dan melakukan *merge*.

### Kepemilikan file per peran

| Peran | File yang di-commit & wajib dikuasai |
|---|---|
| 1. Project Manager & Integrator | `index.html`, `js/main.js`, `.nojekyll`, pengaturan GitHub Pages, `docs/qr.png` |
| 2. Engineer Tracking | `js/ar.js`, `js/catch.js`, aturan spawn di `js/spawn.js` (fungsi `spawnAll`, `spawnPosition`) |
| 3. Aset 3D & Animasi | `assets/models/*`, `assets/img/*`, `tools/make_glb.py`, `tools/make_images.py`, `docs/asset-license.md` |
| 4. Interaksi & UI/UX | `css/style.css`, `js/ui.js`, `js/sim.js`, `js/feedback.js`, `assets/sfx/*`, `tools/make_sfx.py` |
| 5. Data & Persistence | `data/creatures.json`, `js/data.js`, `js/inventory.js` |
| 6. QA & Dokumentasi | `tests/run-tests.mjs`, `docs/device-matrix.md`, `docs/test-cases.md`, `docs/issue-log.md`, `docs/project-brief.md`, `docs/flow-diagram.*`, video demo |

---

## Pertemuan 3: fondasi, mode sentuh, project brief

**Checkpoint:** project brief satu halaman dan repository aktif.

- Peran 1: repository dan push awal (Tahap 0), papan tugas (GitHub Projects: kolom To Do / Doing / Done).
- Peran 6: lengkapi `docs/project-brief.md` (nama kelompok, anggota), lalu commit.
- Peran 4: commit `css/style.css`, `js/ui.js`, `js/sim.js`. Coba di laptop: Live Server, lalu **Mode Simulasi**. Uji ketuk (tangkap), seret (lihat sekeliling), dan cubit (zoom, di HP).
- Semua: baca `README.md` dan diagram `docs/flow-diagram.png`.

## Pertemuan 4: tracking berjalan di HTTPS

**Checkpoint:** tracking build dan `docs/device-matrix.md`.

1. Peran 2 meng-commit `js/ar.js` dan `js/catch.js`.
2. Peran 1 mengaktifkan GitHub Pages: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**. Tunggu 1–2 menit. Tautannya `https://<username>.github.io/campus-go-mini/`.
3. Buka tautan di **Chrome Android**. Jika muncul "AR tidak didukung", pasang/perbarui **Google Play Services for AR** dari Play Store.
4. Tekan Mulai AR, arahkan ke lantai sampai cincin hijau muncul, lalu ketuk.
5. Peran 6 mengisi `docs/device-matrix.md` untuk minimal 1 Android dan 1 iPhone (iPhone diperkirakan ❌ untuk AR, ✅ untuk Mode Simulasi; tulis apa adanya).

**Debug di HP:** sambungkan HP ke laptop dengan kabel USB (aktifkan *USB debugging*), lalu buka `chrome://inspect` di Chrome laptop untuk melihat Console dari HP.

## Pertemuan 5: model GLB beranimasi, HUD, alur

**Checkpoint:** video interaksi 30–60 detik dan diagram alur.

- Peran 3 meng-commit `assets/models/`, `assets/img/`, dan `tools/`. Model dibuat dengan skrip (`python tools/make_glb.py`). Untuk dimodifikasi di **Blender**: File → Import → glTF 2.0 → edit → Export → **glTF Binary (.glb)**. Nama klip animasi harus tetap `Idle` dan `Catch`, dan ukuran file sebaiknya di bawah 2 MB.
- Peran 2 meng-commit `js/spawn.js`.
- Peran 6 merekam layar HP: mencari lantai → makhluk muncul → mendekat → tangkap. Commit `docs/flow-diagram.png` dan `.mmd`.

## Pertemuan 6: data JSON dan persistence

**Checkpoint:** data module dan tabel lisensi aset.

- Peran 5 meng-commit `data/creatures.json`, `js/data.js`, dan `js/inventory.js`.
- Coba ubah `creatures.json`: misalnya `"catchRadius": 1.5` atau posisi spawn `"z": -5`, lalu lihat efeknya tanpa mengubah kode.
- Coba isi JSON yang salah (hapus `spawn`). Aplikasi harus menampilkan error yang menyebut field-nya (TC-11).
- Peran 3 memeriksa `docs/asset-license.md`.

## Pertemuan 7: integrasi (Integration v1)

**Checkpoint:** Integration v1.

- Peran 4 meng-commit `js/feedback.js`, `assets/sfx/`, dan `tools/make_sfx.py` (suara dan getar).
- Peran 6 meng-commit `tests/run-tests.mjs` lalu menjalankan `node tests/run-tests.mjs`. Semua uji harus lulus.
- **Uji lapangan semua anggota** (TC-01 sampai TC-13 di `docs/test-cases.md`) di halaman kampus. Catat masalah di `docs/issue-log.md`.
- Ruang sempit? Tambahkan `?skala=0.3` di URL agar makhluk muncul lebih dekat.

## Pertemuan 8: UTS (demo v0.5)

1. Peran 1 membuat kode QR dari tautan GitHub Pages (pakai situs pembuat QR apa saja), menyimpannya sebagai `docs/qr.png`, lalu commit.
2. Peran 6 merekam **video demo cadangan 1–2 menit** di HP, mengunggahnya, dan mencantumkan tautannya di README.
3. Lengkapi tabel Tim di `README.md`.
4. Jalankan **Daftar Periksa Sebelum Demo** (bagian 9 modul):
   - [ ] Tautan HTTPS terbuka di HP lain yang belum pernah dipakai
   - [ ] Pesan izin kamera ditolak jelas (TC-05)
   - [ ] Model GLB tampil dan animasi berjalan
   - [ ] Inventori tetap ada setelah reload (TC-04)
   - [ ] Matriks perangkat dan tabel lisensi terisi
   - [ ] Video cadangan siap
   - [ ] Setiap anggota bisa menjelaskan arsitektur
5. Isi formulir penilaian sejawat secara pribadi.

### Skenario demo 10 menit
1. (1 mnt) Jelaskan konsep dan keputusan tanpa GPS (WebXR, satuan meter).
2. (3 mnt) Demo AR: pindai lantai → makhluk muncul → tekan Tangkap dari jauh (**gagal**) → berjalan mendekat → tangkap (**berhasil**).
3. (1 mnt) Buka Inventori → reload halaman → inventori masih ada.
4. (2 mnt) Tunjukkan Mode Simulasi di iPhone/laptop dan matriks perangkat.
5. (2 mnt) Tunjukkan `creatures.json` (ubah radius secara langsung) dan `node tests/run-tests.mjs`.
6. (1 mnt) Rencana UAS: makhluk ke-3, misi, skor.

---

## Arsitektur singkat (bahan tanya jawab)

```
main.js ── memuat ─► data.js (creatures.json, validasi)
   │
   ├─ mode AR ───► ar.js   : WebXR session, hit-test lantai, posisi HP (meter), event "select"
   ├─ mode Sim ──► sim.js  : kamera getUserMedia, seret/cubit/ketuk, tombol Maju
   │
   ├─ spawn.js   : GLTFLoader → clone model → AnimationMixer (Idle/Catch) → posisi spawn → respawn
   ├─ catch.js   : horizontalDistance, nearestCreature, evaluateCatch (jarak ≤ radius)
   ├─ inventory.js : localStorage "campusgo.inventory.v1"
   ├─ feedback.js  : Audio + navigator.vibrate
   └─ ui.js        : layar, HUD, toast, panel inventori
```

**Pertanyaan yang mungkin ditanyakan dosen:**

- *Kenapa tidak pakai GPS?* GPS di HP meleset 5–15 m, padahal radius tangkap 2 m. WebXR mengukur pergerakan HP dari kamera dan sensor dalam meter, jadi lebih akurat untuk jarak dekat. Lokasi juga tidak dipakai sekadar penanda tempat.
- *Bagaimana jarak dihitung?* `frame.getViewerPose()` memberi posisi HP (x, y, z) dalam meter. Jarak ke makhluk dihitung secara mendatar: `Math.hypot(dx, dz)` (`catch.js`).
- *Bagaimana posisi spawn ditentukan?* Titik lantai hasil hit-test menjadi titik asal, lalu arah hadap HP menjadi "depan". Posisi = asal + kanan·x + depan·(−z) (`spawn.js → spawnPosition`).
- *Bagaimana ketuk mendeteksi makhluk?* Raycasting: sinar dari titik ketuk ke arah kamera, lalu `raycaster.intersectObjects()` pada model makhluk.
- *Bagaimana animasi diputar?* `AnimationMixer` per makhluk. Klip `Idle` diputar terus-menerus, sedangkan klip `Catch` diputar sekali (`LoopOnce`, `clampWhenFinished`).
- *Di mana data disimpan?* Hanya di `localStorage` perangkat, tidak dikirim ke server (sesuai aturan privasi modul).
- *Bagaimana jika iPhone?* Safari belum mendukung WebXR, jadi pengguna diarahkan ke Mode Simulasi. Hasilnya dicatat di matriks perangkat.

## Menuju UAS (Level C), ide pengembangan
- Makhluk ke-3: tambah model di `tools/make_glb.py` atau Blender, lalu tambahkan entrinya di `creatures.json`.
- Misi sederhana (misalnya "Tangkap 3 Robot") dan skor yang tersimpan.
- Indikator cooldown di HUD dan panah arah ke makhluk terdekat.
