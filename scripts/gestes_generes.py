"""Gestes animés **écrits ici**, sans passer par une bibliothèque de captation.

Le nom du fichier prend des tirets bas et non des tirets : c'est un module que
`rendre-geste.py` importe, pas une commande à lancer. Les scripts exécutables du
dossier gardent leurs tirets.

## Pourquoi écrire des animations à la main alors qu'on en télécharge

Les bibliothèques de captation couvrent ce que les jeux vidéo réclament :
courir, sauter, frapper, et quelques mouvements de salle très connus — pompes,
squat, curl. Elles ignorent l'élévation latérale, le kickback triceps, l'oiseau
buste penché. Ces gestes n'ont aucun usage ailleurs qu'en musculation, personne
ne les a captés, et ils forment pourtant une bonne part du catalogue.

Or ce sont justement les plus faciles à écrire : **une seule articulation
bouge**, le reste du corps tient debout. Là où une burpee demande un corps
entier qui bascule, se pose au sol et se relève — du ressort, du poids, de
l'équilibre —, une élévation latérale se décrit en une phrase : les bras
partent le long du corps et montent à l'horizontale.

D'où le partage : **la captation pour les gestes complexes, ce fichier pour les
gestes simples.** Aucun des deux ne remplace l'autre.

## Comment un geste se décrit

Par des **directions dans le monde**, jamais par des angles d'articulation.
Écrire « tourne l'épaule de 90° autour de son axe X » suppose de connaître
l'orientation de repos de l'os, qui n'a rien d'évident et change d'un squelette
à l'autre. Écrire « le bras pointe vers l'extérieur, à l'horizontale » se
relit, se corrige, et vaut sur n'importe quel squelette.

Le repère est celui de Blender, tel que la captation Mixamo l'exporte :

    +Z  le haut              +X  la gauche du personnage
    -Y  la direction du regard (le personnage est de dos en +Y)

Un geste est une suite de **poses clés** parcourue en aller-retour. Un os
laissé à `REPOS` garde l'orientation qu'il a dans le modèle importé.

## Ne redresser que ce qu'on déplace

C'est la leçon du premier jet, et elle vaut d'être écrite. La première version
imposait une posture debout complète — colonne verticale, nuque droite, jambes
tendues. Vu de face le résultat passait ; vu de profil le personnage partait en
arrière, bassin en avant, parce qu'une colonne parfaitement droite n'existe pas
sur un corps humain : le dos a une courbure, et le modèle la porte déjà dans sa
pose de repos.

D'où `REPOS`. Une élévation latérale ne mentionne que les bras ; le dos, la
nuque, les jambes restent tels que le modèle les tient, c'est-à-dire bien. Seuls
les gestes qui **veulent** plier le dos — oiseau, rowing, kickback — le
mentionnent, et c'est alors une intention et non un accident.

## Ce que ce fichier ne sait pas faire

Rien qui demande de garder un appui pendant que le corps se déplace : mollets
debout (le corps monte sur la pointe des pieds), fentes, tout ce qui touche le
sol. Il y faudrait de la cinématique inverse. La captation reste le bon outil
pour ceux-là.

Les haltères ne sont pas modélisées : le personnage ferme le poing. Les rendus
de captation font pareil, l'app reste cohérente.
"""
from mathutils import Vector

#: Marque un os qu'on ne touche pas : il garde l'orientation du modèle importé.
REPOS = None

# Les os sont posés **du parent vers l'enfant**. Viser un os déplace tous ceux
# qu'il porte ; le faire dans le désordre reviendrait à corriger un bras après
# avoir bougé l'épaule qui le tient.
ORDRE = [
    "mixamorig:Spine",
    "mixamorig:Spine1",
    "mixamorig:Spine2",
    "mixamorig:LeftShoulder",
    "mixamorig:LeftArm",
    "mixamorig:LeftForeArm",
    "mixamorig:RightShoulder",
    "mixamorig:RightArm",
    "mixamorig:RightForeArm",
    "mixamorig:LeftUpLeg",
    "mixamorig:LeftLeg",
    "mixamorig:RightUpLeg",
    "mixamorig:RightLeg",
]

BASSIN = "mixamorig:Hips"


def _os(nom):
    return f"mixamorig:{nom}"


# Debout, tel que le modèle se tient. Chaque geste part de là et ne redéfinit
# que ce qu'il bouge.
DEBOUT = {nom: REPOS for nom in ORDRE}

# Buste penché, comme on se tient pour un oiseau, un rowing ou un kickback.
#
# La flexion est répartie sur les trois vertèbres : la concentrer sur une seule
# casserait le dos en angle droit là où un dos se courbe. Les genoux fléchissent
# et le bassin recule — sans quoi le personnage aurait le centre de gravité
# devant les pieds, et un débutant qui copie une posture jambes tendues se fait
# mal au dos. L'animation doit montrer la bonne.
#
# La nuque et la tête restent à `REPOS` : portées par une colonne penchée, elles
# regardent naturellement vers le sol, ce qui est exactement la bonne posture.
BUSTE_PENCHE = {
    _os("Spine"): (0, -0.42, 0.91),
    _os("Spine1"): (0, -0.60, 0.80),
    _os("Spine2"): (0, -0.70, 0.71),
    _os("LeftUpLeg"): (0.03, 0.17, -0.98),
    _os("LeftLeg"): (0.02, -0.22, -0.97),
    _os("RightUpLeg"): (-0.03, 0.17, -0.98),
    _os("RightLeg"): (-0.02, -0.22, -0.97),
    # Les bras pendent vers le sol : la gravité ne se penche pas avec le buste.
    _os("LeftArm"): (0.16, 0.05, -1),
    _os("LeftForeArm"): (0.18, 0.02, -1),
    _os("RightArm"): (-0.16, 0.05, -1),
    _os("RightForeArm"): (-0.18, 0.02, -1),
}

#: Recul du bassin qui accompagne `BUSTE_PENCHE`, en mètres, dans le monde.
#: +Y est derrière le personnage, qui regarde vers -Y.
RECUL_BASSIN = (0, 0.16, -0.04)


def _pose(*couches):
    """Empile des couches de pose, la dernière l'emportant."""
    resultat = dict(DEBOUT)
    for couche in couches:
        resultat.update(couche)
    return resultat


GESTES = {
    # ---- Épaules ---------------------------------------------------------
    "elevations-laterales": {
        "vue": "face",
        "duree": 2000,
        "cles": [
            _pose(),
            _pose({
                _os("LeftArm"): (1, -0.05, 0.05),
                _os("LeftForeArm"): (1, -0.20, -0.10),
                _os("RightArm"): (-1, -0.05, 0.05),
                _os("RightForeArm"): (-1, -0.20, -0.10),
            }),
        ],
    },
    "elevations-frontales": {
        # De profil : de face, un bras qui monte devant soi se confond avec un
        # bras qui ne bouge pas — le mouvement se fait dans l'axe de la caméra.
        "vue": "profil",
        "duree": 2000,
        "cles": [
            _pose(),
            _pose({
                _os("LeftArm"): (0.14, -1, 0.04),
                _os("LeftForeArm"): (0.16, -1, -0.06),
                _os("RightArm"): (-0.14, -1, 0.04),
                _os("RightForeArm"): (-0.16, -1, -0.06),
            }),
        ],
    },
    "developpe-militaire": {
        "vue": "face",
        "duree": 2200,
        "cles": [
            # Départ coudes à hauteur d'épaules, avant-bras verticaux.
            _pose({
                _os("LeftArm"): (0.80, -0.18, -0.30),
                _os("LeftForeArm"): (0.34, -0.10, 1),
                _os("RightArm"): (-0.80, -0.18, -0.30),
                _os("RightForeArm"): (-0.34, -0.10, 1),
            }),
            _pose({
                _os("LeftArm"): (0.32, -0.06, 1),
                _os("LeftForeArm"): (0.12, 0, 1),
                _os("RightArm"): (-0.32, -0.06, 1),
                _os("RightForeArm"): (-0.12, 0, 1),
            }),
        ],
    },
    "haussement-epaules": {
        "vue": "face",
        # Court : un shrug se fait vite, et l'amplitude est faible. Étalé sur
        # deux secondes il ne se lirait plus comme un mouvement.
        "duree": 1200,
        "cles": [
            _pose(),
            _pose({
                _os("LeftShoulder"): (1, 0, 0.42),
                _os("RightShoulder"): (-1, 0, 0.42),
            }),
        ],
    },
    # ---- Triceps ---------------------------------------------------------
    "extension-triceps": {
        "vue": "profil",
        "duree": 2000,
        "cles": [
            # Bras tendus au-dessus de la tête.
            _pose({
                _os("LeftArm"): (0.22, 0.04, 1),
                _os("LeftForeArm"): (0.12, 0, 1),
                _os("RightArm"): (-0.22, 0.04, 1),
                _os("RightForeArm"): (-0.12, 0, 1),
            }),
            # Coudes en place, avant-bras repliés derrière la nuque : c'est le
            # coude immobile qui fait tout l'exercice, et l'animation doit le
            # montrer sinon le débutant balance les bras.
            _pose({
                _os("LeftArm"): (0.22, 0.04, 1),
                _os("LeftForeArm"): (0.02, 0.95, -0.12),
                _os("RightArm"): (-0.22, 0.04, 1),
                _os("RightForeArm"): (-0.02, 0.95, -0.12),
            }),
        ],
    },
    "kickback-triceps": {
        "vue": "profil",
        "duree": 1800,
        "bassin": RECUL_BASSIN,
        "cles": [
            # Bras collé au corps, pointé vers l'arrière ; avant-bras replié.
            _pose(BUSTE_PENCHE, {
                _os("LeftArm"): (0.14, 0.92, 0.10),
                _os("LeftForeArm"): (0.14, -0.50, -0.85),
                _os("RightArm"): (-0.14, 0.92, 0.10),
                _os("RightForeArm"): (-0.14, -0.50, -0.85),
            }),
            _pose(BUSTE_PENCHE, {
                _os("LeftArm"): (0.14, 0.92, 0.10),
                _os("LeftForeArm"): (0.13, 0.95, 0.06),
                _os("RightArm"): (-0.14, 0.92, 0.10),
                _os("RightForeArm"): (-0.13, 0.95, 0.06),
            }),
        ],
    },
    # ---- Dos -------------------------------------------------------------
    "oiseau": {
        "vue": "face",
        "duree": 2200,
        "bassin": RECUL_BASSIN,
        "cles": [
            _pose(BUSTE_PENCHE),
            _pose(BUSTE_PENCHE, {
                _os("LeftArm"): (1, 0.18, 0.06),
                _os("LeftForeArm"): (1, 0.12, -0.12),
                _os("RightArm"): (-1, 0.18, 0.06),
                _os("RightForeArm"): (-1, 0.12, -0.12),
            }),
        ],
    },
    "rowing-halteres": {
        "vue": "profil",
        "duree": 2000,
        "bassin": RECUL_BASSIN,
        "cles": [
            _pose(BUSTE_PENCHE),
            # Coudes vers l'arrière et le haut, mains aux côtes.
            _pose(BUSTE_PENCHE, {
                _os("LeftArm"): (0.18, 0.72, 0.36),
                _os("LeftForeArm"): (0.14, -0.28, -0.95),
                _os("RightArm"): (-0.18, 0.72, 0.36),
                _os("RightForeArm"): (-0.14, -0.28, -0.95),
            }),
        ],
    },
}


def _adoucir(t):
    """Même amortissement que `Silhouette.tsx` : départ et arrivée ralentis.

    Un geste à vitesse constante bute à chaque extrémité comme un métronome ;
    un corps décélère avant de repartir.
    """
    from math import cos, pi

    return (1 - cos(pi * t)) / 2


def _parcours(cles, images, repos):
    """Suite de poses interpolées, en aller-retour et **sans doublon**.

    La dernière image est celle qui précède le retour au départ : la planche
    boucle, la répéter marquerait un temps mort à chaque tour.

    `repos` fournit la direction des os laissés à `REPOS`, mesurée sur le modèle.
    """
    resolue = lambda pose: {  # noqa: E731
        nom: Vector(repos[nom] if pose[nom] is REPOS else pose[nom]).normalized()
        for nom in pose
        if nom in repos
    }

    # Deux clés se parcourent 0→1→0 ; trois, 0→1→2→1→0.
    boucle = [resolue(c) for c in cles]
    boucle += list(reversed(boucle))[1:]
    segments = max(1, len(boucle) - 1)

    poses = []
    for i in range(images):
        u = (i / images) * segments
        rang = min(int(u), segments - 1)
        e = _adoucir(u - rang)
        depart, arrivee = boucle[rang], boucle[rang + 1]
        poses.append(
            {nom: depart[nom].lerp(arrivee[nom], e).normalized() for nom in depart}
        )
    return poses


def _direction(armature, os_pose):
    """Direction de l'os dans le monde : la colonne Y de sa matrice de pose."""
    return (armature.matrix_world.to_3x3() @ os_pose.matrix.col[1].to_3d()).normalized()


def viser(armature, os_pose, direction, contexte):
    """Oriente l'os pour qu'il pointe vers `direction`, exprimée dans le monde.

    On passe par `pose_bone.matrix`, qui parle en espace armature et se charge
    de remonter la chaîne des parents. Composer soi-même les rotations locales
    obligerait à connaître l'orientation de repos de chaque os — la source
    d'erreur qui rend toute retouche de squelette pénible.
    """
    matrice = os_pose.matrix.copy()
    cible = (armature.matrix_world.inverted().to_3x3() @ Vector(direction)).normalized()
    actuelle = matrice.col[1].to_3d().normalized()
    os_pose.matrix = actuelle.rotation_difference(cible).to_matrix().to_4x4() @ matrice
    # Sans cette réévaluation, l'os suivant lirait la matrice de son parent
    # d'avant la pose. Une seule suffit — celle d'après ; la précédente a déjà
    # laissé la chaîne à jour.
    contexte.view_layer.update()


def _deplacer_bassin(armature, decalage, contexte):
    """Recule le bassin, en mètres et dans le monde."""
    contexte.view_layer.update()
    bassin = armature.pose.bones[BASSIN]
    matrice = bassin.matrix.copy()
    matrice.translation += armature.matrix_world.inverted().to_3x3() @ Vector(decalage)
    bassin.matrix = matrice
    contexte.view_layer.update()


def appliquer(armature, nom, images, contexte):
    """Pose le geste `nom` sur l'armature, image par image.

    Renvoie les numéros d'images à rendre.
    """
    if nom not in GESTES:
        raise SystemExit(
            f"Geste inconnu : {nom}. Disponibles : {', '.join(sorted(GESTES))}"
        )

    manquants = [o for o in ORDRE + [BASSIN] if o not in armature.pose.bones]
    if manquants:
        raise SystemExit(
            "Ce squelette n'est pas un squelette Mixamo : "
            f"{len(manquants)} os attendus sont absents ({manquants[0]}…)."
        )

    contexte.view_layer.update()
    # Mesuré **avant** toute pose : c'est l'orientation que le modèle porte de
    # lui-même, et à laquelle `REPOS` renvoie.
    repos = {o: _direction(armature, armature.pose.bones[o]) for o in ORDRE}

    geste = GESTES[nom]
    decalage = geste.get("bassin")
    # Une seule fois, et non à chaque image : le décalage s'ajoute à la pose
    # courante, et le rappliquer vingt fois ferait reculer le bassin de vingt
    # crans. Il ne varie pas sur ces gestes, il suffit de le poser en clé.
    if decalage:
        _deplacer_bassin(armature, decalage, contexte)

    for numero, pose in enumerate(_parcours(geste["cles"], images, repos), start=1):
        if decalage:
            armature.pose.bones[BASSIN].keyframe_insert("location", frame=numero)
        for os_nom in ORDRE:
            os_pose = armature.pose.bones[os_nom]
            viser(armature, os_pose, pose[os_nom], contexte)
            os_pose.rotation_mode = "QUATERNION"
            os_pose.keyframe_insert("rotation_quaternion", frame=numero)

    return list(range(1, images + 1))
