// ar.js — sesi WebXR AR: kamera, deteksi lantai (hit-test), posisi HP, dan ketukan layar
// Peran: Engineer Tracking. Jarak di WebXR memakai satuan METER nyata, tanpa GPS.

import * as THREE from 'three';

/** Cek apakah browser mendukung immersive-ar (Chrome Android + Google Play Services for AR). */
export async function checkARSupport() {
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Halaman harus dibuka lewat HTTPS agar kamera dan AR berfungsi.' };
  }
  if (!('xr' in navigator)) {
    return { supported: false, reason: 'Browser ini tidak punya WebXR (umumnya Safari/iPhone). Gunakan Mode Simulasi.' };
  }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-ar');
    return ok
      ? { supported: true }
      : { supported: false, reason: 'Perangkat ini belum mendukung WebXR AR. Pastikan memakai Chrome Android dan "Google Play Services for AR" terpasang.' };
  } catch {
    return { supported: false, reason: 'Gagal memeriksa dukungan AR. Gunakan Mode Simulasi.' };
  }
}

export class ARSession {
  /**
   * @param {object} p { renderer, scene, overlayRoot, onSelect(ray), onEnd() }
   *   onSelect dipanggil saat layar diketuk, dengan ray = { origin: Vector3, direction: Vector3 }
   */
  constructor({ renderer, scene, overlayRoot, onSelect, onEnd }) {
    this.renderer = renderer;
    this.scene = scene;
    this.overlayRoot = overlayRoot;
    this.onSelect = onSelect;
    this.onEnd = onEnd;

    this.session = null;
    this.hitTestSource = null;
    this.floorHit = false;
    this.showReticle = true;
    this.hitPos = new THREE.Vector3();
    this.viewerPos = new THREE.Vector3();
    this.viewerQuat = new THREE.Quaternion();
    this.reticle = createReticle();
    this.controller = null;
    this._m = new THREE.Matrix4();
  }

  async start() {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: this.overlayRoot },
    });
    this.session = session;

    this.renderer.xr.setReferenceSpaceType('local');
    await this.renderer.xr.setSession(session);

    const viewerSpace = await session.requestReferenceSpace('viewer');
    this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    this.scene.add(this.reticle);

    // Ketukan layar di WebXR = event "select" dari controller "screen"
    this.controller = this.renderer.xr.getController(0);
    this._onSelectHandler = () => {
      this.controller.updateMatrixWorld(true);
      const origin = new THREE.Vector3().setFromMatrixPosition(this.controller.matrixWorld);
      this._m.identity().extractRotation(this.controller.matrixWorld);
      const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(this._m).normalize();
      this.onSelect({ origin, direction });
    };
    this.controller.addEventListener('select', this._onSelectHandler);
    this.scene.add(this.controller);

    session.addEventListener('end', () => this._cleanup());
    return { domOverlay: !!session.domOverlayState };
  }

  /** Panggil tiap frame dengan XRFrame dari setAnimationLoop. */
  update(frame) {
    if (!frame) return;
    const refSpace = this.renderer.xr.getReferenceSpace();

    const pose = frame.getViewerPose(refSpace);
    if (pose) {
      const p = pose.transform.position;
      const o = pose.transform.orientation;
      this.viewerPos.set(p.x, p.y, p.z);
      this.viewerQuat.set(o.x, o.y, o.z, o.w);
    }

    if (this.hitTestSource) {
      const results = frame.getHitTestResults(this.hitTestSource);
      if (results.length > 0) {
        const hitPose = results[0].getPose(refSpace);
        this.reticle.matrix.fromArray(hitPose.transform.matrix);
        this.hitPos.setFromMatrixPosition(this.reticle.matrix);
        this.floorHit = true;
        this.reticle.visible = this.showReticle;
      } else {
        this.floorHit = false;
        this.reticle.visible = false;
      }
    }
  }

  /** Arah depan HP (mendatar) — dipakai untuk menaruh makhluk "di depan" pemain. */
  forward(out = new THREE.Vector3()) {
    return out.set(0, 0, -1).applyQuaternion(this.viewerQuat).setY(0).normalize();
  }

  end() {
    if (this.session) this.session.end().catch(() => {});
  }

  _cleanup() {
    if (this.hitTestSource) { try { this.hitTestSource.cancel(); } catch { /* abaikan */ } }
    this.hitTestSource = null;
    this.scene.remove(this.reticle);
    if (this.controller) {
      this.controller.removeEventListener('select', this._onSelectHandler);
      this.scene.remove(this.controller);
    }
    this.session = null;
    this.onEnd?.();
  }
}

/** Cincin hijau di lantai, penanda tempat makhluk akan muncul. */
function createReticle() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.13, 0.17, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3fd779 }),
  );
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.03, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  group.add(ring, dot);
  group.matrixAutoUpdate = false;
  group.visible = false;
  return group;
}
