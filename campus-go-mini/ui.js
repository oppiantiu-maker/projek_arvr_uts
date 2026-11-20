// ui.js — semua urusan tampilan HTML (layar, HUD, toast, panel inventori)
// Peran: Interaksi dan UI/UX

import { formatDistance } from './catch.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      overlay: $('overlay'),
      start: $('screen-start'),
      loading: $('screen-loading'),
      loadingText: $('loading-text'),
      error: $('screen-error'),
      errorText: $('error-text'),
      hud: $('hud'),
      hint: $('hint'),
      targetName: $('target-name'),
      targetDist: $('target-dist'),
      catchBtn: $('btn-catch'),
      toast: $('toast'),
      panel: $('panel-inventory'),
      invList: $('inv-list'),
      invEmpty: $('inv-empty'),
      invSummary: $('inv-summary'),
      btnStartAR: $('btn-start-ar'),
      supportNote: $('support-note'),
    };
    this.toastTimer = null;
    this.lastTargetKey = '';

    // Sentuhan pada tombol/panel jangan diteruskan sebagai "select" WebXR (agar tidak dobel)
    this.el.overlay.addEventListener('beforexrselect', (e) => {
      if (e.target.closest('button, .panel')) e.preventDefault();
    });
  }

  on(id, event, fn) {
    $(id).addEventListener(event, fn);
  }

  // ---------- layar ----------
  showOnly(name) {
    for (const key of ['start', 'loading', 'error', 'hud']) {
      this.el[key].classList.toggle('hidden', key !== name);
    }
  }

  showStart() { this.showOnly('start'); this.hidePanel(); }

  showLoading(text) {
    this.el.loadingText.textContent = text;
    this.showOnly('loading');
  }

  showError(message) {
    this.el.errorText.textContent = message;
    this.el.errorText.style.whiteSpace = 'pre-line';
    this.showOnly('error');
  }

  showHUD(mode) {
    this.showOnly('hud');
    this.updateTarget(null, 0);
  }

  setARSupport(supported, reason) {
    const b = this.el.btnStartAR;
    b.disabled = !supported;
    b.textContent = supported ? 'Mulai AR' : 'AR tidak didukung';
    this.el.supportNote.textContent = supported
      ? 'Mode AR: makhluk muncul di lantai sekitarmu, berjalanlah mendekat untuk menangkap.'
      : (reason || 'Browser ini belum mendukung WebXR AR. Gunakan Mode Simulasi.');
  }

  setHint(text) { this.el.hint.textContent = text || ''; }

  // ---------- HUD ----------
  /** nearest = { creature, distance } | null */
  updateTarget(nearest, radius) {
    const btn = this.el.catchBtn;
    if (!nearest) {
      if (this.lastTargetKey === 'none') return;
      this.lastTargetKey = 'none';
      this.el.targetName.textContent = 'Menunggu makhluk…';
      this.el.targetDist.textContent = '';
      btn.disabled = true;
      btn.classList.remove('ready');
      return;
    }
    const { creature, distance } = nearest;
    const inRange = distance <= radius;
    const key = `${creature.type.id}|${formatDistance(distance)}|${inRange}`;
    if (key === this.lastTargetKey) return;   // hindari menulis DOM tiap frame
    this.lastTargetKey = key;

    this.el.targetName.textContent = creature.type.name;
    this.el.targetDist.textContent = formatDistance(distance);
    this.el.targetDist.classList.toggle('near', inRange);
    btn.disabled = false;
    btn.classList.toggle('ready', inRange);
  }

  updateInventoryCount(n) {
    document.querySelectorAll('.inv-count').forEach((s) => { s.textContent = n; });
  }

  toast(text, kind = 'info', ms = 2200) {
    const t = this.el.toast;
    t.textContent = text;
    t.className = `toast ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  // ---------- panel inventori ----------
  showPanel(inventory, types) {
    const groups = inventory.grouped();
    const byId = new Map(types.map((t) => [t.id, t]));
    this.el.invList.innerHTML = '';
    for (const g of groups) {
      const type = byId.get(g.id);
      const li = document.createElement('li');
      li.className = 'inv-item';
      const img = document.createElement('img');
      img.alt = g.name;
      img.src = type?.thumbnail || 'assets/img/icon-192.png';
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = g.name;
      if (type) {
        const badge = document.createElement('span');
        badge.className = `badge ${type.rarity}`;
        badge.textContent = type.rarity === 'rare' ? 'Langka' : 'Biasa';
        name.appendChild(badge);
      }
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = 'Terakhir: ' + new Date(g.lastCaught).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      info.append(name, meta);
      const count = document.createElement('div');
      count.className = 'count';
      count.textContent = `×${g.count}`;
      li.append(img, info, count);
      this.el.invList.appendChild(li);
    }
    const kinds = groups.length;
    this.el.invSummary.textContent = `${inventory.count()} tangkapan · ${kinds} dari ${types.length} jenis ditemukan`;
    this.el.invEmpty.classList.toggle('hidden', groups.length > 0);
    this.el.panel.classList.remove('hidden');
  }

  hidePanel() { this.el.panel.classList.add('hidden'); }
}
