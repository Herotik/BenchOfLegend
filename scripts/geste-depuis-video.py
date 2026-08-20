"""Écrit un geste à partir d'une vidéo de démonstration.

    python3 scripts/geste-depuis-video.py <video.mp4> <nom-du-geste> \
        [--images 288,444,1044] [--assise ventre|dos|cote|debout]

## Pourquoi

Écrire une posture à la main revient à deviner une vingtaine d'angles, puis à
les corriger un par un en regardant un rendu. Sur les gestes au sol, ça n'a
jamais convergé : dix tours pour un seul mouvement, sans y arriver.

Une vidéo de démonstration contient déjà la réponse. Un estimateur de pose en
tire les positions des articulations en trois dimensions ; il ne reste qu'à les
exprimer dans le repère du personnage et à les écrire au format des gestes.

## Ce que le script fait, et ne fait pas

Il **ne copie pas** la vidéo : il en lit des positions d'articulations —
c'est-à-dire des faits anatomiques — et produit une animation originale jouée
par notre propre personnage. La vidéo sert de référence, comme un modèle pour
un dessinateur, et ne part pas dans l'application.

Il ne lit pas non plus n'importe quelle vidéo : il faut que le sujet soit
entier dans le cadre et vu sous un angle où les membres ne se cachent pas.

## Ce qu'il faut installer

    pip install opencv-python-headless mediapipe
    curl -o pose_landmarker.task https://storage.googleapis.com/mediapipe-models/\\
pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task

## Le repère, et pourquoi on ne peut pas s'en passer

L'estimateur rend des coordonnées liées à la **caméra** : elles changent si le
sujet se tourne. Les gestes, eux, sont écrits dans le repère du **personnage**.
On reconstruit donc les axes du corps à partir des articulations elles-mêmes —
le haut va des hanches aux épaules, la gauche d'une épaule à l'autre — et l'on
réexprime chaque membre là-dedans. Le résultat ne dépend plus de l'angle de
prise de vue.

## L'inclinaison, qu'on perdait

Ce repère interne donne la **forme** du corps, et rien d'autre : replier le
sujet dans ses propres axes efface son inclinaison par rapport au sol. Le
premier relevé de planche l'a payé cher — corps parfaitement droit, mains
posées, et les pieds à cinquante-deux centimètres en l'air. Une planche haute
n'est pas horizontale : les épaules sont à hauteur de bras, les orteils au sol,
soit une dizaine de degrés de pente.

Cette pente est pourtant dans la vidéo. La verticale de l'image, c'est la
gravité — de tous les axes de l'estimateur, le plus sûr, parce qu'il ne dépend
d'aucune estimation de profondeur. On mesure donc de combien le haut du corps
et le regard s'écartent de cette verticale, et l'on **fait tourner l'assise**
d'autant. Le corps garde sa forme, et retrouve sa pente.
"""
import argparse
import math
import os
import sys

import numpy as np

MODELE = os.environ.get("MODELE_POSE", "/tmp/pg/pose_landmarker.task")

# Indices des articulations dans le squelette de l'estimateur.
NEZ = 0
#: Les oreilles, et non le nez, donnent l'axe de la tête. Le nez est en avant
#: **et** en dessous du crâne : s'en servir pour orienter la nuque enfonçait la
#: tête sous les épaules, un menton dans la poitrine que le sujet filmé n'avait
#: pas. Le milieu des oreilles est, lui, sur l'axe du cou.
OREILLE = {"G": 7, "D": 8}
EPAULE = {"G": 11, "D": 12}
COUDE = {"G": 13, "D": 14}
POIGNET = {"G": 15, "D": 16}
#: La base de l'index : elle donne la direction des doigts, donc l'orientation
#: de la main posée. Sans elle, la main d'appui garde son orientation debout et
#: pend doigts vers le sol au lieu de s'y poser à plat.
INDEX = {"G": 19, "D": 20}
HANCHE = {"G": 23, "D": 24}
GENOU = {"G": 25, "D": 26}
CHEVILLE = {"G": 27, "D": 28}
POINTE = {"G": 31, "D": 32}

#: Assises connues : (haut, regard) dans le repère du monde de Blender.
ASSISES = {
    "debout": ((0, 0, 1), (0, -1, 0)),
    "dos": ((0, 1, 0), (0, 0, 1)),
    "ventre": ((0, 1, 0), (0, 0, -1)),
    "cote": ((0, 1, 0), (-1, 0, 0)),
}

#: Le haut du monde dans le repère de l'estimateur : son axe y descend avec
#: l'image. C'est la seule direction absolue dont on dispose, et elle vaut tant
#: que la caméra est tenue droite — ce qui est le cas d'une démonstration
#: filmée sur trépied.
GRAVITE = np.array([0.0, -1.0, 0.0])


def normalise(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def landmarks(video, numeros):
    """Positions des articulations, en mètres, pour les images demandées."""
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    if not os.path.isfile(MODELE):
        sys.exit(f"Modèle introuvable : {MODELE} (voir l'en-tête du script)")

    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=MODELE),
        running_mode=vision.RunningMode.VIDEO,
    )
    v = cv2.VideoCapture(video)
    fps = v.get(cv2.CAP_PROP_FPS)
    voulus, trouves = set(numeros), {}

    with vision.PoseLandmarker.create_from_options(options) as estimateur:
        numero = 0
        while trouves.keys() != voulus:
            ok, image = v.read()
            if not ok:
                break
            # Toutes les images passent par l'estimateur : en mode vidéo il
            # suit le sujet d'une image à l'autre, et sauter des images lui
            # ferait perdre ce suivi.
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            mpimg = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            r = estimateur.detect_for_video(mpimg, int(numero / fps * 1000))
            if numero in voulus:
                if not r.pose_world_landmarks:
                    sys.exit(f"Aucune pose détectée sur l'image {numero}.")
                trouves[numero] = np.array(
                    [[l.x, l.y, l.z] for l in r.pose_world_landmarks[0]]
                )
            numero += 1
    v.release()

    manquants = voulus - trouves.keys()
    if manquants:
        sys.exit(f"Images absentes de la vidéo : {sorted(manquants)}")
    return [trouves[n] for n in numeros]


def repere_du_corps(p):
    """Axes du corps — gauche, haut, avant — déduits des articulations.

    C'est ce qui rend le résultat indépendant de l'angle de prise de vue : on
    n'utilise jamais les axes de la caméra, seulement des directions internes
    au corps.
    """
    epaule = (p[EPAULE["G"]] + p[EPAULE["D"]]) / 2
    hanche = (p[HANCHE["G"]] + p[HANCHE["D"]]) / 2

    haut = normalise(epaule - hanche)
    gauche = normalise(p[EPAULE["G"]] - p[EPAULE["D"]])
    gauche = normalise(gauche - haut * np.dot(gauche, haut))
    avant = normalise(np.cross(gauche, haut))

    # Le nez tranche le sens de l'avant, que les axes seuls ne donnent pas : il
    # est devant les épaules, jamais derrière. Sans ce contrôle, un geste sort
    # parfois retourné selon la façon dont l'estimateur a nommé les côtés.
    if np.dot(p[NEZ] - epaule, avant) < 0:
        gauche, avant = -gauche, -avant
    return gauche, haut, avant


def assise_inclinee(base, reperes):
    """Fait pencher l'assise de l'angle qu'on mesure sur la vidéo.

    L'assise dit comment le corps est **posé** : `haut` va du bassin à la tête,
    `regard` sort de la poitrine. On connaît déjà l'inclinaison réelle de ces
    deux directions par rapport à la verticale — c'est ce que la gravité donne.
    Il reste à tourner l'assise de départ dans son propre plan sagittal pour
    qu'elle les retrouve.

    Tourner **dans ce plan** et non librement, c'est ce qui garde la mise en
    scène : un corps couché sur le ventre reste vu de profil, il penche
    seulement. Un angle libre le ferait aussi tourner vers la caméra, ce que la
    profondeur estimée ne mesure pas assez bien pour qu'on s'y fie.
    """
    haut0 = normalise(np.array(base[0], dtype=float))
    regard0 = np.array(base[1], dtype=float)
    regard0 = normalise(regard0 - haut0 * np.dot(regard0, haut0))

    # Moyenne sur les images demandées : l'assise vaut pour le geste entier, et
    # une seule image la ferait dépendre du hasard d'une estimation.
    a = float(np.mean([np.dot(r[1], GRAVITE) for r in reperes]))
    b = float(np.mean([np.dot(r[2], GRAVITE) for r in reperes]))

    # Élévations de l'assise de départ, dans le monde de Blender.
    a0, b0 = float(haut0[2]), float(regard0[2])
    n = a0 * a0 + b0 * b0
    if n < 1e-6:
        # Le plan sagittal de cette assise est horizontal : aucune rotation
        # dedans ne changerait la hauteur. Rien à corriger.
        return tuple(haut0), tuple(regard0), 0.0

    cos = (a * a0 + b * b0) / n
    sin = (a * b0 - b * a0) / n
    angle = math.atan2(sin, cos)

    haut = math.cos(angle) * haut0 + math.sin(angle) * regard0
    regard = -math.sin(angle) * haut0 + math.cos(angle) * regard0
    return tuple(normalise(haut)), tuple(normalise(regard)), math.degrees(angle)


def vers_le_monde(direction, repere, assise):
    """Réexprime une direction du repère du corps vers celui de Blender."""
    gauche, haut, avant = repere
    haut_m = normalise(np.array(assise[0], dtype=float))
    avant_m = np.array(assise[1], dtype=float)
    avant_m = normalise(avant_m - haut_m * np.dot(avant_m, haut_m))
    gauche_m = normalise(np.cross(haut_m, avant_m))

    d = normalise(direction)
    return (
        gauche_m * np.dot(d, gauche)
        + haut_m * np.dot(d, haut)
        + avant_m * np.dot(d, avant)
    )


# Os du geste → (articulation de départ, articulation d'arrivée).
SEGMENTS = [
    ("Spine", lambda p, c: (milieu(p, HANCHE), milieu(p, EPAULE))),
    ("Spine1", lambda p, c: (milieu(p, HANCHE), milieu(p, EPAULE))),
    ("Spine2", lambda p, c: (milieu(p, HANCHE), milieu(p, EPAULE))),
    ("Neck", lambda p, c: (milieu(p, EPAULE), milieu(p, OREILLE))),
    ("Head", lambda p, c: (milieu(p, EPAULE), milieu(p, OREILLE))),
    ("{c}Arm", lambda p, c: (p[EPAULE[c]], p[COUDE[c]])),
    ("{c}ForeArm", lambda p, c: (p[COUDE[c]], p[POIGNET[c]])),
    ("{c}Hand", lambda p, c: (p[POIGNET[c]], p[INDEX[c]])),
    ("{c}UpLeg", lambda p, c: (p[HANCHE[c]], p[GENOU[c]])),
    ("{c}Leg", lambda p, c: (p[GENOU[c]], p[CHEVILLE[c]])),
    ("{c}Foot", lambda p, c: (p[CHEVILLE[c]], p[POINTE[c]])),
]

COTES = {"G": "Left", "D": "Right"}


def milieu(p, paire):
    return (p[paire["G"]] + p[paire["D"]]) / 2


def cles_visees(valeur, total):
    """Quelles poses clés une correction touche.

    Les corrections ne valent pas pour toutes les images d'un geste. Une entrée
    en position part à plat ventre, coudes pliés : y redresser les bras à la
    verticale décrirait une posture que personne ne tient. On désigne donc les
    clés concernées — `--bras-tendus 2` pour la seule troisième, `2,3` pour
    deux d'entre elles, l'option nue pour toutes.
    """
    if valeur is None:
        return set()
    if valeur in ("", "toutes"):
        return set(range(total))
    return {int(x) for x in valeur.split(",")}


def bras_tendus(pose, assise):
    """Remet les bras porteurs à la verticale, mains à plat sur le sol.

    ## Pourquoi corriger un relevé

    L'estimateur est bien plus sûr **dans le plan de l'image** que dans la
    profondeur : les deux premières coordonnées se lisent sur les pixels, la
    troisième s'infère. Filmé de trois quarts, l'écartement des mains tombe en
    partie dans cette profondeur — et sort faux. Sur la planche de référence,
    une main partait quatorze centimètres en dehors de son épaule et l'autre
    quatre en dedans, là où la vidéo montre deux bras verticaux.

    Or c'est justement le point sur lequel toutes les descriptions de
    l'exercice sont d'accord : « mains directement sous les épaules ». Quand un
    critère écrit est plus sûr que la mesure, c'est le critère qui gagne.

    Un bras tendu qui porte descend donc **à la verticale** — la main tombe
    alors sous l'épaule des deux côtés, sans avoir à viser un point — et la
    main pointe vers l'avant du sol, à plat.

    Ne vaut que pour un appui **bras tendus** : au bas d'une pompe, le coude
    est plié et cette correction serait un mensonge.
    """
    bas = np.array([0.0, 0.0, -1.0])
    # L'avant du sol : la direction de la tête, mise à plat. C'est là que
    # pointent les doigts d'une main posée.
    devant = normalise(np.array([assise[0][0], assise[0][1], 0.0]))
    for cote in COTES.values():
        pose[f"{cote}Arm"] = bas
        pose[f"{cote}ForeArm"] = bas
        pose[f"{cote}Hand"] = devant
    return pose


def symetriser(pose, assise):
    """Rend le geste exactement symétrique, gauche et droite en miroir.

    ## Pourquoi il faut le demander, et pourquoi ça marche

    Un sujet filmé n'est jamais parfaitement symétrique, et l'estimateur ajoute
    son propre bruit — surtout en profondeur. Sur la planche de référence, les
    deux cuisses partaient du même côté au lieu de s'écarter en miroir : une
    torsion de quelques degrés, invisible en soi, qui suffisait à décoller une
    main et un pied de cinq millimètres en diagonale.

    Quatre appuis ne peuvent d'ailleurs pas être remis de niveau par une
    rotation si le corps est vrillé : trois points définissent un plan, le
    quatrième n'y tombe que si la posture le veut bien. La symétrie le veut.

    On la demande explicitement, parce qu'elle ne va pas de soi : une fente,
    un mountain climber, un gainage latéral sont asymétriques par nature.

    Le miroir se prend dans le plan sagittal du **corps** — celui que l'assise
    définit —, jamais dans un plan du monde : couché sur le ventre, la gauche
    du personnage n'est plus l'axe X.
    """
    haut = normalise(np.array(assise[0], dtype=float))
    avant = np.array(assise[1], dtype=float)
    avant = normalise(avant - haut * np.dot(avant, haut))
    gauche = normalise(np.cross(haut, avant))

    def miroir(v):
        return v - 2 * np.dot(v, gauche) * gauche

    for nom in list(pose):
        if nom.startswith("Left"):
            jumeau = "Right" + nom[len("Left"):]
            if jumeau not in pose:
                continue
            moyenne = normalise(pose[nom] + miroir(pose[jumeau]))
            pose[nom], pose[jumeau] = moyenne, miroir(moyenne)
        elif not nom.startswith("Right"):
            # Colonne, nuque, tête : elles sont **dans** le plan sagittal. Un
            # dos qui part de côté est du bruit, pas une intention.
            pose[nom] = normalise(pose[nom] - np.dot(pose[nom], gauche) * gauche)
    return pose


def bras_au_sol(pose, assise):
    """Couche le bras **entier** au sol : c'est la position de départ, à plat ventre.

    À plat ventre, coudes repliés le long des côtes, le bras et l'avant-bras
    reposent tous deux sur le tapis. L'estimateur, lui, plaçait le coude
    cinquante centimètres **au-dessus** de l'épaule : un corps écrasé au sol est
    le cas où il se trompe le plus, la profondeur y étant presque entièrement
    devinée. Le corps descendait alors jusqu'à poser ce coude, et le buste
    passait sous le plancher.

    On garde de la mesure ce qu'elle sait : l'orientation du bras **vu de
    dessus**. On lui retire ce qu'elle ne sait pas : sa hauteur.
    """
    haut = np.array([0.0, 0.0, 1.0])
    for cote in COTES.values():
        bras = pose[f"{cote}Arm"]
        aplati = bras - haut * np.dot(bras, haut)
        if np.linalg.norm(aplati) > 1e-3:
            pose[f"{cote}Arm"] = normalise(aplati)
    return avant_bras_au_sol(pose, assise)


def avant_bras_au_sol(pose, assise):
    """Couche les avant-bras à plat sur le sol, parallèles et vers l'avant.

    Sur une planche sur les avant-bras, c'est le **coude** qui porte et
    l'avant-bras qui repose de tout son long. L'estimateur, lui, le renvoyait
    plongeant de trente degrés sous l'horizontale — une pente qu'aucun sol ne
    permet. Le corps ne montait donc jamais : posé sur le poing, coude enfoncé,
    il restait à plat ventre d'un bout à l'autre du geste.

    On ne touche **pas** au bras : c'est lui qui porte l'élévation du buste, et
    elle change tout au long de la montée. Seul l'avant-bras est contraint, et
    il l'est du début à la fin — il ne quitte pas le sol.
    """
    devant = normalise(np.array([assise[0][0], assise[0][1], 0.0]))
    for cote in COTES.values():
        pose[f"{cote}ForeArm"] = devant
        pose[f"{cote}Hand"] = devant
    return pose


def pieds_sur_pointes(pose):
    """Remet les deux pieds à la verticale, orteils au sol.

    Même raison que pour les bras : l'estimateur place mal ce qui tombe dans
    la profondeur. Sur la planche de référence, le pied gauche sortait presque
    vertical et le droit écarté de trente-quatre degrés vers l'extérieur — une
    asymétrie que la vidéo ne montre pas, et qui saute aux yeux sur un rendu.

    Un corps en appui sur la pointe des pieds les a tous deux sous la
    cheville : le pied descend, les orteils se recourbent dessous. C'est la
    même figure des deux côtés, et c'est ce que dit toute description de
    l'exercice.
    """
    bas = np.array([0.0, 0.0, -1.0])
    for cote in COTES.values():
        pose[f"{cote}Foot"] = bas
    return pose


def pose_du_geste(p, repere, assise):
    """Directions de tous les os, prêtes à être écrites dans un geste."""
    sortie = {}
    for gabarit, extrait in SEGMENTS:
        cotes = ["G", "D"] if "{c}" in gabarit else [None]
        for c in cotes:
            depart, arrivee = extrait(p, c)
            nom = gabarit.format(c=COTES[c]) if c else gabarit
            if nom in sortie:
                continue
            sortie[nom] = vers_le_monde(arrivee - depart, repere, assise)
    return sortie


def main():
    a = argparse.ArgumentParser()
    a.add_argument("video")
    a.add_argument("geste")
    a.add_argument("--images", required=True, help="numéros d'images, séparés par des virgules")
    a.add_argument("--assise", default="debout", choices=sorted(ASSISES))
    a.add_argument("--duree", type=int, default=2400)
    a.add_argument(
        "--symetrique",
        nargs="?", const="toutes", default=None, metavar="CLÉS",
        help="la pose est symétrique par nature : met gauche et droite en "
        "miroir exact et remet la colonne dans le plan sagittal. Se donne par "
        "clés, comme les autres : une planche jambe levée l'est à l'entrée et "
        "ne l'est plus à la fin.",
    )
    a.add_argument(
        "--bras-au-sol",
        nargs="?", const="toutes", default=None, metavar="CLÉS",
        help="la clé part à plat ventre : couche le bras entier au sol, en ne "
        "gardant de la mesure que son orientation vue de dessus.",
    )
    a.add_argument(
        "--avant-bras-au-sol",
        nargs="?", const="toutes", default=None, metavar="CLÉS",
        help="le corps porte sur les avant-bras : les couche à plat vers "
        "l'avant, sans toucher au bras qui, lui, porte l'élévation du buste.",
    )
    a.add_argument(
        "--pieds-sur-pointes",
        nargs="?", const="toutes", default=None, metavar="CLÉS",
        help="le corps porte sur la pointe des pieds : les remet tous deux "
        "verticaux, orteils sous la cheville. Nue, l'option vaut pour toutes "
        "les clés ; sinon donner leurs rangs, « 1,2 ».",
    )
    a.add_argument(
        "--bras-tendus",
        nargs="?", const="toutes", default=None, metavar="CLÉS",
        help="le corps porte sur des bras tendus : les redresse à la verticale "
        "et pose les mains à plat, plutôt que de recopier un relevé bruité. "
        "Mêmes rangs que ci-dessus.",
    )
    args = a.parse_args()

    numeros = [int(n) for n in args.images.split(",")]
    releves = landmarks(args.video, numeros)
    reperes = [repere_du_corps(p) for p in releves]

    haut, regard, pente = assise_inclinee(ASSISES[args.assise], reperes)
    assise = (haut, regard)
    poses = [pose_du_geste(p, r, assise) for p, r in zip(releves, reperes)]
    au_sol = cles_visees(args.avant_bras_au_sol, len(poses))
    poses = [
        avant_bras_au_sol(pose, assise) if rang in au_sol else pose
        for rang, pose in enumerate(poses)
    ]
    couches = cles_visees(args.bras_au_sol, len(poses))
    poses = [
        bras_au_sol(pose, assise) if rang in couches else pose
        for rang, pose in enumerate(poses)
    ]
    tendus = cles_visees(args.bras_tendus, len(poses))
    pointes = cles_visees(args.pieds_sur_pointes, len(poses))
    poses = [
        bras_tendus(pose, assise) if rang in tendus else pose
        for rang, pose in enumerate(poses)
    ]
    poses = [
        pieds_sur_pointes(pose) if rang in pointes else pose
        for rang, pose in enumerate(poses)
    ]
    # En dernier : les corrections précédentes portent sur un membre à la fois
    # et peuvent elles-mêmes rompre le miroir.
    miroir = cles_visees(args.symetrique, len(poses))
    poses = [
        symetriser(pose, assise) if rang in miroir else pose
        for rang, pose in enumerate(poses)
    ]

    def triplet(v):
        return "({:+.2f}, {:+.2f}, {:+.2f})".format(*v)

    print(f'    # Relevé sur une vidéo de démonstration, images {args.images}.')
    print(f'    "{args.geste}": {{')
    print(f'        "vue": "profil",')
    print(f'        "duree": {args.duree},')
    print(f'        # Assise « {args.assise} » penchée de {pente:+.0f}°, mesurés sur la vidéo.')
    print(f'        "assise": ({triplet(haut)}, {triplet(regard)}),')
    # Un relevé brut n'est jamais symétrique : le contrôle de symétrie n'aurait
    # rien à en dire d'utile. Symétrisé, en revanche, il devient une garantie
    # qu'on veut voir tenir.
    if len(miroir) < len(poses):
        print(f'        "symetrique": False,')
    print(f'        "cles": [')
    for pose in poses:
        print("            _pose({")
        for nom, d in pose.items():
            print(f'                _os("{nom}"): ({d[0]:+.2f}, {d[1]:+.2f}, {d[2]:+.2f}),')
        print("            }),")
    print("        ],")
    print("    },")


if __name__ == "__main__":
    main()
