"""Découpe la planche de rangs en 8 écussons 512x512 transparents (PNG + WebP).

Dépendances : pillow, numpy, scipy. À relancer uniquement si la planche source change.
"""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "planche-rangs-source.png")
OUT = os.path.join(ROOT, "public", "ranks")
os.makedirs(OUT, exist_ok=True)

BADGE_X = (25, 400)   # colonne des écussons (le filet vertical de la planche est à x=407)

# La planche sépare les écussons par de fins filets horizontaux pleine largeur,
# repérés en cherchant les lignes dont l'étendue en x explose : y = 203, 383, 564,
# 747, 928, 1105, 1291. Chaque bande court d'un filet au suivant.
BANDS = [
    ("hoplite",       14,  202),
    ("myrmidon",     205,  382),
    ("spartiate",    386,  563),
    ("heracles",     567,  746),
    ("elyseen",      750,  927),
    ("titan",        931, 1099),
    ("demi-dieu",   1108, 1290),
    ("dieu-olympe", 1294, 1534),
]

# Le fond de la planche plafonne à ~18 de luminance : la rampe 18->40 le rend
# transparent tout en gardant les parties sombres des écussons (lauriers noirs).
A_LO, A_HI = 18.0, 40.0
CORE_THR = 58.0
CANVAS, PAD = 512, 0.05

im = Image.open(SRC).convert("RGB")
arr = np.asarray(im).astype(np.float32)

for slug, y0, y1 in BANDS:
    sub = arr[y0:y1, BADGE_X[0]:BADGE_X[1]]
    lum = sub.max(axis=2)
    bh, bw = lum.shape

    ramp = np.clip((lum - A_LO) / (A_HI - A_LO), 0, 1)

    # Noyau opaque : les détails sombres *internes* (casque, ombres) ne doivent pas être troués
    core = ndimage.binary_closing(lum > CORE_THR, structure=np.ones((9, 9)))
    core = ndimage.binary_fill_holes(core)
    alpha = np.maximum(ramp, core.astype(np.float32))

    # Les filets horizontaux de la planche : composantes larges et plates -> supprimées
    lab, n = ndimage.label(alpha > 0.25)
    boxes = ndimage.find_objects(lab)
    sizes = ndimage.sum(alpha > 0.25, lab, range(1, n + 1))
    drop = []
    for j in range(n):
        ys, xs = boxes[j]
        h, w = ys.stop - ys.start, xs.stop - xs.start
        if (h < 26 and w > 0.5 * bw) or sizes[j] < 120:
            drop.append(j + 1)
    if drop:
        alpha[np.isin(lab, drop)] = 0.0

    alpha = np.asarray(
        Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.6))
    ).astype(np.float32) / 255.0

    ys, xs = np.where(alpha > 0.12)
    tile = Image.fromarray(
        np.dstack([sub, alpha * 255]).astype(np.uint8)[ys.min():ys.max() + 1, xs.min():xs.max() + 1],
        "RGBA",
    )

    side = int(max(tile.size) * (1 + PAD * 2))
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(tile, ((side - tile.width) // 2, (side - tile.height) // 2))
    sq = sq.resize((CANVAS, CANVAS), Image.LANCZOS)

    sq.save(os.path.join(OUT, f"{slug}.png"), optimize=True)
    sq.save(os.path.join(OUT, f"{slug}.webp"), quality=90, method=6)

    print(f"{slug:12s} y {y0:5d}-{y1:<5d} découpe {tile.width}x{tile.height:<4d} -> {CANVAS}x{CANVAS}")
