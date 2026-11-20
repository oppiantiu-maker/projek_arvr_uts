// sim.js — Mode Simulasi: untuk HP tanpa WebXR (iPhone / Android tanpa ARCore) dan uji di laptop.
// Konsep "seperti Pokémon GO": makhluk DIAM di tempatnya, pemainlah yang bergerak.
//   - Menoleh  : putar/arahkan HP (giroskop, event deviceorientation)
//   - Berjalan : langkah kaki dideteksi akselerometer (event devicemotion), tiap langkah ≈ 0,7 m
//                ke arah HP menghadap. Makin dekat -> makhluk tampak makin besar (perspektif).
//   - Ketuk    : tangkap
// Tidak ada tombol Maju/Mundur dan tidak ada zoom cubit, karena itu "mengendalikan" objek.
// Fallback laptop (tanpa sensor): seret mouse = menoleh, tombol panah ↑/↓ atau W/S = berjalan (khusus uji).

import * as THREE from 'three';

const EYE_HEIGHT = 1.5;      // tinggi HP dari lantai (meter)
const STEP_LENGTH = 0.7;     // panjang 1 langkah (meter)
const WALK_SPEED = 1.3;      // kecepatan menghabiskan jarak langkah (m/detik) agar gerak halus
const STEP_THRESHOLD = 1.6;  // ambang lonjakan percepatan (m/s²) di atas rata-rata gravitasi
const STEP_MIN_GAP = 330;    // jeda minimal antar langkah (ms)

/**
 * iOS 13+ wajib minta izin sensor gerak, dan HARUS dipanggil langsung di dalam ketukan
 * pengguna (sebelum ada await lain). Di Android/laptop fungsi ini langsung selesai.
 */
export async function requestMotionPermission() {
  const asks = [];
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    asks.push(DeviceOrientationEvent.requestPermission());
  }
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    asks.push(DeviceMotionEvent.requestPermission());
  }
  try {
    const res = await Promise.all(asks);
    return res.every((r) => r === 'granted');
  } catch {
    return false;
  }
}

export class SimSession {
  /**
   * @param {object} p { camera, canvas, video, onTap(ndc: Vector2), onNotice(text), onStep() }
   */
  constructor({ camera, canvas, video, onTap, onNotice, onStep }) {
    this.camera = camera;
    this.canvas = canvas;
    this.video = video;
    this.onTap = onTap;
    this.onNotice = onNotice || (() => {});
    this.onStep = onStep || (() => {});
    this.viewerPos = camera.position;   // referensi langsung
    this.stream = null;
    this._listeners = [];   // [target, type, fn]

    // orientasi
    this.hasGyro = false;
    this.orient = null;                 // { alpha, beta, gamma } derajat
    this.yaw = 0;                       // dipakai fallback seret
    this.pitch = -0.12;
    this.headingOffset = 0;             // agar arah awal HP = arah depan permainan

    // langkah
    this.hasMotion = false;
    this.gravityAvg = 9.81;
    this.lastStepAt = 0;
    this.pendingDist = 0;               // jarak langkah yang belum "dijalani"
    this.steps = 0;
    this.keyMove = 0;                   // fallback keyboard

    this._q = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._zee = new THREE.Vector3(0, 0, 1);
    this._q0 = new THREE.Quaternion();
    this._q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));   // kamera melihat lewat belakang HP
    this._yawFix = new THREE.Quaternion();
  }

  async start() {
    this.camera.position.set(0, EYE_HEIGHT, 0);
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    await this._startCamera();
    this._bindSensors();
    this._bindPointer();
    this._bindKeys();

    // tunggu sebentar data giroskop pertama, lalu "nolkan" arah supaya makhluk muncul di depan HP
    this.hasGyro = await this._waitForOrientation(1200);
    if (this.hasGyro) {
      this.headingOffset = 0;
      this._applyOrientation();
      const f = this.forward();
      this.headingOffset = -Math.atan2(-f.x, -f.z);
      this._applyOrientation();
    } else {
      this.onNotice('Giroskop tidak terdeteksi (laptop?). Seret layar untuk menoleh, tombol ↑/↓ untuk berjalan (khusus uji).');
    }
  }

  async _startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.onNotice('Kamera tidak tersedia di browser ini, latar diganti langit.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      });
      this.video.srcObject = this.stream;
      this.video.classList.add('on');
      await this.video.play().catch(() => {});
    } catch (err) {
      const msg = err && err.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Permainan tetap jalan dengan latar langit. Untuk memakai kamera, izinkan kamera di pengaturan situs browser lalu mulai ulang.'
        : 'Kamera tidak bisa dibuka, latar diganti langit.';
      this.onNotice(msg);
    }
  }

  _listen(target, type, fn) {
    target.addEventListener(type, fn);
    this._listeners.push([target, type, fn]);
  }

  // ---------- sensor HP ----------
  _bindSensors() {
    this._listen(window, 'deviceorientation', (e) => {
      if (e.alpha == null && e.beta == null) return;
      this.orient = { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 };
    });

    this._listen(window, 'devicemotion', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      this.hasMotion = true;
      const mag = Math.hypot(a.x, a.y, a.z);
      // rata-rata bergerak = gravitasi; lonjakan di atasnya = hentakan kaki
      this.gravityAvg = this.gravityAvg * 0.95 + mag * 0.05;
      const now = performance.now();
      if (mag - this.gravityAvg > STEP_THRESHOLD && now - this.lastStepAt > STEP_MIN_GAP) {
        this.lastStepAt = now;
        this.steps++;
        this.pendingDist += STEP_LENGTH;
        this.onStep(this.steps);
      }
    });
  }

  _waitForOrientation(ms) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = () => {
        if (this.orient) return resolve(true);
        if (performance.now() - t0 > ms) return resolve(false);
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  /** Ubah alpha/beta/gamma HP menjadi rotasi kamera (rumus DeviceOrientationControls Three.js). */
  _applyOrientation() {
    if (!this.orient) return;
    const d2r = THREE.MathUtils.DEG2RAD;
    const screenAngle = (screen.orientation?.angle ?? window.orientation ?? 0) * d2r;
    this._euler.set(this.orient.beta * d2r, this.orient.alpha * d2r, -this.orient.gamma * d2r, 'YXZ');
    this._q.setFromEuler(this._euler);
    this._q.multiply(this._q1);
    this._q.multiply(this._q0.setFromAxisAngle(this._zee, -screenAngle));
    this._yawFix.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.headingOffset);
    this.camera.quaternion.copy(this._yawFix).multiply(this._q);
  }

  // ---------- sentuh: ketuk = tangkap; seret = menoleh hanya jika tidak ada giroskop ----------
  _bindPointer() {
    const c = this.canvas;
    let p = null;
    this._listen(c, 'pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    });
    this._listen(c, 'pointermove', (e) => {
      if (!p || p.id !== e.pointerId) return;
      if (!this.hasGyro) {
        this.yaw -= (e.clientX - p.x) * 0.005;
        this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - p.y) * 0.004, -1.2, 1.0);
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    this._listen(c, 'pointerup', (e) => {
      if (!p || p.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      const quick = performance.now() - p.t < 350;
      p = null;
      if (moved < 10 && quick) {
        const r = c.getBoundingClientRect();
        this.onTap(new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        ));
      }
    });
    this._listen(c, 'pointercancel', () => { p = null; });
  }

  // ---------- keyboard: hanya untuk uji di laptop ----------
  _bindKeys() {
    const set = (e, v) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keyMove = v > 0 ? 1 : (this.keyMove === 1 ? 0 : this.keyMove);
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keyMove = v > 0 ? -1 : (this.keyMove === -1 ? 0 : this.keyMove);
    };
    this._listen(window, 'keydown', (e) => set(e, 1));
    this._listen(window, 'keyup', (e) => set(e, 0));
  }

  /** Arah depan mendatar (untuk spawn & berjalan) = arah kamera HP menghadap. */
  forward(out = new THREE.Vector3()) {
    if (this.hasGyro) {
      out.set(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0);
      if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
      return out.normalize();
    }
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt) {
    // 1) rotasi kamera mengikuti HP
    if (this.hasGyro) this._applyOrientation();
    else this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // 2) posisi pemain maju sejauh langkah yang terdeteksi (dihaluskan)
    let dist = 0;
    if (this.pendingDist > 0) {
      dist = Math.min(this.pendingDist, WALK_SPEED * dt);
      this.pendingDist -= dist;
    } else if (this.keyMove !== 0) {
      dist = this.keyMove * WALK_SPEED * dt;
    }
    if (dist !== 0) this.camera.position.addScaledVector(this.forward(), dist);
  }

  end() {
    for (const [target, type, fn] of this._listeners) target.removeEventListener(type, fn);
    this._listeners = [];
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.video.classList.remove('on');
    this.pendingDist = 0;
    this.keyMove = 0;
  }
}
