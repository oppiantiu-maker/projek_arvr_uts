# Test Case

Uji otomatis (TC-01 s.d. TC-04 ikut diuji di sini): `node tests/run-tests.mjs`
Uji manual dilakukan di HP. Isi kolom Hasil dengan ✅ / ❌ dan catatan.

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| TC-01 | Tangkap di luar radius | Berdiri > 2 m dari makhluk, tekan Tangkap | Gagal, toast "Terlalu jauh (x m)", suara gagal, getar panjang, inventori tetap | |
| TC-02 | Tangkap di dalam radius | Dekati sampai ≤ 2 m (tombol hijau), tekan Tangkap | Berhasil, animasi Catch, suara, getar, inventori +1 | |
| TC-03 | Ketuk makhluk langsung | Dalam radius, ketuk model makhluk di layar | Sama dengan TC-02 (raycast) | |
| TC-04 | Inventori tersimpan | Tangkap 1 makhluk, muat ulang halaman, buka Inventori | Jumlah tetap | |
| TC-05 | Izin kamera ditolak | Tolak izin kamera saat Mulai AR / Mode Simulasi | Pesan jelas cara mengizinkan kamera, aplikasi tidak macet | |
| TC-06 | Perangkat tanpa WebXR | Buka di iPhone / laptop | Tombol "AR tidak didukung", Mode Simulasi bisa dipakai | |
| TC-07 | Deteksi lantai | Mulai AR, arahkan ke lantai | Cincin hijau muncul ≤ 10 detik di lantai bertekstur | |
| TC-08 | Jarak HUD | Berjalan mendekati makhluk | Angka jarak berkurang sesuai langkah (±0,5 m) | |
| TC-09 | Respawn | Tangkap robot, tunggu 15 detik | Robot muncul lagi dengan suara dan toast | |
| TC-10 | Makhluk langka | Tangkap Buku Terbang beberapa kali | Kadang tidak muncul lagi (peluang 50%) | |
| TC-11 | Data JSON rusak | Ubah `creatures.json` menjadi tidak valid | Layar error menyebut field yang salah | |
| TC-12 | Hapus inventori | Inventori → Hapus semua → OK | Inventori kosong, jumlah (0) | |
| TC-13 | Keluar dari AR | Tekan ✕ atau tombol kembali HP | Kembali ke layar awal tanpa error | |
