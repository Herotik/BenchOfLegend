"""Génère les icônes PWA à partir d'un écusson de rang.

Les icônes « maskable » sont rognées en cercle par Android : le contenu utile
doit tenir dans les 80 % centraux, d'où la marge généreuse. Le fond est opaque
— une icône transparente s'affiche en noir plein sur certains lanceurs.
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "public", "ranks", "heracles.png")
OUT = os.path.join(ROOT, "public")

FOND = (5, 8, 13, 255)          # --color-nuit-950
ZONE_SURE = 0.62                # part de la largeur occupée par l'écusson

CIBLES = [
    ("icon-192.png", 192),
    ("icon-512.png", 512),
    ("apple-touch-icon.png", 180),
]

ecusson = Image.open(SOURCE).convert("RGBA")

for nom, taille in CIBLES:
    fond = Image.new("RGBA", (taille, taille), FOND)

    cote = int(taille * ZONE_SURE)
    vignette = ecusson.resize((cote, cote), Image.LANCZOS)
    decalage = (taille - cote) // 2
    fond.alpha_composite(vignette, (decalage, decalage))

    fond.convert("RGB").save(os.path.join(OUT, nom), optimize=True)
    print(f"{nom:24s} {taille}x{taille}")
