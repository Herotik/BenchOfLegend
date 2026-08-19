"""Assemble les images d'un geste rendu en 3D en une planche exploitable par l'app.

Blender et Unity sortent une image par pas de temps — `geste_0001.png`,
`geste_0002.png`… L'app, elle, ne peut pas charger vingt fichiers par exercice :
elle en charge **un**, et fait glisser une fenêtre dessus pour montrer chaque
image tour à tour. C'est ce que fabrique ce script.

    python scripts/planche-geste.py <dossier-des-images> <slug-du-geste>

Options :
  --taille 256    Côté d'une image dans la planche. 256 suffit : l'app affiche
                  le geste sur 150 à 210 points, soit 630 px au plus dense.
  --images 20     Nombre d'images retenues. Les rendus en comptent souvent
                  bien plus ; on en prélève à intervalle régulier.
  --sortie …      Dossier de destination. Par défaut `mobile/assets/gestes/`.

Une **grille** plutôt qu'une bande : une bande de vingt images fait 5120 px de
large, ce qui dépasse la taille de texture que certains téléphones acceptent
d'un seul tenant. Quatre colonnes ramènent la planche à 1024 × 1280.

Le fond doit être **transparent**. Un fond opaque, même blanc, se verrait comme
un rectangle sur le thème sombre.
"""
from PIL import Image
import argparse
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE_DEFAUT = os.path.join(RACINE, "mobile", "assets", "gestes")

# Quatre colonnes : voir l'en-tête. C'est aussi ce que l'app suppose par défaut.
COLONNES = 4


def images_du_dossier(dossier):
    """Images du rendu, dans l'ordre des numéros et non dans celui de l'alphabet."""
    fichiers = [f for f in os.listdir(dossier) if f.lower().endswith((".png", ".webp"))]
    if not fichiers:
        sys.exit(f"Aucune image dans {dossier}.")

    def numero(nom):
        trouves = re.findall(r"(\d+)", nom)
        # Sans numéro, on retombe sur l'ordre alphabétique plutôt que d'échouer.
        return int(trouves[-1]) if trouves else 0

    return [os.path.join(dossier, f) for f in sorted(fichiers, key=numero)]


def prelever(chemins, combien):
    """Prélève `combien` images à intervalle régulier, premières et dernières comprises."""
    if len(chemins) <= combien:
        return chemins
    pas = (len(chemins) - 1) / (combien - 1)
    return [chemins[round(i * pas)] for i in range(combien)]


def cadrer(image, taille):
    """Met l'image au carré sans la déformer, en la centrant sur son contenu.

    Le rendu peut arriver en 1920 × 1080 avec le personnage au milieu : découpé
    au centre géométrique, il se retrouverait décalé. On se cale donc sur la
    zone réellement dessinée.
    """
    image = image.convert("RGBA")
    boite = image.getbbox()
    if boite:
        image = image.crop(boite)

    cote = max(image.size)
    carre = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    carre.paste(image, ((cote - image.width) // 2, (cote - image.height) // 2))
    return carre.resize((taille, taille), Image.LANCZOS)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("dossier")
    a.add_argument("slug")
    a.add_argument("--taille", type=int, default=256)
    a.add_argument("--images", type=int, default=20)
    a.add_argument("--sortie", default=SORTIE_DEFAUT)
    args = a.parse_args()

    if not os.path.isdir(args.dossier):
        sys.exit(f"{args.dossier} n'est pas un dossier.")

    chemins = prelever(images_du_dossier(args.dossier), args.images)
    nombre = len(chemins)
    lignes = (nombre + COLONNES - 1) // COLONNES

    planche = Image.new(
        "RGBA", (COLONNES * args.taille, lignes * args.taille), (0, 0, 0, 0)
    )
    opaques = 0

    for index, chemin in enumerate(chemins):
        with Image.open(chemin) as brute:
            # Un fond opaque se verrait comme un rectangle sur le thème sombre :
            # mieux vaut le signaler que le laisser passer.
            if brute.mode not in ("RGBA", "LA") and "transparency" not in brute.info:
                opaques += 1
            vignette = cadrer(brute, args.taille)
        planche.paste(
            vignette,
            ((index % COLONNES) * args.taille, (index // COLONNES) * args.taille),
        )

    os.makedirs(args.sortie, exist_ok=True)
    destination = os.path.join(args.sortie, f"{args.slug}.png")
    planche.save(destination, optimize=True)

    poids = os.path.getsize(destination) / 1024
    print(f"{destination}")
    print(f"  {nombre} images, {COLONNES} colonnes, {args.taille} px, {poids:.0f} Ko")

    if opaques:
        print(
            f"  ⚠ {opaques} image(s) sans couche alpha : le fond apparaîtra en "
            f"rectangle sur le thème sombre. Réexporte en PNG RGBA."
        )

    print("\nÀ déclarer dans mobile/src/donnees/planches.ts :")
    print(f'  "{args.slug}": {{')
    print(f'    source: require("../../assets/gestes/{args.slug}.png"),')
    print(f"    images: {nombre},")
    print(f"    colonnes: {COLONNES},")
    print("  },")


if __name__ == "__main__":
    main()
