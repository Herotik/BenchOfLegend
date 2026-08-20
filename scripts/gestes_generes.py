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

Chaque geste porte aussi la **vue** sous laquelle il se lit. C'est une décision
par geste et non un réglage global : une élévation frontale ne se voit pas de
face, où le bras monte dans l'axe de la caméra ; une élévation latérale ne se
voit pas de profil, pour la raison inverse ; et un geste buste penché ne se
voit correctement d'aucune des deux — d'où le trois-quarts.

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

Les gestes de **faible amplitude**. Le haussement d'épaules y a été essayé puis
retiré : la clavicule est un os court, son élévation réelle fait quelques
pixels sur un rendu, et même exagérée trois fois elle reste masquée par le
vêtement. Le bonhomme vectoriel s'en tire mieux, parce qu'il peut exagérer sans
prétendre à l'anatomie — c'est exactement pourquoi les deux façons de montrer
un geste coexistent.

Rien non plus qui demande de garder un appui pendant que le corps se déplace :
mollets debout (le corps monte sur la pointe des pieds), fentes, tout ce qui
touche le sol. Il y faudrait de la cinématique inverse — la captation reste le
bon outil pour ceux-là.

Les haltères ne sont pas modélisées : le personnage ferme le poing. Les rendus
de captation font pareil, l'app reste cohérente.
"""
# `mathutils` n'existe que dans Blender. L'import est donc fait **dans** les
# fonctions qui en ont besoin, et non ici : les définitions de gestes restent
# alors lisibles par un Python ordinaire, ce dont `verifier-gestes.py` se sert
# pour contrôler les postures sans avoir à lancer un rendu.

import itertools

#: Marque un os qu'on ne touche pas : il garde l'orientation du modèle importé.
REPOS = None

#: Marque un os qui **suit son parent** au lieu de viser une direction du monde.
#:
#: La nuance avec `REPOS` est subtile et coûte cher quand on la manque. `REPOS`
#: veut dire « la direction que cet os a dans le modèle debout », c'est-à-dire
#: une direction **absolue** : un avant-bras laissé à `REPOS` pend le long du
#: corps, où que soit passé le bras. C'est ce qu'on veut d'un membre au repos.
#:
#: Le poignet, lui, n'a pas de direction propre : il prolonge l'avant-bras.
#: L'avoir mis à `REPOS` aurait fait pointer la main vers le sol pendant qu'on
#: lève un haltère. D'où ce second marqueur, qui est le défaut des mains.
SUIVRE = "suivre"

#: Les os dont le défaut est de suivre leur parent.
MAINS = ("mixamorig:LeftHand", "mixamorig:RightHand")


class APlat:
    """Une main posée : sa direction **et** le côté vers lequel la paume regarde.

    Une direction seule ne suffit pas à poser une main. Doigts vers l'avant, la
    main peut encore tourner autour de son propre axe : à plat, sur le chant,
    ou dos au sol. Les trois ont la même direction. C'est ce qui a donné une
    paume mesurée à 96° du sol — ouverte, doigts écartés, et debout sur sa
    tranche.

    `paume` est la direction du monde vers laquelle la paume fait face : le sol
    pour une planche, c'est-à-dire `(0, 0, -1)`. Une main dos au sol se dit
    tout aussi bien, avec `(0, 0, 1)`.
    """

    __slots__ = ("direction", "paume")

    def __init__(self, direction, paume=(0, 0, -1)):
        self.direction = tuple(direction)
        self.paume = tuple(paume)

    def __repr__(self):
        return f"APlat(direction={self.direction}, paume={self.paume})"


class Appui:
    """Un membre qui **touche** quelque chose, décrit par un point et non un axe.

    Une main de planche est posée sous l'épaule, un pied de fente est planté au
    sol : ce qu'on connaît est l'endroit, pas l'angle. `atteindre` en déduit les
    deux directions, exactement.

    `cible` est la position de l'extrémité — poignet ou cheville — dans le
    monde, en mètres, le sol à zéro. `pole` dit de quel côté l'articulation
    plie : vers l'arrière pour un coude, vers l'avant pour un genou.

    Se déclare sur l'os **racine** du membre — `LeftArm` ou `LeftUpLeg` —, et
    couvre aussi l'os suivant de la chaîne.
    """

    __slots__ = ("cible", "pole")

    def __init__(self, cible, pole):
        self.cible = tuple(cible)
        self.pole = tuple(pole)

    def __repr__(self):
        return f"Appui(cible={self.cible}, pole={self.pole})"


#: Les chaînes qu'un appui pilote : racine → (milieu, extrémité).
CHAINES = {
    "mixamorig:LeftArm": ("mixamorig:LeftForeArm", "mixamorig:LeftHand"),
    "mixamorig:RightArm": ("mixamorig:RightForeArm", "mixamorig:RightHand"),
    "mixamorig:LeftUpLeg": ("mixamorig:LeftLeg", "mixamorig:LeftFoot"),
    "mixamorig:RightUpLeg": ("mixamorig:RightLeg", "mixamorig:RightFoot"),
}

# Les os sont posés **du parent vers l'enfant**. Viser un os déplace tous ceux
# qu'il porte ; le faire dans le désordre reviendrait à corriger un bras après
# avoir bougé l'épaule qui le tient.
ORDRE = [
    "mixamorig:Spine",
    "mixamorig:Spine1",
    "mixamorig:Spine2",
    "mixamorig:Neck",
    "mixamorig:Head",
    "mixamorig:LeftShoulder",
    "mixamorig:LeftArm",
    "mixamorig:LeftForeArm",
    # La main **après** l'avant-bras : sans elle, une main d'appui garde
    # l'orientation qu'elle a le long du corps debout et pend, doigts vers
    # le bas, au lieu de se poser à plat sur le sol.
    "mixamorig:LeftHand",
    "mixamorig:RightShoulder",
    "mixamorig:RightArm",
    "mixamorig:RightForeArm",
    "mixamorig:RightHand",
    "mixamorig:LeftUpLeg",
    "mixamorig:LeftLeg",
    "mixamorig:LeftFoot",
    "mixamorig:RightUpLeg",
    "mixamorig:RightLeg",
    "mixamorig:RightFoot",
]

BASSIN = "mixamorig:Hips"


def _os(nom):
    return f"mixamorig:{nom}"


# Debout, tel que le modèle se tient. Chaque geste part de là et ne redéfinit
# que ce qu'il bouge.
DEBOUT = {nom: (SUIVRE if nom in MAINS else REPOS) for nom in ORDRE}

# Buste penché, comme on se tient pour un oiseau, un rowing ou un kickback.
#
# Le dos est **plat**, et c'est le point de la posture. Les trois vertèbres
# pointent quasiment dans la même direction : la flexion vient de la hanche, pas
# de la colonne. Un premier jet les graduait de vingt à trente-six degrés, ce
# qui arrondissait le dos — exactement ce qu'on passe son temps à corriger chez
# un débutant, et ce qui lui abîmerait le dos s'il copiait la démonstration.
#
# Le squelette Mixamo rend ça facile : le bassin porte à la fois la colonne et
# les jambes. Incliner la colonne sans toucher aux jambes, c'est charnière à la
# hanche. Les genoux fléchissent un peu et le bassin recule pour compenser,
# sans quoi le centre de gravité passerait devant les pieds.
#
# La nuque **prolonge** le torse, elle ne le contredit pas. Laissée à `REPOS`
# elle s'ajoute à la flexion et le menton finit sur la poitrine ; redressée à la
# verticale, elle forme un coude de vingt degrés sur une seule articulation et
# la tête s'enfonce dans les épaules. Elle suit donc la colonne, un peu moins
# inclinée — le regard porte à un mètre ou deux devant, comme en salle.
BUSTE_PENCHE = {
    _os("Spine"): (0, -0.56, 0.83),
    _os("Spine1"): (0, -0.60, 0.80),
    _os("Spine2"): (0, -0.62, 0.78),
    _os("Neck"): (0, -0.48, 0.88),
    _os("Head"): (0, -0.32, 0.95),
    # Cuisse vers l'avant, tibia vers l'arrière : le genou est le point le plus
    # **avancé** de la jambe. L'inverse — qu'on avait — plie le genou à l'envers,
    # comme une patte d'oiseau. `verifier-gestes.py` l'attrape désormais.
    _os("LeftUpLeg"): (0.03, -0.16, -0.99),
    _os("LeftLeg"): (0.02, 0.20, -0.98),
    _os("RightUpLeg"): (-0.03, -0.16, -0.99),
    _os("RightLeg"): (-0.02, 0.20, -0.98),
    # Les bras pendent vers le sol : la gravité ne se penche pas avec le buste.
    _os("LeftArm"): (0.16, 0.05, -1),
    _os("LeftForeArm"): (0.18, 0.02, -1),
    _os("RightArm"): (-0.16, 0.05, -1),
    _os("RightForeArm"): (-0.18, 0.02, -1),
}

# Tronc **droit**, à l'horizontale : la posture d'une planche.
#
# Laissé à `REPOS`, le tronc garde la courbure naturelle du modèle debout, et
# une fois couché cette courbure fait pencher les épaules d'une dizaine de
# centimètres sous le bassin. Le corps n'est alors plus la ligne droite de la
# tête aux talons que toutes les descriptions du geste réclament, et les bras
# se plient au lieu d'être tendus.
PLANCHE_DROITE = {
    # Le tronc **monte** du bassin vers les épaules, il n'est pas horizontal.
    # C'est la géométrie du geste : la main est au sol, l'épaule à une longueur
    # de bras au-dessus, et le bassin plus bas parce que le corps redescend
    # jusqu'aux orteils. Un tronc horizontal mettait les hanches vingt
    # centimètres au-dessus de la ligne épaules-chevilles — la faute qu'on
    # reproche à un débutant qui « fait la montagne ».
    _os("Spine"): (0, 0.90, 0.44),
    _os("Spine1"): (0, 0.90, 0.44),
    _os("Spine2"): (0, 0.90, 0.44),
    # La nuque se redresse franchement : sur toutes les photos du geste, le
    # regard porte **devant** les mains et la tête prolonge la ligne du dos.
    # Rentrée dans les épaules, elle donnait un personnage sans cou.
    _os("Neck"): (0, 0.88, 0.47),
    _os("Head"): (0, 0.93, 0.37),
}


#: Recul du bassin qui accompagne `BUSTE_PENCHE`, en mètres, dans le monde.
#: +Y est derrière le personnage, qui regarde vers -Y.
RECUL_BASSIN = (0, 0.16, 0)


# Assises du corps, pour `assise` : (direction bassin→tête, direction du regard).
#
# Le personnage debout regarde vers -Y et sa tête pointe vers +Z. Coucher le
# corps, c'est simplement dire où vont ces deux directions.
#
# La tête part vers **+Y**, c'est-à-dire la gauche de l'image en vue de profil.
# C'est la convention des motifs vectoriels, et un exercice ne doit pas changer
# de sens selon qu'il est dessiné ou rendu.
SUR_LE_DOS = ((0, 1, 0), (0, 0, 1))
SUR_LE_VENTRE = ((0, 1, 0), (0, 0, -1))
#: Sur le côté droit : c'est donc le bras droit qui porte.
SUR_LE_COTE = ((0, 1, 0), (-1, 0, 0))


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
            # Les mains descendent derrière la nuque, pas seulement à
            # l'horizontale : un premier essai s'arrêtait là et l'amplitude
            # paraissait deux fois moindre qu'elle ne l'est.
            _pose({
                _os("LeftArm"): (0.22, 0.04, 1),
                _os("LeftForeArm"): (0.02, 0.60, -0.80),
                _os("RightArm"): (-0.22, 0.04, 1),
                _os("RightForeArm"): (-0.02, 0.60, -0.80),
            }),
        ],
    },
    "kickback-triceps": {
        "vue": "trois-quarts",
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
        "vue": "trois-quarts",
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
    # ---- Cinq épreuves, pour juger si le procédé tient hors du debout -------
    "developpe-couche": {
        "vue": "profil",
        "duree": 2200,
        "assise": SUR_LE_DOS,
        "cles": [
            # Couché sur le dos : le haut du corps suit le bassin sans qu'on ait
            # à le dire, les membres se décrivent dans le monde. +Z est donc le
            # plafond, -Y les pieds.
            _pose({
                _os("LeftArm"): (0.85, -0.30, -0.35),
                _os("LeftForeArm"): (0.30, -0.10, 0.95),
                _os("RightArm"): (-0.85, -0.30, -0.35),
                _os("RightForeArm"): (-0.30, -0.10, 0.95),
                _os("LeftUpLeg"): (0.10, -0.70, 0.70),
                _os("LeftLeg"): (0.06, -0.60, -0.80),
                _os("RightUpLeg"): (-0.10, -0.70, 0.70),
                _os("RightLeg"): (-0.06, -0.60, -0.80),
            }),
            _pose({
                _os("LeftArm"): (0.28, -0.10, 0.95),
                _os("LeftForeArm"): (0.12, 0, 1),
                _os("RightArm"): (-0.28, -0.10, 0.95),
                _os("RightForeArm"): (-0.12, 0, 1),
                _os("LeftUpLeg"): (0.10, -0.70, 0.70),
                _os("LeftLeg"): (0.06, -0.60, -0.80),
                _os("RightUpLeg"): (-0.10, -0.70, 0.70),
                _os("RightLeg"): (-0.06, -0.60, -0.80),
            }),
        ],
    },
    # Fente avant, relevée sur une vidéo de démonstration. Trois temps :
    # debout pieds joints, le pas en avant, le point bas genou près du sol.
    # Remplace une version écrite à la main, jamais rendue faute d'y arriver.
    #
    # Les bras sont rendus au modèle : la démonstratrice tient ses poings en
    # garde, ce qui est son style et non l'exercice — et la même planche sert
    # aussi les fentes haltères, bras le long du corps.
    "fente": {
        "vue": "profil",
        "duree": 3000,
        # Assise « debout », penchée des -0° mesurés sur la vidéo.
        "assise": ((+0.00, +0.01, +1.00), (+0.00, -1.00, +0.01)),
        "symetrique": False,
        # Les deux pieds portent. Au point bas, le genou arrière frôle le
        # sol sans le toucher : c'est le refus de rentrer dans le sol qui
        # l'en empêche, et non un appui déclaré.
        "ancrage": ("LeftFoot", "RightFoot"),
        "aplomb": True,
        "cles": [
            _pose({
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.22, +0.98),
                _os("Head"): (+0.00, -0.22, +0.98),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.00, -0.02, -1.00),
                _os("RightUpLeg"): (+0.00, -0.02, -1.00),
                _os("LeftLeg"): (+0.00, -0.02, -1.00),
                _os("RightLeg"): (+0.00, -0.02, -1.00),
                _os("LeftFoot"): (+0.00, -0.90, -0.43),
                _os("RightFoot"): (+0.00, -0.90, -0.43),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.22, +0.98),
                _os("Head"): (+0.00, -0.22, +0.98),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.00, -0.02, -1.00),
                _os("RightUpLeg"): (+0.00, -0.02, -1.00),
                _os("LeftLeg"): (+0.00, -0.02, -1.00),
                _os("RightLeg"): (+0.00, -0.02, -1.00),
                _os("LeftFoot"): (+0.00, -0.90, -0.43),
                _os("RightFoot"): (+0.00, -0.90, -0.43),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.21, +0.98),
                _os("Head"): (+0.00, -0.21, +0.98),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.00, -0.51, -0.86),
                _os("RightUpLeg"): (+0.00, +0.15, -0.99),
                _os("LeftLeg"): (+0.00, -0.43, -0.90),
                _os("RightLeg"): (+0.00, +0.62, -0.78),
                _os("LeftFoot"): (+0.00, -1.00, -0.05),
                _os("RightFoot"): (+0.00, -0.59, -0.81),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.08, +1.00),
                _os("Head"): (+0.00, -0.08, +1.00),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.00, -0.99, -0.13),
                _os("RightUpLeg"): (+0.00, +0.25, -0.97),
                _os("LeftLeg"): (+0.00, +0.25, -0.97),
                _os("RightLeg"): (+0.00, +0.96, +0.29),
                _os("LeftFoot"): (+0.00, -0.38, -0.93),
                _os("RightFoot"): (+0.00, +0.90, -0.43),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.08, +1.00),
                _os("Head"): (+0.00, -0.08, +1.00),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.00, -0.99, -0.13),
                _os("RightUpLeg"): (+0.00, +0.25, -0.97),
                _os("LeftLeg"): (+0.00, +0.25, -0.97),
                _os("RightLeg"): (+0.00, +0.96, +0.29),
                _os("LeftFoot"): (+0.00, -0.38, -0.93),
                _os("RightFoot"): (+0.00, +0.90, -0.43),
            }),
        ],
    },
    "mollets": {
        "vue": "profil",
        "duree": 1400,
        # Aucun décalage : le talon décolle, le pied pivote, et c'est l'ancrage
        # au sol qui fait monter le corps. Le lui imposer à la main donnerait la
        # même image mais pour de mauvaises raisons, et le moindre changement de
        # pose la fausserait.
        "cles": [
            _pose(),
            _pose({
                _os("LeftFoot"): (0.05, -0.55, -0.83),
                _os("RightFoot"): (-0.05, -0.55, -0.83),
            }),
        ],
    },
    # Fente latérale, même vidéo. **De face** et non de profil : le mouvement
    # se fait dans le plan frontal, et de profil il se ferait dans l'axe de la
    # caméra — le personnage semblerait ne pas bouger. Aucun exercice du
    # catalogue ne la décrit encore ; elle attend.
    "fente-laterale": {
        "vue": "face",
        "duree": 3000,
        # Assise « debout », penchée des +34° mesurés sur la vidéo.
        "assise": ((+0.00, -0.55, +0.83), (+0.00, -0.83, -0.55)),
        "symetrique": False,
        # Les deux pieds portent. Au point bas, le genou arrière frôle le
        # sol sans le toucher : c'est le refus de rentrer dans le sol qui
        # l'en empêche, et non un appui déclaré.
        "ancrage": ("LeftFoot", "RightFoot"),
        "aplomb": True,
        "cles": [
            _pose({
                _os("Spine"): (+0.00, -0.55, +0.83),
                _os("Spine1"): (+0.00, -0.55, +0.83),
                _os("Spine2"): (+0.00, -0.55, +0.83),
                _os("Neck"): (+0.00, -0.63, +0.77),
                _os("Head"): (+0.00, -0.63, +0.77),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (-0.14, +0.33, -0.93),
                _os("RightUpLeg"): (+0.14, +0.33, -0.93),
                _os("LeftLeg"): (-0.14, +0.33, -0.93),
                _os("RightLeg"): (+0.14, +0.33, -0.93),
                _os("LeftFoot"): (+0.16, -0.54, -0.82),
                _os("RightFoot"): (-0.16, -0.54, -0.82),
            }),
            _pose({
                _os("Spine"): (+0.00, -0.55, +0.83),
                _os("Spine1"): (+0.00, -0.55, +0.83),
                _os("Spine2"): (+0.00, -0.55, +0.83),
                _os("Neck"): (+0.00, -0.63, +0.77),
                _os("Head"): (+0.00, -0.63, +0.77),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (-0.14, +0.33, -0.93),
                _os("RightUpLeg"): (+0.14, +0.33, -0.93),
                _os("LeftLeg"): (-0.14, +0.33, -0.93),
                _os("RightLeg"): (+0.14, +0.33, -0.93),
                _os("LeftFoot"): (+0.16, -0.54, -0.82),
                _os("RightFoot"): (-0.16, -0.54, -0.82),
            }),
            _pose({
                _os("Spine"): (-0.00, -0.55, +0.83),
                _os("Spine1"): (-0.00, -0.55, +0.83),
                _os("Spine2"): (-0.00, -0.55, +0.83),
                _os("Neck"): (-0.14, -0.47, +0.87),
                _os("Head"): (-0.14, -0.47, +0.87),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.83, +0.03, -0.55),
                _os("RightUpLeg"): (-0.02, -0.33, -0.94),
                _os("LeftLeg"): (+0.91, +0.21, -0.35),
                _os("RightLeg"): (-0.09, +0.35, -0.93),
                _os("LeftFoot"): (+0.68, -0.70, -0.21),
                _os("RightFoot"): (-0.15, -0.76, -0.63),
            }),
            _pose({
                _os("Spine"): (-0.00, -0.55, +0.83),
                _os("Spine1"): (-0.00, -0.55, +0.83),
                _os("Spine2"): (-0.00, -0.55, +0.83),
                _os("Neck"): (-0.02, -0.17, +0.98),
                _os("Head"): (-0.02, -0.17, +0.98),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.87, +0.06, -0.49),
                _os("RightUpLeg"): (-0.01, -1.00, -0.09),
                _os("LeftLeg"): (+0.95, +0.16, -0.28),
                _os("RightLeg"): (+0.10, +0.15, -0.98),
                _os("LeftFoot"): (+0.82, -0.48, +0.31),
                _os("RightFoot"): (+0.07, -0.95, -0.30),
            }),
            _pose({
                _os("Spine"): (-0.00, -0.55, +0.83),
                _os("Spine1"): (-0.00, -0.55, +0.83),
                _os("Spine2"): (-0.00, -0.55, +0.83),
                _os("Neck"): (-0.02, -0.17, +0.98),
                _os("Head"): (-0.02, -0.17, +0.98),
                _os("LeftArm"): REPOS,
                _os("RightArm"): REPOS,
                _os("LeftForeArm"): REPOS,
                _os("RightForeArm"): REPOS,
                _os("LeftHand"): REPOS,
                _os("RightHand"): REPOS,
                _os("LeftUpLeg"): (+0.87, +0.06, -0.49),
                _os("RightUpLeg"): (-0.01, -1.00, -0.09),
                _os("LeftLeg"): (+0.95, +0.16, -0.28),
                _os("RightLeg"): (+0.10, +0.15, -0.98),
                _os("LeftFoot"): (+0.82, -0.48, +0.31),
                _os("RightFoot"): (+0.07, -0.95, -0.30),
            }),
        ],
    },

    "gainage-lateral": {
        # De trois-quarts : de profil, un corps couché est regardé dans l'axe de
        # son regard et l'on ne voit plus de quel côté il est tourné.
        "vue": "trois-quarts",
        "duree": 2600,
        "assise": SUR_LE_COTE,
        "symetrique": False,
        # L'ancrage porte sur les os qui **portent** vraiment, et non sur le
        # point le plus bas du maillage : couché sur le côté, c'est la cape du
        # personnage qui traîne au sol pendant que ses pieds flottent trente
        # centimètres au-dessus.
        #
        # Le pied gauche n'y est plus : dans un gainage latéral il est **empilé
        # sur** le droit, une dizaine de centimètres plus haut. Le compter parmi
        # les points à mettre de niveau aurait fait vriller le corps pour aller
        # le poser au sol.
        "ancrage": ("RightForeArm", "RightHand", "RightFoot"),
        # Sans quoi le corps reste à l'assiette de son assise et les pieds
        # montent à cinquante centimètres pendant que le coude porte seul.
        "aplomb": True,
        "cles": [
            # Pas de cinématique inverse ici, et c'est délibéré : elle place le
            # **poignet** et laisse le coude où il veut. Or dans un gainage
            # latéral, c'est le coude qui porte. Deux directions le disent
            # mieux qu'un point — le bras descend à la verticale, l'avant-bras
            # se couche au sol vers la tête.
            _pose({
                _os("RightArm"): (0, 0.06, -1),
                _os("RightForeArm"): (0, 1, 0.02),
                # La main d'appui est **posée**, paume au sol, dans le
                # prolongement de l'avant-bras. Laissée libre, elle gardait le
                # roulis d'un corps debout et se retrouvait sur le chant.
                _os("RightHand"): APlat((0, 1, 0)),
                # Le bras libre monte vers le plafond, main à la hanche exclue :
                # levé, il dit que le corps est bien sur le côté.
                _os("LeftArm"): (0, 0.04, 1),
                _os("LeftForeArm"): (0, 0.02, 1),
                # Jambes tendues et empilées : la gauche est au-dessus, puisque
                # le corps repose sur son côté droit.
                _os("LeftUpLeg"): (0, -0.97, -0.14),
                _os("LeftLeg"): (0, -0.99, -0.10),
                _os("RightUpLeg"): (0, -0.97, -0.22),
                _os("RightLeg"): (0, -0.99, -0.14),
            }),
            # La hanche s'affaisse puis remonte : le seul mouvement du geste.
            _pose({
                _os("RightArm"): (0, 0.06, -1),
                _os("RightForeArm"): (0, 1, 0.02),
                _os("RightHand"): APlat((0, 1, 0)),
                _os("LeftArm"): (0, 0.04, 1),
                _os("LeftForeArm"): (0, 0.02, 1),
                _os("LeftUpLeg"): (0, -0.99, 0.02),
                _os("LeftLeg"): (0, -0.99, -0.06),
                _os("RightUpLeg"): (0, -0.99, -0.06),
                _os("RightLeg"): (0, -0.99, -0.10),
            }),
        ],
        "bassin": [(0, 0, -0.06), (0, 0, 0.02)],
    },
    "mountain-climber": {
        # De profil, comme toutes les photos de l'exercice : le corps à plat
        # ventre s'y lit d'un trait, de la main posée au talon tendu. Le
        # trois-quarts avait été essayé pour lever une ambiguïté qui venait en
        # réalité d'ailleurs — le personnage regardait le ciel — et il ne
        # montrait plus que le dos et la cape.
        "vue": "profil",
        "duree": 800,
        "assise": SUR_LE_VENTRE,
        "symetrique": False,
        # Bassin à cinquante centimètres. Ce n'est pas la hauteur des épaules :
        # celles-ci sont plus haut, portées par le tronc incliné, à une longueur
        # de bras au-dessus des mains posées.
        #
        # C'est **la** valeur dont dépend tout le reste, et elle était fausse :
        # trente-deux centimètres étaient déclarés ici pendant que les appuis
        # des jambes, quelques lignes plus bas, étaient calculés pour une hanche
        # à cinquante — la portée d'une jambe de 90 cm y est écrite noir sur
        # blanc. Dix-huit centimètres d'écart, et les genoux s'enfonçaient
        # d'autant sous le plancher. Personne ne l'avait vu : rien ne regardait
        # le sol avant `auditer-gestes.py`.
        "hauteur": 0.50,
        "cles": [
            # Les mains ne bougent pas de tout l'exercice — elles sont posées.
            # C'est exactement ce qu'un appui exprime, et ce qu'on n'arrivait
            # pas à obtenir en cherchant les angles à la main.
            # Les pôles se lisent dans le repère du corps : à plat ventre,
            # son avant est le **sol**. Le genou mène donc vers le bas et le
            # coude part vers le haut. Écrits avec l'avant d'un corps debout,
            # ils pliaient les genoux à l'envers.
            #
            # Les x sont **négatifs à gauche** : à plat ventre, le demi-tour
            # met la gauche du personnage en -X. Écrits avec les signes du corps
            # debout, les appuis faisaient traverser chaque membre de l'autre
            # côté et les bras se croisaient.
            _pose(PLANCHE_DROITE, {
                # Six centimètres, et non deux : un appui vise le **poignet**,
                # et la paume est cinq centimètres plus bas. Viser le sol avec
                # le poignet enfonce donc la main d'autant.
                _os("LeftArm"): Appui((-0.18, 0.47, 0.06), (0, 0.30, 0.95)),
                _os("RightArm"): Appui((0.18, 0.47, 0.06), (0, 0.30, 0.95)),
                # Jambe tendue en arrière, cheville juste au-dessus du sol.
                # La hanche est à 50 cm et la jambe en fait 90 : le pied ne peut
                # pas aller plus loin que √(0,90² − 0,42²) ≈ 0,80 m en arrière.
                # Viser au-delà laissait la jambe pendre en diagonale, et le
                # personnage paraissait accroupi.
                # Les mains **posées**, paume au sol, doigts vers la tête. Un
                # appui ne place que le poignet : laissée libre, la main gardait
                # le roulis d'un corps debout et ses doigts traversaient le
                # plancher de sept centimètres et demi. C'est un majeur qui a
                # trahi la faute, une fois le sol dessiné.
                _os("LeftHand"): APlat((0, 1, 0)),
                _os("RightHand"): APlat((0, 1, 0)),
                _os("RightUpLeg"): Appui((0.12, -0.80, 0.21), (0, -0.20, -0.98)),
                # Genou ramené sous la poitrine : la cheville se rapproche.
                _os("LeftUpLeg"): Appui((-0.14, -0.20, 0.24), (0, 0.35, -0.94)),
                # Les pieds **posés**, orteils recourbés sous la cheville. Sans
                # eux, laissés au repos, ils gardaient l'orientation d'un corps
                # debout — donc pointés vers le bas une fois le corps à plat
                # ventre — et traversaient le plancher de douze centimètres. Un
                # appui vise la cheville, pas l'orteil : c'est pourquoi les
                # cibles ci-dessus sont à vingt et un centimètres, soit la
                # longueur du pied plus l'épaisseur des orteils. Les régler à
                # l'œil sur la position du sol y enfonçait le pied.
                _os("LeftFoot"): (0, 0, -1),
                _os("RightFoot"): (0, 0, -1),
            }),
            # Les pôles se lisent dans le repère du corps : à plat ventre,
            # son avant est le **sol**. Le genou mène donc vers le bas et le
            # coude part vers le haut. Écrits avec l'avant d'un corps debout,
            # ils pliaient les genoux à l'envers.
            #
            # Les x sont **négatifs à gauche** : à plat ventre, le demi-tour
            # met la gauche du personnage en -X. Écrits avec les signes du corps
            # debout, les appuis faisaient traverser chaque membre de l'autre
            # côté et les bras se croisaient.
            _pose(PLANCHE_DROITE, {
                # Six centimètres, et non deux : un appui vise le **poignet**,
                # et la paume est cinq centimètres plus bas. Viser le sol avec
                # le poignet enfonce donc la main d'autant.
                _os("LeftArm"): Appui((-0.18, 0.47, 0.06), (0, 0.30, 0.95)),
                _os("RightArm"): Appui((0.18, 0.47, 0.06), (0, 0.30, 0.95)),
                _os("LeftHand"): APlat((0, 1, 0)),
                _os("RightHand"): APlat((0, 1, 0)),
                _os("LeftUpLeg"): Appui((0.12, -0.80, 0.21), (0, -0.20, -0.98)),
                _os("RightUpLeg"): Appui((-0.14, -0.20, 0.24), (0, 0.35, -0.94)),
                _os("LeftFoot"): (0, 0, -1),
                _os("RightFoot"): (0, 0, -1),
            }),
        ],
    },
    # Planche basse, relevée sur une vidéo de démonstration. Trois temps :
    # la position de départ à quatre pattes, la mise en position, puis le
    # maintien. Les clés sont doublées aux deux extrémités — deux clés
    # identiques font une pause, et c'est ce qui donne au maintien la durée
    # d'un maintien plutôt que celle d'un passage.
    "planche-basse": {
        "vue": "profil",
        "duree": 3600,
        # Assise « ventre », penchée des -12° mesurés sur la vidéo.
        "assise": ((+0.00, +0.98, +0.22), (+0.00, +0.22, -0.98)),
        # Sur les avant-bras : le coude, l'avant-bras et le poing portent,
        # avec les orteils. À l'entrée, à quatre pattes, ce sont les genoux —
        # et c'est le refus de rentrer dans le sol qui s'en charge.
        "ancrage": ("LeftForeArm", "RightForeArm", "LeftHand", "RightHand",
                    "LeftFoot", "RightFoot"),
        "aplomb": True,
        "cles": [
            _pose({
                _os("Spine"): (+0.00, +0.98, +0.22),
                _os("Spine1"): (+0.00, +0.98, +0.22),
                _os("Spine2"): (+0.00, +0.98, +0.22),
                _os("Neck"): (+0.00, +0.92, +0.39),
                _os("Head"): (+0.00, +0.92, +0.39),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.03, -0.94, -0.35),
                _os("RightUpLeg"): (-0.03, -0.94, -0.35),
                _os("LeftLeg"): (+0.01, -0.84, +0.54),
                _os("RightLeg"): (-0.01, -0.84, +0.54),
                _os("LeftFoot"): (-0.10, -0.83, -0.55),
                _os("RightFoot"): (+0.10, -0.83, -0.55),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.98, +0.22),
                _os("Spine1"): (+0.00, +0.98, +0.22),
                _os("Spine2"): (+0.00, +0.98, +0.22),
                _os("Neck"): (+0.00, +0.92, +0.39),
                _os("Head"): (+0.00, +0.92, +0.39),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.03, -0.94, -0.35),
                _os("RightUpLeg"): (-0.03, -0.94, -0.35),
                _os("LeftLeg"): (+0.01, -0.84, +0.54),
                _os("RightLeg"): (-0.01, -0.84, +0.54),
                _os("LeftFoot"): (-0.10, -0.83, -0.55),
                _os("RightFoot"): (+0.10, -0.83, -0.55),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.98, +0.22),
                _os("Spine1"): (+0.00, +0.98, +0.22),
                _os("Spine2"): (+0.00, +0.98, +0.22),
                _os("Neck"): (+0.00, +0.97, +0.25),
                _os("Head"): (+0.00, +0.97, +0.25),
                _os("LeftArm"): (-0.21, +0.16, -0.97),
                _os("RightArm"): (+0.21, +0.16, -0.97),
                _os("LeftForeArm"): (+0.00, +1.00, +0.00),
                _os("RightForeArm"): (+0.00, +1.00, +0.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.03, -0.95, -0.32),
                _os("RightUpLeg"): (-0.03, -0.95, -0.32),
                _os("LeftLeg"): (-0.07, -0.97, -0.25),
                _os("RightLeg"): (+0.07, -0.97, -0.25),
                _os("LeftFoot"): (+0.00, +0.00, -1.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.98, +0.22),
                _os("Spine1"): (+0.00, +0.98, +0.22),
                _os("Spine2"): (+0.00, +0.98, +0.22),
                _os("Neck"): (+0.00, +0.97, +0.25),
                _os("Head"): (+0.00, +0.97, +0.25),
                _os("LeftArm"): (-0.21, +0.16, -0.97),
                _os("RightArm"): (+0.21, +0.16, -0.97),
                _os("LeftForeArm"): (+0.00, +1.00, +0.00),
                _os("RightForeArm"): (+0.00, +1.00, +0.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.03, -0.95, -0.32),
                _os("RightUpLeg"): (-0.03, -0.95, -0.32),
                _os("LeftLeg"): (-0.07, -0.97, -0.25),
                _os("RightLeg"): (+0.07, -0.97, -0.25),
                _os("LeftFoot"): (+0.00, +0.00, -1.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
        ],
    },

    # Planche haute, mêmes trois temps que la basse, mais sur bras tendus.
    "planche-haute": {
        "vue": "profil",
        "duree": 3600,
        # Assise « ventre », penchée des -17° mesurés sur la vidéo.
        "assise": ((+0.00, +0.96, +0.29), (+0.00, +0.29, -0.96)),
        # Mains et orteils : les quatre appuis d'une planche haute. À
        # l'entrée, à quatre pattes, ce sont les genoux qui portent — et c'est
        # le refus de rentrer dans le sol qui s'en charge.
        "ancrage": ("LeftHand", "RightHand", "LeftFoot", "RightFoot"),
        "aplomb": True,
        "cles": [
            _pose({
                _os("Spine"): (+0.00, +0.96, +0.29),
                _os("Spine1"): (+0.00, +0.96, +0.29),
                _os("Spine2"): (+0.00, +0.96, +0.29),
                _os("Neck"): (+0.00, +0.89, +0.46),
                _os("Head"): (+0.00, +0.89, +0.46),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.03, -0.91, -0.42),
                _os("RightUpLeg"): (-0.03, -0.91, -0.42),
                _os("LeftLeg"): (+0.01, -0.88, +0.48),
                _os("RightLeg"): (-0.01, -0.88, +0.48),
                _os("LeftFoot"): (-0.10, -0.79, -0.61),
                _os("RightFoot"): (+0.10, -0.79, -0.61),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.96, +0.29),
                _os("Spine1"): (+0.00, +0.96, +0.29),
                _os("Spine2"): (+0.00, +0.96, +0.29),
                _os("Neck"): (+0.00, +0.89, +0.46),
                _os("Head"): (+0.00, +0.89, +0.46),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.03, -0.91, -0.42),
                _os("RightUpLeg"): (-0.03, -0.91, -0.42),
                _os("LeftLeg"): (+0.01, -0.88, +0.48),
                _os("RightLeg"): (-0.01, -0.88, +0.48),
                _os("LeftFoot"): (-0.10, -0.79, -0.61),
                _os("RightFoot"): (+0.10, -0.79, -0.61),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.96, +0.29),
                _os("Spine1"): (+0.00, +0.96, +0.29),
                _os("Spine2"): (+0.00, +0.96, +0.29),
                _os("Neck"): (+0.00, +0.96, +0.27),
                _os("Head"): (+0.00, +0.96, +0.27),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (-0.02, -0.91, -0.42),
                _os("RightUpLeg"): (+0.02, -0.91, -0.42),
                _os("LeftLeg"): (-0.08, -0.96, -0.26),
                _os("RightLeg"): (+0.08, -0.96, -0.26),
                _os("LeftFoot"): (+0.00, +0.00, -1.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.96, +0.29),
                _os("Spine1"): (+0.00, +0.96, +0.29),
                _os("Spine2"): (+0.00, +0.96, +0.29),
                _os("Neck"): (+0.00, +0.96, +0.27),
                _os("Head"): (+0.00, +0.96, +0.27),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (-0.02, -0.91, -0.42),
                _os("RightUpLeg"): (+0.02, -0.91, -0.42),
                _os("LeftLeg"): (-0.08, -0.96, -0.26),
                _os("RightLeg"): (+0.08, -0.96, -0.26),
                _os("LeftFoot"): (+0.00, +0.00, -1.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
        ],
    },

    # Planche haute avec élévation alternée des jambes — la progression.
    # Départ à quatre pattes, mise en position, puis une jambe après l'autre.
    # La seconde élévation est le **reflet** de la première : la vidéo montre
    # les deux côtés, mais pas avec la même amplitude, et une démonstration
    # doit être symétrique là où l'exercice l'est.
    "planche-jambes-alternees": {
        "vue": "profil",
        "duree": 4400,
        # Assise « ventre », penchée des -3° mesurés sur la vidéo.
        "assise": ((+0.00, +1.00, +0.06), (+0.00, +0.06, -1.00)),
        "symetrique": False,
        # Les quatre appuis sont déclarés, y compris le pied qui se lève : la
        # mise d'aplomb écarte d'elle-même celui qui flotte au-dessus des
        # autres, et il redevient porteur quand il redescend.
        "ancrage": ("LeftHand", "RightHand", "LeftFoot", "RightFoot"),
        "aplomb": True,
        "cles": [
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.06),
                _os("Spine1"): (+0.00, +1.00, +0.06),
                _os("Spine2"): (+0.00, +1.00, +0.06),
                _os("Neck"): (+0.00, +0.97, +0.24),
                _os("Head"): (+0.00, +0.97, +0.24),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.03, -0.98, -0.20),
                _os("RightUpLeg"): (-0.03, -0.98, -0.20),
                _os("LeftLeg"): (+0.01, -0.74, +0.67),
                _os("RightLeg"): (-0.01, -0.74, +0.67),
                _os("LeftFoot"): (+0.00, +0.00, -1.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.06),
                _os("Spine1"): (+0.00, +1.00, +0.06),
                _os("Spine2"): (+0.00, +1.00, +0.06),
                _os("Neck"): (+0.00, +1.00, +0.05),
                _os("Head"): (+0.00, +1.00, +0.05),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (-0.02, -0.98, -0.20),
                _os("RightUpLeg"): (+0.02, -0.98, -0.20),
                _os("LeftLeg"): (-0.08, -1.00, -0.03),
                _os("RightLeg"): (+0.08, -1.00, -0.03),
                _os("LeftFoot"): (+0.00, +0.00, -1.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.06),
                _os("Spine1"): (+0.00, +1.00, +0.06),
                _os("Spine2"): (+0.00, +1.00, +0.06),
                _os("Neck"): (+0.00, +1.00, -0.03),
                _os("Head"): (+0.00, +1.00, -0.03),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (+0.00, -1.00, +0.08),
                _os("RightUpLeg"): (+0.00, -0.87, -0.49),
                _os("LeftLeg"): (+0.00, -1.00, +0.02),
                _os("RightLeg"): (+0.00, -0.95, -0.31),
                _os("LeftFoot"): (+0.00, -0.44, -0.90),
                _os("RightFoot"): (+0.00, -0.38, -0.92),
            }),
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.06),
                _os("Spine1"): (+0.00, +1.00, +0.06),
                _os("Spine2"): (+0.00, +1.00, +0.06),
                _os("Neck"): (+0.00, +1.00, +0.05),
                _os("Head"): (+0.00, +1.00, +0.05),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftUpLeg"): (-0.02, -0.98, -0.20),
                _os("RightUpLeg"): (+0.02, -0.98, -0.20),
                _os("LeftLeg"): (-0.08, -1.00, -0.03),
                _os("RightLeg"): (+0.08, -1.00, -0.03),
                _os("LeftFoot"): (+0.00, +0.00, -1.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.06),
                _os("Spine1"): (+0.00, +1.00, +0.06),
                _os("Spine2"): (+0.00, +1.00, +0.06),
                _os("Neck"): (+0.00, +1.00, -0.03),
                _os("Head"): (+0.00, +1.00, -0.03),
                _os("RightArm"): (+0.00, +0.00, -1.00),
                _os("LeftArm"): (+0.00, +0.00, -1.00),
                _os("RightForeArm"): (+0.00, +0.00, -1.00),
                _os("LeftForeArm"): (+0.00, +0.00, -1.00),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00)),
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00)),
                _os("RightUpLeg"): (+0.00, -1.00, +0.08),
                _os("LeftUpLeg"): (+0.00, -0.87, -0.49),
                _os("RightLeg"): (+0.00, -1.00, +0.02),
                _os("LeftLeg"): (+0.00, -0.95, -0.31),
                _os("RightFoot"): (+0.00, -0.44, -0.90),
                _os("LeftFoot"): (+0.00, -0.38, -0.92),
            }),
        ],
    },

    "rowing": {
        "vue": "trois-quarts",
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
    from mathutils import Vector
    def resolue(pose):
        sortie = {}
        for nom, valeur in pose.items():
            if nom not in repos:
                continue
            if isinstance(valeur, (Appui, APlat)) or valeur is SUIVRE:
                # Ni l'un ni l'autre n'est une direction. Un appui se résoudra
                # une fois la chaîne parente posée, quand on saura où se trouve
                # l'épaule ou la hanche ; un os qui suit ne se vise jamais.
                sortie[nom] = valeur
            else:
                sortie[nom] = Vector(
                    repos[nom] if valeur is REPOS else valeur
                ).normalized()
        return sortie

    def entre(a, b, e):
        if a is SUIVRE and b is SUIVRE:
            return SUIVRE
        if a is SUIVRE or b is SUIVRE:
            raise SystemExit(
                "Un os suit son parent dans une pose et vise une direction "
                "dans l'autre ; il faut choisir l'un ou l'autre pour tout le "
                "geste, sans quoi il n'y a rien à interpoler entre les deux."
            )
        if isinstance(a, APlat) and isinstance(b, APlat):
            return APlat(
                Vector(a.direction).lerp(Vector(b.direction), e).normalized(),
                Vector(a.paume).lerp(Vector(b.paume), e).normalized(),
            )
        if isinstance(a, APlat) or isinstance(b, APlat):
            raise SystemExit(
                "Une main est posée à plat dans une pose et libre dans l'autre ; "
                "il faut choisir l'un ou l'autre pour tout le geste."
            )
        if isinstance(a, Appui) and isinstance(b, Appui):
            # Un point s'interpole **linéairement** : le normaliser le
            # ramènerait sur la sphère unité et la main décrirait un arc au
            # lieu d'aller d'un appui à l'autre.
            return Appui(
                tuple(x + (y - x) * e for x, y in zip(a.cible, b.cible)),
                tuple(x + (y - x) * e for x, y in zip(a.pole, b.pole)),
            )
        if isinstance(a, Appui) or isinstance(b, Appui):
            raise SystemExit(
                "Un membre passe d'un appui à une direction libre d'une pose à "
                "l'autre ; il faut choisir l'un ou l'autre pour tout le geste."
            )
        return a.lerp(b, e).normalized()

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
            {nom: entre(depart[nom], arrivee[nom], e) for nom in depart}
        )
    return poses


def _direction(armature, os_pose):
    """Direction de l'os dans le monde : la colonne Y de sa matrice de pose."""
    return (armature.matrix_world.to_3x3() @ os_pose.matrix.col[1].to_3d()).normalized()


def viser(armature, os_pose, direction, repos, contexte, face=None):
    """Oriente l'os vers `direction`, exprimée dans le monde.

    ## Le roulis, quand il compte

    `face` sert aux os dont la rotation **autour** de leur axe se voit : la
    main, et elle seule pour l'instant. Une main posée à plat et une main
    posée sur le chant ont exactement la même direction — du poignet vers les
    doigts — et ne diffèrent que par ce roulis. C'est ce qui donnait une paume
    à 96° du sol : ouverte, doigts écartés, et debout sur sa tranche.

    `face` est la direction du monde vers laquelle la **paume** doit regarder.

    Sur ce squelette, la paume est l'axe local **+Z** de l'os de la main. Le
    signe s'obtient par le pouce, et pas autrement : main droite à plat sur une
    table, doigts vers le nord, le pouce pointe à l'ouest — donc la normale
    vaut `pouce × doigts` à droite et `doigts × pouce` à gauche. Poser ce signe
    au jugé, comme au premier essai, retourne les deux mains dos au sol : à
    plat, et à l'envers.

    ## Pourquoi partir du **repos** et non de la pose courante

    Une direction ne suffit pas à orienter un os : il reste libre de tourner
    autour d'elle. Aligner simplement l'axe courant sur la cible laisse ce
    roulis au hasard de la rotation minimale — et sur une chaîne, chaque os
    hérite du roulis de son parent et y ajoute le sien. Le premier jet faisait
    exactement ça : les gestes debout passaient, parce qu'ils ne touchent pas au
    dos, mais dès qu'on pliait la colonne les vrilles s'accumulaient sur trois
    vertèbres et le torse sortait tordu, épaules écrasées et capuche de travers.

    On repart donc de l'orientation **complète** de l'os au repos, à laquelle on
    applique la rotation qui mène sa direction de repos à la cible. Le roulis
    est alors celui du modèle, le résultat ne dépend plus de l'ordre ni de
    l'historique des poses, et deux images voisines ne peuvent plus diverger.

    `repos` est cette orientation de repos, en espace armature.
    """
    import math

    from mathutils import Matrix, Vector

    cible = (armature.matrix_world.inverted().to_3x3() @ Vector(direction)).normalized()
    depuis = repos.col[1].normalized()
    tourne = depuis.rotation_difference(cible).to_matrix() @ repos

    if face is not None:
        voulue = (armature.matrix_world.inverted().to_3x3() @ Vector(face)).normalized()
        # Ce qu'on cherche est une rotation **autour de l'axe de l'os** : elle
        # seule laisse la direction intacte. On compare donc les deux normales
        # débarrassées de leur part le long de l'axe, et l'angle signé entre
        # elles est le roulis à rattraper.
        actuelle = tourne.col[2].to_3d().normalized()
        a = (actuelle - cible * actuelle.dot(cible))
        b = (voulue - cible * voulue.dot(cible))
        if a.length > 1e-4 and b.length > 1e-4:
            a.normalize()
            b.normalize()
            angle = math.atan2(a.cross(b).dot(cible), a.dot(b))
            tourne = Matrix.Rotation(angle, 3, cible) @ tourne

    oriente = tourne.to_4x4()
    # La position, elle, vient de la chaîne telle qu'elle est **maintenant** :
    # un os suit son parent quand celui-ci tourne.
    oriente.translation = os_pose.matrix.translation
    os_pose.matrix = oriente
    # Sans cette réévaluation, l'os suivant lirait la matrice de son parent
    # d'avant la pose.
    contexte.view_layer.update()


def _decalages(declare, cles, images):
    """Décalage du bassin à chaque image, ou `None` partout s'il n'y en a pas.

    Accepte un seul triplet — le bassin ne bouge alors pas du geste — ou un
    triplet par pose clé, ce qui le fait monter et descendre. C'est ce dont un
    mollet debout a besoin : rien ne tourne, tout le corps se translate.
    """
    if declare is None:
        return [None] * images
    if not isinstance(declare[0], (tuple, list)):
        return [tuple(declare)] * images
    if len(declare) != cles:
        raise SystemExit(
            f"Le geste déclare {len(declare)} décalages de bassin pour {cles} poses."
        )

    boucle = list(declare) + list(reversed(declare))[1:]
    segments = max(1, len(boucle) - 1)
    suite = []
    for i in range(images):
        u = (i / images) * segments
        rang = min(int(u), segments - 1)
        e = _adoucir(u - rang)
        a, b = boucle[rang], boucle[rang + 1]
        suite.append(tuple(x + (y - x) * e for x, y in zip(a, b)))
    return suite


def atteindre(racine, cible, pole, longueurs):
    """Où pointer les deux os d'un membre pour que son extrémité touche `cible`.

    ## Pourquoi il en faut une

    Écrire les directions à la main suffit tant que le membre est libre. Dès
    qu'il **prend appui**, ce n'est plus la direction qu'on connaît mais le
    point : une main de planche est posée sous l'épaule, un pied de fente est
    planté au sol. Chercher à la main les deux angles qui amènent la paume au
    bon endroit, c'est résoudre un triangle de tête — et se tromper, ce qui a
    donné un gainage latéral où le personnage était couché au lieu d'être en
    appui.

    Une chaîne à deux os se résout pourtant exactement, par le théorème d'Al-
    Kashi : la distance racine-cible et les deux longueurs déterminent l'angle
    au coude, et il ne reste qu'à choisir de quel côté il plie. C'est ce que
    `pole` indique — vers l'arrière pour un coude, vers l'avant pour un genou.

    Renvoie les deux directions, à passer à `viser` comme les autres.
    """
    from mathutils import Vector

    racine, cible, pole = Vector(racine), Vector(cible), Vector(pole)
    l1, l2 = longueurs

    vers = cible - racine
    distance = vers.length
    if distance < 1e-5:
        # Cible confondue avec la racine : aucune direction n'a de sens, on
        # laisse le membre tendu vers le pôle plutôt que de diviser par zéro.
        return pole.normalized(), pole.normalized()

    axe = vers / distance
    # Hors de portée : le membre se tend vers la cible sans l'atteindre. C'est
    # le comportement d'un vrai bras, et il vaut mieux que de forcer un pli.
    distance = min(distance, (l1 + l2) * 0.999)

    # Projection du coude sur l'axe, puis sa hauteur au-dessus.
    le_long = (distance * distance + l1 * l1 - l2 * l2) / (2 * distance)
    ecart = max(0.0, l1 * l1 - le_long * le_long) ** 0.5

    # Le pôle, débarrassé de sa part parallèle à l'axe : il ne dit que le côté.
    cote = pole - axe * pole.dot(axe)
    if cote.length < 1e-5:
        # Pôle aligné sur l'axe : il ne désigne aucun côté. On en prend un
        # perpendiculaire quelconque plutôt que de renvoyer une direction nulle.
        cote = axe.cross(Vector((0, 0, 1)))
        if cote.length < 1e-5:
            cote = axe.cross(Vector((1, 0, 0)))
    cote.normalize()

    coude = racine + axe * le_long + cote * ecart
    return (coude - racine).normalized(), (cible - coude).normalized()


#: Sommets portés par chaque os d'appui, retenus d'un appel à l'autre. Le
#: dépouillement des groupes de sommets coûte une seconde ; le refaire à chaque
#: image d'un rendu le multiplierait par vingt.
_CHAIR = {}


def _chair_portee(contexte, armature, os_porteurs):
    """Quels sommets du maillage chaque os d'appui emporte avec lui.

    On prend l'os **et sa descendance** : une main porte ses doigts, un pied
    ses orteils, et ce sont eux qui touchent le sol. Le partage se lit dans les
    groupes de sommets, c'est-à-dire dans le poids que le modèle a lui-même
    attribué à chaque os.
    """
    cle = (armature.name, tuple(os_porteurs))
    if cle in _CHAIR:
        return _CHAIR[cle]

    familles = {}
    for nom in os_porteurs:
        racine = armature.pose.bones[f"mixamorig:{nom}"]
        familles[nom] = {racine.name} | {
            enfant.name for enfant in racine.children_recursive
        }

    sortie = {nom: [] for nom in os_porteurs}
    for objet in contexte.scene.objects:
        if objet.type != "MESH" or objet.find_armature() is not armature:
            continue
        noms = {groupe.index: groupe.name for groupe in objet.vertex_groups}
        for nom, famille in familles.items():
            groupes = {i for i, n in noms.items() if n in famille}
            if not groupes:
                continue
            # Plus de la moitié du poids : le sommet appartient franchement à
            # ce membre. En dessous, il est partagé avec le voisin et bouge
            # aussi avec lui — le compter fausserait le contact.
            choisis = [
                v.index
                for v in objet.data.vertices
                if sum(e.weight for e in v.groups if e.group in groupes) > 0.5
            ]
            if choisis:
                sortie[nom].append((objet, choisis))

    _CHAIR[cle] = sortie
    return sortie


def contacts(contexte, armature, os_porteurs):
    """Point le plus bas de la **chair** de chaque appui, dans le monde.

    ## Pourquoi pas l'os

    Parce que ce n'est pas lui qui touche. L'os de la main passe au milieu de
    la paume : le poser à zéro enfonce la chair de trois centimètres dans le
    sol. Sur une planche, où mains et pieds portent tout le corps, l'erreur se
    voit aussitôt qu'on matérialise le plancher — et jusque-là, elle passait
    inaperçue faute de repère.
    """
    depsgraph = contexte.evaluated_depsgraph_get()
    sortie = {}
    for nom, morceaux in _chair_portee(contexte, armature, os_porteurs).items():
        bas = None
        for objet, indices in morceaux:
            evalue = objet.evaluated_get(depsgraph)
            monde = evalue.matrix_world
            for i in indices:
                p = monde @ evalue.data.vertices[i].co
                if bas is None or p.z < bas.z:
                    bas = p
        if bas is None:
            # Un squelette sans maillage — le banc de mesure en importe un.
            # L'os reste alors la meilleure approximation disponible.
            bas = armature.matrix_world @ armature.pose.bones[
                f"mixamorig:{nom}"
            ].tail
        sortie[nom] = bas
    return sortie


#: Au-delà, un appui n'est pas sur le même plan que les autres. Six
#: centimètres, c'est l'épaisseur d'un pied empilé sur l'autre en gainage
#: latéral — donc assez large pour ne pas rejeter du bruit, assez serré pour
#: reconnaître un pied levé.
TOLERANCE_APPUI = 0.06


def _plan_consensuel(points):
    """Le plan du sol que le plus d'appuis confirment.

    ## Pourquoi pas les moindres carrés sur tous les points

    Parce qu'un membre levé les tire à lui. Sur une planche jambe levée, le
    pied en l'air est à quarante centimètres au-dessus des trois autres appuis ;
    un ajustement global penche vers lui, et la correction qui suit fait
    vriller le corps pour aller le poser au sol. Une main se retrouvait alors à
    vingt-deux centimètres en l'air.

    Écarter les points aberrants **après** un premier ajustement ne suffit pas
    non plus : chaque passe rapproche un peu le pied levé du plan, jusqu'à ce
    qu'il passe le seuil et reprenne la main. La faute revenait par la fenêtre.

    ## Le consensus

    On essaie donc chaque trio d'appuis — il y en a quatre au plus —, on
    compte pour chacun combien d'autres appuis tombent sur le plan qu'il
    définit, et l'on garde le mieux confirmé. Un pied levé ne se joindra jamais
    au trio des deux mains et du pied qui porte ; le trio, lui, se confirme
    tout seul.

    Aucun tirage au sort là-dedans : quatre points, quatre trios, tous
    essayés. Le résultat ne dépend que de la pose.
    """
    if len(points) < 3:
        return None

    def hauteurs(plan):
        """Hauteur signée de chaque appui au-dessus du plan candidat."""
        a, b, centre = plan
        return [
            (p.z - centre.z) - a * (p.x - centre.x) - b * (p.y - centre.y)
            for p in points
        ]

    meilleur, secours = None, None
    for trio in itertools.combinations(range(len(points)), 3):
        plan = _ajuster_le_plan([points[i] for i in trio])
        if plan is None:
            continue
        au_dessus = hauteurs(plan)
        soutien = sum(1 for h in au_dessus if abs(h) < TOLERANCE_APPUI)
        # À soutien égal, **la moindre correction**. Deux trios peuvent porter
        # autant de monde l'un que l'autre : celui des deux mains et du pied
        # qui porte, et celui d'une main et des deux pieds, dont l'un se lève.
        # Le second demande de vriller le corps d'un quart de tour pour aller
        # chercher un pied en l'air, et une main montait alors de quatorze
        # centimètres. Un sol qui exige ça n'est pas le sol.
        pente = plan[0] * plan[0] + plan[1] * plan[1]
        note = (-soutien, pente)
        garde = (
            note,
            [p for p, h in zip(points, au_dessus) if abs(h) < TOLERANCE_APPUI],
        )
        if secours is None or note < secours[0]:
            secours = garde

        # **Le sol ne coupe pas le corps.** Un plan qui laisserait un appui en
        # dessous n'est pas un sol : c'est ce qui départage, pendant la montée
        # d'une jambe, le trio des membres qui portent de celui qui contient le
        # membre en l'air. Sans ce test, le corps se retrouvait en équilibre
        # sur un seul pied, tout le reste à trente centimètres.
        if min(au_dessus) < -TOLERANCE_APPUI:
            continue
        if meilleur is None or note < meilleur[0]:
            meilleur = garde

    # Aucun plan ne porte tout le monde : la pose est intenable, mais mieux
    # vaut la redresser au mieux que ne rien faire et la laisser en travers.
    retenu = meilleur or secours
    return _ajuster_le_plan(retenu[1]) if retenu else None


def _ajuster_le_plan(points):
    """Plan des moindres carrés `z = a·x + b·y` passant par les appuis.

    Renvoie `(a, b, centre)`, ou `None` si les points ne définissent aucun
    plan — deux mains seules, ou un corps vu strictement de profil.
    """
    from mathutils import Vector

    if len(points) < 3:
        return None
    centre = sum(points, Vector((0, 0, 0))) / len(points)
    plats = [(p.x - centre.x, p.y - centre.y, p.z - centre.z) for p in points]

    # Le système normal d'une régression à deux variables. Le terme constant
    # disparaît puisque l'origine est déjà au centre des appuis.
    xx = sum(x * x for x, _, _ in plats)
    xy = sum(x * y for x, y, _ in plats)
    yy = sum(y * y for _, y, _ in plats)
    xz = sum(x * z for x, _, z in plats)
    yz = sum(y * z for _, y, z in plats)

    determinant = xx * yy - xy * xy
    if abs(determinant) >= 1e-8:
        return (
            (xz * yy - yz * xy) / determinant,
            (yz * xx - xz * xy) / determinant,
            centre,
        )

    # Appuis alignés : aucun plan ne s'y ajuste, et il n'y a rien à redresser
    # en travers. On se rabat sur la seule pente que les points désignent.
    etale = max(plats, key=lambda p: p[0] * p[0] + p[1] * p[1])
    u = Vector((etale[0], etale[1], 0))
    if u.length < 0.05:
        return None
    u.normalize()
    le_long = [x * u.x + y * u.y for x, y, _ in plats]
    variance = sum(s * s for s in le_long)
    if variance < 1e-6:
        return None
    pente = sum(s * z for s, (_, _, z) in zip(le_long, plats)) / variance
    return pente * u.x, pente * u.y, centre


def mettre_d_aplomb(contexte, armature, os_porteurs, remettre=None):
    """Fait pencher le corps entier jusqu'à ce que ses appuis soient de niveau.

    ## Ce que ça répare

    Un geste relevé sur une vidéo donne la **forme** du corps — l'angle de
    chaque membre par rapport aux autres — et pas sa pente par rapport au sol.
    L'estimateur travaille dans le repère de l'image, et une caméra qui plonge
    un peu, ce qui est le cas de toute vidéo tournée sur un sujet au sol, fait
    croire à un corps plus horizontal qu'il n'est.

    La première planche relevée ainsi sortait parfaitement droite, mains
    posées… et chevilles à cinquante-deux centimètres en l'air. Le corps était
    juste, sa pente ne l'était pas.

    Or la pente, on la connaît sans rien mesurer sur la vidéo : **les mains et
    les orteils d'une planche sont sur le même sol.** C'est une contrainte
    physique, elle ne dépend d'aucune estimation, et elle s'adapte d'elle-même
    aux proportions du personnage — qui ne sont pas celles du sujet filmé.

    ## Comment

    On prend le point de contact de chaque appui et l'on cherche le **plan**
    des moindres carrés qui les traverse, puis on fait tourner le corps pour
    coucher ce plan à l'horizontale.

    Un plan, et non une droite le long du corps : sur une planche, les appuis
    s'étalent aussi en largeur, et la première version — qui ne corrigeait que
    la pente tête-pieds — laissait un centimètre de gîte, main droite et pied
    droit en l'air. Un centimètre passe inaperçu tant qu'on ne dessine pas le
    sol, et saute aux yeux dès qu'on le dessine.

    Un plan ajusté **deux fois**, aussi, la seconde sans les membres qui ne
    portent pas. Un pied levé, un pied empilé sur l'autre en gainage latéral :
    ils figurent parmi les appuis déclarés parce qu'ils portent *par moments*,
    et les compter fait vriller le corps pour aller les poser au sol. On les
    reconnaît à ceci qu'ils flottent franchement au-dessus du plan que les
    autres définissent.

    Ça ne remplace pas `poser_sur`, ça le précède : mettre d'aplomb rend les
    appuis parallèles au sol, poser les y amène.

    Plusieurs passes plutôt qu'une : le point de contact d'un membre est le
    sommet le plus bas de sa chair, et ce n'est plus le même une fois le corps
    tourné.

    `remettre` est rappelé après chaque rotation, avant de remesurer. Il sert
    aux mains posées à plat, dont l'orientation est donnée dans le **monde** et
    ne doit donc pas suivre le corps : les remettre déplace leur point de
    contact, ce qui change le plan à ajuster. Les corriger une seule fois à la
    fin décollait les pieds d'un centimètre.
    """
    for _ in range(4):
        if not _une_passe_daplomb(contexte, armature, os_porteurs):
            return
        if remettre is not None:
            remettre()


def _une_passe_daplomb(contexte, armature, os_porteurs):
    """Une correction d'assiette. Renvoie vrai s'il reste à faire."""
    import math

    from mathutils import Vector

    contexte.view_layer.update()

    tous = list(contacts(contexte, armature, os_porteurs).values())
    plan = _plan_consensuel(tous)
    if plan is None:
        return False
    a, b, _centre = plan

    # La normale du plan trouvé. La coucher sur la verticale, c'est mettre les
    # appuis de niveau.
    normale = Vector((-a, -b, 1.0)).normalized()
    angle = normale.angle(Vector((0, 0, 1)))
    # Une correction de plus d'un quart de tour ne redresse rien : elle dit que
    # les appuis nommés ne sont pas ceux qui portent. Mieux vaut ne rien faire
    # et laisser la faute visible.
    if angle > math.pi / 4:
        return False
    # Un dixième de degré sur un corps d'un mètre quatre-vingt, c'est trois
    # dixièmes de millimètre au bout : plus rien à gagner.
    if angle < math.radians(0.1):
        return False

    rotation = normale.rotation_difference(Vector((0, 0, 1))).to_matrix()

    monde = armature.matrix_world.to_3x3()
    locale = monde.inverted() @ rotation @ monde

    bassin = armature.pose.bones[BASSIN]
    tourne = (locale @ bassin.matrix.to_3x3()).to_4x4()
    tourne.translation = bassin.matrix.translation
    bassin.matrix = tourne
    contexte.view_layer.update()
    return True


def poser_sur(contexte, armature, os_porteurs):
    """Descend le corps jusqu'à ce que les membres nommés touchent le sol.

    Le point le plus bas du maillage **entier** ne convient pas toujours : le
    personnage porte une cape, et couché sur le côté c'est elle qui traîne au
    sol pendant que ses pieds flottent trente centimètres au-dessus. Nommer les
    os qui portent — l'avant-bras et les pieds d'un gainage latéral — remet la
    décision là où elle appartient, dans le geste.

    Ce qu'on mesure alors reste de la **chair** : celle que ces os emportent,
    et pas l'os lui-même, qui passe au milieu de la paume.

    ## Et rien ne rentre dans le sol

    Les appuis nommés ne sont pas toujours les points les plus bas. Sur l'image
    de départ d'une planche — le corps à plat ventre avant de se hisser —, ce
    qui touche est la poitrine, pas les mains. Descendre jusqu'aux mains
    enfonçait alors le buste de quelques centimètres et la tête de treize, ce
    qu'aucun sol ne permet.

    On rattrape donc en second temps : si quoi que ce soit du maillage passe
    sous zéro, le corps remonte d'autant. Sur les images où les appuis portent
    vraiment, ce rattrapage ne fait rien.
    """
    contexte.view_layer.update()
    hauteurs = [p.z for p in contacts(contexte, armature, os_porteurs).values()]
    bas = min(hauteurs) if hauteurs else None

    if bas is not None and abs(bas) > 1e-4:
        _translater(contexte, armature, -bas)

    dessous = _plus_bas_du_maillage(contexte)
    if dessous is not None and dessous < -1e-4:
        _translater(contexte, armature, -dessous)


def _plus_bas_du_maillage(contexte):
    """Hauteur du point le plus bas du maillage évalué, dans le monde."""
    depsgraph = contexte.evaluated_depsgraph_get()
    bas = None
    for objet in contexte.scene.objects:
        if objet.type != "MESH":
            continue
        evalue = objet.evaluated_get(depsgraph)
        monde = evalue.matrix_world
        for v in evalue.data.vertices:
            z = (monde @ v.co).z
            bas = z if bas is None else min(bas, z)
    return bas


def _translater(contexte, armature, monte):
    """Déplace le corps entier de `monte` mètres sur la verticale du monde."""
    bassin = armature.pose.bones[BASSIN]
    matrice = bassin.matrix.copy()
    matrice.translation += armature.matrix_world.inverted().to_3x3() @ _vecteur(
        (0, 0, monte)
    )
    bassin.matrix = matrice
    contexte.view_layer.update()


def poser_au_sol(contexte, armature):
    """Descend le corps jusqu'à ce que son point le plus bas touche le sol.

    ## Pourquoi il faut un sol

    Sans lui, on ne pose pas un corps : on le fait flotter. Debout ou couché,
    ça ne se voit pas — la caméra recadre et personne ne sait à quelle hauteur
    était le personnage. Mais dès qu'un geste prend **appui**, tout son sens
    tient à ce que les mains et les pieds reposent sur un même plan avec le
    corps au-dessus. Une planche dont les mains flottent trente centimètres
    sous le sol n'est plus une planche : le premier mountain climber rendu ici
    donnait un personnage en équilibre sur la tête.

    Le point le plus bas est pris sur le **maillage évalué**, pas sur le
    squelette : c'est la paume et la semelle qui touchent, pas l'os du poignet
    ni celui de la cheville, et l'écart se compte en centimètres.

    Un saut est la seule exception légitime — le corps y quitte le sol pour de
    bon. Ces gestes-là déclarent `ancrage: False`.
    """
    contexte.view_layer.update()
    depsgraph = contexte.evaluated_depsgraph_get()

    bas = None
    for objet in contexte.scene.objects:
        if objet.type != "MESH":
            continue
        evalue = objet.evaluated_get(depsgraph)
        for coin in evalue.bound_box:
            z = (evalue.matrix_world @ _vecteur(coin)).z
            bas = z if bas is None else min(bas, z)

    if bas is None or abs(bas) < 1e-4:
        return

    bassin = armature.pose.bones[BASSIN]
    matrice = bassin.matrix.copy()
    matrice.translation -= armature.matrix_world.inverted().to_3x3() @ _vecteur(
        (0, 0, bas)
    )
    bassin.matrix = matrice
    contexte.view_layer.update()


def _vecteur(triplet):
    from mathutils import Vector

    return Vector(triplet)


def _poser_bassin(armature, ancre, decalage, contexte):
    """Place le bassin à sa position de repos, décalée de `decalage` (monde)."""
    from mathutils import Vector

    bassin = armature.pose.bones[BASSIN]
    matrice = bassin.matrix.copy()
    matrice.translation = ancre + armature.matrix_world.inverted().to_3x3() @ Vector(
        decalage
    )
    bassin.matrix = matrice
    contexte.view_layer.update()


def basculer_bassin(armature, haut, regard, repos, contexte):
    """Couche, suspend ou retourne le corps entier, en orientant le bassin.

    ## Pourquoi le bassin ne se vise pas comme les autres os

    `viser` ne demande qu'une direction, ce qui suffit à un bras : le roulis
    hérité du repos y passe inaperçu. Sur le bassin, ce roulis **est** le geste.
    Un corps allongé sur le dos et un corps allongé sur le côté ont la même
    colonne — de la tête aux pieds — et ne diffèrent que par la rotation autour
    d'elle. Une direction seule ne peut pas les distinguer.

    On en donne donc deux : `haut`, la direction qui va du bassin vers la tête,
    et `regard`, celle vers laquelle le corps fait face. La composante de
    `regard` parallèle à `haut` est retirée : deux directions non
    perpendiculaires ne définiraient aucun repère.

    C'est ce qui ouvre les développés couchés, les gainages latéraux, les
    suspensions — tout ce qui ne se fait pas debout.

    Renvoie la rotation appliquée, dans le monde **et** dans l'armature. Les
    deux servent : la première fait tourner les directions de repos, de sorte
    que `REPOS` continue de signifier « comme le modèle se tient » une fois le
    corps couché ; la seconde fait tourner les **orientations** de repos, sans
    quoi `viser` prendrait le roulis d'un corps debout pour poser un corps
    couché — et le tronc basculait alors de cent quatre-vingts degrés, le
    personnage regardant le ciel au lieu du sol.
    """
    import math

    from mathutils import Matrix, Vector

    contexte.view_layer.update()

    # Tout se calcule dans le monde : c'est le repère dans lequel les gestes
    # sont écrits, et le seul où « le haut » et « le regard » veulent dire
    # quelque chose.
    h = Vector(haut).normalized()
    r = Vector(regard)
    r = (r - h * r.dot(h)).normalized()

    # Deux rotations enchaînées : la colonne d'abord, le roulis ensuite.
    # Construire le repère à la main obligerait à savoir quel axe local de
    # Mixamo désigne l'avant — ce qu'on cherche justement à ne jamais savoir.
    debout, devant = Vector((0, 0, 1)), Vector((0, -1, 0))
    vers_haut = debout.rotation_difference(h)
    apres = vers_haut @ devant
    apres = (apres - h * apres.dot(h)).normalized()

    # Le demi-tour est un cas à part, et c'est celui qui donnait un personnage
    # en équilibre sur la tête. Entre deux directions **opposées**,
    # `rotation_difference` doit choisir un axe parmi une infinité de
    # possibilités et en prend un arbitraire — alors qu'ici un seul convient :
    # la colonne elle-même. C'est exactement le cas du corps à plat ventre, où
    # aligner la colonne laisse le regard tourné vers le plafond.
    if apres.dot(r) < -0.999:
        vers_regard = Matrix.Rotation(math.pi, 3, h)
    else:
        vers_regard = apres.rotation_difference(r).to_matrix()

    rotation = (vers_regard @ vers_haut.to_matrix())

    monde = armature.matrix_world.to_3x3()
    locale = monde.inverted() @ rotation @ monde

    bassin = armature.pose.bones[BASSIN]
    oriente = (locale @ repos).to_4x4()
    oriente.translation = bassin.matrix.translation
    bassin.matrix = oriente
    contexte.view_layer.update()
    return rotation, locale


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
    # Mesurées **avant** toute pose : c'est ce que le modèle porte de lui-même.
    # La direction sert à résoudre `REPOS` ; l'orientation complète sert à
    # `viser`, qui a besoin du roulis et pas seulement de l'axe (voir là-bas).
    repos = {o: _direction(armature, armature.pose.bones[o]) for o in ORDRE}
    orientations = {
        o: armature.pose.bones[o].matrix.to_3x3().copy() for o in ORDRE
    }
    repos_bassin = armature.pose.bones[BASSIN].matrix.to_3x3().copy()

    # Longueurs réelles des membres, mesurées sur ce squelette-ci : la
    # résolution des appuis en dépend, et les coder en dur les ferait mentir sur
    # un personnage plus grand ou plus petit.
    echelle = armature.matrix_world.to_scale().x
    longueurs = {
        racine: (
            armature.pose.bones[racine].bone.length * echelle,
            armature.pose.bones[milieu].bone.length * echelle,
        )
        for racine, (milieu, _) in CHAINES.items()
        if racine in armature.pose.bones and milieu in armature.pose.bones
    }

    geste = GESTES[nom]

    # La bascule **d'abord** : elle tourne tout le corps, et les os visés
    # ensuite le sont dans le monde — leurs directions ne dépendent donc pas
    # d'elle. L'inverse effacerait chaque pose au moment de coucher le corps.
    assise = geste.get("assise")
    if assise:
        rotation, locale = basculer_bassin(
            armature, assise[0], assise[1], repos_bassin, contexte
        )
        # `REPOS` veut dire « comme le modèle se tient » ; une fois le corps
        # couché, cela doit vouloir dire « couché comme lui ». Sans ce passage,
        # un os laissé au repos garderait sa direction debout et le torse
        # resterait vertical sur un corps à l'horizontale.
        repos = {o: (rotation @ d) for o, d in repos.items()}
        # Les orientations aussi, et c'est le point : `viser` s'en sert comme
        # repère de départ pour décider du roulis. Laissées debout, elles
        # faisaient poser un torse couché avec le roulis d'un torse vertical.
        orientations = {o: (locale @ m) for o, m in orientations.items()}

    # L'orientation du bassin telle que l'assise la veut, mise de côté. La mise
    # d'aplomb la corrige à chaque image ; sans ce point de départ à retrouver,
    # la correction **s'ajoute** à celle de l'image précédente et le corps part
    # en vrille sur la boucle — une planche qui dérivait de bout en bout et
    # sautait au retour, là où elle doit tenir la pose.
    assiette = armature.pose.bones[BASSIN].matrix.to_3x3().copy()

    # Le bassin est reposé **depuis sa position de repos** à chaque image, et
    # jamais décalé par rapport à l'image précédente : un décalage relatif
    # s'accumulerait, et le corps dériverait de vingt crans sur un tour.
    ancre = armature.pose.bones[BASSIN].matrix.translation.copy()
    # Un geste qui donne sa hauteur de bassin sans décalage en réclame quand
    # même le placement : sans ce zéro, la hauteur était calculée puis jamais
    # posée, et le corps restait à sa hauteur debout — mains à cinquante
    # centimètres du sol pour une planche.
    declare = geste.get("bassin")
    if declare is None and geste.get("hauteur") is not None:
        declare = (0, 0, 0)
    decalages = _decalages(declare, len(geste["cles"]), images)

    # Hauteur du bassin au-dessus du sol, en mètres. À donner pour les gestes
    # qui plantent des appuis — « le bassin d'une planche est à soixante
    # centimètres » se dit et se relit, contrairement à un décalage relatif.
    hauteur = geste.get("hauteur")
    if hauteur is not None:
        from mathutils import Vector

        monde = armature.matrix_world
        # La correction se calcule dans le **monde** puis se ramène dans
        # l'armature. Ajouter la hauteur à `ancre.z` revenait à la poser sur le
        # Z de l'armature, qui n'est pas celui du monde : Mixamo importe le
        # squelette tourné d'un quart de tour, et le corps partait de côté au
        # lieu de descendre.
        monte = Vector((0, 0, hauteur - (monde @ ancre).z))
        ancre = ancre + monde.inverted().to_3x3() @ monte

    for numero, (pose, decalage) in enumerate(
        zip(_parcours(geste["cles"], images, repos), decalages), start=1
    ):
        bassin = armature.pose.bones[BASSIN]
        if decalage is not None:
            _poser_bassin(armature, ancre, decalage, contexte)
            bassin.keyframe_insert("location", frame=numero)
        if geste.get("aplomb"):
            remise = assiette.to_4x4()
            remise.translation = bassin.matrix.translation
            bassin.matrix = remise
            contexte.view_layer.update()
        if assise:
            bassin.rotation_mode = "QUATERNION"
            bassin.keyframe_insert("rotation_quaternion", frame=numero)
        resolus = {}
        for os_nom in ORDRE:
            os_pose = armature.pose.bones[os_nom]
            voulu = resolus.pop(os_nom, None) or pose[os_nom]

            if voulu is SUIVRE:
                # Rotation locale nulle : l'os prolonge exactement son parent,
                # quoi que celui-ci ait fait. On la pose quand même en clé,
                # sans quoi un geste qui oriente la main sur une pose et la
                # laisse suivre sur l'autre garderait la première.
                os_pose.rotation_mode = "QUATERNION"
                os_pose.rotation_quaternion = (1, 0, 0, 0)
                os_pose.keyframe_insert("rotation_quaternion", frame=numero)
                continue

            if isinstance(voulu, Appui):
                # Résolu **ici** et pas plus tôt : la position de l'épaule
                # dépend de toute la chaîne posée avant elle.
                milieu = CHAINES[os_nom][0]
                voulu, suivant = atteindre(
                    armature.matrix_world @ os_pose.head,
                    voulu.cible,
                    voulu.pole,
                    longueurs[os_nom],
                )
                resolus[milieu] = suivant

            paume = None
            if isinstance(voulu, APlat):
                voulu, paume = voulu.direction, voulu.paume

            viser(
                armature, os_pose, voulu, orientations[os_nom], contexte,
                face=paume,
            )
            os_pose.rotation_mode = "QUATERNION"
            os_pose.keyframe_insert("rotation_quaternion", frame=numero)

        # **Après** avoir posé les membres, jamais avant : c'est la pose finie
        # qui dit où est le point le plus bas. Un corps ancré puis plié
        # repasserait sous le sol.
        #
        # Un geste qui plante ses appuis au sol donne sa hauteur de bassin à la
        # place : les deux ne peuvent pas décider en même temps, et c'est la
        # hauteur qui commande, sans quoi descendre le corps décollerait les
        # mains du point où on vient de les poser.
        ancrage = geste.get("ancrage", True)
        if hauteur is None and ancrage:
            if isinstance(ancrage, (list, tuple)):
                # `aplomb` ne se met que sur les gestes relevés en vidéo : eux
                # seuls tiennent leur pente d'une estimation, et non d'une
                # assise écrite à la main qu'on ne veut surtout pas voir
                # corrigée dans le dos de celui qui l'a écrite.
                if geste.get("aplomb"):
                    # Les mains posées se reposent après chaque rotation.
                    # Mettre d'aplomb tourne le corps **entier**, mains
                    # comprises, et une paume orientée avant cette rotation en
                    # ressort penchée de l'angle corrigé — cinq degrés ici,
                    # soit près d'un centimètre de jour sous le talon de la
                    # main. Or `APlat` dit une orientation dans le **monde**.
                    # Les remettre est sans effet de bord : la main ne porte
                    # aucun os posé.
                    a_plat = {
                        nom: valeur
                        for nom, valeur in pose.items()
                        if isinstance(valeur, APlat)
                    }

                    def reposer_les_mains():
                        for nom, valeur in a_plat.items():
                            viser(
                                armature, armature.pose.bones[nom],
                                valeur.direction, orientations[nom], contexte,
                                face=valeur.paume,
                            )

                    mettre_d_aplomb(
                        contexte, armature, ancrage, remettre=reposer_les_mains
                    )
                    for nom in a_plat:
                        armature.pose.bones[nom].keyframe_insert(
                            "rotation_quaternion", frame=numero
                        )
                    # Sans cette clé-là, la mise d'aplomb existait dans la pose
                    # vivante et disparaissait de l'animation : la rotation du
                    # bassin n'était mémorisée qu'en début de tour, avant
                    # qu'on la corrige. Le corps repartait donc à sa pente
                    # d'origine dès que le rendu relisait les clés.
                    bassin.rotation_mode = "QUATERNION"
                    bassin.keyframe_insert("rotation_quaternion", frame=numero)

                poser_sur(contexte, armature, ancrage)
            else:
                poser_au_sol(contexte, armature)
            bassin.keyframe_insert("location", frame=numero)

    return list(range(1, images + 1))
