# Project Brief: Campus Go Mini

**Mata kuliah:** Prak. Augmented dan Virtual Reality (ITIA730591), FIKTI UMSU
**Topik:** 5. Campus Go Mini (Permainan Menangkap Makhluk)
**Target UAS:** Level C
**Kelompok:** … | **Repository:** …

## Konsep
Permainan AR di HP untuk menangkap makhluk orisinal bertema kampus. Makhluk muncul di lantai di sekitar pemain. Pemain harus berjalan mendekat, dan tangkapan hanya berhasil dalam radius tertentu. Semua tangkapan tersimpan di inventori perangkat.

## Keputusan teknis: tanpa GPS
Dosen mengingatkan agar lokasi tidak dipakai hanya untuk menandai tempat (seperti Topik 3). Kelompok memutuskan **tidak memakai GPS**. Sebagai gantinya dipakai **WebXR hit-test (Three.js)**:
- WebXR mengukur posisi HP dan lantai dalam meter nyata, jadi jarak di HUD dan aturan radius tetap berlaku.
- Koordinat spawn di `creatures.json` berupa meter relatif terhadap titik awal pemain.
- Akurasi lebih baik daripada GPS (GPS meleset 5–15 m, sedangkan radius tangkap hanya 2 m).
- Konsekuensi: iPhone (Safari) tidak mendukung WebXR, jadi disediakan Mode Simulasi dan hasilnya dicatat di matriks perangkat.

## Aturan permainan
1. Pindai lantai, lalu ketuk untuk menetapkan titik awal. Makhluk muncul sesuai `creatures.json`.
2. HUD menampilkan makhluk terdekat dan jaraknya.
3. Tangkap (ketuk makhluk atau tombol): **jarak ≤ 2 m berhasil, jarak > 2 m gagal**.
4. Saat berhasil: animasi Catch, suara, getar, dan inventori +1.
5. Makhluk muncul lagi setelah cooldown. Makhluk langka hanya punya peluang 50% untuk muncul lagi.

## Makhluk (orisinal, dibuat kelompok)
| Makhluk | Kelangkaan | Animasi |
|---|---|---|
| Robot Kampus | Biasa | Idle: bergoyang, berkedip · Catch: angkat tangan, berputar, mengecil |
| Buku Terbang | Langka | Idle: mengepakkan sampul · Catch: menutup, berputar, mengecil |
| (makhluk ke-3, target UAS) | | |

## Teknologi
Three.js 0.175.0 (WebXR, GLTFLoader, Raycaster, AnimationMixer), localStorage, GitHub Pages (HTTPS).

## Rencana menuju UAS (Level C)
Makhluk ke-3, misi sederhana ("tangkap 3 robot"), skor, dan cooldown per makhluk yang terlihat di HUD.
