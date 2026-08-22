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

#: Les quatre doigts longs. Le pouce se referme autrement et se traite à part.
DOIGTS = ("Index", "Middle", "Ring", "Pinky")

#: De combien chaque phalange se replie, en degrés, pour un poing fermé sur une
#: poignée. Trois valeurs : la phalange proximale, l'intermédiaire, la distale.
#:
#: Le repli se fait autour du **X local** de chaque phalange, dans le sens
#: positif. Ce n'est pas une supposition : on l'a mesuré en projetant le bout
#: du doigt sur la normale de la paume, qui passe de +0,3 à +5,7 cm — donc vers
#: la paume. Le sens opposé l'en éloigne d'autant.
#:
#: C'est la seule rotation **locale** du moteur, et c'est justifié : un poing
#: est un poing quelle que soit l'orientation de la main, alors que tout le
#: reste se dit en directions du monde parce que la question y est toujours
#: « où pointe ce membre ».
FERMETURE = (68.0, 88.0, 72.0)

#: Le pouce ne s'enroule pas comme les autres doigts : il **traverse** la prise.
#:
#: D'où le signe négatif sur sa première phalange, qui le rabat en travers de la
#: paume, suivi de deux positives qui en recourbent le bout par-dessus les
#: doigts déjà fermés. Un pouce replié dans le même sens qu'eux part vers
#: l'extérieur — c'est le geste de l'auto-stoppeur, et c'est ce que la première
#: version donnait : quatre doigts en poing et un pouce tendu dans le vide, ce
#: qui de loin ressemblait à une serre plutôt qu'à une prise.
#:
#: Mesuré, comme le reste : le bout du pouce passe de 11,0 cm de la base de
#: l'index, main ouverte, à 4,2 cm — soit posé dessus. Replié dans le sens des
#: autres doigts, il s'en éloignait jusqu'à 13 cm.
FERMETURE_POUCE = (-55.0, 45.0, 40.0)


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
#: Hauteur de bassin d'une planche bras tendus, en mètres.
#:
#: Elle n'est pas choisie mais **déduite**, et c'est la seule façon de la tenir
#: juste. Le bras est vertical dans une planche — mesuré à 93° du sol sur la
#: vidéo de grimpeur croisé, sur cent deux images, à quatre degrés près. Le
#: poignet est donc à l'aplomb de l'épaule, et l'épaule à une longueur de bras
#: au-dessus de lui : 0,562 m sur ce squelette. Le poignet posé se vise à six
#: centimètres — la paume est plus bas que lui —, l'épaule est donc à 0,622 m
#: et le bassin, douze degrés plus bas le long du tronc, à 0,532.
#:
#: Cinquante centimètres étaient déclarés, et le compte ne tombait pas : pour
#: descendre le poignet au sol depuis une épaule trop basse, le bras devait
#: s'incliner de trente-huit degrés, le tronc plonger vers la tête, et le
#: personnage se retrouvait accroupi sur ses mains — un ours, pas une planche.
HAUTEUR_PLANCHE = 0.532

PLANCHE_DROITE = {
    # Le tronc monte du bassin vers les épaules, mais de **douze degrés**, pas
    # de vingt-six. C'est une mesure et non une estimation : sur la vidéo, le
    # segment bassin→épaule fait 168° avec la ligne du sol — celle qui joint le
    # poignet posé à l'orteil posé —, donc douze degrés au-dessus d'elle.
    #
    # Vingt-six degrés, c'était le double, et l'erreur se propageait à tout le
    # reste. Un tronc redressé de vingt-six degrés avec un bras perpendiculaire
    # — les 87° mesurés à l'épaule — donne des bras penchés en avant, ce qui
    # n'est plus une planche : dans une planche les mains sont **sous** les
    # épaules.
    _os("Spine"): (0, 0.978, 0.208),
    _os("Spine1"): (0, 0.978, 0.208),
    _os("Spine2"): (0, 0.978, 0.208),
    # La nuque prolonge la ligne du dos et la tête regarde devant les mains,
    # légèrement plongeante. Elle pointait vingt-deux degrés vers le ciel, ce
    # qui allait avec un dos à vingt-six ; avec un dos à douze, elle regardait
    # le plafond.
    _os("Neck"): (0, 0.97, 0.24),
    _os("Head"): (0, 0.99, 0.10),
}


# Mains tenues **devant**, à hauteur de hanche, paumes vers le sol.
#
# C'est la cible que la démonstratrice se donne dans la vidéo de montées de
# genoux : les mains ne bougent pas, et c'est le genou qui vient les toucher.
# Sans elles, le geste ne dit plus jusqu'où monter — or c'est justement toute
# la consigne, le genou à hauteur de hanche.
#
# Le coude descend un peu en avant (l'épaule est à 1,42 m, le coude tombe à
# 1,15 m) et l'avant-bras part vers l'avant en plongeant à peine : la paume
# arrive à 1,08 m, trente centimètres devant. Le genou monté culmine à 1,09 m
# et 41 cm devant — il passe donc sous la main, ce qui est le geste.
MAINS_DEVANT = {
    _os("LeftArm"): (+0.14, -0.20, -0.97),
    _os("RightArm"): (-0.14, -0.20, -0.97),
    _os("LeftForeArm"): (+0.02, -0.96, -0.28),
    _os("RightForeArm"): (-0.02, -0.96, -0.28),
    # Paume vers le sol : une main tenue en cible se présente à plat, pas sur
    # le chant. `APlat` est le seul moyen de le dire — une direction seule
    # laisse la main tourner autour de son propre axe.
    _os("LeftHand"): APlat((0, -1, 0), paume=(0, 0, -1)),
    _os("RightHand"): APlat((0, -1, 0), paume=(0, 0, -1)),
}


# Bras qui **pendent**, coude à peine fléchi, poignets dans le prolongement.
#
# À ne pas confondre avec `REPOS`, qui veut dire « comme le modèle se tient » —
# et ce modèle-ci se tient en croix. Cinq poses de la fente le demandaient et
# récoltaient donc cinq fois un personnage bras écartés, ce qu'aucun exercice
# debout ne veut.
BRAS_LE_LONG = {
    _os("LeftArm"): (+0.13, +0.02, -0.99),
    _os("RightArm"): (-0.13, +0.02, -0.99),
    _os("LeftForeArm"): (+0.10, -0.16, -0.98),
    _os("RightForeArm"): (-0.10, -0.16, -0.98),
    _os("LeftHand"): SUIVRE,
    _os("RightHand"): SUIVRE,
}


# Jambe gauche repliée en arrière, talon haut : la position d'appui unipodal.
#
# Le tibia part vers l'arrière **et légèrement vers le haut**, ce qui met la
# cheville à cinquante-neuf centimètres du sol. C'est beaucoup, et c'est voulu :
# une jambe à peine décollée ne se distingue pas d'une fente, de profil.
JAMBE_REPLIEE = {
    _os("LeftUpLeg"): (+0.02, +0.14, -0.99),
    _os("LeftLeg"): (+0.02, +0.98, +0.20),
    # Le pied pend, orteils vers le bas et l'arrière : c'est ce que fait un
    # pied qu'aucun appui ne tient.
    _os("LeftFoot"): (+0.00, +0.55, -0.84),
}


# Jambes d'un corps allongé sur un banc, pieds posés au sol de part et d'autre.
#
# Le calcul se lit : bassin à 54 cm, cuisse et tibia de 42 cm, cheville à 9 cm
# du sol. La cuisse part vers les pieds presque à l'horizontale — le genou
# reste à 44 cm — et le tibia **redescend vers l'arrière** chercher un pied
# posé sous le genou. C'est ce dernier point qui compte : un tibia qui
# continuerait vers l'avant plierait le genou à l'envers, ce que
# `verifier-gestes.py` a refusé au premier essai. Sur un banc, le pied est sous
# le genou et non devant lui.
#
# Les deux jambes ne sont **pas** symétriques. À x = ±0,08 elles se
# superposaient derrière le banc, vu de profil, et l'on ne comprenait plus si
# le personnage était assis dessus ou couché derrière. La droite passe donc
# nettement **devant** — c'est elle qu'on voit — et la gauche reste derrière :
# le corps enjambe le banc, ce qui est la position de l'exercice et ce qui
# donne au banc sa profondeur.
#: Les jambes d'un développé couché : genoux pliés de part et d'autre du banc,
#: **pieds à plat au sol**.
#:
#: Elles s'écrivaient en directions, et les pieds pendaient alors dans le vide,
#: à quarante centimètres du plancher, orteils pointés — une position qu'aucun
#: corps ne tient et que personne ne prend sur un banc. Ce n'est pourtant pas
#: une direction qu'on connaît ici mais un **point** : le pied est posé. C'est
#: exactement ce qu'un appui exprime, et il tombe juste du premier coup là où
#: trois angles cherchés à la main ne tombaient pas.
#:
#: La cheville se vise à 8,7 cm, la hauteur qu'elle a debout, et le pied garde
#: l'orientation qu'il a debout lui aussi : semelle à plat, orteils au sol.
#:
#: Les deux pieds passent **à côté** du banc et non dessous, le droit du côté
#: de la caméra. De profil, une jambe qui disparaît derrière le meuble ne
#: démontre rien.
#: Assis en arrière, genoux fléchis, talons décollés : le socle du russian
#: twist, commun à ses trois poses. Seuls les bras et le haut du buste changent
#: d'une clé à l'autre, et les répéter trois fois invitait à les corriger deux
#: fois sur trois.
#:
#: Le tronc bascule de cinquante degrés, la cuisse ne monte que de vingt-deux,
#: le tibia redescend de vingt-cinq. Le compte tombe alors juste : bassin à
#: 14 cm, genou à 30, cheville à 12 — talon décollé de quelques centimètres,
#: ce que montre la vidéo.
ASSIS_EN_ARRIERE = {
    # Tronc à soixante-cinq degrés du tapis : elle est **assise**, penchée en
    # arrière d'un petit quart de tour. Le tronc ne bouge plus ensuite — seule
    # la rotation travaille.
    _os("Spine"): (+0.00, +0.423, +0.906),
    _os("Spine1"): (+0.00, +0.423, +0.906),
    _os("Spine2"): (+0.00, +0.423, +0.906),
    # La tête regarde ses mains, donc vers l'avant et le bas.
    _os("Neck"): (+0.00, +0.15, +0.99),
    _os("Head"): (+0.00, -0.55, +0.84),
    # Genoux **hauts** et talons décollés : la cuisse monte de soixante-trois
    # degrés au-dessus de l'horizontale, le tibia redescend de quarante-six,
    # genou fléchi à cent neuf degrés. La cheville se retrouve **au-dessus** du
    # bassin, d'un quart de longueur de tronc.
    #
    # Ces trois nombres sont les moyennes des **vecteurs** unitaires du relevé,
    # sur trente-huit images, avec une dispersion de 1,0°, 2,2° et 3,6°. C'est
    # la mesure la plus sûre de tout ce geste, et elle a été écartée deux fois
    # au profit d'une impression : le premier jet la respectait, on a trouvé
    # que ça faisait « une boule » et l'on a descendu la cuisse à quarante
    # degrés, puis à trente-cinq. Le personnage s'est alors allongé au lieu de
    # rester assis, et c'est exactement ce qu'on cherchait à corriger ailleurs.
    #
    # La leçon vaut d'être écrite : une moyenne de vecteurs unitaires à trois
    # degrés de dispersion ne se corrige pas à l'œil sur un mannequin nu. La
    # première version des angles moyennait des `arctan2(dy, |dx|)`, ce qui
    # explose quand dx passe près de zéro — c'est **cette** mesure-là qui était
    # fausse, pas celle-ci.
    _os("LeftUpLeg"): (+0.06, -0.451, +0.890),
    _os("RightUpLeg"): (-0.06, -0.451, +0.890),
    # Le tibia redescend de trente-deux degrés et non de quarante-six : le
    # relevé place la cheville un quart de longueur de tronc **au-dessus** du
    # bassin, et à quarante-six degrés la semelle ne décollait que de dix
    # centimètres — assez pour que l'audit soit content, pas assez pour qu'on
    # voie que les pieds ne touchent pas. Ils sont maintenant à vingt.
    _os("LeftLeg"): (+0.04, -0.845, -0.535),
    _os("RightLeg"): (-0.04, -0.845, -0.535),
    _os("LeftFoot"): (+0.00, -0.93, -0.37),
    _os("RightFoot"): (+0.00, -0.93, -0.37),
}


SUR_LE_BANC = {
    _os("LeftUpLeg"): Appui((+0.24, -0.34, 0.087), (0, -0.55, +0.84)),
    _os("RightUpLeg"): Appui((-0.26, -0.34, 0.087), (0, -0.55, +0.84)),
    _os("LeftFoot"): (0, -0.78, -0.63),
    _os("RightFoot"): (0, -0.78, -0.63),
}


def bras_de_course(devant, amplitude=1.0):
    """Bras de coureur : coude à angle droit, l'un devant, l'autre derrière.

    `devant` dit quel côté balance vers l'avant — `"G"` ou `"D"`. En course,
    le bras répond à la jambe **opposée** : quand le talon gauche remonte, la
    jambe gauche est en arrière et c'est donc le bras gauche qui part devant.

    Le coude reste à quatre-vingt-dix degrés des deux côtés, et seul le sens du
    balancement change — c'est ce qui distingue une course d'un moulinet. La
    main avant monte à hauteur de poitrine, la main arrière descend à la
    hanche ; les poignets prolongent l'avant-bras, comme un poing fermé.

    `amplitude` mélange vers `BRAS_LE_LONG` : 1 pour une course sur place, un
    tiers pour le contre-balancement discret d'une fente, où les bras
    accompagnent le pas sans le mimer.
    """
    avance = {"G": +1, "D": -1}[devant]
    couche = {}
    for cote, signe in (("Left", +1), ("Right", -1)):
        # +1 pour le bras qui part devant, -1 pour celui qui part derrière.
        sens = +1 if (signe == avance) else -1
        courant = {
            _os(f"{cote}Arm"): (signe * 0.12, -sens * 0.42, -0.90),
            _os(f"{cote}ForeArm"): (signe * 0.10, -0.87, sens * 0.48),
        }
        for nom, vise in courant.items():
            calme = BRAS_LE_LONG[nom]
            couche[nom] = tuple(
                c + (v - c) * amplitude for c, v in zip(calme, vise)
            )
        couche[_os(f"{cote}Hand")] = SUIVRE
    return couche


# La planche **basse** tenue : coudes sous les épaules, avant-bras à plat vers
# l'avant, poings joints devant la tête, orteils recourbés. C'est la position
# de gainage dont partent les variantes, et elle vaut d'être écrite une fois
# plutôt que recopiée dans chaque clé.
PLANCHE_BASSE_APPUI = {
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
}


def JAMBE_LEVEE(cote):
    """La jambe qu'on décolle en gainage, tendue et pointe allongée.

    Les directions se lisent dans le repère du monde, corps à plat ventre : la
    jambe part vers les pieds (-Y) en **montant** (+Z). Vingt-cinq degrés au-
    dessus de la ligne du corps, ce qui met le talon à hauteur de nuque — la
    hauteur que montre la photo de référence, et celle que les descriptions
    demandent : « à l'horizontale ou un peu au-dessus, sans creuser le dos ».

    La pointe est **tendue**. Le pied du gainage est recourbé sous la cheville
    parce qu'il pousse sur le sol ; celui qui est en l'air ne pousse sur rien,
    et le garder recourbé donnait une jambe levée qui cherchait encore un
    appui.
    """
    signe = +1 if cote == "Left" else -1
    return {
        _os(f"{cote}UpLeg"): (signe * 0.03, -0.90, +0.44),
        _os(f"{cote}Leg"): (signe * 0.02, -0.92, +0.39),
        _os(f"{cote}Foot"): (+0.00, -0.72, +0.69),
    }


def grimpeur(genou, croise=False):
    """Une pose de mountain climber : quel genou est ramené, ou aucun.

    `genou` vaut `"G"`, `"D"`, ou `None` pour la planche pleine — les deux
    jambes tendues. C'est cette troisième pose qui manquait : sans elle, le
    geste interpolait directement d'un genou à l'autre et le corps ciseillait
    sans jamais repasser par la planche. Or c'est précisément ce que la vidéo
    montre, et ce qu'un pratiquant doit voir : on **revient** en planche entre
    deux montées.

    Les pôles se lisent dans le repère du corps : à plat ventre, son avant est
    le **sol**. Le genou mène donc vers le bas et le coude part vers le haut.
    Écrits avec l'avant d'un corps debout, ils pliaient les genoux à l'envers.

    Les x sont **négatifs à gauche** : à plat ventre, le demi-tour met la
    gauche du personnage en -X. La version précédente attachait le x au rôle —
    la jambe tendue toujours en +0,12, quelle qu'elle soit — et les jambes se
    croisaient donc à chaque alternance. De profil cela ne se voyait pas ; ce
    n'est pas une raison pour l'écrire.
    """
    couche = {
        # Six centimètres, et non deux : un appui vise le **poignet**, et la
        # paume est cinq centimètres plus bas. Viser le sol avec le poignet
        # enfonce donc la main d'autant.
        #
        # Les mains ne bougent pas de tout l'exercice — elles sont posées.
        # C'est exactement ce qu'un appui exprime, et ce qu'on n'arrivait pas
        # à obtenir en cherchant les angles à la main.
        _os("LeftArm"): Appui((-0.18, 0.42, 0.06), (0, 0.30, 0.95)),
        _os("RightArm"): Appui((0.18, 0.42, 0.06), (0, 0.30, 0.95)),
        # Les mains **posées**, paume au sol, doigts vers la tête. Un appui ne
        # place que le poignet : laissée libre, la main gardait le roulis d'un
        # corps debout et ses doigts traversaient le plancher de sept
        # centimètres et demi. C'est un majeur qui a trahi la faute, une fois
        # le sol dessiné.
        _os("LeftHand"): APlat((0, 1, 0)),
        _os("RightHand"): APlat((0, 1, 0)),
        # Les pieds **posés**, orteils recourbés sous la cheville. Sans eux,
        # laissés au repos, ils gardaient l'orientation d'un corps debout —
        # donc pointés vers le bas une fois le corps à plat ventre — et
        # traversaient le plancher de douze centimètres. Un appui vise la
        # cheville, pas l'orteil : c'est pourquoi les cibles ci-dessous sont à
        # vingt et un centimètres, soit la longueur du pied plus l'épaisseur
        # des orteils. Les régler à l'œil sur la position du sol y enfonçait
        # le pied.
        _os("LeftFoot"): (0, 0, -1),
        _os("RightFoot"): (0, 0, -1),
    }
    for cote, lettre, signe in (("Left", "G", -1), ("Right", "D", +1)):
        if lettre == genou:
            # Genou ramené sous la poitrine : la cheville se rapproche.
            #
            # Croisé, il traverse l'axe du corps pour aller chercher le coude
            # opposé — d'où le signe inversé. C'est ce qui distingue les deux
            # exercices du catalogue, et de trois-quarts ça se voit.
            # Croisé, la cheville passe de l'autre côté de l'axe — mais de peu.
            # Ce n'est pas un autre exercice, c'est le même avec quelques
            # degrés de plus : quatorze centimètres du côté du genou pour le
            # droit, dix de l'autre côté pour le croisé.
            #
            # Le **pôle** compte autant que la cible, et c'est ce qui manquait
            # à la première version. Un appui ne place que la cheville ; c'est
            # le pôle qui décide de quel côté le genou ressort. Laissé dans
            # l'axe, on obtenait un pied passé de l'autre côté et un genou resté
            # du sien — un tibia tordu, pas un mouvement croisé.
            x = (-signe * 0.10) if croise else (signe * 0.14)
            pole = (-signe * 0.45, 0.30, -0.84) if croise else (0, 0.35, -0.94)
            couche[_os(f"{cote}UpLeg")] = Appui((x, -0.22, 0.20), pole)
        else:
            # Jambe tendue en arrière, cheville juste au-dessus du sol. La
            # hanche est à 53 cm et la jambe en fait 96 : la cheville, posée à
            # vingt centimètres, se place donc à √(0,96² − 0,33²) ≈ 0,90 m en
            # arrière. On vise deux centimètres en deçà, ce qui laisse au genou
            # le soupçon de flexion qu'une planche a vraiment — tendre à fond
            # une chaîne à deux os la fait claquer d'une image à l'autre dès
            # que la cible bouge d'un millimètre.
            #
            # Quatre-vingts centimètres étaient visés pour une hanche déclarée
            # à cinquante, ce qui repliait le genou à cent vingt-sept degrés :
            # la jambe « tendue » de la planche était en fait à demi pliée, et
            # le personnage accroupi.
            couche[_os(f"{cote}UpLeg")] = Appui(
                (signe * 0.12, -0.88, 0.20), (0, -0.20, -0.98)
            )
    return couche


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
    # `BRAS_LE_LONG` et non `_pose()` nu, et c'est **le** piège du moteur :
    # `REPOS` ne veut pas dire « au repos » mais « comme le modèle se tient »,
    # et ce mannequin-ci se tient **en croix**. Une élévation latérale partant
    # de là commençait bras déjà à l'horizontale et n'avait donc plus rien à
    # élever — deux poses identiques, un personnage immobile en T pendant deux
    # secondes. La faute était invisible tant que le rendu se faisait sur
    # l'ancien personnage, qui, lui, se tenait bras le long du corps.
    "elevations-laterales": {
        "vue": "face",
        "duree": 2000,
        "cles": [
            _pose(BRAS_LE_LONG),
            _pose(BRAS_LE_LONG, {
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
        # Bras le long du corps au départ : voir l'élévation latérale, `REPOS`
        # laisse ce mannequin en croix.
        "cles": [
            _pose(BRAS_LE_LONG),
            _pose(BRAS_LE_LONG, {
                _os("LeftArm"): (0.14, -1, 0.04),
                _os("LeftForeArm"): (0.16, -1, -0.06),
                _os("RightArm"): (-0.14, -1, 0.04),
                _os("RightForeArm"): (-0.16, -1, -0.06),
            }),
        ],
    },
    # Développé militaire, **haltères** et non barre : le personnage n'en tient
    # aucun, mais ses mains doivent dire lequel des deux il ferait.
    #
    # Poings fermés, paumes tournées vers l'avant, poignets dans le
    # prolongement de l'avant-bras — c'est la prise d'un haltère tenu à
    # l'épaule puis poussé au plafond. Laissées ouvertes et libres, les mains
    # partaient doigts écartés vers l'extérieur, ce qui ne ressemble à aucune
    # prise et faisait douter de ce que le geste montrait.
    "developpe-militaire": {
        "vue": "face",
        "duree": 2200,
        "poings": 1.0,
        "cles": [
            # Départ coudes à hauteur d'épaules, avant-bras verticaux.
            _pose({
                _os("LeftArm"): (0.80, -0.18, -0.30),
                _os("LeftForeArm"): (0.34, -0.10, 1),
                _os("RightArm"): (-0.80, -0.18, -0.30),
                _os("RightForeArm"): (-0.34, -0.10, 1),
                # Paume vers l'avant : c'est ce qui met les phalanges face à
                # la caméra et le pouce à l'intérieur, comme sur une poignée
                # d'haltère tenue à l'épaule.
                _os("LeftHand"): APlat((0.34, -0.10, 1), paume=(0, -1, 0)),
                _os("RightHand"): APlat((-0.34, -0.10, 1), paume=(0, -1, 0)),
            }),
            _pose({
                _os("LeftArm"): (0.32, -0.06, 1),
                _os("LeftForeArm"): (0.12, 0, 1),
                _os("RightArm"): (-0.32, -0.06, 1),
                _os("RightForeArm"): (-0.12, 0, 1),
                _os("LeftHand"): APlat((0.12, 0, 1), paume=(0, -1, 0)),
                _os("RightHand"): APlat((-0.12, 0, 1), paume=(0, -1, 0)),
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
    # Développé couché, sur un **banc**.
    #
    # Sans lui, le geste était faux d'une façon qui ne se voyait qu'en
    # mouvement : à chaque descente le coude passait sous le dos, devenait le
    # point le plus bas du maillage, et le moteur remontait le corps entier
    # pour l'y poser. Le personnage montait et descendait au rythme de ses
    # bras, comme sur un trampoline.
    #
    # D'où `ancrage: False` — le corps ne se pose sur rien, il **repose** — et
    # une hauteur de bassin déclarée. Le banc est à quarante-cinq centimètres,
    # le bassin à cinquante-quatre : l'épaisseur du corps. Les jambes sont
    # refaites pour que les pieds touchent le sol de part et d'autre, ce qui
    # est la position de l'exercice et ce qui donne l'échelle du banc.
    "developpe-couche": {
        "vue": "profil",
        "duree": 2200,
        "assise": SUR_LE_DOS,
        "ancrage": False,
        "hauteur": 0.54,
        "banc": 0.45,
        # Poings fermés : on tient une barre ou deux haltères, jamais les
        # doigts ouverts.
        "poings": 1.0,
        # Les jambes ne sont **pas** symétriques, et c'est voulu : voir
        # `SUR_LE_BANC`.
        "symetrique": False,
        "cles": [
            # Couché sur le dos : le haut du corps suit le bassin sans qu'on ait
            # à le dire, les membres se décrivent dans le monde. +Z est donc le
            # plafond, -Y les pieds.
            _pose(SUR_LE_BANC, {
                _os("LeftArm"): (0.85, -0.30, -0.35),
                _os("LeftForeArm"): (0.30, -0.10, 0.95),
                _os("RightArm"): (-0.85, -0.30, -0.35),
                _os("RightForeArm"): (-0.30, -0.10, 0.95),
            }),
            _pose(SUR_LE_BANC, {
                _os("LeftArm"): (0.28, -0.10, 0.95),
                _os("LeftForeArm"): (0.12, 0, 1),
                _os("RightArm"): (-0.28, -0.10, 0.95),
                _os("RightForeArm"): (-0.12, 0, 1),
            }),
        ],
    },
    # Fente avant, relevée sur une vidéo de démonstration. Trois temps :
    # debout pieds joints, le pas en avant, le point bas genou près du sol.
    # Remplace une version écrite à la main, jamais rendue faute d'y arriver.
    #
    # Les bras ne viennent pas du relevé : la démonstratrice tient ses poings
    # en garde, ce qui est son style et non l'exercice — et la même planche
    # sert aussi les fentes haltères, bras le long du corps.
    #
    # Ils étaient donc laissés à `REPOS`, ce qui semblait dire « au repos » et
    # veut dire « comme le modèle se tient » : en croix. Cinq clés, cinq fois
    # un personnage bras écartés au milieu d'une fente. Ils pendent désormais
    # le long du corps, avec le contre-balancement discret que le pas appelle —
    # la jambe **gauche** part devant, c'est donc le bras **droit** qui
    # avance —, et à un tiers de l'amplitude d'une course : une fente
    # s'accompagne, elle ne se mime pas.
    "fente": {
        "vue": "profil",
        "duree": 3087,  # mesuré : 71 images à 23 i/s, sur 44 répétitions
        # Assise « debout », penchée des -0° mesurés sur la vidéo.
        "assise": ((+0.00, +0.01, +1.00), (+0.00, -1.00, +0.01)),
        "symetrique": False,
        # Les deux pieds portent. Au point bas, le genou arrière frôle le
        # sol sans le toucher : c'est le refus de rentrer dans le sol qui
        # l'en empêche, et non un appui déclaré.
        "ancrage": ("LeftFoot", "RightFoot"),
        "aplomb": True,
        # Le pied **arrière** reste planté et le corps passe au-dessus : c'est
        # ce qui fait un pas. Sans lui, les deux pieds s'écartaient autour d'un
        # bassin immobile — un grand écart, pas une fente.
        "plante": "RightFoot",
        # Trois clés et deux temps d'arrêt, là où il y en avait cinq dont
        # quatre doublées pour faire des pauses. Le doublage figeait
        # quatorze images sur trente-deux et tassait tout le pas dans les
        # sept restantes : le personnage restait planté, se jetait en
        # avant, puis se figeait à nouveau. Déclarer les arrêts laisse la
        # répartition au prorata du chemin faire son travail.
        #
        # Les arrêts sont ensuite descendus de 0,10/0,12 à 0,06/0,08, et c'est
        # encore une histoire de saccade. Vingt-deux pour cent du tour immobile
        # laissait trente-sept images sur quarante-huit pour tout le pas :
        # mesuré sur la planche livrée, sept images strictement identiques au
        # point bas, puis des bonds de 7,3 par image là où un squat — que
        # personne ne trouve saccadé — plafonne à 5,0. Le contraste entre
        # l'arrêt mort et la rafale est exactement ce qui se lit comme un
        # hachage.
        "pauses": [0.06, 0.00, 0.08],
        "cles": [
            _pose(BRAS_LE_LONG, {
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.22, +0.98),
                _os("Head"): (+0.00, -0.22, +0.98),
                _os("LeftUpLeg"): (+0.00, -0.02, -1.00),
                _os("RightUpLeg"): (+0.00, -0.02, -1.00),
                _os("LeftLeg"): (+0.00, -0.02, -1.00),
                _os("RightLeg"): (+0.00, -0.02, -1.00),
                _os("LeftFoot"): (+0.00, -0.90, -0.43),
                _os("RightFoot"): (+0.00, -0.90, -0.43),
            }),
            _pose(bras_de_course("D", 0.20), {
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.21, +0.98),
                _os("Head"): (+0.00, -0.21, +0.98),
                _os("LeftUpLeg"): (+0.00, -0.51, -0.86),
                _os("RightUpLeg"): (+0.00, +0.15, -0.99),
                _os("LeftLeg"): (+0.00, -0.43, -0.90),
                _os("RightLeg"): (+0.00, +0.62, -0.78),
                _os("LeftFoot"): (+0.00, -1.00, -0.05),
                _os("RightFoot"): (+0.00, -0.59, -0.81),
            }),
            _pose(bras_de_course("D", 0.35), {
                _os("Spine"): (+0.00, +0.01, +1.00),
                _os("Spine1"): (+0.00, +0.01, +1.00),
                _os("Spine2"): (+0.00, +0.01, +1.00),
                _os("Neck"): (+0.00, -0.08, +1.00),
                _os("Head"): (+0.00, -0.08, +1.00),
                _os("LeftUpLeg"): (+0.00, -0.99, -0.13),
                _os("RightUpLeg"): (+0.00, +0.25, -0.97),
                _os("LeftLeg"): (+0.00, +0.25, -0.97),
                _os("RightLeg"): (+0.00, +0.96, +0.29),
                # Les deux pieds sont corrigés à la main, et c'est assumé :
                # au point bas d'une fente, le pied arrière est **occulté** par
                # le corps et l'estimateur le renvoie orteils vers l'arrière,
                # donc pointant dans le vide. Ce que la posture impose se dit
                # en une phrase : le pied avant est **à plat**, orteils dans le
                # sens de la marche ; le pied arrière est **sur la pointe**,
                # orteils sous la cheville.
                _os("LeftFoot"): (+0.00, -1.00, +0.00),
                _os("RightFoot"): (+0.00, +0.00, -1.00),
            }),
        ],
    },
    # Montées de genoux, relevées sur le plan **de face** d'une vidéo qui en
    # contient trois exercices. Une seule image sert de base — le sommet de la
    # montée du genou gauche, image 340 — et la seconde clé en est le miroir
    # exact : c'est ce que le geste est, la même chose d'un côté puis de
    # l'autre. Relever deux sommets réels aurait figé une dissymétrie que le
    # mouvement n'a pas.
    #
    # Le genou monte à 105 cm pour une hanche à 103 : à hauteur, ce que toutes
    # les descriptions demandent. Filmée de face, la profondeur porte
    # l'avant-arrière et se trompe — d'où `--dans-le-plan`, et des bras
    # descendus le long du corps plutôt que tordus comme le relevé les voyait.
    "montee-genoux": {
        # De trois-quarts, et non de profil : le geste est une **alternance**
        # gauche-droite, et de profil les deux jambes se superposent — six
        # images de suite s'y ressemblaient au point que le personnage
        # semblait immobile.
        "vue": "trois-quarts",
        "duree": 751,  # mesuré : 18 images à 24 i/s
        # Assise « debout » canonique : voir --sans-pente.
        "assise": ((+0.00, +0.00, +1.00), (+0.00, -1.00, +0.00)),
        "symetrique": False,
        # Hauteur de bassin **déclarée**, et pas d'ancrage — c'est ce qui a
        # corrigé le hachage.
        #
        # Ancré, le moteur posait à chaque image le plus bas des deux pieds.
        # Aux poses clés c'est juste : un pied porte, l'autre est en l'air. Mais
        # à mi-alternance les deux jambes sont à demi levées, **aucune** ne
        # porte, et le corps plongeait de quatorze centimètres pour aller
        # chercher le sol — mesuré : le bassin tombait de 104 à 90 cm sur cinq
        # images, puis remontait. Un plongeon de squat au milieu d'une foulée.
        #
        # Cent quatre centimètres et demi : la hauteur à laquelle l'ancrage
        # posait lui-même le corps aux poses clés. Le pied porteur touche donc
        # toujours, et l'entre-deux est une phase de vol — ce qu'une montée de
        # genoux comporte vraiment.
        "ancrage": False,
        "hauteur": 1.045,
        # Le rebond de la foulée. Sans lui, le bassin tenu à hauteur fixe
        # donnait un coureur en apesanteur : les jambes pédalaient et le corps
        # glissait sans jamais monter ni retomber.
        #
        # Douze centimètres, quand le relevé en donne vingt et un de creux à
        # crête. On prend un peu plus de la moitié : la démonstratrice de la
        # vidéo monte les genoux très haut, et reproduire son amplitude ferait
        # bondir le mannequin comme s'il sautait à cloche-pied.
        "rebond": 0.12,
        "cles": [
            _pose(MAINS_DEVANT, {
                _os("Spine"): (+0.00, -0.00, +1.00),
                _os("Spine1"): (+0.00, -0.00, +1.00),
                _os("Spine2"): (+0.00, -0.00, +1.00),
                _os("Neck"): (+0.00, -0.28, +0.96),
                _os("Head"): (+0.00, -0.28, +0.96),
                _os("LeftUpLeg"): (+0.00, -0.98, +0.21),
                _os("RightUpLeg"): (+0.00, +0.00, -1.00),
                _os("LeftLeg"): (+0.00, +0.36, -0.93),
                _os("RightLeg"): (+0.00, +0.33, -0.94),
                _os("LeftFoot"): (+0.00, -0.40, -0.92),
                _os("RightFoot"): (+0.00, -0.66, -0.75),
            }),
            _pose(MAINS_DEVANT, {
                _os("Spine"): (+0.00, -0.00, +1.00),
                _os("Spine1"): (+0.00, -0.00, +1.00),
                _os("Spine2"): (+0.00, -0.00, +1.00),
                _os("Neck"): (+0.00, -0.28, +0.96),
                _os("Head"): (+0.00, -0.28, +0.96),
                _os("RightUpLeg"): (+0.00, -0.98, +0.21),
                _os("LeftUpLeg"): (+0.00, +0.00, -1.00),
                _os("RightLeg"): (+0.00, +0.36, -0.93),
                _os("LeftLeg"): (+0.00, +0.33, -0.94),
                _os("RightFoot"): (+0.00, -0.40, -0.92),
                _os("LeftFoot"): (+0.00, -0.66, -0.75),
            }),
        ],
    },

    # Superman au sol, relevé sur une vidéo de démonstration. Deux temps :
    # le corps à plat, puis bras et jambes décollés ensemble.
    #
    # L'exercice tient en une phrase — « lever les bras et les jambes en
    # gardant le ventre au sol » — et c'est exactement ce que l'ancrage par
    # défaut donne : le point le plus bas du maillage est le bassin, il reste
    # posé, et tout le reste monte autour de lui. Rien à déclarer.
    #
    # Trois exercices s'en servent : le superman, le nageur et les Y-T-W. Les
    # deux derniers ne diffèrent que par le tracé des bras, que la vignette ne
    # peut de toute façon pas distinguer de profil.
    "superman": {
        "vue": "profil",
        # Trois mille cent trente millisecondes : mesuré de crête à crête sur
        # le relevé, trois fois de suite au même compte — images 285, 357 et
        # 429, soit soixante-douze images à 23 i/s. C'est un exercice lent, et
        # c'est le sujet : on monte, on tient, on redescend sans lâcher.
        "duree": 3130,
        # Assise « ventre » canonique : voir --sans-pente.
        "assise": ((+0.00, +1.00, +0.00), (+0.00, +0.00, -1.00)),
        # Le creux est plus long que la crête, et le relevé le dit : la levée
        # normalisée reste à 0,30 pendant vingt-quatre images et à 0,90
        # pendant seize. Un tiers du tour en bas, un cinquième en haut.
        "pauses": [0.18, 0.12],
        "cles": [
            # À plat. Les bras reposent tendus devant, les jambes derrière.
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.00),
                _os("Spine1"): (+0.00, +1.00, +0.00),
                _os("Spine2"): (+0.00, +1.00, +0.00),
                # La tête reste **dans l'axe du corps**. Elle plongeait de
                # onze degrés, ce qui suffisait à en faire le point le plus bas
                # du maillage : l'ancrage posait alors le front au sol et
                # soulevait tout le reste. Mesuré, le bassin montait à 21 cm à
                # plat contre 15 en position haute — il se relevait au moment
                # même où il aurait dû être collé au tapis.
                # Le menton se relève d'à peine huit degrés : à l'horizontale
                # pile, c'est lui qui touchait le premier et le bassin restait
                # trois centimètres au-dessus de sa hauteur haute. Front au
                # tapis, regard juste devant — la position d'un superman avant
                # qu'il monte.
                _os("Neck"): (+0.00, +0.997, +0.070),
                _os("Head"): (+0.00, +0.990, +0.140),
                # Bras **presque horizontaux**, et c'est toute la correction de
                # cette pose.
                #
                # Le relevé les donnait à vingt-cinq degrés sous l'horizontale.
                # L'épaule d'un corps à plat ventre étant à dix-huit
                # centimètres, une pente pareille envoie la main trente et un
                # centimètres plus bas — sous le plancher. L'ancrage, qui pose
                # le point le plus bas du maillage à zéro, soulevait alors le
                # corps entier de la différence : la « position à plat »
                # flottait, ventre décollé, et c'est ce qui se voyait.
                #
                # Onze degrés suffisent à amener la main au sol depuis
                # l'épaule, et le point le plus bas redevient le ventre.
                # Tout est **exactement horizontal**, et c'est la seule façon
                # d'obtenir un corps réellement à plat.
                #
                # Chaque segment qu'on incline vers le bas devient le point le
                # plus bas du maillage, et l'ancrage — qui pose ce point-là à
                # zéro — soulève alors tout le reste. On l'a payé trois fois de
                # suite : d'abord la tête plongeante, puis les orteils pointés à
                # y = -1,13, puis le pouce sous le poignet. À chaque correction
                # le bassin descendait d'un centimètre et un autre bout du corps
                # prenait le relais.
                #
                # À plat, le corps repose sur son épaisseur — ventre, poitrine,
                # cuisses — exactement comme un corps posé au sol, et le bassin
                # retrouve la hauteur qu'il a en position haute.
                _os("LeftArm"): (+0.00, +1.00, +0.00),
                _os("RightArm"): (+0.00, +1.00, +0.00),
                _os("LeftForeArm"): (+0.00, +1.00, +0.00),
                _os("RightForeArm"): (+0.00, +1.00, +0.00),
                # La main prolonge l'avant-bras. Le relevé la renvoyait
                # relevée de quinze degrés vers le plafond pendant que
                # l'avant-bras plongeait : l'estimateur n'a pas de poignet
                # orienté, et un bras tendu au sol n'a pas de raison de casser
                # au poignet.
                _os("LeftHand"): APlat((+0.00, +1.00, +0.00), paume=(0, 0, -1)),
                _os("RightHand"): APlat((+0.00, +1.00, +0.00), paume=(0, 0, -1)),
                _os("LeftUpLeg"): (+0.00, -1.00, +0.00),
                _os("RightUpLeg"): (+0.00, -1.00, +0.00),
                _os("LeftLeg"): (+0.00, -1.00, +0.00),
                _os("RightLeg"): (+0.00, -1.00, +0.00),
                # Pieds posés, cou-de-pied au sol : le pied prolonge la jambe
                # en plongeant à peine. Le relevé le donnait à soixante degrés
                # sous l'horizontale, ce qui plantait les orteils dans le
                # plancher — l'estimateur voit mal un pied de profil au sol.
                # Le **cou-de-pied** repose, orteils à peine plus bas que la
                # cheville. C'est ce qui décidait de tout : pointés de dix-huit
                # degrés, les orteils devenaient le point le plus bas du
                # maillage — mesuré à y = -1,12, tout au bout du corps — et
                # l'ancrage soulevait le reste pour les poser. Le bassin montait
                # ainsi à 21 cm à plat contre 15 en position haute.
                #
                # Aplatis, c'est le ventre qui touche, dans les deux poses, et
                # le bassin garde la même hauteur d'un bout à l'autre.
                _os("LeftFoot"): (+0.00, -1.00, +0.00),
                _os("RightFoot"): (+0.00, -1.00, +0.00),
            }),
            # Décollé. Bras et jambes montent ensemble, poitrine dégagée.
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.00),
                _os("Spine1"): (+0.00, +1.00, +0.00),
                _os("Spine2"): (+0.00, +1.00, +0.00),
                _os("Neck"): (+0.00, +0.87, +0.50),
                _os("Head"): (+0.00, +0.87, +0.50),
                _os("LeftArm"): (+0.00, +0.85, +0.53),
                _os("RightArm"): (+0.00, +0.85, +0.53),
                _os("LeftForeArm"): (+0.00, +0.95, +0.30),
                _os("RightForeArm"): (+0.00, +0.95, +0.30),
                _os("LeftHand"): APlat((+0.00, +0.95, +0.31), paume=(0, 0, -1)),
                _os("RightHand"): APlat((+0.00, +0.95, +0.31), paume=(0, 0, -1)),
                _os("LeftUpLeg"): (+0.00, -0.97, +0.26),
                _os("RightUpLeg"): (+0.00, -0.97, +0.26),
                _os("LeftLeg"): (+0.00, -0.97, +0.26),
                _os("RightLeg"): (+0.00, -0.97, +0.26),
                _os("LeftFoot"): (+0.00, -0.93, +0.37),
                _os("RightFoot"): (+0.00, -0.93, +0.37),
            }),
        ],
    },

    # Relevés en V, relevés sur une vidéo de démonstration. Deux temps : le
    # corps à plat bras au-dessus de la tête, puis le pli en V, mains aux
    # chevilles.
    #
    # C'est le premier geste du catalogue dont le tronc **change
    # d'inclinaison** en cours de route, et il a longtemps été noté comme
    # impossible. Il ne l'était pas : les os se visent dans le monde, donc
    # `Spine` peut pointer où l'on veut quelle que soit l'assise. Ce qui était
    # vrai, c'est que `geste-depuis-video.py` écrit toujours `Spine` sur l'axe
    # « haut » de l'assise — il exprime la pose dans le repère du **tronc**, et
    # l'inclinaison de celui-ci se perd donc en route. Le relevé sort alors des
    # jambes « au-delà de la verticale », qui sont en fait des jambes à
    # cinquante-trois degrés vues d'un tronc à soixante-huit.
    #
    # Les deux angles sont mesurés sur le relevé et non estimés : sur quatre
    # répétitions successives, le tronc fait 68,8° / 67,7° / 66,9° / 65,9° avec
    # l'horizontale et les jambes 52,9° / 52,3° / 51,1° / 54,6°.
    "releve-en-v": {
        "vue": "profil",
        # Trois mille deux cent vingt millisecondes : crête à crête sur le
        # relevé, 60, 78 et 84 images à 23 i/s. La démonstratrice souffle entre
        # deux répétitions.
        "duree": 3220,
        "assise": SUR_LE_DOS,
        # Le corps à plat dure, le V ne dure pas : le relevé reste à 0,01 de
        # pli pendant quarante-deux images et ne passe au-dessus de 0,60 que
        # sur six. On ne reprend pas les 57 % du tour passés à plat — c'est le
        # repos de la démonstratrice, pas l'exercice — mais on garde l'ordre
        # des grandeurs.
        "pauses": [0.25, 0.03],
        "cles": [
            # À plat, bras allongés au-dessus de la tête.
            _pose({
                _os("Spine"): (+0.00, +1.00, +0.00),
                _os("Spine1"): (+0.00, +1.00, +0.00),
                _os("Spine2"): (+0.00, +1.00, +0.00),
                _os("Neck"): (+0.00, +0.99, +0.12),
                _os("Head"): (+0.00, +0.99, +0.12),
                _os("LeftArm"): (+0.00, +1.00, +0.03),
                _os("RightArm"): (+0.00, +1.00, +0.03),
                _os("LeftForeArm"): (+0.00, +0.99, +0.10),
                _os("RightForeArm"): (+0.00, +0.99, +0.10),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.00, -1.00, +0.01),
                _os("RightUpLeg"): (+0.00, -1.00, +0.01),
                _os("LeftLeg"): (+0.00, -1.00, +0.01),
                _os("RightLeg"): (+0.00, -1.00, +0.01),
                # Couché sur le dos, le pied retombe pointe vers le plafond.
                _os("LeftFoot"): (+0.00, -0.30, +0.95),
                _os("RightFoot"): (+0.00, -0.30, +0.95),
            }),
            # Le V. Tronc à 68° de l'horizontale, jambes à 53°, et les bras
            # vont chercher les chevilles.
            _pose({
                _os("Spine"): (+0.00, +0.37, +0.93),
                _os("Spine1"): (+0.00, +0.37, +0.93),
                _os("Spine2"): (+0.00, +0.37, +0.93),
                # La nuque bascule vers les genoux : on regarde ses pieds, on
                # ne cherche pas le plafond.
                _os("Neck"): (+0.00, +0.45, +0.89),
                _os("Head"): (+0.00, +0.60, +0.80),
                _os("LeftArm"): (+0.00, -0.90, +0.44),
                _os("RightArm"): (+0.00, -0.90, +0.44),
                _os("LeftForeArm"): (+0.00, -0.90, +0.44),
                _os("RightForeArm"): (+0.00, -0.90, +0.44),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.00, -0.60, +0.80),
                _os("RightUpLeg"): (+0.00, -0.60, +0.80),
                _os("LeftLeg"): (+0.00, -0.60, +0.80),
                _os("RightLeg"): (+0.00, -0.60, +0.80),
                _os("LeftFoot"): (+0.00, -0.55, +0.84),
                _os("RightFoot"): (+0.00, -0.55, +0.84),
            }),
        ],
    },

    # Russian twist, relevé sur trois vidéos de démonstration.
    #
    # ## Ce que le mouvement est, et ce qu'il n'est pas
    #
    # Assis, buste en arrière, genoux pliés, talons décollés, mains jointes
    # devant la poitrine. Ce qui travaille, c'est la **rotation** : les épaules
    # tournent autour de l'axe du tronc, l'une part en avant pendant que
    # l'autre recule, et les mains suivent jusqu'à venir près du tapis à côté
    # de la hanche.
    #
    # Ce n'est **pas** une inclinaison latérale, et huit versions se sont
    # perdues à confondre les deux. Coucher le buste sur le côté descend bien
    # la main au sol — c'est même la seule façon d'y poser le coude —, mais
    # cela laisse les deux épaules à la même profondeur : le geste se lit alors
    # comme un corps qui bascule de droite à gauche, et le bras de l'épaule
    # opposée n'a plus d'autre chemin vers les mains que le travers de la
    # poitrine.
    #
    # D'où le partage retenu ici, et il se paie : **35° d'inclinaison, 70° de
    # rotation**. Le coude ne touche donc plus le tapis — il s'arrête à une
    # quinzaine de centimètres — parce que l'y amener demandait de coucher le
    # tronc à 57°, et qu'à ce compte-là il n'y avait plus de rotation à voir.
    # Les trois vidéos, du reste, ne posent jamais le coude : ce sont les mains
    # jointes qui descendent frôler le tapis.
    #
    # ## Les nombres
    #
    # Relevé sur trente-huit images, en moyennant les **vecteurs** unitaires et
    # jamais les angles, qui explosent quand un segment passe près de la
    # verticale de l'image :
    #
    #     bassin → épaule    (-0,436 ; +0,900)   64° au-dessus de l'horizontale
    #     bassin → genou     (+0,452 ; +0,892)   63°
    #     genou  → cheville  (+0,690 ; -0,724)  -46°
    #
    # Le reste se construit : bassin à 0,19 m, tronc de 0,432 m, épaules à 0,14
    # de part et d'autre le long de l'axe scapulaire tourné de 70°. Le point
    # visé par les mains est alors à 0,52 m des deux épaules — pour une allonge
    # de 0,562, donc un coude encore plié — et à 38 cm en avant du plan de la
    # poitrine pour l'une comme pour l'autre.
    "russian-twist": {
        # De profil, comme les trois vidéos filment l'exercice. Le trois-quarts
        # avait été pris par réflexe — « le buste plie, donc trois-quarts » —,
        # et il tombait mal : la rotation amène le personnage face à la caméra
        # à un bout de course et de dos à l'autre, si bien que le corps se
        # raccourcit au moment précis où l'on veut lire la torsion. De côté,
        # elle se lit comme dans la vidéo, par le dos qui se présente.
        "vue": "profil",
        "duree": 1750,
        "assise": ((+0.00, +0.423, +0.906), (+0.00, -0.906, +0.423)),
        "ancrage": False,
        "hauteur": 0.19,
        "symetrique": False,
        "poings": 1.0,
        # Un temps au bout de chaque côté — c'est là qu'on marque —, rien au
        # centre, qu'on traverse.
        "pauses": [0.16, 0.00, 0.16],
        "cles": [
            # Bout de course **à gauche**. Debout comme assis, la gauche du
            # personnage est en +X.
            _pose(ASSIS_EN_ARRIERE, {
                # Le tronc s'incline de 35° vers la gauche en gardant sa
                # bascule arrière relevée : u = (0,574 ; 0,347 ; 0,742).
                #
                # Le roulis dit la **rotation**, et il monte par étages : le
                # bassin ne tourne pas, la colonne lombaire de moitié, le
                # thorax des 70° entiers. C'est ce dégradé qui fait une torsion
                # plutôt qu'un bloc qui pivote.
                _os("Spine"): APlat((+0.574, +0.347, +0.742),
                                    paume=(+0.470, -0.881, +0.048)),
                _os("Spine1"): APlat((+0.574, +0.347, +0.742),
                                     paume=(+0.769, -0.538, -0.344)),
                _os("Spine2"): APlat((+0.574, +0.347, +0.742),
                                     paume=(+0.769, -0.538, -0.344)),
                # La tête suit le thorax et regarde les mains, sans plus. Les
                # versions précédentes la jetaient sur le côté à chaque bout de
                # course, et c'est ce ballant-là qu'on voyait en premier.
                _os("Neck"): (+0.35, +0.20, +0.92),
                _os("Head"): (+0.30, -0.25, +0.92),
                # L'axe des épaules, tourné de 70° : l'épaule gauche part en
                # arrière, la droite vient en avant. Sans ces deux lignes, les
                # épaules gardent la profondeur que leur donne la seule
                # inclinaison, et il n'y a pas de rotation du tout.
                _os("LeftShoulder"): (+0.280, +0.768, -0.575),
                _os("RightShoulder"): (-0.280, -0.768, +0.575),
                # Mains jointes à côté de la hanche gauche, à une douzaine de
                # centimètres du tapis. Elles ne se superposent pas : deux
                # centimètres et demi les séparent le long de l'axe des
                # épaules, comme deux poings serrés l'un contre l'autre.
                _os("LeftArm"): Appui((+0.337, -0.171, +0.116),
                                      (+0.280, +0.768, -0.575)),
                _os("RightArm"): Appui((+0.323, -0.209, +0.144),
                                       (-0.280, -0.768, +0.575)),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                # Les jambes **contrebalancent** : quand les bras descendent à
                # gauche, les genoux partent à droite.
                #
                # Ce n'est pas une licence, c'est ce que fait le corps et le
                # relevé le mesure sans ambiguïté : sur 243 images, la position
                # latérale des genoux est corrélée à **-0,86** avec la torsion
                # des épaules, et à -0,93 avec celle des mains sur la portion la
                # mieux détectée. Elles vont dans le sens opposé, toujours.
                #
                # Trente centimètres de décalage latéral sur la cuisse, soit un
                # genou qui se déplace de quinze centimètres de chaque côté.
                _os("LeftUpLeg"): (-0.233, -0.622, +0.747),
                _os("RightUpLeg"): (-0.339, -0.602, +0.723),
                _os("LeftLeg"): (-0.252, -0.774, -0.581),
                _os("RightLeg"): (-0.322, -0.757, -0.568),
                _os("LeftFoot"): (-0.287, -0.939, -0.192),
                _os("RightFoot"): (-0.287, -0.939, -0.192),
            }),
            # De face, mains jointes devant le sternum. Aucune torsion : c'est
            # le point de passage, pas une pose tenue.
            _pose(ASSIS_EN_ARRIERE, {
                _os("Spine"): APlat((+0.00, +0.423, +0.906),
                                    paume=(+0.00, -0.906, +0.423)),
                _os("Spine1"): APlat((+0.00, +0.423, +0.906),
                                     paume=(+0.00, -0.906, +0.423)),
                _os("Spine2"): APlat((+0.00, +0.423, +0.906),
                                     paume=(+0.00, -0.906, +0.423)),
                _os("Neck"): (+0.00, +0.25, +0.97),
                _os("Head"): (+0.00, -0.18, +0.98),
                _os("LeftShoulder"): (+1.00, +0.00, +0.00),
                _os("RightShoulder"): (-1.00, +0.00, +0.00),
                # Les mains remontent devant la poitrine, coudes pliés et
                # rentrés — c'est la position de départ des trois vidéos, et
                # non la main basse sur le ventre qu'avaient les versions
                # précédentes.
                #
                # Le creux entre le buste et les cuisses décide de la hauteur :
                # les genoux passent à 0,53 m, les mains à 0,50 et seize
                # centimètres derrière eux. Elles longent la cuisse, elles ne
                # la traversent pas.
                _os("LeftArm"): Appui((+0.025, -0.140, +0.500),
                                      (+0.72, +0.20, -0.66)),
                _os("RightArm"): Appui((-0.025, -0.140, +0.500),
                                       (-0.72, +0.20, -0.66)),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                # Genou plié à 87°, cheville en avant du genou, talon décollé
                # d'une dizaine de centimètres : les pieds ne touchent jamais,
                # et de assez loin pour que ça se voie.
                _os("LeftUpLeg"): (+0.06, -0.639, +0.767),
                _os("RightUpLeg"): (-0.06, -0.639, +0.767),
                _os("LeftLeg"): (+0.04, -0.799, -0.599),
                _os("RightLeg"): (-0.04, -0.799, -0.599),
                _os("LeftFoot"): (+0.00, -0.98, -0.20),
                _os("RightFoot"): (+0.00, -0.98, -0.20),
            }),
            # Bout de course **à droite**, miroir exact.
            _pose(ASSIS_EN_ARRIERE, {
                _os("Spine"): APlat((-0.574, +0.347, +0.742),
                                    paume=(-0.470, -0.881, +0.048)),
                _os("Spine1"): APlat((-0.574, +0.347, +0.742),
                                     paume=(-0.769, -0.538, -0.344)),
                _os("Spine2"): APlat((-0.574, +0.347, +0.742),
                                     paume=(-0.769, -0.538, -0.344)),
                _os("Neck"): (-0.35, +0.20, +0.92),
                _os("Head"): (-0.30, -0.25, +0.92),
                _os("LeftShoulder"): (+0.280, -0.768, +0.575),
                _os("RightShoulder"): (-0.280, +0.768, -0.575),
                _os("LeftArm"): Appui((-0.323, -0.209, +0.144),
                                      (+0.280, -0.768, +0.575)),
                _os("RightArm"): Appui((-0.337, -0.171, +0.116),
                                       (-0.280, +0.768, -0.575)),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.339, -0.602, +0.723),
                _os("RightUpLeg"): (+0.233, -0.622, +0.747),
                _os("LeftLeg"): (+0.322, -0.757, -0.568),
                _os("RightLeg"): (+0.252, -0.774, -0.581),
                _os("LeftFoot"): (+0.287, -0.939, -0.192),
                _os("RightFoot"): (+0.287, -0.939, -0.192),
            }),
        ],
    },

    # Rowing inversé. Corps gainé sous une barre, talons au sol, on tire la
    # poitrine vers la barre.
    #
    # C'est le seul des cinq gestes de ce lot dont la vidéo n'a **rien** donné,
    # et il faut le dire : elle montre deux personnes — l'athlète sous la barre
    # et un coach agenouillé au premier plan — et l'estimateur a suivi le
    # coach. Bassin relevé au quart gauche de l'image sur toute la séquence,
    # et plus une seule image exploitable passé la quatre-centième. La posture
    # ci-dessous vient donc de la **géométrie**, pas d'un relevé : elle est
    # entièrement déterminée par trois faits — les talons au sol, les mains
    # sur la barre, le corps droit.
    #
    # Le compte tombe alors tout seul. Bras tendus, l'épaule est à une longueur
    # de bras sous la barre, soit 0,95 - 0,562 = 0,39 m ; le tronc mesure
    # 0,432 m, donc le bassin est à 0,31 m et le corps monte de onze degrés.
    # Poitrine à la barre, l'épaule arrive à 0,75 m, le bassin à 0,55, et
    # l'inclinaison passe à vingt-huit degrés. Les vingt-quatre centimètres
    # entre les deux sont ce que `bassin` déclare.
    # De **trois-quarts** et non de profil : de profil, les deux bras se
    # superposent exactement et le pliage du coude — qui est tout le geste —
    # disparaît derrière le corps.
    "rowing-inverse": {
        "vue": "trois-quarts",
        "duree": 2400,
        "assise": SUR_LE_DOS,
        # La barre : (y, z) dans le monde. La même paire sert aux appuis des
        # mains et au décor, ce qui rend impossible qu'ils se contredisent.
        "barre": (0.39, 0.83),
        # Poings fermés : on **tient** la barre. Main ouverte, les doigts la
        # traversaient et le personnage paraissait la pousser plutôt que s'y
        # suspendre — la même faute que la corde à sauter, et le même remède.
        "poings": 1.0,
        # Le corps ne touche le sol que par les talons, et sa hauteur est
        # imposée par la barre : c'est un cas d'école pour `hauteur` et
        # `bassin`, comme le développé couché.
        "ancrage": False,
        "hauteur": 0.263,
        "bassin": [(0, 0, 0.0), (0, 0, 0.24)],
        # On tire vite et l'on redescend en retenant ; faute de pouvoir dire
        # une descente plus lente que la montée, on marque le haut.
        "pauses": [0.08, 0.14],
        "cles": [
            # Bras tendus, corps à onze degrés.
            _pose({
                _os("Spine"): (+0.00, +0.982, +0.191),
                _os("Spine1"): (+0.00, +0.982, +0.191),
                _os("Spine2"): (+0.00, +0.982, +0.191),
                _os("Neck"): (+0.00, +0.982, +0.191),
                _os("Head"): (+0.00, +0.982, +0.191),
                # Les mains **tiennent** la barre : on connaît le point, pas
                # l'angle. C'est ce qu'un appui exprime, et c'est ce qui
                # garantit qu'elles n'en décollent pas d'une image à l'autre.
                _os("LeftArm"): Appui((+0.15, 0.39, 0.83), (0, -0.95, -0.30)),
                _os("RightArm"): Appui((-0.15, 0.39, 0.83), (0, -0.95, -0.30)),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.03, -0.974, -0.225),
                _os("RightUpLeg"): (-0.03, -0.974, -0.225),
                _os("LeftLeg"): (+0.02, -0.974, -0.225),
                _os("RightLeg"): (-0.02, -0.974, -0.225),
                # Talon posé, pointe vers le haut : c'est le talon qui porte
                # dans un rowing inversé, jamais l'avant-pied.
                _os("LeftFoot"): (+0.00, -0.45, +0.89),
                _os("RightFoot"): (+0.00, -0.45, +0.89),
            }),
            # Poitrine à la barre, corps à vingt-huit degrés.
            _pose({
                _os("Spine"): (+0.00, +0.883, +0.469),
                _os("Spine1"): (+0.00, +0.883, +0.469),
                _os("Spine2"): (+0.00, +0.883, +0.469),
                _os("Neck"): (+0.00, +0.883, +0.469),
                _os("Head"): (+0.00, +0.930, +0.367),
                _os("LeftArm"): Appui((+0.15, 0.39, 0.83), (0, -0.95, -0.30)),
                _os("RightArm"): Appui((-0.15, 0.39, 0.83), (0, -0.95, -0.30)),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.03, -0.879, -0.476),
                _os("RightUpLeg"): (-0.03, -0.879, -0.476),
                _os("LeftLeg"): (+0.02, -0.879, -0.476),
                _os("RightLeg"): (-0.02, -0.879, -0.476),
                _os("LeftFoot"): (+0.00, -0.45, +0.89),
                _os("RightFoot"): (+0.00, -0.45, +0.89),
            }),
        ],
    },

    # Talons-fesses, relevés sur le plan **de profil** de la même vidéo. C'est
    # ce qui explique que la cuisse y reste verticale de bout en bout : en
    # talon-fesse, seul le genou plie. Le tibia part droit vers l'arrière, à
    # l'horizontale, talon à hauteur de genou.
    #
    # Image 894, le pli le plus franc de la vidéo — genou à 70° d'un côté,
    # 171° de l'autre — et son miroir pour l'autre jambe.
    "talons-fesses": {
        # De trois-quarts, et non de profil : le geste est une **alternance**
        # gauche-droite, et de profil les deux jambes se superposent — six
        # images de suite s'y ressemblaient au point que le personnage
        # semblait immobile.
        "vue": "trois-quarts",
        "duree": 792,  # mesuré : 19 images à 24 i/s
        # Assise « debout » canonique : voir --sans-pente.
        "assise": ((+0.00, +0.00, +1.00), (+0.00, -1.00, +0.00)),
        "symetrique": False,
        # Hauteur de bassin **déclarée**, comme pour les montées de genoux et
        # pour la même raison. Ancré, le moteur posait le plus bas des deux
        # pieds : juste aux poses clés, désastreux entre les deux, où les deux
        # talons sont à mi-hauteur et où **aucun** pied ne porte. Mesuré, le
        # bassin tombait de 105 à 77 cm sur cinq images — vingt-huit
        # centimètres, un plongeon au milieu d'une foulée.
        "ancrage": False,
        "hauteur": 1.054,
        # Le rebond de la foulée, comme pour les montées de genoux et pour la
        # même raison — les deux gestes viennent d'ailleurs de la même vidéo.
        # Un peu moins : on ramène le talon sous la fesse sans lancer le genou
        # devant, et la poussée au sol est plus courte.
        "rebond": 0.09,
        # Poings fermés : on court les mains fermées, pas les doigts
        # écartés. Le mannequin les a ouverts au repos.
        "poings": 0.75,
        "cles": [
            # Talon **gauche** qui remonte : la jambe gauche est donc en
            # arrière, et c'est le bras gauche qui part devant.
            _pose(bras_de_course("G"), {
                _os("Spine"): (+0.00, +0.00, +1.00),
                _os("Spine1"): (+0.00, +0.00, +1.00),
                _os("Spine2"): (+0.00, +0.00, +1.00),
                _os("Neck"): (+0.00, -0.31, +0.95),
                _os("Head"): (+0.00, -0.31, +0.95),
                _os("LeftUpLeg"): (+0.00, -0.32, -0.95),
                _os("RightUpLeg"): (+0.00, +0.15, -0.99),
                _os("LeftLeg"): (+0.00, +0.53, +0.85),
                _os("RightLeg"): (+0.00, +0.27, -0.96),
                _os("LeftFoot"): (+0.00, +0.92, +0.39),
                _os("RightFoot"): (+0.00, -0.63, -0.78),
            }),
            _pose(bras_de_course("D"), {
                _os("Spine"): (+0.00, +0.00, +1.00),
                _os("Spine1"): (+0.00, +0.00, +1.00),
                _os("Spine2"): (+0.00, +0.00, +1.00),
                _os("Neck"): (+0.00, -0.31, +0.95),
                _os("Head"): (+0.00, -0.31, +0.95),
                _os("RightUpLeg"): (+0.00, -0.32, -0.95),
                _os("LeftUpLeg"): (+0.00, +0.15, -0.99),
                _os("RightLeg"): (+0.00, +0.53, +0.85),
                _os("LeftLeg"): (+0.00, +0.27, -0.96),
                _os("RightFoot"): (+0.00, +0.92, +0.39),
                _os("LeftFoot"): (+0.00, -0.63, -0.78),
            }),
        ],
    },

    # Corde à sauter, relevée sur la fin de la même vidéo. La démonstratrice
    # y **mime** le mouvement sans corde, ce qui tombe bien : le personnage
    # n'en tient pas non plus, et l'obstacle qu'on croyait rédhibitoire —
    # l'agrès non modélisé — n'en était pas un.
    #
    # Deux temps du rebond, images 1288 et 1294 : genou de 146° à 156°,
    # bassin quatorze centimètres plus haut, avant-bras qui tournent. De
    # **face**, parce que c'est là que la position des avant-bras se lit —
    # de profil ils se cachent l'un l'autre.
    #
    # Les mains **tiennent** la corde, même absente : coudes serrés contre les
    # côtes et à peine en arrière, avant-bras qui partent vers l'avant et vers
    # l'extérieur, poings à trente-huit centimètres de l'axe et à hauteur de
    # hanche — la place exacte d'une poignée. Et le poignet **prolonge**
    # l'avant-bras : le relevé le cassait de dix degrés, ce qui donnait une
    # main ouverte, alors qu'un poing fermé sur une poignée fait une ligne
    # droite du coude aux doigts. C'est le seul signe qui distingue ce geste
    # d'un simple rebond sur place.
    "corde-a-sauter": {
        "vue": "face",
        "duree": 417,  # mesuré : 10 images à 24 i/s
        # Assise « debout » canonique : voir --sans-pente.
        "assise": ((+0.00, +0.00, +1.00), (+0.00, -1.00, +0.00)),
        # `ancrage: False` et un décalage de bassin, comme pour un saut :
        # c'est le seul moyen de montrer le rebond. Reposer les pieds au
        # sol à chaque image l'écrasait entièrement — quatre images de
        # suite identiques, et un personnage qui se contentait de tenir
        # les bras écartés.
        "ancrage": False,
        "bassin": [(0, 0, -0.03), (0, 0, 0.09)],
        # Poings **fermés** sur les poignées. La pose de repos du mannequin a
        # les mains ouvertes, doigts écartés, ce qui est le bon défaut partout
        # ailleurs — le personnage ne tient pas l'haltère non plus. Ici c'est
        # l'inverse : la corde ne se démontre que par les mains, et une main
        # grande ouverte dit exactement le contraire du geste.
        "poings": 1.0,
        "cles": [
            _pose({
                _os("Spine"): (+0.00, -0.00, +1.00),
                _os("Spine1"): (+0.00, -0.00, +1.00),
                _os("Spine2"): (+0.00, -0.00, +1.00),
                _os("Neck"): (+0.00, -0.34, +0.94),
                _os("Head"): (+0.00, -0.34, +0.94),
                _os("LeftArm"): (+0.16, +0.12, -0.98),
                _os("RightArm"): (-0.16, +0.12, -0.98),
                _os("LeftForeArm"): (+0.62, -0.72, -0.31),
                _os("RightForeArm"): (-0.62, -0.72, -0.31),
                # La main prolonge l'avant-bras — un poing sur une poignée fait
                # une ligne droite du coude aux doigts — mais son **roulis**
                # compte autant que sa direction.
                #
                # Paumes tournées l'une vers l'autre et **légèrement vers le
                # haut** : c'est ce qui met le pouce au-dessus du poing et
                # l'axe de la poignée vers le ciel, comme sur toutes les photos
                # du geste. Le corps de la corde sort alors du haut du poing et
                # descend derrière — la seule position d'où le mouvement se
                # comprend.
                #
                # Mesuré plutôt que choisi : avec cette paume-là, le bout du
                # pouce est trois centimètres **au-dessus** du poignet et l'axe
                # autour duquel les doigts s'enroulent est vertical à 95 %.
                # Paume vers le bas — ce qu'on avait —, le pouce passait six
                # centimètres dessous et la poignée se couchait à
                # l'horizontale : un poing serré sur rien.
                _os("LeftHand"): APlat((+0.62, -0.72, -0.31), paume=(-1, 0, +0.30)),
                _os("RightHand"): APlat((-0.62, -0.72, -0.31), paume=(+1, 0, +0.30)),
                # Les cuisses descendent **droit**, à peine rentrées.
                #
                # Debout, le +X est la gauche du personnage : une cuisse gauche
                # écrite à -0,14 partait donc vers sa droite, la droite vers sa
                # gauche, et les deux jambes se croisaient. Les chevilles
                # finissaient à un centimètre et demi de l'axe, soit trois
                # centimètres l'une de l'autre pour des pieds larges de dix : de
                # face, une seule jambe. On saute à pieds joints, pas à pieds
                # superposés — sept centimètres de part et d'autre, et les
                # semelles se touchent presque sans se recouvrir.
                _os("LeftUpLeg"): (-0.04, +0.00, -0.999),
                _os("RightUpLeg"): (+0.04, +0.00, -0.999),
                _os("LeftLeg"): (-0.01, +0.46, -0.888),
                _os("RightLeg"): (+0.01, +0.46, -0.888),
                _os("LeftFoot"): (+0.05, -0.70, -0.71),
                _os("RightFoot"): (-0.05, -0.70, -0.71),
            }),
            _pose({
                _os("Spine"): (+0.00, +0.00, +1.00),
                _os("Spine1"): (+0.00, +0.00, +1.00),
                _os("Spine2"): (+0.00, +0.00, +1.00),
                _os("Neck"): (+0.00, -0.45, +0.89),
                _os("Head"): (+0.00, -0.45, +0.89),
                _os("LeftArm"): (+0.17, +0.15, -0.97),
                _os("RightArm"): (-0.17, +0.15, -0.97),
                _os("LeftForeArm"): (+0.66, -0.70, -0.27),
                _os("RightForeArm"): (-0.66, -0.70, -0.27),
                _os("LeftHand"): APlat((+0.66, -0.70, -0.27), paume=(-1, 0, +0.30)),
                _os("RightHand"): APlat((-0.66, -0.70, -0.27), paume=(+1, 0, +0.30)),
                _os("LeftUpLeg"): (-0.04, +0.08, -0.996),
                _os("RightUpLeg"): (+0.04, +0.08, -0.996),
                _os("LeftLeg"): (-0.01, +0.42, -0.907),
                _os("RightLeg"): (+0.01, +0.42, -0.907),
                _os("LeftFoot"): (+0.04, -0.68, -0.73),
                _os("RightFoot"): (-0.04, -0.68, -0.73),
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
            _pose(BRAS_LE_LONG),
            _pose(BRAS_LE_LONG, {
                _os("LeftFoot"): (0.05, -0.55, -0.83),
                _os("RightFoot"): (-0.05, -0.55, -0.83),
            }),
        ],
    },
    # Squat sauté.
    #
    # Deux reproches, deux corrections.
    #
    # Le squat était **mal exécuté** : écrit à la main, genou à 83°, il ne
    # ressemblait pas à celui de la planche `squat`, qui vient d'une captation
    # et que personne ne conteste. Les angles ci-dessous sont donc **lus sur
    # elle**, à son image la plus basse — bassin descendu de 117 à 51 cm, soit
    # 67 centimètres, cuisse qui part vers l'avant en remontant, tibia qui
    # replonge vers l'arrière, buste penché de 28° à la hanche. Mesurer ce qui
    # marche plutôt que retoucher ce qui ne marche pas.
    #
    # Et il **faisait deux squats** par tour. C'est le parcours en aller-retour
    # qui le voulait : partant de debout, la position accroupie était traversée
    # deux fois, à la descente et à la réception. Un squat sauté enchaîné ne
    # repasse pas par la station debout — on retombe dans le squat et on
    # repart. La station debout disparaît donc des clés, et le tour se lit :
    # accroupi, extension, envol, retour.
    "squat-saute": {
        "vue": "profil",
        # Mille huit cents millisecondes : à mille quatre cents le saut passait
        # trop vite pour se lire. Un squat sauté enchaîné tourne autour de deux
        # secondes par répétition, dont l'essentiel au sol — on descend, on
        # arme, on pousse, et le vol lui-même est bref.
        "duree": 2200,
        # Le corps quitte vraiment le sol : le contact est calculé normalement
        # sur le maillage à chaque pose, puis le corps est soulevé de la
        # hauteur déclarée. Cinq centimètres à l'extension — le talon vient de
        # décoller —, **quarante** au sommet.
        #
        # Vingt-deux ne suffisaient pas : à l'échelle du cadre, un saut de
        # vingt centimètres se confond avec un simple redressement sur la
        # pointe des pieds. La place a été prise sur les bras, qui ne montent
        # plus au-dessus du crâne — voir les deux dernières clés.
        #
        # Soixante-deux centimètres, et le compte tombe juste : pointes
        # tendues, le corps mesure un mètre quatre-vingt-trois du bout des
        # orteils au sommet du crâne, ce qui fait deux mètres quarante-cinq
        # au plus haut pour un champ de deux mètres soixante.
        "envol": [0.0, 0.05, 0.62],
        # Un temps au point bas — c'est là qu'on amortit et qu'on réarme — et
        # un souffle au sommet, où un corps qui monte s'arrête avant de
        # redescendre. Sans lui le sommet est un simple rebroussement, et le
        # saut paraît sec.
        #
        # Le temps du point bas est **divisé par deux**, et c'est la vraie
        # correction. Un cinquième du tour immobile au fond du squat, sur un
        # tour de 2,2 s, fait quatre cent quarante millisecondes assis avant de
        # pousser : ce n'est plus un armé, c'est un arrêt, et c'est ce qui se
        # voyait entre la descente et le saut. Un dixième suffit à dire qu'on
        # charge les jambes.
        #
        # Le souffle du sommet baisse aussi. Il avait été ajouté parce que le
        # vol paraissait trop court — mais le vol était court pour une tout
        # autre raison, réparée depuis dans `_horaire` : il ne recevait qu'une
        # image sur trente-deux. Maintenant qu'il en reçoit onze, il n'a plus
        # besoin qu'on le fige au sommet pour durer.
        "pauses": [0.10, 0.00, 0.06],
        "cles": [
            # Le point bas, relevé sur la captation du squat.
            _pose({
                _os("Spine"): (+0.00, -0.34, +0.94),
                _os("Spine1"): (+0.00, -0.40, +0.92),
                _os("Spine2"): (+0.00, -0.47, +0.88),
                _os("Neck"): (+0.00, -0.12, +0.99),
                _os("Head"): (+0.00, -0.24, +0.97),
                # Les bras partent **en arrière** : c'est l'armé du saut, et
                # c'est la seule chose qui distingue ce point bas de celui du
                # squat ordinaire, où ils se tendent devant pour équilibrer.
                _os("LeftArm"): (+0.16, +0.55, -0.82),
                _os("RightArm"): (-0.16, +0.55, -0.82),
                _os("LeftForeArm"): (+0.12, +0.30, -0.95),
                _os("RightForeArm"): (-0.12, +0.30, -0.95),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.32, -0.91, +0.26),
                _os("RightUpLeg"): (-0.32, -0.91, +0.26),
                _os("LeftLeg"): (-0.02, +0.54, -0.84),
                _os("RightLeg"): (+0.02, +0.54, -0.84),
                _os("LeftFoot"): (+0.31, -0.70, -0.65),
                _os("RightFoot"): (-0.31, -0.70, -0.65),
            }),
            # L'extension : corps aligné de la cheville à la tête, talons
            # décollés, bras lancés vers l'avant et le haut.
            #
            # Vers l'avant surtout : le lancer s'arrête à hauteur d'épaule, et
            # c'est ce qui laisse la place au saut. Un squat sauté n'est pas un
            # jumping jack — les bras accompagnent la poussée, ils ne cherchent
            # pas le plafond. Tant qu'ils restent sous le crâne, c'est la tête
            # qui plafonne la silhouette et le corps peut monter de soixante
            # centimètres sans qu'on rogne les doigts.
            _pose({
                _os("Spine"): (+0.00, -0.05, +1.00),
                _os("Spine1"): (+0.00, -0.05, +1.00),
                _os("Spine2"): (+0.00, -0.05, +1.00),
                _os("Neck"): (+0.00, -0.05, +1.00),
                _os("Head"): (+0.00, -0.03, +1.00),
                _os("LeftArm"): (+0.18, -0.88, +0.44),
                _os("RightArm"): (-0.18, -0.88, +0.44),
                _os("LeftForeArm"): (+0.14, -0.94, +0.31),
                _os("RightForeArm"): (-0.14, -0.94, +0.31),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.02, -0.03, -1.00),
                _os("RightUpLeg"): (-0.02, -0.03, -1.00),
                _os("LeftLeg"): (+0.02, -0.02, -1.00),
                _os("RightLeg"): (-0.02, -0.02, -1.00),
                _os("LeftFoot"): (+0.03, -0.55, -0.83),
                _os("RightFoot"): (-0.03, -0.55, -0.83),
            }),
            # En l'air : pointes tendues, bras **tenus** dans l'élan.
            #
            # Ils ne montent pas plus haut qu'à l'extension, et c'est ce qui
            # permet au saut d'être haut. Le cadrage est commun à toutes les
            # planches — 2,6 m — et il faut bien que quelque chose y tienne :
            # soit les bras montent et le corps reste au sol, soit les bras
            # s'arrêtent à l'épaule et le corps décolle. On a choisi le corps,
            # qui est le sujet de l'exercice. Le lancer des bras se fait au
            # décollage ; en l'air ils accompagnent, ils ne poussent plus.
            _pose({
                _os("Spine"): (+0.00, -0.02, +1.00),
                _os("Spine1"): (+0.00, -0.02, +1.00),
                _os("Spine2"): (+0.00, -0.02, +1.00),
                _os("Neck"): (+0.00, -0.02, +1.00),
                _os("Head"): (+0.00, -0.02, +1.00),
                _os("LeftArm"): (+0.18, -0.88, +0.44),
                _os("RightArm"): (-0.18, -0.88, +0.44),
                _os("LeftForeArm"): (+0.14, -0.94, +0.31),
                _os("RightForeArm"): (-0.14, -0.94, +0.31),
                _os("LeftHand"): SUIVRE,
                _os("RightHand"): SUIVRE,
                _os("LeftUpLeg"): (+0.02, -0.02, -1.00),
                _os("RightUpLeg"): (-0.02, -0.02, -1.00),
                _os("LeftLeg"): (+0.02, -0.01, -1.00),
                _os("RightLeg"): (-0.02, -0.01, -1.00),
                _os("LeftFoot"): (+0.02, -0.25, -0.97),
                _os("RightFoot"): (-0.02, -0.25, -0.97),
            }),
        ],
    },
    # Mollets sur une jambe. Même geste, une seule cheville : le mollet porte
    # tout le poids du corps au lieu de la moitié, ce qui est exactement la
    # progression que le catalogue décrit.
    #
    # La jambe libre se replie **en arrière**, genou à quatre-vingt-six degrés,
    # cheville cinquante-neuf centimètres au-dessus du sol. La replier devant
    # aurait donné un flamant rose : ce n'est pas la position de l'exercice, où
    # la jambe libre pend ou se croise derrière sans gêner la cheville qui
    # travaille.
    #
    # Le genou est plié **franchement**, et c'est une correction : un premier
    # jet le laissait à cent vingt-sept degrés, pied à vingt centimètres du
    # sol, et de profil on ne voyait plus qu'une position en fente. Rien ne
    # disait que le corps ne portait que sur une jambe, ce qui est pourtant le
    # seul point de l'exercice.
    #
    # `ancrage` ne nomme que le pied **droit**, et c'est tout le sujet : laissé
    # au défaut, le moteur pose le point le plus bas du maillage, qui serait
    # ici le pied levé une fois le corps monté sur la pointe. Le corps se
    # serait alors enfoncé pour aller le chercher.
    "mollets-une-jambe": {
        "vue": "profil",
        "duree": 1600,
        "symetrique": False,
        "ancrage": ("RightFoot",),
        "cles": [
            _pose(BRAS_LE_LONG, JAMBE_REPLIEE),
            _pose(BRAS_LE_LONG, JAMBE_REPLIEE, {
                # Plus vertical que sur le mollet à deux jambes : tout le poids
                # passe sur une cheville, et l'amplitude complète que la
                # consigne demande se voit ou ne se voit pas.
                _os("RightFoot"): (-0.05, -0.45, -0.89),
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
            _pose(BRAS_LE_LONG, {
                _os("Spine"): (+0.00, -0.55, +0.83),
                _os("Spine1"): (+0.00, -0.55, +0.83),
                _os("Spine2"): (+0.00, -0.55, +0.83),
                _os("Neck"): (+0.00, -0.63, +0.77),
                _os("Head"): (+0.00, -0.63, +0.77),
                _os("LeftUpLeg"): (-0.14, +0.33, -0.93),
                _os("RightUpLeg"): (+0.14, +0.33, -0.93),
                _os("LeftLeg"): (-0.14, +0.33, -0.93),
                _os("RightLeg"): (+0.14, +0.33, -0.93),
                _os("LeftFoot"): (+0.16, -0.54, -0.82),
                _os("RightFoot"): (-0.16, -0.54, -0.82),
            }),
            _pose(BRAS_LE_LONG, {
                _os("Spine"): (+0.00, -0.55, +0.83),
                _os("Spine1"): (+0.00, -0.55, +0.83),
                _os("Spine2"): (+0.00, -0.55, +0.83),
                _os("Neck"): (+0.00, -0.63, +0.77),
                _os("Head"): (+0.00, -0.63, +0.77),
                _os("LeftUpLeg"): (-0.14, +0.33, -0.93),
                _os("RightUpLeg"): (+0.14, +0.33, -0.93),
                _os("LeftLeg"): (-0.14, +0.33, -0.93),
                _os("RightLeg"): (+0.14, +0.33, -0.93),
                _os("LeftFoot"): (+0.16, -0.54, -0.82),
                _os("RightFoot"): (-0.16, -0.54, -0.82),
            }),
            _pose(BRAS_LE_LONG, {
                _os("Spine"): (-0.00, -0.55, +0.83),
                _os("Spine1"): (-0.00, -0.55, +0.83),
                _os("Spine2"): (-0.00, -0.55, +0.83),
                _os("Neck"): (-0.14, -0.47, +0.87),
                _os("Head"): (-0.14, -0.47, +0.87),
                _os("LeftUpLeg"): (+0.83, +0.03, -0.55),
                _os("RightUpLeg"): (-0.02, -0.33, -0.94),
                _os("LeftLeg"): (+0.91, +0.21, -0.35),
                _os("RightLeg"): (-0.09, +0.35, -0.93),
                _os("LeftFoot"): (+0.68, -0.70, -0.21),
                _os("RightFoot"): (-0.15, -0.76, -0.63),
            }),
            _pose(BRAS_LE_LONG, {
                _os("Spine"): (-0.00, -0.55, +0.83),
                _os("Spine1"): (-0.00, -0.55, +0.83),
                _os("Spine2"): (-0.00, -0.55, +0.83),
                _os("Neck"): (-0.02, -0.17, +0.98),
                _os("Head"): (-0.02, -0.17, +0.98),
                _os("LeftUpLeg"): (+0.87, +0.06, -0.49),
                _os("RightUpLeg"): (-0.01, -1.00, -0.09),
                _os("LeftLeg"): (+0.95, +0.16, -0.28),
                _os("RightLeg"): (+0.10, +0.15, -0.98),
                _os("LeftFoot"): (+0.82, -0.48, +0.31),
                _os("RightFoot"): (+0.07, -0.95, -0.30),
            }),
            _pose(BRAS_LE_LONG, {
                _os("Spine"): (-0.00, -0.55, +0.83),
                _os("Spine1"): (-0.00, -0.55, +0.83),
                _os("Spine2"): (-0.00, -0.55, +0.83),
                _os("Neck"): (-0.02, -0.17, +0.98),
                _os("Head"): (-0.02, -0.17, +0.98),
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
        # De **trois-quarts**, et c'est un retour en arrière assumé.
        #
        # Le profil avait été choisi parce que le corps à plat ventre s'y lit
        # d'un trait, de la main posée au talon tendu, et que le trois-quarts
        # « ne montrait plus que le dos et la cape ». La cape a disparu avec le
        # personnage habillé, et l'objection avec elle.
        #
        # Restait l'argument décisif dans l'autre sens : le geste est une
        # **alternance** gauche-droite, et de profil les deux jambes se
        # superposent. Genou droit ramené et genou gauche ramené y donnent deux
        # images en miroir, donc indiscernables — on venait d'ajouter des temps
        # d'arrêt pour rendre le rythme lisible, et la moitié du rythme restait
        # invisible. C'est le même raisonnement qui avait fait passer les
        # montées de genoux et les talons-fesses au trois-quarts.
        "vue": "trois-quarts",
        # Mille quatre cents millisecondes et non huit cents. Le geste n'est pas
        # un ciseau continu : la vidéo montre quatre temps — genou ramené, temps
        # d'arrêt, retour en planche, autre genou —, et un tour joué en huit
        # cents millisecondes les efface tous. Rallonger ne ralentit pas le
        # mouvement, il rend les arrêts lisibles.
        "duree": 1400,
        "assise": SUR_LE_VENTRE,
        "symetrique": False,
        # La hauteur de bassin d'une planche est **déduite** du bras vertical
        # et non choisie : voir `HAUTEUR_PLANCHE`. C'est la valeur dont dépend
        # tout le reste — le tronc, les appuis, la portée de la jambe arrière —
        # et elle s'est trompée deux fois de suite. Trente-deux centimètres
        # d'abord, pendant que les appuis en supposaient cinquante : les genoux
        # s'enfonçaient de dix-huit centimètres sous le plancher, ce que rien ne
        # regardait avant `auditer-gestes.py`. Cinquante ensuite, alors que le
        # bras vertical en demande cinquante-trois : le personnage était
        # accroupi sur ses mains.
        "hauteur": HAUTEUR_PLANCHE,
        # Trois poses et deux temps d'arrêt, et c'est le rythme même du geste :
        # genou droit ramené, **marque**, retour en planche, genou gauche,
        # marque. Vingt-deux pour cent du tour immobile de chaque côté.
        #
        # La pose du milieu — la planche pleine, les deux jambes tendues —
        # manquait, et c'est ce qui rendait le mouvement illisible : le geste
        # interpolait directement d'un genou à l'autre, et le corps ciseillait
        # sans jamais repasser par la position d'appui. Or c'est justement ce
        # qu'un pratiquant doit voir.
        #
        # Le rythme est **écrit**, et il faut le dire : deux vidéos de mountain
        # climber ont fini par arriver, et ni l'une ni l'autre ne le donne.
        #
        # La première est un montage — la caméra zoome, l'étendue du sujet varie
        # de plus du tiers d'un plan à l'autre — et `rythme-video.py` y lit trois
        # cadences incompatibles selon la fenêtre qu'on lui donne : 1502 ms sur
        # les images 200-360, 834 ms sur 560-700, 584 ms sur 620-760, avec une
        # autocorrélation qui ne dépasse jamais 0,1. La seconde est une boucle
        # de synthèse de six secondes, dont l'autocorrélation ne fait que
        # décroître : elle n'a pas de cadence propre à relever.
        #
        # Vingt-deux pour cent d'arrêt de chaque côté sont donc un **choix de
        # lisibilité** et non une mesure — le geste est une alternance, et une
        # alternance sans marque se lit comme un ciseau continu. Les fenêtres
        # exploitables donnent d'ailleurs des arrêts bien plus courts, de zéro à
        # sept pour cent du tour. Si une vidéo à cadrage fixe arrive un jour,
        # c'est cette valeur-là qu'il faudra reprendre.
        "pauses": [0.22, 0.00, 0.22],
        "cles": [
            _pose(PLANCHE_DROITE, grimpeur("D")),
            _pose(PLANCHE_DROITE, grimpeur(None)),
            _pose(PLANCHE_DROITE, grimpeur("G")),
        ],
    },
    # Mountain climbers **croisés**. Même appui, même rythme, une seule
    # différence : le genou traverse l'axe du corps pour aller chercher le
    # coude opposé au lieu de rentrer sous la poitrine. C'est ce que le
    # catalogue décrit sous « Mountain climbers croisés », et qui partageait
    # jusqu'ici la planche du mountain climber ordinaire — deux exercices, une
    # seule démonstration, et celle qui montrait l'autre mouvement.
    #
    # De trois-quarts comme lui : le croisement se fait dans la largeur, et de
    # profil il disparaît entièrement.
    "mountain-climber-croise": {
        "vue": "trois-quarts",
        "duree": 1400,
        "assise": SUR_LE_VENTRE,
        "symetrique": False,
        "hauteur": HAUTEUR_PLANCHE,
        "pauses": [0.22, 0.00, 0.22],
        # Une torsion du bassin, dix degrés de chaque côté.
        #
        # Sans elle, la jambe partait de travers d'une hanche restée carrée, et
        # l'on voyait une jambe tordue plutôt qu'un corps qui tourne. Personne
        # ne ramène le genou vers le coude opposé sans que le bassin
        # accompagne. Dix degrés suffisent : c'est un mouvement croisé, pas un
        # russian twist.
        "torsion": [+10.0, 0.0, -10.0],
        # Le **même** grimpeur que l'exercice droit, avec quelques degrés de
        # plus. Il avait droit à une pose écrite à part, en directions, et
        # c'était une erreur d'analyse : on avait conclu qu'un appui ne pouvait
        # pas croiser parce qu'il vise la cheville. Il le peut très bien — il
        # faut simplement dire au **pôle** de quel côté sortir le genou.
        # Écrite à part, la pose divergeait de celle du grimpeur droit à chaque
        # correction de celui-ci, et c'est ainsi qu'elle a fini par ne plus
        # ressembler à l'exercice.
        "cles": [
            _pose(PLANCHE_DROITE, grimpeur("D", croise=True)),
            _pose(PLANCHE_DROITE, grimpeur(None, croise=True)),
            _pose(PLANCHE_DROITE, grimpeur("G", croise=True)),
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
    # Planche **basse** avec élévation alternée des jambes.
    #
    # Elle partait d'une planche **haute**, bras tendus, et c'était faux : la
    # progression décrite part du gainage sur les avant-bras. Coudes posés,
    # avant-bras à plat vers l'avant, poings joints devant la tête comme sur
    # toutes les photos du geste.
    #
    # Le pied qui se lève est **tendu**, pointe dans le prolongement du tibia,
    # et non recourbé sous la cheville : un pied en l'air n'a plus rien à
    # pousser. C'est ce que montre la photo de référence, et c'est aussi ce qui
    # distingue une jambe levée d'une jambe qui cherche le sol.
    "planche-jambes-alternees": {
        "vue": "profil",
        "duree": 4400,
        "assise": ((+0.00, +0.98, +0.22), (+0.00, +0.22, -0.98)),
        "symetrique": False,
        # Les appuis de la planche basse : coudes, avant-bras, poings, orteils.
        # Le pied levé y figure aussi — la mise d'aplomb écarte d'elle-même
        # celui qui flotte au-dessus des autres, et il redevient porteur quand
        # il redescend.
        "ancrage": ("LeftForeArm", "RightForeArm", "LeftHand", "RightHand",
                    "LeftFoot", "RightFoot"),
        "aplomb": True,
        # Un temps sur chaque jambe levée, rien au passage : c'est un geste de
        # gainage, on **tient** la jambe en l'air.
        "pauses": [0.18, 0.00, 0.18],
        "cles": [
            _pose(PLANCHE_BASSE_APPUI, JAMBE_LEVEE("Left")),
            _pose(PLANCHE_BASSE_APPUI),
            _pose(PLANCHE_BASSE_APPUI, JAMBE_LEVEE("Right")),
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


def fermer_les_poings(armature, contexte, numero, serrage=1.0):
    """Referme les doigts, comme sur une poignée.

    ## Pourquoi le mannequin ne le fait pas tout seul

    Sa pose de repos a les mains **ouvertes**, doigts écartés. C'est le bon
    défaut : la plupart des gestes n'ont rien à tenir, et une main ouverte au
    bout d'un bras qui monte une charge ne choque personne — le personnage ne
    tient pas l'haltère non plus.

    La corde à sauter, elle, ne se démontre que par les mains. C'est le seul
    signe qui la distingue d'un rebond sur place, et une main grande ouverte
    dit exactement le contraire de ce que le geste demande.

    `serrage` va de zéro — main ouverte — à un, poing fermé sur une poignée.
    """
    import math
    from mathutils import Quaternion

    for cote in ("Left", "Right"):
        for doigt in DOIGTS + ("Thumb",):
            angles = FERMETURE_POUCE if doigt == "Thumb" else FERMETURE
            for rang, degres in enumerate(angles, start=1):
                nom = _os(f"{cote}Hand{doigt}{rang}")
                if nom not in armature.pose.bones:
                    continue
                os_pose = armature.pose.bones[nom]
                os_pose.rotation_mode = "QUATERNION"
                os_pose.rotation_quaternion = Quaternion(
                    (1, 0, 0), math.radians(degres * serrage)
                )
                # Posée en clé comme tout le reste : sans elle la fermeture
                # existerait dans la pose vivante et disparaîtrait du rendu,
                # qui relit les clés.
                os_pose.keyframe_insert("rotation_quaternion", frame=numero)
    contexte.view_layer.update()


def _boucle_resolue(cles, repos):
    """Les poses clés en directions du monde, aller-retour compris.

    Deux clés se parcourent 0→1→0 ; trois, 0→1→2→1→0. Les extrémités ne sont
    pas doublées : la planche boucle, et les répéter marquerait un temps mort à
    chaque tour — un temps mort qui, lui, se déclare avec `pauses`.
    """
    from mathutils import Vector

    boucle = []
    for pose in cles:
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
        boucle.append(sortie)
    return boucle + list(reversed(boucle))[1:]


#: Combien de mètres parcourus par le corps « valent » un radian d'articulation,
#: quand il faut comparer les deux pour partager les images d'un tour. Le ramener
#: exactement demanderait la longueur du membre ; dix centimètres pour un radian
#: est l'ordre de grandeur d'un bras, et il ne s'agit que de répartir des durées
#: entre elles.
METRE_EN_RADIAN = 0.10


def _deplacements(geste):
    """Ce que le corps **translate** à chaque pose clé, en mètres.

    Somme de `bassin` et d'`envol`, qui déplacent tous deux le corps entier
    sans qu'aucune articulation ne tourne. C'est précisément ce que `_ecart`
    ne peut pas voir : il compare des directions d'os, et un corps qui monte
    de soixante centimètres tout raide n'en fait bouger aucune.
    """
    par_cle = [[0.0, 0.0, 0.0] for _ in geste["cles"]]
    declare = geste.get("bassin")
    if declare is not None and isinstance(declare[0], (tuple, list)):
        for k, triplet in enumerate(declare):
            for i in range(3):
                par_cle[k][i] += triplet[i]
    envol = geste.get("envol")
    if envol is not None:
        for k, hauteur in enumerate(envol):
            par_cle[k][2] += hauteur
    return [tuple(v) for v in par_cle]


def _ecart(a, b):
    """Combien de chemin sépare deux poses, en radians cumulés.

    Sert à donner à chaque déplacement la durée qu'il mérite : un genou qui
    monte à hauteur de hanche met plus longtemps qu'un poignet qui pivote, et
    leur accorder le même nombre d'images fait un mouvement qui accélère et
    ralentit sans raison. C'est une somme d'angles et non une moyenne : une
    pose qui bouge tout le corps est bien plus longue qu'une qui bouge un bras.
    """
    from mathutils import Vector

    total = 0.0
    for nom, x in a.items():
        y = b.get(nom)
        if y is None or x is SUIVRE or y is SUIVRE:
            continue
        if isinstance(x, Appui) and isinstance(y, Appui):
            total += sum(
                (u - v) ** 2 for u, v in zip(x.cible, y.cible)
            ) ** 0.5 / METRE_EN_RADIAN
            continue
        u = Vector(x.direction if isinstance(x, APlat) else x)
        v = Vector(y.direction if isinstance(y, APlat) else y)
        if u.length > 1e-6 and v.length > 1e-6:
            total += u.angle(v)
    return total


def _calendrier(taille, images, arrets, trajets):
    """Où en est le geste à chaque image : (rang du segment, avancement).

    ## Pourquoi un calendrier plutôt qu'une division

    Le partage d'origine était le plus simple possible : autant d'images par
    segment, quel que soit le segment. C'est faux de deux façons, et la vidéo
    le dit à chaque fois qu'on la regarde.

    Faux sur les **déplacements** d'abord : deux poses éloignées et deux poses
    voisines recevaient le même nombre d'images, donc le corps traversait
    lentement un grand mouvement puis se précipitait sur un petit.

    Faux sur les **arrêts** surtout : un geste ne se déplace pas sans cesse. Le
    mountain climber marque un temps genou ramené, la corde à sauter marque la
    réception. Un aller-retour continu efface tout cela, et l'exercice se
    démontre à un rythme que personne n'exécute. Faute de pouvoir le dire, on
    dupliquait la pose clé — deux clés identiques faisant une pause. Ça marche
    et ça se lit mal : la durée de l'arrêt y dépend du nombre de clés, et
    dépendre du voisinage est la meilleure façon de casser un réglage en en
    changeant un autre.

    `arrets` donne, par élément de la boucle, la part du tour passée immobile
    sur cette pose. `trajets` donne la part de chaque déplacement.

    ## L'amortissement porte sur la **phase**, pas sur le segment

    C'est le point délicat, et il a coûté une livraison. Amortir chaque segment
    séparément fait décélérer le corps jusqu'à l'arrêt complet à **chaque pose
    clé traversée**, y compris celles où l'on ne veut pas s'arrêter. Une fente
    en trois clés marquait donc un temps au milieu de la descente, là où la
    pose intermédiaire ne dit qu'un passage. Mesuré sur la planche livrée : le
    sommet du crâne stagnait trois images à mi-parcours.

    Sur deux clés, le défaut ne se voyait pas — deux segments amortis se
    recomposent exactement en un cosinus, donc en un mouvement harmonique
    propre. Il n'apparaît qu'à partir de trois.

    Les déplacements consécutifs sont donc regroupés en **phases** : on part
    d'un arrêt, on accélère, on traverse les poses intermédiaires à pleine
    vitesse, on décélère jusqu'à l'arrêt suivant. L'amortissement s'applique à
    la phase entière et la position s'y répartit au prorata des durées.
    """
    etapes = []
    for k in range(taille):
        if arrets[k] > 0:
            # Un arrêt n'est pas un segment : c'est un segment figé. Sur la
            # dernière pose de la boucle il n'y a pas de segment suivant, on
            # tient donc la **fin** du précédent — les deux disent le même
            # endroit, la boucle se refermant sur sa première pose.
            if k < taille - 1:
                etapes.append((arrets[k], k, 0.0))
            else:
                etapes.append((arrets[k], taille - 2, 1.0))
        if k < taille - 1:
            etapes.append((trajets[k], k, None))

    # Regroupement en phases : une suite de déplacements sans arrêt entre eux
    # n'est qu'un seul mouvement, et se lit comme tel.
    phases, courante = [], []
    for etape in etapes:
        if etape[2] is None:
            courante.append(etape)
        else:
            if courante:
                phases.append(courante)
                courante = []
            phases.append([etape])
    if courante:
        phases.append(courante)

    total = sum(duree for duree, _, _ in etapes) or 1.0
    plan = []
    for i in range(images):
        t = (i / images) * total
        cumul = 0.0
        for rang_phase, phase in enumerate(phases):
            duree_phase = sum(d for d, _, _ in phase)
            derniere = rang_phase == len(phases) - 1
            if not (t < cumul + duree_phase or derniere):
                cumul += duree_phase
                continue

            if phase[0][2] is not None:
                plan.append((phase[0][1], phase[0][2]))
                break

            # Où en est-on de la phase, une fois amortie ? La valeur obtenue
            # se relit ensuite comme une durée, ce qui la ramène sur le bon
            # segment et à la bonne fraction de celui-ci.
            avance = 0.0 if duree_phase <= 0 else (t - cumul) / duree_phase
            atteint = _adoucir(min(1.0, max(0.0, avance))) * duree_phase
            parcouru = 0.0
            for duree, rang, _ in phase:
                if atteint <= parcouru + duree or duree <= 0:
                    reste = 0.0 if duree <= 0 else (atteint - parcouru) / duree
                    plan.append((rang, min(1.0, max(0.0, reste))))
                    break
                parcouru += duree
            else:
                plan.append((phase[-1][1], 1.0))
            break
    return plan


def _horaire(cles, images, arrets_declares, poses_resolues, deplacements=None):
    """Le calendrier d'un geste, arrêts compris — ou le partage d'autrefois.

    Sans `pauses` déclarées, on rend **exactement** le découpage d'origine :
    autant d'images par segment. Vingt et un gestes ont été contrôlés à l'œil
    sous ce partage-là, et les retimer tous au passage reviendrait à les
    remettre en cause sans que personne l'ait demandé.

    ## Le corps qui se déplace compte autant que les os qui tournent

    `_ecart` ne mesure que des angles, et c'est une lacune qui saute aux yeux
    dès qu'un geste décolle. Sur le saut squaté, l'écart accroupi→extension
    valait 16,27 et l'écart extension→sommet 0,84 : entre les deux, le corps
    monte de cinquante-sept centimètres tout raide, et pas une articulation ne
    bouge. Le partage donnait donc **une seule image** au vol pour quatorze à
    la montée. Le saut se lisait comme un saut de montage : on s'accroupit
    longuement, on disparaît, on réapparaît en haut.

    `deplacements` donne, pose par pose, ce que le corps translate — la somme
    de `bassin` et d'`envol`. Sa longueur s'ajoute au chemin du segment, au
    même tarif que les appuis.
    """
    taille = 2 * len(cles) - 1
    segments = max(1, taille - 1)

    if arrets_declares is None:
        return [
            (min(int((i / images) * segments), segments - 1),
             _adoucir((i / images) * segments - min(int((i / images) * segments), segments - 1)))
            for i in range(images)
        ]

    if len(arrets_declares) != len(cles):
        raise SystemExit(
            f"Le geste déclare {len(arrets_declares)} temps d'arrêt pour "
            f"{len(cles)} poses clés."
        )
    arrets = list(arrets_declares) + list(reversed(arrets_declares))[1:]
    # La **première** pose est le point de bouclage : le tour s'y termine et y
    # recommence, si bien que son temps d'arrêt est à cheval sur la jointure.
    # Le compter en entier des deux côtés le doublerait, et le geste marquerait
    # deux fois plus longtemps à un bout qu'à l'autre — ce qui se voit
    # immédiatement sur une alternance gauche-droite.
    #
    # Les poses **intermédiaires**, elles, sont traversées deux fois par tour,
    # à l'aller et au retour : ce qu'on déclare y vaut par passage.
    arrets[0] = arrets_declares[0] / 2.0
    arrets[-1] = arrets_declares[0] / 2.0
    part_arret = sum(arrets)
    if part_arret >= 1.0:
        raise SystemExit(
            f"Les temps d'arrêt déclarés font {part_arret:.2f} du tour : il ne "
            "resterait rien pour se déplacer."
        )

    chemins = [
        _ecart(poses_resolues[k], poses_resolues[k + 1]) for k in range(segments)
    ]
    if deplacements is not None:
        allees = list(deplacements) + list(reversed(deplacements))[1:]
        for k in range(segments):
            course = sum(
                (u - v) ** 2 for u, v in zip(allees[k], allees[k + 1])
            ) ** 0.5
            chemins[k] += course / METRE_EN_RADIAN
    somme = sum(chemins)
    if somme <= 1e-6:
        chemins = [1.0] * segments
        somme = float(segments)
    trajets = [(1.0 - part_arret) * c / somme for c in chemins]
    return _calendrier(taille, images, arrets, trajets)


def _parcours(cles, images, repos, arrets=None):
    """Suite de poses interpolées, en aller-retour et **sans doublon**.

    La dernière image est celle qui précède le retour au départ : la planche
    boucle, la répéter marquerait un temps mort à chaque tour.

    `repos` fournit la direction des os laissés à `REPOS`, mesurée sur le modèle.
    `arrets` donne, quand le geste en déclare, la part du tour passée immobile
    sur chaque pose clé. Voir `_calendrier`.
    """
    from mathutils import Vector

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

    boucle = _boucle_resolue(cles, repos)

    poses = []
    for rang, e in _horaire(cles, images, arrets, boucle):
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


def _decalages(declare, cles, images, horaire=None):
    """Décalage du bassin à chaque image, ou `None` partout s'il n'y en a pas.

    Accepte un seul triplet — le bassin ne bouge alors pas du geste — ou un
    triplet par pose clé, ce qui le fait monter et descendre. C'est ce dont un
    mollet debout a besoin : rien ne tourne, tout le corps se translate.

    `horaire` est le calendrier des poses, quand le geste en a un. Il **faut**
    le passer : calculer le sien reviendrait à faire monter le bassin selon un
    découpage régulier pendant que le corps, lui, marque des temps d'arrêt — et
    un bassin qui monte pendant que les jambes ne bougent pas, c'est un
    personnage qui lévite.
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
    if horaire is None:
        segments = max(1, len(boucle) - 1)
        horaire = [
            (min(int((i / images) * segments), segments - 1),
             _adoucir((i / images) * segments
                      - min(int((i / images) * segments), segments - 1)))
            for i in range(images)
        ]
    suite = []
    for rang, e in horaire:
        a, b = boucle[rang], boucle[rang + 1]
        suite.append(tuple(x + (y - x) * e for x, y in zip(a, b)))
    return suite


def _rebondir(decalages, horaire, hauteur):
    """Ajoute au bassin le va-et-vient vertical d'une foulée.

    ## Pourquoi le moteur en avait besoin

    Une montée de genoux et un talons-fesses tenaient leur bassin à une hauteur
    **fixe**, déclarée. C'était la correction d'une faute réelle — ancré, le
    moteur posait à chaque image le plus bas des deux pieds, et le corps
    plongeait de quatorze centimètres à mi-alternance, là où aucun pied ne
    porte. Mais la correction en a créé une autre, et elle se voit tout de
    suite : un corps dont le bassin ne monte ni ne descend pendant que les
    jambes pédalent est un corps en apesanteur. On avait remplacé un plongeon
    par une lévitation.

    ## Le relevé tranche, et contre l'intuition

    Sur les quatre cent trente-quatre images exploitables de la vidéo de
    montées de genoux, le bassin oscille avec une période de 375 ms — la moitié
    du tour de 751 ms, donc **deux rebonds par tour**, un par appui. Et la
    phase est l'inverse de ce qu'on suppose : le bassin est au plus **bas**
    quand un genou est au plus haut (-10,6 % de la longueur de jambe) et au
    plus **haut** quand les deux genoux se croisent (+3,4 %). Genou haut, c'est
    le milieu de l'appui, quand la jambe porteuse amortit ; genoux croisés,
    c'est la phase de vol.

    C'est pourquoi le rebond **monte** depuis la pose clé au lieu de descendre
    vers elle. La hauteur déclarée du geste est celle où l'ancrage posait
    lui-même le pied porteur : y descendre enfoncerait ce pied dans le sol. Le
    creux de la foulée est donc la pose clé elle-même, et le corps s'élève
    entre deux poses, où il ne touche plus rien.

    L'amplitude relevée va de creux à crête à 22 % de la longueur de jambe,
    soit vingt et un centimètres sur ce squelette. Les gestes en déclarent
    moins : la vidéo est vigoureuse, et une démonstration qui bondit d'autant
    se lit comme un saut plutôt que comme une foulée.

    Pendant un temps d'arrêt, `horaire` renvoie une avancée figée à 0 ou 1 :
    le cosinus y vaut 1, le rebond est nul, et le corps tient sa pose à la
    hauteur où il la tenait. C'est ce qu'il faut — un bassin qui continuerait
    de monter pendant que les jambes s'arrêtent, c'est précisément la lévitation
    qu'on corrige.
    """
    import math

    suite = []
    for (_, avance), decalage in zip(horaire, decalages):
        monte = hauteur * (1.0 - math.cos(2.0 * math.pi * avance)) / 2.0
        x, y, z = (0.0, 0.0, 0.0) if decalage is None else decalage
        suite.append((x, y, z + monte))
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


def planter(contexte, armature, os_porteur, reference):
    """Empêche un appui de glisser : il garde sa place au sol d'un bout à l'autre.

    ## Ce que ça répare

    Le bassin est reposé au même endroit à chaque image — il le faut, sinon un
    décalage relatif s'accumulerait et le corps dériverait d'un tour à l'autre.
    Mais alors **rien ne bouge horizontalement** : sur une fente, les deux
    pieds s'écartaient symétriquement autour d'un bassin immobile. Ce n'est pas
    un pas en avant, c'est un grand écart, et l'œil le voit tout de suite même
    s'il ne sait pas le nommer.

    Or un pas se définit par ce qui **ne** bouge pas : le pied arrière reste
    planté et le corps passe au-dessus. On mesure donc où l'appui nommé a
    touché à la première image, et l'on déplace le corps entier de ce qu'il
    faut pour qu'il y reste.

    `reference` est ce point, ou `None` à la première image — il est alors
    renvoyé pour les suivantes.

    ## Pourquoi l'os et non la chair

    `contacts` renvoie le point le plus **bas** de la chair, et c'est
    exactement ce qu'il faut pour poser un corps : ce qui touche le sol, c'est
    la chair, et l'os du pied passe au milieu. Mais ancrer un point dans le plan
    horizontal est une autre question, et le point le plus bas y est un piège :
    il **migre** le long de la semelle. Tant que le pied est à plat, c'est un
    point du talon ; dès qu'il se déroule, c'est un point de l'avant-pied. Entre
    deux images le repère saute donc d'une longueur de pied, et `planter`,
    consciencieusement, déplace tout le corps d'autant pour le ramener où il
    croit qu'il était.

    Mesuré sur la fente : entre la onzième et la douzième image, la silhouette
    entière se décalait de seize centimètres d'un coup — un saut de 10,4 par
    image là où le reste du geste tenait sous 6. C'était ce que le geste avait
    de « saccadé », et ce n'était pas un manque d'images : c'était une
    téléportation. En ajouter ne faisait que la rendre plus visible en
    aplanissant tout le reste.

    On ancre donc la **queue de l'os**, c'est-à-dire la base des orteils : un
    point matériel du pied, qui ne se déplace pas parce que le pied tourne.
    C'est aussi le bon point physiquement — une fente arrière pivote sur
    l'avant-pied, pas sur le talon.
    """
    contexte.view_layer.update()
    point = armature.matrix_world @ armature.pose.bones[
        f"mixamorig:{os_porteur}"
    ].tail
    if reference is None:
        return (point.x, point.y)

    ecart = (reference[0] - point.x, reference[1] - point.y)
    if abs(ecart[0]) > 1e-4 or abs(ecart[1]) > 1e-4:
        _translater(contexte, armature, 0.0, ecart[0], ecart[1])
    return reference


def _translater(contexte, armature, monte, vers_x=0.0, vers_y=0.0):
    """Déplace le corps entier dans le monde, sans toucher à son orientation."""
    bassin = armature.pose.bones[BASSIN]
    matrice = bassin.matrix.copy()
    matrice.translation += armature.matrix_world.inverted().to_3x3() @ _vecteur(
        (vers_x, vers_y, monte)
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


def _tordre(armature, assiette, axe_du_corps, degres, contexte):
    """Fait pivoter le bassin autour de l'axe long du corps.

    C'est ce qui manque à un mouvement croisé pour être naturel. Personne ne
    ramène le genou vers le coude opposé en gardant les hanches carrées : le
    bassin accompagne, et sans lui la jambe part de travers d'une hanche qui,
    elle, ne bouge pas — on voit une jambe tordue plutôt qu'un corps qui tourne.

    L'axe est celui de l'assise, c'est-à-dire la direction bassin→tête : à plat
    ventre elle vaut +Y, et tourner autour d'elle est exactement une torsion.

    Le bassin **seul** tourne, et c'est voulu. Le tronc est visé par des
    directions du monde et les bras par des appuis, eux aussi dans le monde :
    les uns comme les autres retrouvent leur place après la rotation. Seules
    les racines des jambes suivent, ce qui est la définition d'une torsion de
    hanches.

    On repart de `assiette` — l'orientation que l'assise a donnée — et jamais de
    l'orientation courante : composer une rotation sur la précédente à chaque
    image ferait visser le corps d'un bout à l'autre du tour.
    """
    import math

    from mathutils import Matrix, Vector

    if not degres:
        return
    bassin = armature.pose.bones[BASSIN]
    # L'axe se dit dans le monde et la matrice du bassin vit dans l'armature :
    # Mixamo importe le squelette tourné d'un quart de tour, et tourner autour
    # de l'axe du monde sans le convertir vrillerait le corps de travers.
    axe = (
        armature.matrix_world.inverted().to_3x3() @ Vector(axe_du_corps)
    ).normalized()
    remise = (Matrix.Rotation(math.radians(degres), 3, axe) @ assiette).to_4x4()
    remise.translation = bassin.matrix.translation
    bassin.matrix = remise
    contexte.view_layer.update()


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
    # Le calendrier **une fois**, et partagé : les poses, le bassin et l'envol
    # doivent avancer ensemble. Chacun recalculant le sien, il suffisait qu'un
    # geste déclare des temps d'arrêt pour que le bassin continue de monter
    # pendant que le corps tient la pose.
    arrets = geste.get("pauses")
    poses_du_tour = _parcours(geste["cles"], images, repos, arrets)
    horaire = _horaire(
        geste["cles"], images, arrets,
        # `_horaire` ne lit la boucle que pour mesurer les distances, et il ne
        # la lit pas du tout sans temps d'arrêt déclarés.
        _boucle_resolue(geste["cles"], repos) if arrets else None,
        _deplacements(geste) if arrets else None,
    )

    declare = geste.get("bassin")
    if declare is None and geste.get("hauteur") is not None:
        declare = (0, 0, 0)
    decalages = _decalages(declare, len(geste["cles"]), images, horaire)

    # Le rebond de la foulée, s'il y en a un : voir `_rebondir`.
    if geste.get("rebond"):
        decalages = _rebondir(decalages, horaire, geste["rebond"])

    # Combien le corps **décolle**, en mètres, une fois posé au sol. À ne pas
    # confondre avec `bassin`, qui déplace le bassin dans la pose et se fait
    # donc rattraper par l'ancrage : ici, on pose le corps normalement — le
    # contact des pieds reste calculé sur le maillage — puis on le soulève.
    #
    # C'est le seul moyen d'écrire un saut sans mentir. `ancrage: False`
    # laisserait le corps à la hauteur où sa pose le met, et il faudrait alors
    # calculer à la main la hauteur de hanche de chaque accroupissement pour
    # que les pieds retombent à zéro — un chiffre faux à la moindre retouche
    # du genou. Un envol se déclare en une valeur qui veut dire ce qu'elle
    # dit : zéro au sol, trente centimètres en l'air.
    envols = _decalages(
        None if geste.get("envol") is None
        else [(0, 0, h) for h in geste["envol"]],
        len(geste["cles"]),
        images,
        horaire,
    )

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

    # La torsion du bassin, pose par pose, en degrés autour de l'axe long du
    # corps. On la fait passer par `_decalages` — le seul intéressant des trois
    # nombres est le premier — pour qu'elle suive exactement le même calendrier
    # que les poses : une torsion qui avancerait à son propre rythme tournerait
    # les hanches pendant que les jambes tiennent leur position.
    torsions = _decalages(
        None if geste.get("torsion") is None
        else [(angle, 0.0, 0.0) for angle in geste["torsion"]],
        len(geste["cles"]),
        images,
        horaire,
    )

    # Où l'appui planté a touché à la première image. Il n'y retournera pas
    # tout seul : c'est le corps qu'on déplacera pour qu'il y reste.
    repere_plante = None

    for numero, (pose, decalage, envol) in enumerate(
        zip(poses_du_tour, decalages, envols), start=1
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
        if assise and torsions[numero - 1] is not None:
            _tordre(
                armature, assiette, assise[0], torsions[numero - 1][0], contexte
            )
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

        # Les doigts **après** le poignet, comme partout : ils le suivent.
        # Avant l'ancrage, en revanche, parce qu'un poing fermé change le point
        # le plus bas du maillage — ce qui ne compte pas pour la corde à
        # sauter, mains en l'air, mais compterait pour une planche.
        if geste.get("poings"):
            fermer_les_poings(armature, contexte, numero, geste["poings"])

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

            # **Après** avoir posé le corps à sa hauteur : planter fixe la
            # place au sol, poser fixe la hauteur, et les deux ne se marchent
            # pas dessus — l'un agit à plat, l'autre sur la verticale.
            if geste.get("plante"):
                repere_plante = planter(
                    contexte, armature, geste["plante"], repere_plante
                )
            bassin.keyframe_insert("location", frame=numero)

        # **Après** avoir posé le corps, et c'est tout l'intérêt : le contact
        # a été calculé sur le maillage à cette pose-ci, et l'on sait donc de
        # combien on soulève au-dessus du sol, et non au-dessus de rien.
        if envol is not None and abs(envol[2]) > 1e-5:
            _translater(contexte, armature, envol[2])
            bassin.keyframe_insert("location", frame=numero)

    return list(range(1, images + 1))
