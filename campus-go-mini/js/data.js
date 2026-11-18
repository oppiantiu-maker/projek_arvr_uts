// data.js — memuat dan memvalidasi data/creatures.json
// Peran: Data dan Persistence. Data makhluk TIDAK ditulis di kode, semuanya dari JSON.

const RARITIES = ['common', 'rare'];

/** Ambil creatures.json lalu validasi. Melempar Error berisi daftar masalah jika tidak valid. */
export async function loadConfig(url = 'data/creatures.json') {
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (err) {
    throw new Error(`Tidak bisa mengambil ${url}. Periksa koneksi internet.`);
  }
  if (!res.ok) throw new Error(`File ${url} tidak ditemukan (HTTP ${res.status}).`);

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error(`Isi ${url} bukan JSON yang valid: ${err.message}`);
  }
  return validateConfig(json);
}

/** Validasi + isi nilai bawaan. Fungsi murni (tanpa browser), jadi bisa diuji di Node. */
export function validateConfig(json) {
  const errors = [];
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  if (!json || typeof json !== 'object') {
    throw new Error('creatures.json harus berupa objek.');
  }

  const config = {
    catchRadius: json.catchRadius ?? 2,
    distanceScale: json.distanceScale ?? 1,
    spawnJitter: json.spawnJitter ?? 0,
    creatures: [],
  };

  if (!isNum(config.catchRadius) || config.catchRadius <= 0) errors.push('catchRadius harus angka > 0.');
  if (!isNum(config.distanceScale) || config.distanceScale <= 0) errors.push('distanceScale harus angka > 0.');
  if (!isNum(config.spawnJitter) || config.spawnJitter < 0) errors.push('spawnJitter harus angka >= 0.');

  if (!Array.isArray(json.creatures) || json.creatures.length < 2) {
    errors.push('creatures harus berisi minimal 2 makhluk (syarat v0.5).');
  }

  const ids = new Set();
  (json.creatures || []).forEach((c, i) => {
    const where = `creatures[${i}]${c && c.id ? ` (${c.id})` : ''}`;
    if (!c || typeof c !== 'object') { errors.push(`${where} bukan objek.`); return; }
    if (typeof c.id !== 'string' || !c.id) errors.push(`${where}: id wajib diisi.`);
    else if (ids.has(c.id)) errors.push(`${where}: id "${c.id}" dipakai dua kali.`);
    else ids.add(c.id);
    if (typeof c.name !== 'string' || !c.name) errors.push(`${where}: name wajib diisi.`);
    if (typeof c.model !== 'string' || !c.model.toLowerCase().endsWith('.glb')) errors.push(`${where}: model harus path file .glb.`);
    if (typeof c.idleClip !== 'string' || !c.idleClip) errors.push(`${where}: idleClip wajib diisi.`);
    if (typeof c.catchClip !== 'string' || !c.catchClip) errors.push(`${where}: catchClip wajib diisi.`);
    if (!c.spawn || !isNum(c.spawn.x) || !isNum(c.spawn.z)) errors.push(`${where}: spawn.x dan spawn.z wajib angka (meter).`);

    const rarity = c.rarity ?? 'common';
    if (!RARITIES.includes(rarity)) errors.push(`${where}: rarity harus salah satu dari ${RARITIES.join(', ')}.`);
    const spawnChance = c.spawnChance ?? 1;
    if (!isNum(spawnChance) || spawnChance < 0 || spawnChance > 1) errors.push(`${where}: spawnChance harus 0–1.`);
    const respawnSeconds = c.respawnSeconds ?? 15;
    if (!isNum(respawnSeconds) || respawnSeconds < 0) errors.push(`${where}: respawnSeconds harus >= 0.`);
    const scale = c.scale ?? 1;
    if (!isNum(scale) || scale <= 0) errors.push(`${where}: scale harus > 0.`);

    config.creatures.push({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      model: c.model,
      thumbnail: c.thumbnail ?? '',
      idleClip: c.idleClip,
      catchClip: c.catchClip,
      scale,
      rarity,
      spawn: { x: c.spawn?.x, z: c.spawn?.z },
      spawnChance,
      respawnSeconds,
    });
  });

  if (errors.length) {
    throw new Error('creatures.json tidak valid:\n• ' + errors.join('\n• '));
  }
  return config;
}
