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

#: Marque un os qu'on ne touche pas : il garde l'orientation du modèle importé.
REPOS = None


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
    "mixamorig:RightShoulder",
    "mixamorig:RightArm",
    "mixamorig:RightForeArm",
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
DEBOUT = {nom: REPOS for nom in ORDRE}

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
    "fente": {
        "vue": "profil",
        "duree": 2200,
        "bassin": [(0, 0, 0), (0, -0.10, 0)],
        "symetrique": False,
        "cles": [
            _pose(),
            # Une jambe part devant, l'autre reste derrière ; les deux genoux
            # plient, le buste ne s'incline pas. Le bassin descend, ce que seul
            # un décalage animé permet — rien ici ne tourne pour le faire.
            _pose({
                _os("LeftUpLeg"): (0.10, -0.62, -0.78),
                _os("LeftLeg"): (0.05, 0.10, -0.99),
                _os("RightUpLeg"): (-0.10, 0.15, -0.98),
                _os("RightLeg"): (-0.05, 0.95, -0.31),
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
        "ancrage": ("RightForeArm", "RightHand", "RightFoot", "LeftFoot"),
        "cles": [
            # Pas de cinématique inverse ici, et c'est délibéré : elle place le
            # **poignet** et laisse le coude où il veut. Or dans un gainage
            # latéral, c'est le coude qui porte. Deux directions le disent
            # mieux qu'un point — le bras descend à la verticale, l'avant-bras
            # se couche au sol vers la tête.
            _pose({
                _os("RightArm"): (0, 0.06, -1),
                _os("RightForeArm"): (0, 1, 0.02),
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
        # Bassin à trente-deux centimètres. Ce n'est pas la hauteur des
        # épaules : celles-ci sont plus haut, portées par le tronc incliné, à
        # une longueur de bras au-dessus des mains posées. Le corps redescend
        # ensuite jusqu'aux orteils.
        "hauteur": 0.32,
        "cles": [
            # Les mains ne bougent pas de tout l'exercice — elles sont posées.
            # C'est exactement ce qu'un appui exprime, et ce qu'on n'arrivait
            # pas à obtenir en cherchant les angles à la main.
            # Les x sont **négatifs à gauche** : à plat ventre, le demi-tour
            # met la gauche du personnage en -X. Écrits avec les signes du corps
            # debout, les appuis faisaient traverser chaque membre de l'autre
            # côté et les bras se croisaient.
            _pose(PLANCHE_DROITE, {
                _os("LeftArm"): Appui((-0.18, 0.47, 0.02), (0, 1, 0)),
                _os("RightArm"): Appui((0.18, 0.47, 0.02), (0, 1, 0)),
                # Jambe tendue en arrière, cheville juste au-dessus du sol.
                # La hanche est à 50 cm et la jambe en fait 90 : le pied ne peut
                # pas aller plus loin que √(0,90² − 0,42²) ≈ 0,80 m en arrière.
                # Viser au-delà laissait la jambe pendre en diagonale, et le
                # personnage paraissait accroupi.
                _os("RightUpLeg"): Appui((0.12, -0.80, 0.08), (0, -1, 0.3)),
                # Genou ramené sous la poitrine : la cheville se rapproche.
                _os("LeftUpLeg"): Appui((-0.14, -0.20, 0.15), (0, 1, 0)),
            }),
            # Les x sont **négatifs à gauche** : à plat ventre, le demi-tour
            # met la gauche du personnage en -X. Écrits avec les signes du corps
            # debout, les appuis faisaient traverser chaque membre de l'autre
            # côté et les bras se croisaient.
            _pose(PLANCHE_DROITE, {
                _os("LeftArm"): Appui((-0.18, 0.47, 0.02), (0, 1, 0)),
                _os("RightArm"): Appui((0.18, 0.47, 0.02), (0, 1, 0)),
                _os("LeftUpLeg"): Appui((0.12, -0.80, 0.08), (0, -1, 0.3)),
                _os("RightUpLeg"): Appui((-0.14, -0.20, 0.15), (0, 1, 0)),
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
            if isinstance(valeur, Appui):
                # Un appui n'est pas une direction : il se garde tel quel et se
                # résoudra une fois la chaîne parente posée, quand on saura où
                # se trouve l'épaule ou la hanche.
                sortie[nom] = valeur
            else:
                sortie[nom] = Vector(
                    repos[nom] if valeur is REPOS else valeur
                ).normalized()
        return sortie

    def entre(a, b, e):
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


def viser(armature, os_pose, direction, repos, contexte):
    """Oriente l'os vers `direction`, exprimée dans le monde.

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
    from mathutils import Vector
    cible = (armature.matrix_world.inverted().to_3x3() @ Vector(direction)).normalized()
    depuis = repos.col[1].normalized()
    oriente = (depuis.rotation_difference(cible).to_matrix() @ repos).to_4x4()
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


def poser_sur(contexte, armature, os_porteurs):
    """Descend le corps jusqu'à ce que les os nommés touchent le sol.

    Le point le plus bas du **maillage** ne convient pas toujours : le
    personnage porte une cape, et couché sur le côté c'est elle qui traîne au
    sol pendant que ses pieds flottent trente centimètres au-dessus. Nommer les
    os qui portent — l'avant-bras et les pieds d'un gainage latéral — remet la
    décision là où elle appartient, dans le geste.
    """
    contexte.view_layer.update()
    bas = None
    for nom in os_porteurs:
        pb = armature.pose.bones[f"mixamorig:{nom}"]
        for bout in (pb.head, pb.tail):
            z = (armature.matrix_world @ bout).z
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
        if assise:
            bassin.rotation_mode = "QUATERNION"
            bassin.keyframe_insert("rotation_quaternion", frame=numero)
        resolus = {}
        for os_nom in ORDRE:
            os_pose = armature.pose.bones[os_nom]
            voulu = resolus.pop(os_nom, None) or pose[os_nom]

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

            viser(armature, os_pose, voulu, orientations[os_nom], contexte)
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
                poser_sur(contexte, armature, ancrage)
            else:
                poser_au_sol(contexte, armature)
            bassin.keyframe_insert("location", frame=numero)

    return list(range(1, images + 1))
