// sim.js — Mode Simulasi: untuk HP tanpa WebXR (iPhone) dan untuk uji di laptop.
// Latar = kamera belakang (jika diizinkan). Pemain "berjalan" dengan tombol Maju/Mundur.
// Interaksi sentuh: ketuk = tangkap, seret = lihat sekeliling, cubit = zoom.

import * as THREE from 'three';

const WALK_SPEED = 1.3;   // meter per detik (kecepatan jalan santai)
const EYE_HEIGHT = 1.5;   // tinggi HP dari lantai

export class SimSession {
  /**
   * @param {object} p { camera, canvas, video, onTap(ndc: Vector2), onNotice(text) }
   */
  constructor({ camera, canvas, video, onTap, onNotice }) {
    this.camera = camera;
    this.canvas = canvas;
    this.video = video;
    this.onTap = onTap;
    this.onNotice = onNotice || (() => {});
    this.viewerPos = camera.position;   // referensi langsung
    this.yaw = 0;
    this.pitch = -0.12;
    this.move = 0;                       // +1 maju, -1 mundur
    this.stream = null;
    this.pointers = new Map();
    this.pinchStart = 0;
    this.fovStart = camera.fov;
    this._listeners = [];
  }

  async start() {
    this.camera.position.set(0, EYE_HEIGHT, 0);
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    await this._startCamera();
    this._bindPointer();
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

  _bindPointer() {
    const c = this.canvas;
    const add = (type, fn) => { c.addEventListener(type, fn); this._listeners.push([type, fn]); };

    add('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (this.pointers.size === 2) {
        this.pinchStart = this._pinchDist();
        this.fovStart = this.camera.fov;
      }
    });
    add('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 1) {
        // seret = memutar pandangan
        this.yaw -= (e.clientX - p.x) * 0.005;
        this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - p.y) * 0.004, -1.2, 1.0);
      }
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinchStart > 0) {
        // cubit = zoom (ubah field of view)
        const ratio = this.pinchStart / this._pinchDist();
        this.camera.fov = THREE.MathUtils.clamp(this.fovStart * ratio, 30, 85);
        this.camera.updateProjectionMatrix();
      }
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p || this.pointers.size > 0) return;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (moved < 10 && performance.now() - p.t < 350) {
        // ketukan singkat -> koordinat NDC untuk raycast
        const r = c.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        );
        this.onTap(ndc);
      }
    };
    add('pointerup', up);
    add('pointercancel', (e) => this.pointers.delete(e.pointerId));
  }

  _pinchDist() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  /** Arah depan mendatar (untuk spawn & berjalan). */
  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  setMove(dir) { this.move = dir; }

  update(dt) {
    if (this.move !== 0) {
      const f = this.forward();
      this.camera.position.addScaledVector(f, this.move * WALK_SPEED * dt);
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  end() {
    for (const [type, fn] of this._listeners) this.canvas.removeEventListener(type, fn);
    this._listeners = [];
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.video.classList.remove('on');
    this.move = 0;
  }
}
