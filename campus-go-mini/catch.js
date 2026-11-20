// catch.js — aturan permainan: jarak, makhluk terdekat, dan syarat tangkap
// Fungsi murni (tidak bergantung Three.js / browser) agar mudah diuji: node tests/run-tests.mjs

/** Jarak mendatar (abaikan tinggi HP) antara dua titik {x, y, z} dalam meter. */
export function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Cari makhluk aktif terdekat dari posisi pemain.
 * creatures: [{ position: {x,y,z}, ... }]
 * @returns {{ creature, distance } | null}
 */
export function nearestCreature(creatures, playerPos) {
  let best = null;
  for (const c of creatures) {
    const d = horizontalDistance(playerPos, c.position);
    if (!best || d < best.distance) best = { creature: c, distance: d };
  }
  return best;
}

/** Tangkap hanya berhasil jika jarak <= radius. */
export function evaluateCatch(distance, radius) {
  if (!Number.isFinite(distance)) return { ok: false, reason: 'unknown' };
  if (distance <= radius) return { ok: true, reason: 'in-range' };
  return { ok: false, reason: 'too-far', missing: distance - radius };
}

/** Teks jarak untuk HUD: "8m" jika jauh, "1.6m" jika dekat (biar terasa saat mendekati radius). */
export function formatDistance(d) {
  if (!Number.isFinite(d)) return '';
  return d >= 3 ? `${Math.round(d)}m` : `${d.toFixed(1)}m`;
}

/** Undi apakah makhluk muncul (dipakai saat respawn). rand bisa diganti untuk pengujian. */
export function rollSpawn(spawnChance, rand = Math.random) {
  return rand() < spawnChance;
}
