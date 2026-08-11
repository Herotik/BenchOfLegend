"""Normalise les écussons de rang sortis du générateur.

Chaque médaillon arrive dans un cadre différent — portrait ou paysage, plus ou
moins rogné — et avec une bordure plus ou moins épaisse. Servis tels quels, ils
sembleraient « respirer » à chaque promotion, puisqu'ils se succèdent au même
emplacement du tableau de bord.

Le traitement recadre chacun sur son médaillon, le redresse au cercle vrai et
le sort à taille fixe : les cinq premiers écussons arrivaient ovales de 3 à
5 %, ce qui donnait jusqu'à 23 px d'écart de diamètre entre deux rangs. Les
fonds étant déjà transparents en sortie de génération, il n'y a pas de
détourage à faire.

    python scripts/normaliser-ecussons.py [--contraste 5-elyseen=1.25]
"""
from PIL import Image, ImageEnhance
import numpy as np
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, "docs", "ecussons-source")
SORTIE = os.path.join(RACINE, "public", "ranks")

TAILLE = 512
#: Part du carré occupée par le médaillon. Une marge est nécessaire : sans
#: elle, l'anticrénelage du bord se ferait rogner à l'affichage.
OCCUPATION = 0.94
#: Sous ce seuil d'alpha, on considère qu'on est hors du médaillon.
SEUIL_ALPHA = 12


def cadre_utile(image: Image.Image) -> tuple[int, int, int, int]:
    """Boîte englobante du médaillon, d'après le canal alpha."""
    alpha = np.asarray(image)[..., 3]
    lignes = np.where(alpha.max(axis=1) > SEUIL_ALPHA)[0]
    colonnes = np.where(alpha.max(axis=0) > SEUIL_ALPHA)[0]
    if len(lignes) == 0 or len(colonnes) == 0:
        raise ValueError("image entièrement transparente")
    return colonnes[0], lignes[0], colonnes[-1] + 1, lignes[-1] + 1


def normaliser(chemin: str, contraste: float) -> tuple[str, int, int]:
    image = Image.open(chemin).convert("RGBA")
    g, h, d, b = cadre_utile(image)
    medaillon = image.crop((g, h, d, b))

    if contraste != 1.0:
        # Le contraste s'applique avant la mise à l'échelle : sur l'image
        # pleine résolution, il creuse les ombres du relief sans créneler.
        rvb = ImageEnhance.Contrast(medaillon.convert("RGB")).enhance(contraste)
        medaillon = Image.merge("RGBA", (*rvb.split(), medaillon.split()[3]))

    # Mise au cercle vrai, par une mise à l'échelle non uniforme.
    #
    # Les médaillons sortent du générateur ovales de 3 à 5 % — un cadre non
    # carré, que le texte du prompt ne rattrape pas. Préserver ces proportions
    # reviendrait à propager l'erreur, et les rangs n'auraient pas tous le même
    # diamètre : l'image semblerait « respirer » à chaque promotion, puisqu'ils
    # se succèdent au même emplacement. On redresse donc au cercle. L'étirement
    # reste sous 5 %, invisible sur les figures, et les sources sont conservées.
    interieur = round(TAILLE * OCCUPATION)
    carre = medaillon.resize((interieur, interieur), Image.LANCZOS)

    final = Image.new("RGBA", (TAILLE, TAILLE), (0, 0, 0, 0))
    marge = (TAILLE - interieur) // 2
    final.paste(carre, (marge, marge))

    return final, medaillon.width, medaillon.height


def main() -> None:
    ajustements: dict[str, float] = {}
    for arg in sys.argv[1:]:
        if arg.startswith("--contraste"):
            _, valeur = arg.split("=", 1) if "=" in arg else (arg, "")
            cle, facteur = valeur.split("=") if "=" in valeur else (valeur, "1")
            ajustements[cle] = float(facteur)

    os.makedirs(SORTIE, exist_ok=True)
    fichiers = sorted(
        f for f in os.listdir(SOURCE) if f.lower().endswith((".png", ".webp", ".jpg"))
    )
    if not fichiers:
        raise SystemExit(f"Aucune image dans {SOURCE}")

    print(f"{'rang':<16} {'source':<14} {'ovalité':>8}")
    for f in fichiers:
        base = os.path.splitext(f)[0]
        # « 5-elyseen » -> « elyseen » : le numéro n'ordonne que les sources.
        slug = base.split("-", 1)[1] if "-" in base and base[0].isdigit() else base

        image, larg, haut = normaliser(
            os.path.join(SOURCE, f), ajustements.get(base, 1.0)
        )
        image.save(os.path.join(SORTIE, f"{slug}.png"), optimize=True)
        image.save(os.path.join(SORTIE, f"{slug}.webp"), quality=92, method=6)

        # Ovalité de la **source**, reportée à titre indicatif : elle est
        # redressée à la mise à l'échelle. Au-delà de 8 %, mieux vaut
        # régénérer que d'étirer.
        ovalite = larg / haut
        alerte = "  <- source ovale, redressée" if abs(ovalite - 1) > 0.03 else ""
        print(f"{slug:<16} {larg}x{haut:<9} {ovalite:>8.3f}{alerte}")

    print(f"\n{len(fichiers)} écussons -> {SORTIE} ({TAILLE}px, PNG + WebP)")


if __name__ == "__main__":
    main()
