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
"""
import argparse
import os
import sys

import numpy as np

MODELE = os.environ.get("MODELE_POSE", "/tmp/pg/pose_landmarker.task")

# Indices des articulations dans le squelette de l'estimateur.
NEZ = 0
EPAULE = {"G": 11, "D": 12}
COUDE = {"G": 13, "D": 14}
POIGNET = {"G": 15, "D": 16}
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
    ("Neck", lambda p, c: (milieu(p, EPAULE), p[NEZ])),
    ("Head", lambda p, c: (milieu(p, EPAULE), p[NEZ])),
    ("{c}Arm", lambda p, c: (p[EPAULE[c]], p[COUDE[c]])),
    ("{c}ForeArm", lambda p, c: (p[COUDE[c]], p[POIGNET[c]])),
    ("{c}UpLeg", lambda p, c: (p[HANCHE[c]], p[GENOU[c]])),
    ("{c}Leg", lambda p, c: (p[GENOU[c]], p[CHEVILLE[c]])),
    ("{c}Foot", lambda p, c: (p[CHEVILLE[c]], p[POINTE[c]])),
]

COTES = {"G": "Left", "D": "Right"}


def milieu(p, paire):
    return (p[paire["G"]] + p[paire["D"]]) / 2


def pose_du_geste(p, assise):
    """Directions de tous les os, prêtes à être écrites dans un geste."""
    repere = repere_du_corps(p)
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
    args = a.parse_args()

    numeros = [int(n) for n in args.images.split(",")]
    assise = ASSISES[args.assise]
    poses = [pose_du_geste(p, assise) for p in landmarks(args.video, numeros)]

    nom_assise = {
        "debout": None, "dos": "SUR_LE_DOS",
        "ventre": "SUR_LE_VENTRE", "cote": "SUR_LE_COTE",
    }[args.assise]

    print(f'    # Relevé sur une vidéo de démonstration, images {args.images}.')
    print(f'    "{args.geste}": {{')
    print(f'        "vue": "profil",')
    print(f'        "duree": {args.duree},')
    if nom_assise:
        print(f'        "assise": {nom_assise},')
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
