"""Contrôle les postures déclarées dans `gestes_generes.py`, sans lancer de rendu.

    python3 scripts/verifier-gestes.py

## Pourquoi ce script existe

Deux fautes ont été livrées avant d'être vues à l'œil sur un rendu : un torse
vrillé, puis un **genou plié à l'envers** — la cuisse partait vers l'arrière et
le tibia revenait vers l'avant, ce qui donne une patte d'oiseau. Chacune a
demandé un rendu complet, un coup d'œil, et un aller-retour.

Or ces fautes-là sont géométriques. Une direction mal signée se voit dans les
chiffres bien avant de se voir sur une image, et le contrôle prend une
milliseconde là où le rendu prend deux minutes. D'où ce script : il ne juge pas
si un geste est *beau* — ça, seul l'œil le dit — mais si une posture est
anatomiquement possible.

Il tourne avec un Python ordinaire : `gestes_generes.py` n'importe `mathutils`
que dans les fonctions qui s'en servent, précisément pour que ses définitions
restent lisibles hors de Blender.

## Repère

    +Z  le haut              +X  la gauche du personnage
    -Y  la direction du regard (le personnage est de dos en +Y)
"""
import math
import os
import sys

# Pas de bytecode en cache. Ce script sert à éprouver des corrections : on y
# introduit une faute exprès, on vérifie qu'elle est vue, on rétablit. Or
# Python juge un `.pyc` valide sur la date **à la seconde** et la taille du
# source — et une direction changée de `+0.08` en `+0.20` garde exactement la
# même taille. Le rétablissement passait alors inaperçu, et le script criait
# une faute déjà corrigée.
sys.dont_write_bytecode = True

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gestes_generes as g  # noqa: E402

# Longueurs approximatives, en mètres, mesurées sur le squelette Mixamo. Elles
# n'ont pas à être exactes : elles servent à placer une articulation par rapport
# aux deux autres, et seul le signe du résultat compte.
CUISSE, TIBIA = 0.45, 0.45
#: Du bassin aux épaules, sur ce squelette.
TRONC = 0.50
BRAS, AVANT_BRAS = 0.28, 0.26

#: En deçà, l'articulation est trop alignée pour qu'on affirme quoi que ce soit —
#: une jambe tendue est légitime, seul un pli franc à l'envers est une faute.
SEUIL = 0.02


def _somme(a, b, k=1.0):
    return tuple(x + y * k for x, y in zip(a, b))


def _normalise(v):
    n = sum(x * x for x in v) ** 0.5
    return tuple(x / n for x in v) if n else v


def _saillie(racine, milieu, bout, axe):
    """De combien l'articulation dépasse du segment racine→bout, selon `axe`.

    Positif = elle dépasse dans le sens de l'axe. C'est la mesure qui dit dans
    quel sens un genou ou un coude est plié, sans avoir à raisonner sur des
    angles.
    """
    t = 0.5  # le milieu du segment suffit : on compare deux points, pas des aires
    reference = tuple(r + (b - r) * t for r, b in zip(racine, bout))
    return sum((m - r) * a for m, r, a in zip(milieu, reference, axe))


def _direction(valeur):
    """Direction d'une entrée de pose, ou `None` si c'en est un appui.

    Un appui donne un **point**, pas un axe : les contrôles qui raisonnent sur
    des directions n'ont rien à en dire, et `atteindre` garantit de toute façon
    que le membre y arrive proprement. Ce qui reste à vérifier sur un appui,
    c'est qu'il soit atteignable — voir `appuis_a_portee`.
    """
    if valeur is g.REPOS or valeur is g.SUIVRE or isinstance(valeur, g.Appui):
        return None
    # Une main posée à plat porte bien une direction — plus le roulis de sa
    # paume, dont les contrôles n'ont rien à dire.
    if isinstance(valeur, g.APlat):
        valeur = valeur.direction
    return _normalise(valeur)


def appuis_a_portee(pose, geste):
    """Un appui doit rester à portée du membre, et ne pas passer sous le sol.

    Hors de portée, `atteindre` tend le membre sans atteindre la cible : le
    geste reste rendable mais ne dit plus ce qu'on croyait. Sous le sol, c'est
    une faute de frappe — le sol est à zéro.
    """
    # Longueurs mesurées sur le squelette Mixamo, en mètres.
    portees = {"Arm": BRAS + AVANT_BRAS, "UpLeg": CUISSE + TIBIA}
    hauteur = geste.get("hauteur")

    # Un bras part de l'épaule, pas de la hanche : mesurer sa portée depuis le
    # bassin la sous-estimait d'une demi-longueur de tronc, et le contrôle
    # refusait des appuis parfaitement atteignables.
    #
    # L'épaule se cherche donc **le long de la colonne telle que la pose la
    # vise**, et non le long de l'axe de l'assise. Les deux se confondaient
    # tant qu'aucun geste ne redressait le buste : `Spine` valait toujours cet
    # axe-là. Depuis qu'un relevé en V, un russian twist et un rowing inversé
    # existent, ce n'est plus vrai, et l'approximation coûtait cher — sur le
    # rowing, elle plaçait l'épaule à plat à 0,31 m pendant qu'elle est en
    # réalité à 0,40, et refusait comme « hors de portée » une barre que la
    # main tient très bien.
    colonne = pose.get(g._os("Spine"))
    axe = _normalise(
        colonne if isinstance(colonne, (tuple, list)) and len(colonne) == 3
        else geste.get("assise", ((0, 0, 1), None))[0]
    )
    epaule = tuple(a * TRONC for a in axe)
    epaule = (epaule[0], epaule[1], epaule[2] + (hauteur or 0))
    fautes = []
    for nom, valeur in pose.items():
        if not isinstance(valeur, g.Appui):
            continue
        court = nom.removeprefix("mixamorig:")
        membre = "Arm" if court.endswith("Arm") else "UpLeg"
        if valeur.cible[2] < -0.01:
            fautes.append(f"{court} : appui sous le sol (z = {valeur.cible[2]:+.2f} m)")
        if hauteur is None:
            fautes.append(f"{court} : appui déclaré sans hauteur de bassin")
            continue
        # Distance de la racine du membre à la cible.
        racine = epaule if membre == "Arm" else (0, 0, hauteur)
        d = sum((c - r) ** 2 for c, r in zip(valeur.cible, racine)) ** 0.5
        # Tolérance serrée : c'est une marge de 35 cm qui avait laissé passer
        # un pied visé à 1,02 m pour une jambe de 90 — le membre pendait alors
        # en diagonale au lieu de toucher, et le personnage paraissait accroupi.
        # L'épaule étant plus haute que la hanche, 12 cm suffisent à absorber
        # l'approximation.
        if d > portees[membre] + 0.12:
            fautes.append(
                f"{court} : appui à {d:.2f} m de sa racine, hors de portée "
                f"(membre de {portees[membre]:.2f} m)"
            )
    return fautes


def pole_a_lendroit(pose, geste):
    """Le pôle d'un appui doit plier l'articulation dans le bon sens.

    Un genou ne plie que d'une façon : la jambe se replie vers l'**arrière** du
    corps, donc la rotule mène vers l'avant. Un coude fait l'inverse, il pointe
    vers l'arrière. Le pôle d'un appui est ce qui décide de ce sens, et rien ne
    le vérifiait : `genou_a_lendroit` raisonne sur des directions et sautait
    donc en silence tous les membres définis par un appui — c'est-à-dire
    exactement ceux des gestes au sol.

    « L'avant » se prend dans le repère du corps : à plat ventre, c'est le sol.
    """
    avant = _normalise(geste.get("assise", (None, (0, -1, 0)))[1])
    fautes = []
    for nom, valeur in pose.items():
        if not isinstance(valeur, g.Appui):
            continue
        court = nom.removeprefix("mixamorig:")
        pole = _normalise(valeur.pole)
        vers_avant = sum(a * b for a, b in zip(pole, avant))
        if court.endswith("UpLeg") and vers_avant < 0.1:
            fautes.append(
                f"{court} : pôle {tuple(round(c, 2) for c in pole)} — le genou "
                f"plierait à l'envers, il doit mener vers l'avant du corps "
                f"{tuple(round(c, 2) for c in avant)}"
            )
        if court.endswith("Arm") and not court.endswith("ForeArm") and vers_avant > -0.1:
            fautes.append(
                f"{court} : pôle {tuple(round(c, 2) for c in pole)} — le coude "
                f"pointerait vers l'avant, il doit partir vers l'arrière"
            )
    return fautes


def genou_a_lendroit(pose, geste):
    """Le genou doit être en avant du segment hanche→cheville.

    C'est l'invariant le plus simple qui distingue une jambe humaine d'une patte
    d'oiseau, et celui qui manquait.

    « En avant » se mesure dans le repère **du corps**, pas du monde : un
    personnage couché sur le dos a toujours des genoux qui plient du bon côté,
    mais ce côté n'est plus -Y. C'est l'assise du geste qui le dit.
    """
    avant = _normalise(geste.get("assise", (None, (0, -1, 0)))[1])
    fautes = []
    for cote in ("Left", "Right"):
        cuisse = _direction(pose.get(g._os(f"{cote}UpLeg")))
        tibia = _direction(pose.get(g._os(f"{cote}Leg")))
        if cuisse is None or tibia is None:
            continue
        hanche = (0.0, 0.0, 0.0)
        genou = _somme(hanche, cuisse, CUISSE)
        cheville = _somme(genou, tibia, TIBIA)
        avance = _saillie(hanche, genou, cheville, avant)
        if avance < -SEUIL:
            fautes.append(
                f"genou {cote} plié à l'envers : il dépasse de "
                f"{-avance * 100:.0f} cm vers l'arrière au lieu de l'avant"
            )
    return fautes


def dos_plat(pose, _geste):
    """Les trois vertèbres doivent pointer à peu près dans la même direction.

    Un dos qui s'enroule est ce qu'on corrige chez un débutant ; une
    démonstration ne peut pas l'enseigner.
    """
    vertebres = [_direction(pose.get(g._os(n))) for n in ("Spine", "Spine1", "Spine2")]
    if any(v is None for v in vertebres):
        return []

    def inclinaison(v):
        x, y, z = v
        return (y * y + x * x) ** 0.5, z

    angles = []
    for v in vertebres:
        plan, haut = inclinaison(v)
        angles.append(math.degrees(math.atan2(plan, haut)))
    ecart = max(angles) - min(angles)
    if ecart > 15:
        return [
            f"dos enroulé : {ecart:.0f}° d'écart entre la première et la "
            f"dernière vertèbre ({', '.join(f'{a:.0f}°' for a in angles)})"
        ]
    return []


def symetrie(pose, geste):
    """Gauche et droite doivent se répondre en miroir : X opposé, Y et Z égaux.

    La plupart de ces poses sont symétriques, et un signe oublié s'y voit ici
    avant de se voir à l'écran. Quelques gestes ne le sont pas **par nature** —
    une fente, un gainage latéral, un mountain climber travaillent un côté à la
    fois — et le déclarent par `symetrique: False`. Sans cette échappatoire, le
    contrôle crierait au loup sur les seuls gestes où l'asymétrie est le sujet.
    """
    if geste.get("symetrique", True) is False:
        return []
    fautes = []
    for membre in ("Shoulder", "Arm", "ForeArm", "UpLeg", "Leg"):
        gauche = _direction(pose.get(g._os(f"Left{membre}")))
        droite = _direction(pose.get(g._os(f"Right{membre}")))
        if gauche is None or droite is None:
            continue
        gx, gy, gz = gauche
        dx, dy, dz = droite
        if abs(gx + dx) > 0.05 or abs(gy - dy) > 0.05 or abs(gz - dz) > 0.05:
            fautes.append(
                f"{membre} : gauche {gx:+.2f},{gy:+.2f},{gz:+.2f} et droite "
                f"{dx:+.2f},{dy:+.2f},{dz:+.2f} ne sont pas en miroir"
            )
    return fautes


def directions_utilisables(pose, _geste):
    """Une direction nulle ne définit aucune orientation."""
    fautes = []
    for nom, valeur in pose.items():
        direction = _direction(valeur)
        if direction is None:
            continue
        # Repassé par `_direction`, qui déballe une main posée à plat : c'est
        # sa direction qu'on éprouve, pas l'objet qui la porte.
        brute = valeur.direction if isinstance(valeur, g.APlat) else valeur
        if sum(x * x for x in brute) < 1e-6:
            fautes.append(f"{nom.removeprefix('mixamorig:')} : direction nulle")
    return fautes


def assise_utilisable(_pose, geste):
    """Le haut et le regard d'une assise doivent définir un repère.

    Colinéaires, ils n'en définissent aucun. Et le cas **opposé** mérite d'être
    signalé à part : c'est celui du corps à plat ventre, où aligner la colonne
    laisse le regard tourné vers le plafond. La rotation qui reste à faire est
    alors un demi-tour, dont l'axe n'est pas déterminé par les deux directions
    seules — il a donné un personnage en équilibre sur la tête avant qu'on le
    traite explicitement.
    """
    assise = geste.get("assise")
    if not assise:
        return []
    haut, regard = _normalise(assise[0]), _normalise(assise[1])
    produit = sum(a * b for a, b in zip(haut, regard))
    if abs(produit) > 0.99:
        return [
            f"assise dégénérée : haut {haut} et regard {regard} sont "
            f"{'opposés' if produit < 0 else 'confondus'}, ils ne définissent "
            "aucun repère"
        ]
    return []


def bras_pas_en_croix(pose, geste):
    """Un bras laissé au repos, debout, se retrouve **en croix**.

    C'est le piège le plus coûteux du moteur, et il ne se voit pas dans le
    code : `REPOS` se lit « au repos » et veut dire « comme le modèle se
    tient ». Or ce mannequin-ci se tient en T. Une élévation latérale partant
    de là commence bras déjà à l'horizontale et n'a plus rien à élever — deux
    poses identiques, un personnage immobile pendant deux secondes.

    La faute est restée invisible tant que les rendus se faisaient sur
    l'ancien personnage habillé, qui se tenait bras le long du corps. Elle est
    apparue d'un coup le jour où tout est passé sur le mannequin.

    Le contrôle ne porte que sur les gestes **debout** : un corps couché a une
    tout autre raison de laisser un bras au repos, et l'assise fait alors
    tourner ce repos avec lui.
    """
    if geste.get("assise"):
        return []
    fautes = []
    for cote in ("Left", "Right"):
        if pose.get(g._os(f"{cote}Arm")) is None:
            fautes.append(
                f"{cote}Arm est au repos sur un geste debout : le modèle se "
                "tient en croix, il faut poser `BRAS_LE_LONG`"
            )
    return fautes


def rythme_tenable(geste):
    """Les temps d'arrêt déclarés doivent laisser de quoi se déplacer.

    Un geste dont les arrêts font le tour entier ne bouge plus : la
    démonstration montre une photo. Et un compte qui ne tombe pas juste — trois
    arrêts pour quatre poses — n'est pas une erreur d'arrondi mais une pose
    qu'on a ajoutée sans y penser, donc des arrêts décalés d'un cran.

    Le compte se fait comme le moteur le fera : la première pose est le point
    de bouclage et son arrêt se partage en deux, les poses intermédiaires sont
    traversées deux fois par tour.
    """
    arrets = geste.get("pauses")
    if arrets is None:
        return []
    cles = geste["cles"]
    if len(arrets) != len(cles):
        return [
            f"{len(arrets)} temps d'arrêt déclarés pour {len(cles)} poses clés"
        ]
    if any(a < 0 for a in arrets):
        return ["un temps d'arrêt négatif"]
    total = sum(arrets) + sum(arrets[1:-1]) - arrets[0] / 2.0
    if total >= 1.0:
        return [
            f"les temps d'arrêt occupent {total:.0%} du tour : il ne reste "
            "rien pour se déplacer"
        ]
    return []


CONTROLES = (
    directions_utilisables,
    genou_a_lendroit,
    dos_plat,
    symetrie,
    assise_utilisable,
    appuis_a_portee,
    pole_a_lendroit,
    bras_pas_en_croix,
)

#: Contrôles qui portent sur le geste entier et non sur une pose.
CONTROLES_DU_GESTE = (rythme_tenable,)


def main():
    total = 0
    for nom in sorted(g.GESTES):
        for rang, pose in enumerate(g.GESTES[nom]["cles"]):
            for controle in CONTROLES:
                for faute in controle(pose, g.GESTES[nom]):
                    print(f"  ✗ {nom} · pose {rang + 1} — {faute}")
                    total += 1
        for controle in CONTROLES_DU_GESTE:
            for faute in controle(g.GESTES[nom]):
                print(f"  ✗ {nom} — {faute}")
                total += 1

    poses = sum(len(x["cles"]) for x in g.GESTES.values())
    if total:
        print(f"\n{total} faute(s) sur {len(g.GESTES)} gestes ({poses} poses).")
        sys.exit(1)
    print(f"{len(g.GESTES)} gestes, {poses} poses : postures cohérentes.")


if __name__ == "__main__":
    main()
