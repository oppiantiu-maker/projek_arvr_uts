// Uji otomatis aturan permainan, validasi data, dan inventori.
// Tidak butuh browser maupun internet. Jalankan dari folder utama repository:
//     node tests/run-tests.mjs
// Peran: QA dan Dokumentasi

import { readFileSync } from 'node:fs';
import { horizontalDistance, nearestCreature, evaluateCatch, formatDistance, rollSpawn } from '../js/catch.js';
import { validateConfig } from '../js/data.js';
import { Inventory, STORAGE_KEY } from '../js/inventory.js';

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    fail++;
    console.log(`  ✘ ${name}\n      ${err.message}`);
  }
}
function eq(actual, expected, msg = '') {
  if (actual !== expected) throw new Error(`${msg} diharapkan ${JSON.stringify(expected)}, didapat ${JSON.stringify(actual)}`);
}
function throws(fn, includes) {
  try { fn(); } catch (err) {
    if (includes && !err.message.includes(includes)) throw new Error(`pesan error tidak memuat "${includes}": ${err.message}`);
    return;
  }
  throw new Error('seharusnya melempar error');
}
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

console.log('\nAturan tangkap (catch.js)');
test('jarak mendatar mengabaikan tinggi', () => eq(horizontalDistance({ x: 0, y: 1.5, z: 0 }, { x: 3, y: 0, z: -4 }), 5));
test('TC-01 di luar radius -> gagal', () => eq(evaluateCatch(5, 2).ok, false));
test('TC-02 di dalam radius -> berhasil', () => eq(evaluateCatch(1.2, 2).ok, true));
test('TC-03 tepat di batas radius -> berhasil', () => eq(evaluateCatch(2, 2).ok, true));
test('alasan gagal = too-far', () => eq(evaluateCatch(3, 2).reason, 'too-far'));
test('jarak tak valid -> gagal', () => eq(evaluateCatch(NaN, 2).ok, false));
test('makhluk terdekat dipilih', () => {
  const a = { id: 'a', position: { x: 0, y: 0, z: -8 } };
  const b = { id: 'b', position: { x: 3, y: 0, z: -2 } };
  eq(nearestCreature([a, b], { x: 0, y: 1.5, z: 0 }).creature.id, 'b');
});
test('tidak ada makhluk -> null', () => eq(nearestCreature([], { x: 0, y: 0, z: 0 }), null));
test('format jarak jauh "8m"', () => eq(formatDistance(8.2), '8m'));
test('format jarak dekat "1.6m"', () => eq(formatDistance(1.63), '1.6m'));
test('spawnChance 0 tidak pernah muncul', () => eq(rollSpawn(0, () => 0), false));
test('spawnChance 1 selalu muncul', () => eq(rollSpawn(1, () => 0.999), true));

console.log('\nValidasi data (data.js + data/creatures.json)');
const json = JSON.parse(readFileSync(new URL('../data/creatures.json', import.meta.url)));
test('creatures.json asli lolos validasi', () => {
  const cfg = validateConfig(json);
  eq(cfg.creatures.length >= 2, true, 'jumlah makhluk');
});
test('semua file model & thumbnail di creatures.json ada', () => {
  for (const c of json.creatures) {
    readFileSync(new URL('../' + c.model, import.meta.url));
    if (c.thumbnail) readFileSync(new URL('../' + c.thumbnail, import.meta.url));
  }
});
test('kurang dari 2 makhluk ditolak', () => throws(() => validateConfig({ ...json, creatures: [json.creatures[0]] }), 'minimal 2'));
test('id ganda ditolak', () => throws(() => validateConfig({ ...json, creatures: [json.creatures[0], json.creatures[0]] }), 'dua kali'));
test('model bukan .glb ditolak', () => {
  const bad = structuredClone(json);
  bad.creatures[0].model = 'robot.fbx';
  throws(() => validateConfig(bad), '.glb');
});
test('spawn tanpa koordinat ditolak', () => {
  const bad = structuredClone(json);
  delete bad.creatures[1].spawn;
  throws(() => validateConfig(bad), 'spawn');
});
test('catchRadius negatif ditolak', () => throws(() => validateConfig({ ...json, catchRadius: -1 }), 'catchRadius'));

console.log('\nInventori (inventory.js)');
test('inventori awal kosong', () => eq(new Inventory(memoryStorage()).count(), 0));
test('TC-04 inventori tetap ada setelah "muat ulang"', () => {
  const st = memoryStorage();
  const inv1 = new Inventory(st);
  inv1.add({ id: 'robot', name: 'Robot Kampus' });
  inv1.add({ id: 'robot', name: 'Robot Kampus' });
  inv1.add({ id: 'buku', name: 'Buku Terbang' });
  const inv2 = new Inventory(st);   // seperti halaman dimuat ulang
  eq(inv2.count(), 3);
  eq(inv2.grouped().find((g) => g.id === 'robot').count, 2);
});
test('data rusak di localStorage tidak membuat crash', () => {
  const st = memoryStorage();
  st.setItem(STORAGE_KEY, '{ini bukan json');
  eq(new Inventory(st).count(), 0);
});
test('hapus semua', () => {
  const st = memoryStorage();
  const inv = new Inventory(st);
  inv.add({ id: 'robot', name: 'Robot Kampus' });
  inv.clear();
  eq(new Inventory(st).count(), 0);
});

console.log(`\nHasil: ${pass} lulus, ${fail} gagal\n`);
process.exit(fail ? 1 : 0);
