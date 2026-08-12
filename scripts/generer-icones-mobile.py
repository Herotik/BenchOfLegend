"""Icônes et écran de lancement de l'app mobile, sur l'identité Frame of Legends.

La marque tient en deux signes : le **Δ**, gravé en Cinzel, et les **quatre
équerres** d'angle. Les équerres ne se rejoignent jamais et sont toujours
quatre — c'est ce qui les distingue d'un cadre, qui enfermerait la marque au
lieu de la désigner.

    python scripts/generer-icones-mobile.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "mobile", "assets")
POLICE = os.path.join(
    RACINE, "mobile", "node_modules", "@expo-google-fonts", "cinzel",
    "600SemiBold", "Cinzel_600SemiBold.ttf",
)

MARBRE = (244, 244, 241, 255)
GRAPHITE = (42, 44, 46, 255)
BASALTE = (26, 28, 30, 255)
PORPHYRE = (107, 46, 59, 255)
PORPHYRE_CLAIR = (180, 99, 111, 255)
TRANSPARENT = (0, 0, 0, 0)

#: Rendu à quatre fois la taille demandée puis réduit. Les diagonales du Δ et
#: les angles droits des équerres crénelleraient sans cela : PIL ne lisse ni le
#: texte ni les rectangles.
SURECHANTILLON = 4


def dessiner(
    taille: int,
    fond: tuple,
    encre: tuple,
    equerre: tuple | None,
    occupation: float = 0.52,
) -> Image.Image:
    """Une planche carrée : le Δ centré, les quatre équerres autour."""
    grand = taille * SURECHANTILLON
    image = Image.new("RGBA", (grand, grand), fond)
    dessin = ImageDraw.Draw(image)

    if equerre is not None:
        # Retrait mesuré depuis le bord. Généreux : iOS masque l'icône en
        # rectangle arrondi et Android la rogne en cercle — une équerre posée
        # près du bord y perdrait son angle, qui est tout son propos.
        retrait = round(grand * 0.17)
        longueur = round(grand * 0.13)
        trait = max(2, round(grand * 0.016))
        for x in (retrait, grand - retrait):
            for y in (retrait, grand - retrait):
                dx = longueur if x == retrait else -longueur
                dy = longueur if y == retrait else -longueur
                dessin.line([(x, y), (x + dx, y)], fill=equerre, width=trait)
                dessin.line([(x, y), (x, y + dy)], fill=equerre, width=trait)

    # Le Δ est centré sur sa boîte d'encre, non sur sa ligne de base : une
    # capitale grecque n'a ni jambage ni approche symétrique, et s'aligner sur
    # la métrique la ferait flotter vers le haut.
    police = ImageFont.truetype(POLICE, round(grand * occupation))
    g, h, d, b = dessin.textbbox((0, 0), "Δ", font=police)
    dessin.text(
        ((grand - (d - g)) / 2 - g, (grand - (b - h)) / 2 - h),
        "Δ",
        font=police,
        fill=encre,
    )

    return image.resize((taille, taille), Image.LANCZOS)


PLANCHES = [
    # Icône d'app : fond opaque obligatoire, une icône transparente s'affiche
    # en noir plein sur certains lanceurs.
    ("icon.png", 1024, MARBRE, GRAPHITE, PORPHYRE, 0.52),
    ("favicon.png", 48, MARBRE, GRAPHITE, None, 0.58),
    # Écran de lancement : fond transparent, la couleur vient d'`app.json`.
    ("splash-icon.png", 1024, TRANSPARENT, GRAPHITE, PORPHYRE, 0.46),
    ("splash-icon-sombre.png", 1024, TRANSPARENT, MARBRE, PORPHYRE_CLAIR, 0.46),
    # Android : la vignette adaptative n'occupe que les deux tiers centraux,
    # le système se réservant la marge pour ses animations.
    ("android-icon-foreground.png", 512, TRANSPARENT, GRAPHITE, PORPHYRE, 0.36),
    ("android-icon-monochrome.png", 432, TRANSPARENT, (255, 255, 255, 255), None, 0.36),
]

for nom, taille, fond, encre, equerre, occupation in PLANCHES:
    dessiner(taille, fond, encre, equerre, occupation).save(
        os.path.join(SORTIE, nom), optimize=True
    )
    print(f"{nom:32s} {taille}x{taille}")

# Fond adaptatif Android : un aplat, la vignette porte le dessin.
Image.new("RGBA", (512, 512), MARBRE).save(
    os.path.join(SORTIE, "android-icon-background.png"), optimize=True
)
print(f"{'android-icon-background.png':32s} 512x512")
