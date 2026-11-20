// inventory.js — inventori makhluk yang tersimpan di perangkat (localStorage)
// Peran: Data dan Persistence. Tidak ada data yang dikirim ke server.

export const STORAGE_KEY = 'campusgo.inventory.v1';

/** localStorage bisa diblokir (mode privat, iframe). Jika gagal, pakai memori sementara. */
function safeStorage() {
  try {
    const k = '__campusgo_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    console.warn('localStorage tidak tersedia, inventori hanya tersimpan sementara.');
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}

export class Inventory {
  constructor(storage = safeStorage()) {
    this.storage = storage;
    this.items = this.load();
  }

  load() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      // validasi ringan: buang entri rusak
      return Array.isArray(data)
        ? data.filter((it) => it && typeof it.id === 'string' && typeof it.caughtAt === 'string')
        : [];
    } catch {
      return [];
    }
  }

  save() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (err) {
      console.warn('Gagal menyimpan inventori:', err);
    }
  }

  /** Tambah satu tangkapan. creatureType = objek dari creatures.json. */
  add(creatureType, date = new Date()) {
    const entry = { id: creatureType.id, name: creatureType.name, caughtAt: date.toISOString() };
    this.items.push(entry);
    this.save();
    return entry;
  }

  count() {
    return this.items.length;
  }

  /** Ringkasan per jenis: [{ id, name, count, lastCaught }] urut dari yang terbaru. */
  grouped() {
    const map = new Map();
    for (const it of this.items) {
      const g = map.get(it.id) || { id: it.id, name: it.name, count: 0, lastCaught: it.caughtAt };
      g.count += 1;
      if (it.caughtAt > g.lastCaught) g.lastCaught = it.caughtAt;
      map.set(it.id, g);
    }
    return [...map.values()].sort((a, b) => (a.lastCaught < b.lastCaught ? 1 : -1));
  }

  clear() {
    this.items = [];
    this.save();
  }
}
