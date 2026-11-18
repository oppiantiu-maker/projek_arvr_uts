// spawn.js — memuat model GLB, memunculkan makhluk, animasi, dan respawn
// Peran: Aset 3D & Animasi (model, klip) + Engineer Tracking (aturan spawn)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rollSpawn } from './catch.js';

const APPEAR_TIME = 0.45;   // detik animasi "muncul"

export class CreatureManager {
  /**
   * @param {THREE.Scene} scene
   * @param {object} config  hasil validateConfig()
   * @param {object} opts    { distanceScale, onRespawn(creature) }
   */
  constructor(scene, config, opts = {}) {
    this.scene = scene;
    this.config = config;
    this.distanceScale = opts.distanceScale ?? config.distanceScale;
    this.onRespawn = opts.onRespawn || (() => {});
    this.templates = new Map();   // id -> { scene, animations }
    this.creatures = [];
    this.origin = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.loader = new GLTFLoader();
    this._tmp = new THREE.Vector3();
  }

  /** Muat semua model sekali di awal. onProgress(teks) untuk layar memuat. */
  async preload(onProgress = () => {}) {
    for (const type of this.config.creatures) {
      if (this.templates.has(type.id)) continue;
      onProgress(`Memuat ${type.name}…`);
      let gltf;
      try {
        gltf = await this.loader.loadAsync(type.model);
      } catch (err) {
        throw new Error(`Gagal memuat model "${type.model}". Pastikan file ada dan namanya sama persis dengan creatures.json.`);
      }
      const names = gltf.animations.map((a) => a.name);
      for (const clip of [type.idleClip, type.catchClip]) {
        if (!names.includes(clip)) {
          throw new Error(`Model ${type.model} tidak punya klip animasi "${clip}". Klip yang ada: ${names.join(', ') || '(kosong)'}.`);
        }
      }
      this.templates.set(type.id, { scene: gltf.scene, animations: gltf.animations });
    }
  }

  /**
   * Tetapkan titik asal permainan dan arah hadap pemain, lalu munculkan semua makhluk.
   * origin  = titik di lantai (hasil hit-test), forward = arah kamera saat mulai.
   */
  spawnAll(origin, forward) {
    this.clear();
    this.origin.copy(origin);
    this.forward.set(forward.x, 0, forward.z);
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);

    for (const type of this.config.creatures) {
      const c = { type, root: null, model: null, mixer: null, state: 'waiting', timer: 0, appearT: 0 };
      c.position = new THREE.Vector3();
      this.creatures.push(c);
      this._place(c);   // kemunculan pertama selalu terjadi (spawnChance dipakai saat respawn)
    }
  }

  /** Hitung posisi dunia dari koordinat spawn di creatures.json. */
  spawnPosition(type, out = new THREE.Vector3()) {
    const s = this.distanceScale;
    const j = this.config.spawnJitter;
    const jx = (Math.random() * 2 - 1) * j;
    const jz = (Math.random() * 2 - 1) * j;
    // x = ke kanan, z negatif = ke depan (konvensi Three.js)
    return out.copy(this.origin)
      .addScaledVector(this.right, (type.spawn.x + jx) * s)
      .addScaledVector(this.forward, -(type.spawn.z + jz) * s);
  }

  _place(c) {
    const tpl = this.templates.get(c.type.id);
    if (c.root) this.scene.remove(c.root);

    const root = new THREE.Group();
    root.name = `creature-${c.type.id}`;
    const model = tpl.scene.clone(true);
    model.scale.setScalar(c.type.scale);
    root.add(model);
    root.userData.creature = c;
    root.scale.setScalar(0.001);
    this.spawnPosition(c.type, root.position);

    const mixer = new THREE.AnimationMixer(model);
    const idle = mixer.clipAction(THREE.AnimationClip.findByName(tpl.animations, c.type.idleClip));
    const catchClip = THREE.AnimationClip.findByName(tpl.animations, c.type.catchClip);
    const catchAction = mixer.clipAction(catchClip);
    catchAction.setLoop(THREE.LoopOnce, 1);
    catchAction.clampWhenFinished = true;
    idle.play();

    Object.assign(c, {
      root, model, mixer, idle, catchAction,
      catchDuration: catchClip.duration,
      state: 'appearing', appearT: 0, timer: 0,
    });
    c.position = root.position;   // dipakai nearestCreature()
    this.scene.add(root);
  }

  /** Makhluk yang boleh ditangkap. */
  active() {
    return this.creatures.filter((c) => c.state === 'active' || c.state === 'appearing');
  }

  /** Panggil tiap frame. playerPos = posisi kamera/HP. */
  update(dt, playerPos) {
    for (const c of this.creatures) {
      if (c.mixer) c.mixer.update(dt);

      if (c.state === 'appearing') {
        c.appearT += dt;
        const t = Math.min(1, c.appearT / APPEAR_TIME);
        const back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);   // ease-out-back
        c.root.scale.setScalar(Math.max(0.001, back));
        if (t >= 1) { c.root.scale.setScalar(1); c.state = 'active'; }
      }

      if (c.state === 'active' || c.state === 'appearing') {
        // selalu menghadap pemain (hanya diputar di sumbu Y)
        this._tmp.set(playerPos.x, c.root.position.y, playerPos.z);
        c.root.lookAt(this._tmp);
      }

      if (c.state === 'caught') {
        c.timer -= dt;
        if (c.timer <= 0) {
          this.scene.remove(c.root);
          c.state = 'waiting';
          c.timer = c.type.respawnSeconds;
        }
      } else if (c.state === 'waiting') {
        c.timer -= dt;
        if (c.timer <= 0) {
          if (rollSpawn(c.type.spawnChance)) {
            this._place(c);
            this.onRespawn(c);
          } else {
            c.timer = c.type.respawnSeconds;   // coba lagi nanti
          }
        }
      }
    }
  }

  /** Jalankan animasi tangkap; makhluk hilang setelah klip selesai lalu menunggu respawn. */
  playCatch(c) {
    if (c.state !== 'active' && c.state !== 'appearing') return;
    c.root.scale.setScalar(1);
    c.state = 'caught';
    c.timer = c.catchDuration + 0.15;
    c.idle.fadeOut(0.1);
    c.catchAction.reset().fadeIn(0.05).play();
  }

  /** Cari makhluk yang kena sinar raycaster (ketuk layar). */
  pick(raycaster) {
    const roots = this.active().map((c) => c.root);
    const hits = raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.creature) o = o.parent;
      if (o) return o.userData.creature;
    }
    return null;
  }

  clear() {
    for (const c of this.creatures) {
      if (c.root) this.scene.remove(c.root);
      if (c.mixer) c.mixer.stopAllAction();
    }
    this.creatures = [];
  }
}
