"""
Generator gambar: thumbnail inventori dan ikon aplikasi.

Menghasilkan:
  assets/img/robot.png, assets/img/buku.png   -> thumbnail inventori (256 px)
  assets/img/icon-192.png, icon-512.png       -> ikon aplikasi / favicon

Butuh Python 3 + numpy + matplotlib + Pillow. Jalankan SETELAH make_glb.py:
    python tools/make_images.py
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from preview_glb import render  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
IMG = os.path.join(ROOT, "assets", "img")
MODELS = os.path.join(ROOT, "assets", "models")


def crop_to_content(img, pad=0.08):
    box = img.getbbox()
    if not box:
        return img
    img = img.crop(box)
    side = int(max(img.size) * (1 + pad * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return canvas


def thumbnail(name):
    tmp = os.path.join(IMG, f"_{name}_raw.png")
    render(os.path.join(MODELS, f"{name}.glb"), tmp, 700)
    img = crop_to_content(Image.open(tmp).convert("RGBA")).resize((256, 256), Image.LANCZOS)
    img.save(os.path.join(IMG, f"{name}.png"))
    os.remove(tmp)
    print(f"  assets/img/{name}.png")
    return img


def icon(robot_img, size):
    scale = 4
    s = size * scale
    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    grad = Image.new("RGBA", (s, s))
    d = ImageDraw.Draw(grad)
    for y in range(s):
        t = y / s
        d.line([(0, y), (s, y)], fill=(int(46 + 20 * t), int(204 - 60 * t), int(113 - 30 * t), 255))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=255)
    bg.paste(grad, (0, 0), mask)
    ring = ImageDraw.Draw(bg)
    r = int(s * 0.36)
    ring.ellipse([s // 2 - r, int(s * 0.8) - r // 4, s // 2 + r, int(s * 0.8) + r // 4],
                 outline=(255, 255, 255, 140), width=max(2, s // 60))
    robot = robot_img.resize((int(s * 0.78), int(s * 0.78)), Image.LANCZOS)
    shadow = robot.split()[3].filter(ImageFilter.GaussianBlur(s // 60))
    sh = Image.new("RGBA", robot.size, (0, 0, 0, 90))
    pos = ((s - robot.width) // 2, int(s * 0.1))
    bg.paste(sh, (pos[0] + s // 80, pos[1] + s // 60), shadow)
    bg.paste(robot, pos, robot)
    out = bg.resize((size, size), Image.LANCZOS)
    out.save(os.path.join(IMG, f"icon-{size}.png"))
    print(f"  assets/img/icon-{size}.png")


if __name__ == "__main__":
    os.makedirs(IMG, exist_ok=True)
    print("Membuat gambar:")
    robot = thumbnail("robot")
    thumbnail("buku")
    for sz in (192, 512):
        icon(robot, sz)
