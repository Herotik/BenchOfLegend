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
  --sans-recadrage  Garde le cadrage tel quel. C'est le bon choix pour les
                  images sorties de `rendre-geste.py`, qui les a déjà cadrées
                  à une échelle commune à tous les gestes. Recadrer les
                  rapetisserait ou les grossirait chacune selon son
                  encombrement, et le personnage changerait de taille d'un
                  exercice à l'autre.

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


def boite_commune(chemins):
    """Encombrement du dessin sur **l'ensemble** des images.

    Recadrer chaque image sur son propre contenu ferait grandir et rapetisser le
    personnage d'une image à l'autre : au plus bas d'une pompe le corps occupe
    moins de place, et il se retrouverait grossi pour compenser. Une seule boîte
    pour toute la série, et le mouvement redevient stable.
    """
    union = None
    for chemin in chemins:
        with Image.open(chemin) as image:
            boite = image.convert("RGBA").getbbox()
        if not boite:
            continue
        union = boite if union is None else (
            min(union[0], boite[0]),
            min(union[1], boite[1]),
            max(union[2], boite[2]),
            max(union[3], boite[3]),
        )
    return union


def cadrer(image, taille, boite):
    """Met l'image au carré sans la déformer.

    `boite` vaut `None` quand on ne recadre pas — les images de
    `rendre-geste.py` sont déjà cadrées à une échelle commune à tous les gestes.
    """
    image = image.convert("RGBA")
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
    a.add_argument("--sans-recadrage", action="store_true")
    args = a.parse_args()

    if not os.path.isdir(args.dossier):
        sys.exit(f"{args.dossier} n'est pas un dossier.")

    chemins = prelever(images_du_dossier(args.dossier), args.images)
    nombre = len(chemins)
    boite = None if args.sans_recadrage else boite_commune(chemins)
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
            vignette = cadrer(brute, args.taille, boite)
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
    print(f"  cadrage : {'tel quel' if boite is None else f'commun aux {nombre} images {boite}'}")

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
