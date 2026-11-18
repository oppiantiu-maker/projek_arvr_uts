"""
Generator model 3D orisinal untuk Campus Go Mini.

Menghasilkan dua file .glb beranimasi (klip "Idle" dan "Catch"):
  assets/models/robot.glb  -> Robot Kampus
  assets/models/buku.glb   -> Buku Terbang

Hanya butuh Python 3 + numpy. Jalankan dari folder utama repository:
    python tools/make_glb.py

Model buatan kelompok sendiri (lisensi CC0). Boleh dibuka dan diedit di
Blender: File > Import > glTF 2.0, lalu ekspor lagi sebagai glTF Binary (.glb)
dengan nama klip animasi tetap "Idle" dan "Catch".
"""
import json
import math
import os
import struct

import numpy as np

FLOAT, USHORT = 5126, 5123
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


# ---------------------------------------------------------------- utilitas
def srgb_to_linear(hex_color):
    hex_color = hex_color.lstrip("#")
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [round(c ** 2.2, 4) for c in rgb]


def quat_axis_angle(axis, deg):
    a = math.radians(deg) / 2
    s = math.sin(a)
    x, y, z = axis
    return [x * s, y * s, z * s, math.cos(a)]


# ---------------------------------------------------------------- geometri
def box(w, h, d, c=(0, 0, 0)):
    """Kotak dengan normal per sisi (24 verteks, 36 indeks)."""
    hx, hy, hz = w / 2, h / 2, d / 2
    faces = [  # (normal, 4 sudut berlawanan arah jarum jam dilihat dari luar)
        ((1, 0, 0), [(hx, -hy, hz), (hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz)]),
        ((-1, 0, 0), [(-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)]),
        ((0, 1, 0), [(-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz), (-hx, hy, -hz)]),
        ((0, -1, 0), [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)]),
        ((0, 0, 1), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0, 0, -1), [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)]),
    ]
    pos, nor, idx = [], [], []
    for n, corners in faces:
        base = len(pos)
        for p in corners:
            pos.append((p[0] + c[0], p[1] + c[1], p[2] + c[2]))
            nor.append(n)
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]
    return np.array(pos, np.float32), np.array(nor, np.float32), np.array(idx, np.uint16)


def sphere(r, c=(0, 0, 0), seg=18, rings=12):
    pos, nor, idx = [], [], []
    for i in range(rings + 1):
        v = i / rings
        phi = v * math.pi
        for j in range(seg + 1):
            u = j / seg
            th = u * 2 * math.pi
            n = (math.sin(phi) * math.sin(th), math.cos(phi), math.sin(phi) * math.cos(th))
            nor.append(n)
            pos.append((c[0] + r * n[0], c[1] + r * n[1], c[2] + r * n[2]))
    for i in range(rings):
        for j in range(seg):
            a = i * (seg + 1) + j
            b = a + seg + 1
            idx += [a, b, a + 1, b, b + 1, a + 1]
    return np.array(pos, np.float32), np.array(nor, np.float32), np.array(idx, np.uint16)


# ---------------------------------------------------------------- penulis GLB
class GLBBuilder:
    def __init__(self, generator):
        self.bin = bytearray()
        self.gltf = {
            "asset": {"version": "2.0", "generator": generator},
            "scene": 0, "scenes": [{"nodes": []}],
            "nodes": [], "meshes": [], "materials": [], "accessors": [],
            "bufferViews": [], "buffers": [], "animations": [],
        }
        self.mat_index = {}

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.bin += data
        self.gltf["bufferViews"].append(view)
        return len(self.gltf["bufferViews"]) - 1

    def accessor(self, arr, ctype, atype, target=None, minmax=False):
        acc = {"bufferView": self._view(arr.tobytes(), target),
               "componentType": ctype, "count": int(arr.shape[0]), "type": atype}
        if minmax:
            if arr.ndim == 1:
                acc["min"], acc["max"] = [float(arr.min())], [float(arr.max())]
            else:
                acc["min"] = [float(v) for v in arr.min(axis=0)]
                acc["max"] = [float(v) for v in arr.max(axis=0)]
        self.gltf["accessors"].append(acc)
        return len(self.gltf["accessors"]) - 1

    def material(self, name, hex_color, metal=0.1, rough=0.6, emissive=None):
        if name in self.mat_index:
            return self.mat_index[name]
        m = {"name": name, "pbrMetallicRoughness": {
            "baseColorFactor": srgb_to_linear(hex_color) + [1.0],
            "metallicFactor": metal, "roughnessFactor": rough}}
        if emissive:
            m["emissiveFactor"] = srgb_to_linear(emissive)
        self.gltf["materials"].append(m)
        self.mat_index[name] = len(self.gltf["materials"]) - 1
        return self.mat_index[name]

    def mesh(self, name, parts):
        """parts: daftar (geometri, indeks_material)."""
        prims = []
        for (pos, nor, idx), mat in parts:
            prims.append({
                "attributes": {
                    "POSITION": self.accessor(pos, FLOAT, "VEC3", ARRAY_BUFFER, True),
                    "NORMAL": self.accessor(nor, FLOAT, "VEC3", ARRAY_BUFFER),
                },
                "indices": self.accessor(idx, USHORT, "SCALAR", ELEMENT_ARRAY_BUFFER),
                "material": mat,
            })
        self.gltf["meshes"].append({"name": name, "primitives": prims})
        return len(self.gltf["meshes"]) - 1

    def node(self, name, mesh=None, t=None, r=None, s=None, children=None):
        n = {"name": name}
        if mesh is not None:
            n["mesh"] = mesh
        if t:
            n["translation"] = list(t)
        if r:
            n["rotation"] = list(r)
        if s:
            n["scale"] = list(s)
        if children:
            n["children"] = children
        self.gltf["nodes"].append(n)
        return len(self.gltf["nodes"]) - 1

    def animation(self, name, tracks):
        """tracks: daftar (node, path, waktu[], nilai[[...]])."""
        anim = {"name": name, "channels": [], "samplers": []}
        for node, path, times, values in tracks:
            inp = self.accessor(np.array(times, np.float32), FLOAT, "SCALAR", minmax=True)
            out_type = "VEC4" if path == "rotation" else "VEC3"
            out = self.accessor(np.array(values, np.float32), FLOAT, out_type)
            anim["samplers"].append({"input": inp, "output": out, "interpolation": "LINEAR"})
            anim["channels"].append({"sampler": len(anim["samplers"]) - 1,
                                     "target": {"node": node, "path": path}})
        self.gltf["animations"].append(anim)

    def save(self, path, root):
        self.gltf["scenes"][0]["nodes"] = [root]
        while len(self.bin) % 4:
            self.bin.append(0)
        self.gltf["buffers"] = [{"byteLength": len(self.bin)}]
        js = json.dumps(self.gltf, separators=(",", ":")).encode()
        js += b" " * ((4 - len(js) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
            f.write(struct.pack("<II", len(self.bin), 0x004E4942) + bytes(self.bin))
        print(f"  {path}  ({total / 1024:.1f} KB)")


def spin_track(node, duration, turns, axis=(0, 1, 0), steps_per_turn=8):
    steps = int(turns * steps_per_turn)
    times = [duration * i / steps for i in range(steps + 1)]
    vals = [quat_axis_angle(axis, 360 * turns * i / steps) for i in range(steps + 1)]
    return (node, "rotation", times, vals)


# ---------------------------------------------------------------- Robot Kampus
def make_robot(path):
    g = GLBBuilder("Campus Go Mini tools/make_glb.py")
    green = g.material("HijauBadan", "#3DBE5A", 0.2, 0.45)
    dark = g.material("HijauGelap", "#24803B", 0.2, 0.5)
    gray = g.material("AbuSendi", "#7A8490", 0.6, 0.35)
    visor = g.material("Visor", "#18222E", 0.3, 0.2)
    eye = g.material("MataKuning", "#FFE14D", 0.0, 0.3, emissive="#FFD21F")
    light = g.material("LampuAntena", "#7CFF9B", 0.0, 0.3, emissive="#3DFF6A")

    # kaki
    leg_l = g.node("LegL", g.mesh("LegL", [(box(0.12, 0.16, 0.14, (0, 0.13, 0)), dark),
                                          (box(0.16, 0.05, 0.2, (0, 0.025, 0.02)), gray)]), t=(-0.1, 0, 0))
    leg_r = g.node("LegR", g.mesh("LegR", [(box(0.12, 0.16, 0.14, (0, 0.13, 0)), dark),
                                          (box(0.16, 0.05, 0.2, (0, 0.025, 0.02)), gray)]), t=(0.1, 0, 0))
    # badan
    torso = g.node("Torso", g.mesh("Torso", [
        (box(0.42, 0.32, 0.3, (0, 0.36, 0)), green),
        (box(0.24, 0.14, 0.02, (0, 0.37, 0.155)), dark),
        (sphere(0.025, (0.06, 0.37, 0.17)), eye),
        (sphere(0.025, (-0.02, 0.37, 0.17)), light),
    ]))
    # lengan (pivot di bahu)
    arm_parts = [(box(0.1, 0.24, 0.1, (0, -0.12, 0)), green), (sphere(0.065, (0, -0.28, 0)), gray),
                 (sphere(0.06, (0, 0, 0)), gray)]
    arm_l = g.node("ArmL", g.mesh("ArmL", arm_parts), t=(-0.27, 0.48, 0))
    arm_r = g.node("ArmR", g.mesh("ArmR", arm_parts), t=(0.27, 0.48, 0))
    # kepala (pivot di leher)
    eye_l = g.node("EyeL", g.mesh("EyeL", [(sphere(0.048), eye)]), t=(-0.085, 0.19, 0.18))
    eye_r = g.node("EyeR", g.mesh("EyeR", [(sphere(0.048), eye)]), t=(0.085, 0.19, 0.18))
    head = g.node("Head", g.mesh("Head", [
        (box(0.46, 0.32, 0.34, (0, 0.18, 0)), green),
        (box(0.36, 0.17, 0.02, (0, 0.19, 0.172)), visor),
        (box(0.05, 0.14, 0.14, (-0.25, 0.18, 0)), gray),   # headphone kiri
        (box(0.05, 0.14, 0.14, (0.25, 0.18, 0)), gray),    # headphone kanan
        (box(0.02, 0.12, 0.02, (-0.11, 0.4, 0)), gray),    # antena
        (box(0.02, 0.12, 0.02, (0.11, 0.4, 0)), gray),
        (sphere(0.032, (-0.11, 0.48, 0)), light),
        (sphere(0.032, (0.11, 0.48, 0)), light),
    ]), t=(0, 0.52, 0), children=[eye_l, eye_r])

    rig = g.node("Rig", children=[leg_l, leg_r, torso, arm_l, arm_r, head])
    root = g.node("RobotKampus", children=[rig])

    # ---- Idle (2 detik, loop): bergoyang, kepala miring, lengan berayun, mata berkedip
    t5 = [0, 0.5, 1.0, 1.5, 2.0]
    g.animation("Idle", [
        (rig, "translation", t5, [[0, 0, 0], [0, 0.03, 0], [0, 0, 0], [0, 0.03, 0], [0, 0, 0]]),
        (head, "rotation", t5, [quat_axis_angle((0, 0, 1), a) for a in (0, -7, 0, 7, 0)]),
        (arm_l, "rotation", t5, [quat_axis_angle((1, 0, 0), a) for a in (0, 18, 0, -18, 0)]),
        (arm_r, "rotation", t5, [quat_axis_angle((1, 0, 0), a) for a in (0, -18, 0, 18, 0)]),
        (eye_l, "scale", [0, 1.55, 1.65, 1.75, 2.0], [[1, 1, 1], [1, 1, 1], [1, 0.1, 1], [1, 1, 1], [1, 1, 1]]),
        (eye_r, "scale", [0, 1.55, 1.65, 1.75, 2.0], [[1, 1, 1], [1, 1, 1], [1, 0.1, 1], [1, 1, 1], [1, 1, 1]]),
    ])
    # ---- Catch (1.2 detik, sekali): angkat tangan, berputar, naik, mengecil
    g.animation("Catch", [
        spin_track(rig, 1.0, 2),
        (rig, "translation", [0, 0.3, 1.0, 1.2], [[0, 0, 0], [0, 0.1, 0], [0, 0.45, 0], [0, 0.45, 0]]),
        (rig, "scale", [0, 0.3, 1.0, 1.2], [[1, 1, 1], [1.15, 1.15, 1.15], [0.01, 0.01, 0.01], [0.01, 0.01, 0.01]]),
        (arm_l, "rotation", [0, 0.25, 1.2], [quat_axis_angle((0, 0, 1), a) for a in (0, -150, -150)]),
        (arm_r, "rotation", [0, 0.25, 1.2], [quat_axis_angle((0, 0, 1), a) for a in (0, 150, 150)]),
        (eye_l, "scale", [0, 0.2, 1.2], [[1, 1, 1], [1.4, 1.4, 1.4], [1.4, 1.4, 1.4]]),
        (eye_r, "scale", [0, 0.2, 1.2], [[1, 1, 1], [1.4, 1.4, 1.4], [1.4, 1.4, 1.4]]),
    ])
    g.save(path, root)


# ---------------------------------------------------------------- Buku Terbang
def make_book(path):
    g = GLBBuilder("Campus Go Mini tools/make_glb.py")
    cover = g.material("SampulMerah", "#B3263A", 0.1, 0.55)
    spine_m = g.material("Punggung", "#7E1426", 0.1, 0.55)
    paper = g.material("Kertas", "#FFF6DC", 0.0, 0.9)
    white = g.material("PutihMata", "#FFFFFF", 0.0, 0.3)
    black = g.material("Pupil", "#111111", 0.0, 0.2)
    ribbon_m = g.material("Pita", "#FFC93C", 0.0, 0.5, emissive="#402F00")
    gold = g.material("Emas", "#E8B931", 0.8, 0.3)

    cover_l = g.node("CoverL", g.mesh("CoverL", [
        (box(0.3, 0.025, 0.42, (-0.16, 0, 0)), cover),
        (box(0.27, 0.03, 0.39, (-0.15, 0.027, 0)), paper),
        (box(0.12, 0.004, 0.12, (-0.17, -0.014, 0)), gold),
    ]), r=quat_axis_angle((0, 0, 1), -25))
    cover_r = g.node("CoverR", g.mesh("CoverR", [
        (box(0.3, 0.025, 0.42, (0.16, 0, 0)), cover),
        (box(0.27, 0.03, 0.39, (0.15, 0.027, 0)), paper),
        (box(0.12, 0.004, 0.12, (0.17, -0.014, 0)), gold),
    ]), r=quat_axis_angle((0, 0, 1), 25))
    ribbon = g.node("Ribbon", g.mesh("Ribbon", [(box(0.035, 0.01, 0.2, (0, 0, -0.1)), ribbon_m)]),
                    t=(0, -0.02, -0.21))
    spine = g.node("Spine", g.mesh("Spine", [
        (box(0.07, 0.06, 0.44), spine_m),
        (sphere(0.055, (-0.06, 0.05, 0.2)), white),
        (sphere(0.055, (0.06, 0.05, 0.2)), white),
        (sphere(0.027, (-0.06, 0.055, 0.25)), black),
        (sphere(0.027, (0.06, 0.055, 0.25)), black),
    ]))
    rig = g.node("Rig", t=(0, 0.6, 0), children=[spine, cover_l, cover_r, ribbon])
    root = g.node("BukuTerbang", children=[rig])

    t3 = [0, 0.6, 1.2]
    g.animation("Idle", [
        (cover_l, "rotation", t3, [quat_axis_angle((0, 0, 1), a) for a in (-15, -60, -15)]),
        (cover_r, "rotation", t3, [quat_axis_angle((0, 0, 1), a) for a in (15, 60, 15)]),
        (rig, "translation", t3, [[0, 0.6, 0], [0, 0.68, 0], [0, 0.6, 0]]),
        (ribbon, "rotation", t3, [quat_axis_angle((1, 0, 0), a) for a in (10, -25, 10)]),
    ])
    g.animation("Catch", [
        (cover_l, "rotation", [0, 0.25, 1.2], [quat_axis_angle((0, 0, 1), a) for a in (-15, -88, -88)]),
        (cover_r, "rotation", [0, 0.25, 1.2], [quat_axis_angle((0, 0, 1), a) for a in (15, 88, 88)]),
        spin_track(rig, 1.0, 2),
        (rig, "translation", [0, 0.3, 1.0, 1.2], [[0, 0.6, 0], [0, 0.75, 0], [0, 1.1, 0], [0, 1.1, 0]]),
        (rig, "scale", [0, 0.3, 1.0, 1.2], [[1, 1, 1], [1.15, 1.15, 1.15], [0.01, 0.01, 0.01], [0.01, 0.01, 0.01]]),
    ])
    g.save(path, root)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "assets", "models")
    os.makedirs(out, exist_ok=True)
    print("Membuat model:")
    make_robot(os.path.join(out, "robot.glb"))
    make_book(os.path.join(out, "buku.glb"))
