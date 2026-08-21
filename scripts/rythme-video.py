"""Le **rythme** d'un exercice, lu sur une vidéo entière.

    python3 scripts/rythme-video.py <relevé.npz> [--debut N] [--fin N]

## Pourquoi

`geste-depuis-video.py` prend des numéros d'images qu'on lui donne à la main —
deux le plus souvent, les deux extrêmes — et le moteur les parcourt en
aller-retour à cadence régulière. Tout ce qui reste de la vidéo est jeté : la
durée d'une répétition, le fait qu'un genou **marque** un temps en haut, qu'une
descente soit deux fois plus lente que la remontée. Or c'est souvent là qu'est
l'exercice. Un mountain climber sans temps d'arrêt n'est plus un mountain
climber mais un ciseau ; un mollet debout remonté aussi vite qu'il est descendu
n'est plus le mouvement contrôlé que la consigne demande.

Ces informations sont **déjà dans le relevé** : `relever-video.py` garde les
1613 images d'une vidéo et sa cadence. Il suffisait de les lire.

## Comment

Trois étapes, sans réglage propre à l'exercice — ce qui compte, parce qu'un
seuil choisi sur une vidéo se trompe sur la suivante.

1. **Une mesure scalaire du mouvement.** Les 33 repères sont ramenés dans le
   repère du corps — origine au milieu des hanches, échelle donnée par la
   distance hanches-épaules — puis projetés sur leur première composante
   principale. Ce que ça donne oscille une fois par répétition, quel que soit
   l'exercice, sans qu'on ait eu à désigner l'articulation qui travaille.

2. **La période**, par autocorrélation du signal. C'est la durée d'une
   répétition, et donc le `duree` du geste.

3. **Le cycle moyen.** Toutes les répétitions sont repliées sur une période et
   moyennées : le bruit de l'estimateur, qui n'est pas périodique, s'efface.
   Sur ce cycle-là, la **vitesse** du corps — la norme de la dérivée dans
   l'espace des repères — dit tout : ses minimums sont les poses clés, et la
   largeur de chaque creux est le temps d'arrêt.

En sortie : les numéros d'images à passer à `--images`, la durée réelle d'une
répétition, et les `pauses` à recopier dans le geste.

## Ce que ça ne fait pas

Le moteur parcourt les poses clés en **aller-retour**. Un exercice dont la
descente et la remontée diffèrent — trois secondes pour descendre, une pour
remonter — ne peut donc pas être rendu fidèlement, et l'outil le signale au
lieu de faire semblant.
"""
import argparse
import sys

import numpy as np

#: Milieu des hanches et milieu des épaules, dans la numérotation MediaPipe.
HANCHES = (23, 24)
EPAULES = (11, 12)

#: En deçà, un repère est deviné plutôt que vu, et le suivre revient à suivre
#: l'imagination de l'estimateur.
VISIBLE = 0.5

#: Un creux de vitesse compte comme un arrêt tant que le corps y va moins vite
#: que cette fraction de sa vitesse moyenne sur le tour. Ce n'est pas un
#: réglage fin : entre 0,3 et 0,5 les temps d'arrêt trouvés ne bougent que de
#: quelques centièmes de tour.
ARRET = 0.40


def normaliser(monde, vis):
    """Repères centrés sur les hanches et mis à l'échelle du buste.

    Sans quoi le signal suivrait le sujet qui s'approche de la caméra plutôt
    que le geste qu'il fait.
    """
    centre = monde[:, HANCHES, :].mean(axis=1, keepdims=True)
    buste = np.linalg.norm(
        monde[:, EPAULES, :].mean(axis=1) - centre[:, 0, :], axis=1
    )
    buste = np.where(buste > 1e-3, buste, 1.0)[:, None, None]
    points = (monde - centre) / buste
    # Un repère à peine visible est remplacé par sa valeur moyenne : le laisser
    # sauter d'une image à l'autre inventerait de la vitesse là où il n'y a que
    # de l'incertitude.
    masque = (vis < VISIBLE)[:, :, None]
    vus = (~masque).sum(axis=0, keepdims=True)
    # Somme des seuls repères vus, divisée par leur nombre. `nanmean` dirait la
    # même chose mais avertirait bruyamment pour les repères **jamais** vus —
    # un pied hors cadre pendant toute la fenêtre —, alors que le cas est
    # normal et sa réponse, zéro, est la bonne : un repère qu'on n'a jamais vu
    # ne doit rien apporter au signal.
    somme = np.where(masque, 0.0, points).sum(axis=0, keepdims=True)
    remplacement = somme / np.maximum(vus, 1)
    return np.where(masque, np.broadcast_to(remplacement, points.shape), points)


def sans_derive(x, largeur):
    """Retire la lente dérive du signal, en gardant ce qui oscille.

    Un sujet qui se rapproche de la caméra, se replace entre deux séries ou
    se redresse peu à peu produit une variation bien plus ample que le geste
    lui-même. La première composante principale la suit, et l'autocorrélation
    du résultat décroît alors sans jamais remonter : plus de période, plus de
    rythme. C'est ce qui arrivait sur la corde à sauter, où la dérive noyait un
    rebond pourtant très net.

    On soustrait donc une moyenne glissante plus large qu'une répétition : elle
    suit la dérive et ignore l'oscillation, qui se moyenne à zéro.
    """
    largeur = max(3, int(largeur) | 1)
    if largeur >= len(x):
        return x - x.mean()
    noyau = np.ones(largeur) / largeur
    # Bords prolongés par la valeur du bord : sans ça la moyenne glissante
    # plonge vers zéro aux extrémités et y invente une oscillation.
    marge = largeur // 2
    etendu = np.concatenate([np.full(marge, x[0]), x, np.full(marge, x[-1])])
    return x - np.convolve(etendu, noyau, mode="valid")


def signal_principal(points):
    """Projection sur la première composante principale : une valeur par image."""
    plat = points.reshape(len(points), -1)
    plat = plat - plat.mean(axis=0, keepdims=True)
    # `svd` sur la matrice centrée : le premier vecteur singulier droit est la
    # direction de plus grande variation, c'est-à-dire le mouvement lui-même.
    _, _, vt = np.linalg.svd(plat, full_matrices=False)
    return plat @ vt[0]


def periode(signal, mini, maxi):
    """Durée d'une répétition, en images, par autocorrélation.

    Le pic retenu doit être un **maximum local** : une autocorrélation qui ne
    fait que décroître ne dit pas qu'il y a une période courte, elle dit qu'il
    n'y en a aucune. Prendre son argmax revenait à répondre systématiquement la
    plus petite durée cherchée — 250 ms pour la corde à sauter, soit quatre
    rebonds par seconde, que personne ne fait.
    """
    x = sans_derive(signal - signal.mean(), 2 * maxi)
    correle = np.correlate(x, x, mode="full")[len(x) - 1:]
    correle = correle / (correle[0] or 1.0)
    maxi = min(maxi, len(correle) - 1)
    if maxi <= mini:
        sys.exit(
            f"Aucune période cherchable entre {mini} et {maxi} images : la "
            "fenêtre demandée est plus courte qu'une répétition."
        )

    sommets = [
        k for k in range(max(mini, 1), maxi)
        if correle[k] >= correle[k - 1] and correle[k] >= correle[k + 1]
    ]
    if not sommets:
        sys.exit(
            f"Aucune répétition entre {mini} et {maxi} images : "
            "l'autocorrélation ne fait que décroître, ce qui est la signature "
            "d'une dérive et non d'un rythme. Élargir la fenêtre, ou la "
            "resserrer sur un seul exercice."
        )
    meilleur = max(sommets, key=lambda k: correle[k])
    return int(meilleur), float(correle[meilleur])


def cycle_moyen(points, t):
    """Replie toutes les répétitions sur une période et les moyenne."""
    tours = len(points) // t
    if tours < 2:
        sys.exit(
            f"Une seule répétition tient dans la fenêtre ({len(points)} images "
            f"pour une période de {t}) : il n'y a pas de rythme à moyenner."
        )
    empile = points[: tours * t].reshape(tours, t, *points.shape[1:])
    return empile.mean(axis=0), tours


def vitesse(cycle):
    """Norme de la dérivée, sur un cycle **circulaire**.

    Circulaire parce que le cycle boucle : calculer la dérivée en oubliant que
    la dernière image précède la première inventerait un saut de vitesse à la
    jointure, exactement là où il n'y en a pas.
    """
    plat = cycle.reshape(len(cycle), -1)
    d = np.roll(plat, -1, axis=0) - np.roll(plat, 1, axis=0)
    return np.linalg.norm(d, axis=1) / 2.0


def creux(v, seuil):
    """Plages contiguës — circulaires — où la vitesse passe sous le seuil."""
    lent = v < seuil
    if lent.all():
        return [(0, len(v))]
    if not lent.any():
        return []
    # On fait tourner le tableau jusqu'à démarrer sur une image rapide : sans
    # ça, un creux à cheval sur la jointure serait compté comme deux.
    depart = int(np.argmin(lent))
    tourne = np.roll(lent, -depart)
    plages, debut = [], None
    for i, bas in enumerate(tourne):
        if bas and debut is None:
            debut = i
        elif not bas and debut is not None:
            plages.append(((debut + depart) % len(v), i - debut))
            debut = None
    if debut is not None:
        plages.append(((debut + depart) % len(v), len(v) - debut))
    return plages


def symetrie(v):
    """À quel point l'aller ressemble au retour, entre 0 et 1.

    Le moteur parcourt ses poses clés en aller-retour : un exercice dont la
    descente est deux fois plus lente que la montée n'y entre pas. Autant le
    dire, plutôt que de sortir un rythme que le rendu ne saura pas tenir.
    """
    creux_v = creux(v, v.mean() * ARRET)
    if len(creux_v) < 2:
        return 1.0
    # On aligne le cycle sur le creux le plus long, puis on compare la première
    # moitié à la seconde retournée.
    ancre = max(creux_v, key=lambda c: c[1])[0]
    aligne = np.roll(v, -ancre)
    moitie = len(aligne) // 2
    aller, retour = aligne[:moitie], aligne[moitie: 2 * moitie][::-1]
    ecart = np.abs(aller - retour).mean()
    return float(max(0.0, 1.0 - ecart / (v.mean() or 1.0)))


def main():
    a = argparse.ArgumentParser()
    a.add_argument("releve", help="un .npz produit par relever-video.py")
    a.add_argument("--debut", type=int, default=0,
                   help="première image de la fenêtre à analyser")
    a.add_argument("--fin", type=int, default=None,
                   help="dernière image (exclue)")
    a.add_argument("--periode-min", type=int, default=12,
                   help="période la plus courte cherchée, en images")
    a.add_argument("--periode-max", type=int, default=0,
                   help="période la plus longue ; 0 pour un quart de la fenêtre")
    args = a.parse_args()

    d = np.load(args.releve)
    fps = float(d["fps"])
    fin = args.fin if args.fin is not None else len(d["monde"])
    monde, vis = d["monde"][args.debut:fin], d["vis"][args.debut:fin]
    if len(monde) < 40:
        sys.exit(f"Fenêtre trop courte : {len(monde)} images.")

    points = normaliser(monde, vis)
    sig = signal_principal(points)
    maxi = args.periode_max or max(args.periode_min + 1, len(sig) // 4)
    t, force = periode(sig, args.periode_min, maxi)
    cycle, tours = cycle_moyen(points, t)
    v = vitesse(cycle)

    print(f"\n{len(monde)} images à {fps:.1f} i/s, soit {len(monde)/fps:.1f} s")
    print(f"Période : {t} images = {1000 * t / fps:.0f} ms "
          f"({tours} répétitions, autocorrélation {force:.2f})")
    if force < 0.35:
        print("  ⚠ périodicité faible : la fenêtre contient probablement "
              "plusieurs exercices, ou un mouvement qui ne se répète pas.")

    sym = symetrie(v)
    print(f"Symétrie aller-retour : {sym:.2f}"
          + ("" if sym > 0.75 else
             "  ⚠ l'aller et le retour n'ont pas la même durée ; le moteur, "
             "qui les rejoue en miroir, ne pourra pas le rendre."))

    plages = sorted(creux(v, v.mean() * ARRET), key=lambda c: -c[1])
    if not plages:
        print("\nAucun temps d'arrêt : le mouvement est continu.")
        print("  \"pauses\" est inutile ici.")
        return

    print(f"\n{len(plages)} temps d'arrêt, du plus long au plus court :")
    cles, pauses = [], []
    for depart, duree in plages:
        milieu = (depart + duree // 2) % t
        # Ramené sur la vidéo : le milieu du creux, dans la première
        # répétition entière, est l'image à relever.
        image = args.debut + milieu
        part = duree / t
        cles.append(image)
        pauses.append(part)
        print(f"  image {image:5d}   {1000 * duree / fps:4.0f} ms   "
              f"{part:.2f} du tour")

    ordre = np.argsort(cles)
    cles = [cles[i] for i in ordre]
    pauses = [pauses[i] for i in ordre]
    # Le moteur parcourt les clés en aller-retour : les poses intermédiaires y
    # passent deux fois, les extrémités une seule. Le total ci-dessous compte
    # donc comme le moteur comptera.
    total = sum(pauses) + sum(pauses[1:-1])
    if total >= 0.95:
        facteur = 0.60 / total
        pauses = [p * facteur for p in pauses]
        print(f"\n  ⚠ les arrêts occupent {total:.0%} du tour — le corps ne "
              "bougerait presque plus. Ramenés à 60 % ci-dessous ; c'est le "
              "signe qu'il manque une pose clé entre deux arrêts.")

    print("\nÀ passer à geste-depuis-video.py :")
    print(f"  --images {','.join(str(c) for c in cles)} "
          f"--duree {1000 * t / fps:.0f}")
    print("\nÀ recopier dans le geste :")
    print("        \"pauses\": [" + ", ".join(f"{p:.2f}" for p in pauses) + "],")


if __name__ == "__main__":
    main()
