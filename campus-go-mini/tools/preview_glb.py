"""
Pratinjau model .glb tanpa browser (membaca ulang file GLB dan menggambarnya).
Dipakai untuk memeriksa model dan membuat thumbnail inventori.

    python tools/preview_glb.py assets/models/robot.glb out.png [ukuran_px]

Butuh Python 3 + numpy + matplotlib.
"""
import json
import struct
import sys

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

COMP = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}
NCOMP = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    magic, ver, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67 and ver == 2 and length == len(data), "header GLB rusak"
    jlen, jtype = struct.unpack_from("<II", data, 12)
    assert jtype == 0x4E4F534A
    gltf = json.loads(data[20:20 + jlen])
    blen, btype = struct.unpack_from("<II", data, 20 + jlen)
    assert btype == 0x004E4942
    binary = data[28 + jlen:28 + jlen + blen]
    return gltf, binary


def accessor(gltf, binary, i):
    acc = gltf["accessors"][i]
    view = gltf["bufferViews"][acc["bufferView"]]
    n = NCOMP[acc["type"]]
    arr = np.frombuffer(binary, COMP[acc["componentType"]], acc["count"] * n,
                        view.get("byteOffset", 0) + acc.get("byteOffset", 0))
    return arr.reshape(-1, n) if n > 1 else arr


def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def trs(node):
    m = np.eye(4)
    m[:3, :3] = quat_mat(node.get("rotation", [0, 0, 0, 1])) * np.array(node.get("scale", [1, 1, 1]))
    m[:3, 3] = node.get("translation", [0, 0, 0])
    return m


def collect(gltf, binary):
    tris, cols = [], []

    def walk(i, parent):
        node = gltf["nodes"][i]
        m = parent @ trs(node)
        if "mesh" in node:
            for prim in gltf["meshes"][node["mesh"]]["primitives"]:
                pos = accessor(gltf, binary, prim["attributes"]["POSITION"])
                idx = accessor(gltf, binary, prim["indices"])
                p = (m[:3, :3] @ pos.T).T + m[:3, 3]
                mat = gltf["materials"][prim["material"]]
                lin = np.array(mat["pbrMetallicRoughness"]["baseColorFactor"][:3])
                emis = np.array(mat.get("emissiveFactor", [0, 0, 0]))
                for t in idx.reshape(-1, 3):
                    tris.append(p[t])
                    cols.append((lin, emis))
        for c in node.get("children", []):
            walk(c, m)

    for r in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        walk(r, np.eye(4))
    return np.array(tris), cols


def render(path, out, size=512, transparent=True):
    gltf, binary = read_glb(path)
    tris, cols = collect(gltf, binary)
    light = np.array([0.4, 0.8, 0.6])
    light /= np.linalg.norm(light)
    faces = []
    for tri, (lin, emis) in zip(tris, cols):
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        nn = np.linalg.norm(n)
        shade = 0.45 + 0.55 * max(0, np.dot(n / nn, light)) if nn > 1e-12 else 0.8
        rgb = np.clip(lin * shade + emis * 0.6, 0, 1) ** (1 / 2.2)
        faces.append(rgb)
    fig = plt.figure(figsize=(size / 100, size / 100), dpi=100)
    ax = fig.add_subplot(111, projection="3d")
    # glTF: Y ke atas, Z ke depan -> matplotlib: Z ke atas
    conv = tris[:, :, [0, 2, 1]] * np.array([1, -1, 1])
    pc = Poly3DCollection(conv, facecolors=faces, edgecolors="none")
    ax.add_collection3d(pc)
    lo, hi = conv.reshape(-1, 3).min(0), conv.reshape(-1, 3).max(0)
    c, r = (lo + hi) / 2, (hi - lo).max() / 2 * 0.92
    ax.set_xlim(c[0] - r, c[0] + r)
    ax.set_ylim(c[1] - r, c[1] + r)
    ax.set_zlim(c[2] - r, c[2] + r)
    ax.set_box_aspect((1, 1, 1))
    ax.view_init(elev=18, azim=-62)
    ax.set_axis_off()
    fig.subplots_adjust(0, 0, 1, 1)
    fig.savefig(out, transparent=transparent)
    plt.close(fig)
    anims = [a["name"] for a in gltf.get("animations", [])]
    print(f"  {out}  ({len(tris)} segitiga, animasi: {', '.join(anims)})")


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 512)
