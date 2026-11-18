// main.js — titik awal aplikasi: menyambungkan data, AR/simulasi, makhluk, UI, dan inventori
// Peran: Project Manager & Integrator

import * as THREE from 'three';
import { loadConfig } from './data.js';
import { Inventory } from './inventory.js';
import { Feedback } from './feedback.js';
import { UI } from './ui.js';
import { CreatureManager } from './spawn.js';
import { ARSession, checkARSupport } from './ar.js';
import { SimSession } from './sim.js';
import { horizontalDistance, nearestCreature, evaluateCatch } from './catch.js';

// ---------- parameter URL (untuk uji) ----------
// ?skala=0.3  -> semua jarak spawn dikali 0.3 (uji di ruang kelas yang sempit)
const params = new URLSearchParams(location.search);
const urlScale = parseFloat(params.get('skala'));

// ---------- objek utama ----------
const ui = new UI();
const inventory = new Inventory();
const feedback = new Feedback();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);   // transparan: kamera terlihat di belakang
renderer.xr.enabled = true;
renderer.domElement.id = 'scene-canvas';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(2, 4, 3);
scene.add(sun);

// bayangan bulat palsu di bawah makhluk (ringan untuk HP)
const shadowTex = makeShadowTexture();

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

let config = null;
let creatures = null;
let session = null;        // ARSession atau SimSession
let mode = null;           // 'ar' | 'sim'
let state = 'menu';        // 'menu' | 'scanning' | 'playing'

// ---------- inisialisasi ----------
init();

async function init() {
  ui.updateInventoryCount(inventory.count());
  bindButtons();

  const support = await checkARSupport();
  ui.setARSupport(support.supported, support.reason);

  try {
    config = await loadConfig();
  } catch (err) {
    ui.showError(err.message);
  }
}

function bindButtons() {
  ui.on('btn-start-ar', 'click', () => startGame('ar'));
  ui.on('btn-start-sim', 'click', () => startGame('sim'));
  ui.on('btn-open-inv-start', 'click', () => ui.showPanel(inventory, config?.creatures || []));
  ui.on('btn-inventory', 'click', () => ui.showPanel(inventory, config?.creatures || []));
  ui.on('btn-close-inv', 'click', () => ui.hidePanel());
  ui.on('btn-reset-inv', 'click', () => {
    if (confirm('Hapus semua makhluk di inventori? Tindakan ini tidak bisa dibatalkan.')) {
      inventory.clear();
      ui.updateInventoryCount(0);
      ui.showPanel(inventory, config?.creatures || []);
    }
  });
  ui.on('btn-catch', 'click', onCatchButton);
  ui.on('btn-exit', 'click', stopGame);
  ui.on('btn-error-back', 'click', () => (config ? ui.showStart() : location.reload()));

  // tombol jalan di Mode Simulasi: tahan untuk bergerak
  for (const [id, dir] of [['btn-forward', 1], ['btn-backward', -1]]) {
    const el = document.getElementById(id);
    const on = (e) => { e.preventDefault(); session?.setMove?.(dir); el.classList.add('active'); };
    const off = () => { session?.setMove?.(0); el.classList.remove('active'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  }

  window.addEventListener('resize', () => {
    if (renderer.xr.isPresenting) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ---------- mulai / berhenti ----------
async function startGame(kind) {
  if (!config) { ui.showError('Data makhluk belum termuat. Muat ulang halaman.'); return; }
  feedback.unlock();   // harus di dalam sentuhan pengguna
  ui.hidePanel();

  try {
    ui.showLoading('Memuat makhluk…');
    if (!creatures) {
      creatures = new CreatureManager(scene, config, {
        distanceScale: config.distanceScale * (Number.isFinite(urlScale) && urlScale > 0 ? urlScale : 1),
        onRespawn: (c) => {
          addShadow(c);
          feedback.play('spawn');
          ui.toast(`${c.type.name} muncul lagi!`, 'info');
        },
      });
    }
    await creatures.preload((t) => ui.showLoading(t));

    if (kind === 'ar') {
      ui.showLoading('Membuka kamera AR…');
      session = new ARSession({
        renderer, scene,
        overlayRoot: document.getElementById('overlay'),
        onSelect: onARSelect,
        onEnd: () => { if (mode === 'ar') resetToMenu(); },
      });
      mode = 'ar';
      const info = await session.start();
      state = 'scanning';
      ui.showHUD('ar');
      ui.setHint('Arahkan kamera ke lantai sampai cincin hijau muncul, lalu ketuk layar.');
      if (!info.domOverlay) console.warn('DOM overlay tidak didukung, HUD mungkin tidak terlihat.');
    } else {
      mode = 'sim';
      session = new SimSession({
        camera, canvas: renderer.domElement,
        video: document.getElementById('camera-feed'),
        onTap: onSimTap,
        onNotice: (t) => ui.toast(t, 'warn', 4500),
      });
      await session.start();
      creatures.spawnAll(new THREE.Vector3(0, 0, 0), session.forward());
      creatures.creatures.forEach(addShadow);
      feedback.play('spawn');
      state = 'playing';
      ui.showHUD('sim');
      ui.setHint('Seret untuk melihat sekeliling · tahan ▲ Maju untuk mendekat');
      setTimeout(() => state === 'playing' && ui.setHint(''), 6000);
    }

    clock.getDelta();
    renderer.setAnimationLoop(loop);
  } catch (err) {
    console.error(err);
    session?.end?.();
    session = null;
    mode = null;
    state = 'menu';
    ui.showError(friendlyError(err));
  }
}

function stopGame() {
  if (mode === 'ar' && session) {
    session.end();          // resetToMenu dipanggil lewat onEnd
  } else {
    session?.end?.();
    resetToMenu();
  }
}

function resetToMenu() {
  renderer.setAnimationLoop(null);
  creatures?.clear();
  session = null;
  mode = null;
  state = 'menu';
  ui.setHint('');
  renderer.clear();
  ui.showStart();
}

// ---------- loop per frame ----------
function loop(time, frame) {
  const dt = Math.min(clock.getDelta(), 0.1);

  if (mode === 'ar') session.update(frame);
  else if (mode === 'sim') session.update(dt);

  if (state === 'playing') {
    const player = session.viewerPos;
    creatures.update(dt, player);
    const nearest = nearestCreature(creatures.active(), player);
    ui.updateTarget(nearest, config.catchRadius);
  }

  renderer.render(scene, camera);
}

// ---------- input ----------
/** Ketuk layar di mode AR. */
function onARSelect(ray) {
  if (state === 'scanning') {
    if (!session.floorHit) {
      ui.toast('Lantai belum terdeteksi. Gerakkan HP perlahan ke arah lantai.', 'warn');
      return;
    }
    creatures.spawnAll(session.hitPos, session.forward());
    creatures.creatures.forEach(addShadow);
    session.showReticle = false;
    state = 'playing';
    feedback.play('spawn');
    ui.setHint('Makhluk muncul! Berjalanlah mendekat lalu tekan Tangkap.');
    setTimeout(() => state === 'playing' && ui.setHint(''), 5000);
    return;
  }
  if (state === 'playing') {
    raycaster.set(ray.origin, ray.direction);
    const c = creatures.pick(raycaster);
    if (c) attemptCatch(c);
  }
}

/** Ketuk layar di Mode Simulasi. */
function onSimTap(ndc) {
  if (state !== 'playing') return;
  raycaster.setFromCamera(ndc, camera);
  const c = creatures.pick(raycaster);
  if (c) attemptCatch(c);
}

function onCatchButton() {
  if (state !== 'playing') return;
  const nearest = nearestCreature(creatures.active(), session.viewerPos);
  if (nearest) attemptCatch(nearest.creature);
}

// ---------- inti permainan ----------
function attemptCatch(c) {
  const d = horizontalDistance(session.viewerPos, c.position);
  const result = evaluateCatch(d, config.catchRadius);

  if (result.ok) {
    creatures.playCatch(c);
    inventory.add(c.type);
    ui.updateInventoryCount(inventory.count());
    feedback.play('catch');
    feedback.vibrate([60, 40, 140]);
    ui.toast(`${c.type.name} tertangkap! 🎉`, 'success');
  } else {
    feedback.play('fail');
    feedback.vibrate(200);
    ui.toast(`Terlalu jauh (${d.toFixed(1)} m). Dekati sampai ${config.catchRadius} m.`, 'warn');
  }
}

// ---------- utilitas ----------
function addShadow(c) {
  if (!c.root || c.root.getObjectByName('shadow')) return;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  m.name = 'shadow';
  m.position.y = 0.005;
  m.raycast = () => {};   // bayangan tidak ikut diketuk
  c.root.add(m);
}

function makeShadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

function friendlyError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Izin kamera ditolak. Buka pengaturan situs di browser, izinkan Kamera, lalu coba lagi.';
  }
  if (name === 'NotSupportedError') {
    return 'Perangkat ini tidak mendukung fitur AR yang dibutuhkan (hit-test). Gunakan Mode Simulasi.';
  }
  return err?.message || 'Terjadi kesalahan yang tidak diketahui.';
}
