"""Contrôle les planches livrées, sans lancer Blender.

    python3 scripts/verifier-planches.py

## Pourquoi

Trois fautes ont été livrées et vues par l'utilisateur avant de l'être ici, et
toutes trois se lisent dans les fichiers eux-mêmes :

- **Sept planches portaient encore l'ancien personnage.** Le mannequin nu avait
  remplacé l'hoplite en robe rouge sur les captations, et personne n'avait
  pensé aux gestes *écrits*, rendus bien plus tôt sur l'hoplite. Rien ne les
  regardait ; il a fallu qu'on les voie à l'écran.

- **Une planche déclarait un nombre d'images qu'elle n'avait pas.** Passer de
  vingt à trente-deux demande de rendre *et* de déclarer. Oublier la déclaration
  fait jouer la moitié de la planche ; oublier le rendu fait défiler du vide.

- **Un geste sautait d'une image à l'autre.** Ce n'est pas la durée qui décide
  de la fluidité mais le chemin parcouru par image : un maintien de planche de
  3,6 s en vingt images est fluide, un burpee de 2 s ne l'est pas.

## Deux nombres pour la fluidité, et un seul qui refuse

La colonne « saut » en donne deux : la **moyenne** par image, sur laquelle le
script refuse, et le **pire** pas du tour, qu'il se contente d'afficher.

Ce partage est le résultat d'une mesure, pas d'une prudence. La moyenne cache :
la fente livrée affichait 3,2 — bien sous le seuil — alors qu'elle restait sept
images strictement immobiles au point bas puis bondissait de 7,3 par image. Le
pire pas, lui, le disait. La tentation était donc d'en faire un second refus.

Elle ne tient pas. Sur les planches déjà validées à l'œil, le burpee culmine à
7,1 et le gainage bas à 5,9 sans que personne ne les trouve hachés ; la fente
refusée culminait à 7,3. Aucun seuil ne les sépare. Le rapport du pire pas à la
médiane ne les sépare pas davantage : 2,5 pour la fente refusée, mais 3,2 pour
le mountain climber, dont les temps d'arrêt sont **voulus** et lus comme tels.

C'est qu'un arrêt déclaré et un hachage donnent exactement le même profil. Ce
qui les distingue est de savoir si l'arrêt appartient à l'exercice, et aucun
pixel ne le dit. Le nombre est donc montré et non opposé : il sert à regarder au
bon endroit, pas à trancher à la place de l'œil.

## Ce qu'il ne peut pas dire

Si le geste est **juste**. Ça, seul un œil qui connaît l'exercice le dit, et
c'est à quoi sert la page de revue.
"""
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RACINE, "mobile", "assets", "gestes")

#: Au-delà, le corps traverse trop de chemin d'une image à la suivante et le
#: geste saccade. Mesuré sur les vingt-sept planches livrées : les six qu'on a
#: dû passer à trente-deux images dépassaient toutes cette valeur, aucune de
#: celles qui passaient bien ne l'atteignait.
SAUT_MAXIMAL = 4.2

#: Part de pixels franchement rouges au-delà de laquelle le personnage n'est
#: pas le mannequin nu. La chair est rosée mais peu saturée — elle en compte
#: zéro pour cent —, la robe de l'hoplite en compte quinze à vingt-deux.
ROUGE_MAXIMAL = 0.02


def registre():
    """Ce que `planches.ts` déclare : slug → images, colonnes, durée, fichier.

    Le fichier n'est pas toujours celui du slug. Une planche peut en
    **partager** une autre quand deux exercices ne diffèrent que par le tempo —
    une traction négative est une traction dont on ralentit la descente, et le
    moteur rejouant ses clés en miroir, les deux images sortiraient identiques
    au pixel près. `planches.ts` le déclare alors par `partage`, et c'est la
    seule dérogation admise : sans elle, une image manquante et une image
    réutilisée se ressembleraient.
    """
    texte = open(
        os.path.join(RACINE, "mobile", "src", "donnees", "planches.ts"),
        encoding="utf-8",
    ).read()
    sortie = {}
    for bloc in re.finditer(r'^  "?([a-z0-9-]+)"?: \{\n(.*?)^  \},', texte, re.M | re.S):
        slug, corps = bloc.group(1), bloc.group(2)

        def champ(nom, defaut):
            trouve = re.search(rf"{nom}: (\d+)", corps)
            return int(trouve.group(1)) if trouve else defaut

        partage = re.search(r'partage: "([a-z0-9-]+)"', corps)
        sortie[slug] = (
            champ("images", 20), champ("colonnes", 4), champ("duree", 1400),
            partage.group(1) if partage else slug,
        )
    return sortie


def controler(slug, images, colonnes, duree, fichier=None):
    import numpy as np
    from PIL import Image

    chemin = os.path.join(ASSETS, f"{fichier or slug}.png")
    if not os.path.isfile(chemin):
        return [f"aucune image : {chemin}"], (None, None)

    fautes = []
    brut = Image.open(chemin)
    lignes = -(-images // colonnes)
    if brut.width % colonnes or brut.height % lignes:
        fautes.append(
            f"{brut.width}×{brut.height} px ne se divise pas en "
            f"{colonnes}×{lignes} vignettes"
        )
        return fautes, (None, None)

    # Les vignettes sont **carrées** — `planche-geste.py` les met au carré — et
    # c'est ce qui trahit un nombre d'images mal déclaré. Une planche rendue en
    # vingt images fait 1024×1280 ; relue en quatre colonnes sur huit lignes,
    # elle se divise encore sans reste (1280 = 8 × 160) et l'on découpe
    # tranquillement des vignettes de 256 × 160, à cheval sur deux images. Rien
    # ne le signalait : la dernière case n'est pas vide pour autant.
    largeur, hauteur = brut.width // colonnes, brut.height // lignes
    if abs(largeur - hauteur) > 1:
        fautes.append(
            f"vignettes de {largeur}×{hauteur} px, donc pas carrées : la "
            f"planche ne contient pas {images} images sur {colonnes} colonnes"
        )
        return fautes, (None, None)

    rgba = np.array(brut.convert("RGBA"))
    opaques = rgba[rgba[:, :, 3] > 200][:, :3].astype(int)
    if len(opaques):
        r, g, b = opaques[:, 0], opaques[:, 1], opaques[:, 2]
        rouge = ((r > 90) & (r > g * 1.9) & (r > b * 1.9)).mean()
        if rouge > ROUGE_MAXIMAL:
            fautes.append(
                f"{rouge:.0%} de rouge saturé : ce n'est pas le mannequin nu "
                "mais l'ancien personnage habillé"
            )

    # Le cadrage est calculé sur l'encombrement du geste : si le corps sort du
    # cadre, il est rogné. Un saut trop haut coupait les doigts de neuf pixels
    # au sommet, sur trois images — le genre de chose qui ne se voit qu'en
    # arrêtant l'animation pile là.
    #
    # Toucher le bord ne suffit pourtant pas à conclure. Un geste qui remplit
    # le cadre **exactement** l'effleure sans rien y perdre, et c'est le cas du
    # burpee : deux mètres soixante de haut pour un champ de deux mètres
    # soixante. Ce qui sépare l'effleurement de la coupe se lit dans l'alpha du
    # bord. Une silhouette tangente n'y pose que son liseré antialiasé — sur le
    # burpee, sept contacts de bord, pas **un seul** pixel au-dessus de 200. Un
    # corps tranché y montre sa chair pleine : le pied coupé du saut squaté en
    # alignait vingt-trois à 255, et les doigts coupés au sommet, cinq.
    #
    # On compte donc les pixels franchement opaques, et non les pixels visibles.
    #
    # Et l'on ne compte que la **chair**. Un agrès a le droit de sortir du
    # cadre : une barre de traction est à 2,25 m, ses montants descendent au
    # sol, et le champ de 2,60 m que toutes les démonstrations partagent ne
    # peut pas contenir à la fois ces montants et un corps qui monte jusqu'au
    # menton. Couper le pied d'un portique est un cadrage, couper le pied d'un
    # personnage est une faute — et c'est celle-ci qu'on cherche.
    #
    # Les deux se distinguent à la couleur : les accessoires sont peints d'un
    # bleu sombre unique, `(0.13, 0.17, 0.26)`, choisi précisément pour qu'un
    # agrès ne se confonde avec aucune peau.
    alpha = rgba[:, :, 3]
    bleu = (
        (rgba[:, :, 2].astype(int) > rgba[:, :, 0].astype(int) + 15)
        & (rgba[:, :, 2].astype(int) > rgba[:, :, 1].astype(int) + 10)
    )
    chair = (alpha > 200) & ~bleu
    for k in range(images):
        c, l = k % colonnes, k // colonnes
        v = chair[l * hauteur:(l + 1) * hauteur, c * largeur:(c + 1) * largeur]
        bords = {
            "haut": int(v[0, :].sum()),
            "bas": int(v[-1, :].sum()),
            "gauche": int(v[:, 0].sum()),
            "droite": int(v[:, -1].sum()),
        }
        touches = {nom: n for nom, n in bords.items() if n}
        if touches:
            fautes.append(
                f"image {k + 1} rognée : "
                + ", ".join(f"{n} px pleins sur le bord {nom}" for nom, n in touches.items())
            )
            break

    gris = np.array(brut.convert("LA")).astype(float)
    h, w = gris.shape[0] // lignes, gris.shape[1] // colonnes
    vignettes = []
    for k in range(images):
        c, l = k % colonnes, k // colonnes
        v = gris[l * h:(l + 1) * h, c * w:(c + 1) * w]
        vignettes.append(v[:, :, 0] * v[:, :, 1] / 255)

    # La dernière case déclarée doit contenir quelque chose : une planche rendue
    # en vingt images et déclarée en trente-deux ferait défiler douze cases
    # vides, ce qui à l'écran est un personnage qui disparaît.
    if vignettes[-1].max() < 1.0:
        fautes.append(
            f"la {images}e image est vide : la planche en a probablement moins "
            "que ce que `planches.ts` déclare"
        )

    sauts = [
        float(np.abs(vignettes[k] - vignettes[(k + 1) % images]).mean())
        for k in range(images)
    ]
    moyen = sum(sauts) / len(sauts)
    if moyen > SAUT_MAXIMAL:
        fautes.append(
            f"saut moyen de {moyen:.1f} par image : le geste saccade, "
            f"il lui faut plus que {images} images"
        )
    # Le retour au départ ne doit pas se voir davantage qu'un pas ordinaire.
    #
    # Le seuil absolu compte autant que le rapport : sur un **maintien**, rien
    # ne bouge, la moyenne est nulle, et trois fois rien reste rien — mais
    # `0,02 > 3 × 0,00` est vrai, et la suspension à la barre se faisait refuser
    # pour une couture qu'aucun œil ne peut voir. Un dixième de niveau de gris
    # par pixel est le plancher en deçà duquel il n'y a rien à juger.
    if sauts[-1] > 3 * moyen and sauts[-1] > 0.1:
        fautes.append(
            f"la boucle saute : {sauts[-1]:.1f} contre {moyen:.1f} en moyenne"
        )
    return fautes, (moyen, max(sauts))


def main():
    planches = registre()
    total = 0
    print(f"\n=== {len(planches)} planches ===")
    for slug, (images, colonnes, duree, fichier) in sorted(planches.items()):
        fautes, (moyen, pire) = controler(slug, images, colonnes, duree, fichier)
        pas = "  —      —  " if moyen is None else f"{moyen:5.2f}  {pire:5.2f}"
        etat = "ok" if not fautes else "; ".join(fautes)
        print(f"  {slug:28s} {images:2d} img  saut {pas}   {etat}")
        total += len(fautes)

    if total:
        print(f"\n{total} faute(s).")
        sys.exit(1)
    print(f"\n{len(planches)} planches : toutes propres.")


if __name__ == "__main__":
    main()
