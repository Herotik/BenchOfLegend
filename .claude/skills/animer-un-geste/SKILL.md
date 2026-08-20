---
name: animer-un-geste
description: Écrire l'animation 3D d'un exercice de musculation et la porter dans l'app, en partant d'une description de référence trouvée en ligne. À utiliser quand un exercice n'a pas encore de démonstration, quand une démonstration existante est jugée fausse, ou quand il faut ajouter un geste à `scripts/gestes_generes.py`.
---

# Animer un geste

## Ce que ce skill corrige

Les dix premières animations écrites à la main l'ont été en tâtonnant : poser
des directions au jugé, lancer un rendu de dix minutes, regarder la planche de
contact, constater que « quelque chose cloche » sans savoir quoi, recommencer.
Un seul geste au sol a consommé une dizaine de tours de cette façon.

Ce qui a fini par marcher tient en une phrase : **partir d'une description de
référence, en tirer des critères chiffrables, et boucler sur la mesure plutôt
que sur l'image.** Quarante secondes par essai au lieu de dix minutes, et un
verdict qui ne se discute pas.

Toutes les fautes trouvées ainsi étaient invisibles à l'œil nu — un bassin resté
à sa hauteur debout, un corps qui partait de côté au lieu de descendre, un
roulis pris sur un corps vertical pour poser un corps couché, une gauche et une
droite échangées par un demi-tour. L'œil disait « c'est bizarre » ; la mesure
disait « le bassin est à 1,17 m au lieu de 0,50 ».

## Ce que je ne peux pas faire

**Lire une vidéo.** Aucun accès aux images : ni YouTube, ni extraction de poses
à partir d'un film. Une playlist d'exercices ne sert donc qu'à nommer les
gestes, et encore faut-il que le domaine passe le proxy — YouTube ne passe pas.

Ce qui passe : les pages de description d'exercices, largement suffisantes.
Elles disent « mains directement sous les épaules », « ligne droite de la tête
aux talons », « bassin de niveau » — c'est-à-dire exactement des contraintes
géométriques.

## La marche à suivre

### 1. Chercher la forme de référence

    WebSearch: "<exercice> proper form step by step"

Trois ou quatre sources concordantes suffisent. Chercher les phrases qui parlent
de **positions relatives**, pas de sensations :

- « hands directly under shoulders » → l'écart main-épaule doit être nul
- « straight line from head to heels » → le bassin est sur la ligne
  épaules-chevilles
- « hips level, don't let them sag or pike » → l'écart à cette ligne est nul
- « toes curled under » → la cheville arrière est au sol
- « front foot off the floor » → l'autre cheville ne l'est pas

Écrire ces critères **avant** de toucher au code. Ce sont eux qui décideront,
pas l'impression que donne le rendu.

### 2. Écrire la pose

Dans `scripts/gestes_generes.py`. Les règles qui coûtent cher quand on les
oublie, toutes apprises à la dure :

**Un membre qui touche quelque chose se décrit par un `Appui`**, jamais par des
directions. La main d'une planche est *posée*, on connaît l'endroit et non
l'angle. `atteindre` résout la chaîne exactement.

**Sauf pour un appui sur l'avant-bras** — gainage latéral, planche basse. Là,
c'est le **coude** qui porte, et un `Appui` ne place que le poignet. Deux
directions valent mieux : le bras descend, l'avant-bras se couche.

**Tout se lit dans le repère du corps, pas du monde.** Une `assise` qui couche
le personnage échange aussi sa gauche et sa droite, et déplace son « avant ». À
plat ventre, l'avant du corps est le **sol** : le genou mène vers le bas, le
coude part vers le haut. Écrire les pôles avec l'avant d'un corps debout plie
les genoux à l'envers — c'est arrivé sur les quatre membres à la fois.

**Un membre ne vise pas plus loin qu'il ne mesure.** Bassin à 50 cm et jambe de
90 : la portée au sol est √(0,90² − 0,42²) ≈ 0,80 m, pas davantage. Au-delà, le
membre se tend sans atteindre et pend en diagonale.

**La hauteur du corps se donne, ou se déduit, jamais les deux.** Un geste qui
plante des appuis déclare `hauteur` ; les autres laissent `ancrage` poser le
corps au sol. Quand le personnage porte un vêtement long, l'ancrage doit porter
sur les **os** qui portent : `"ancrage": ("RightForeArm", "RightFoot")`, sans
quoi c'est la cape qui touche le sol pendant que les pieds flottent.

### 3. Contrôler sans rien rendre

    python3 scripts/verifier-gestes.py

Huit contrôles instantanés : genou à l'envers, dos rond, asymétrie non
déclarée, direction nulle, assise dégénérée, appui hors de portée, appui sous le
sol, pôle qui plie à l'envers. Chacun a été ajouté après une faute réellement
livrée.

### 4. Mesurer

    blender -b -noaudio -P scripts/mesurer-geste.py -- <corps.fbx> <geste>

Comparer aux critères de l'étape 1. Corriger, remesurer. **Ne pas rendre tant
que les chiffres ne passent pas** — c'est là que se gagne le temps.

Le contrôle du **regard** mérite une mention : il départage une planche d'un
corps couché sur le dos, ce que l'image seule laisse ambigu et ce qui a coûté
plusieurs tours.

### 5. Rendre, et seulement alors

    blender -b -noaudio -P scripts/rendre-geste.py -- <corps.fbx> <sortie> \
        --geste <nom> --echelle 2.6 --taille 512

`--echelle 2.6` **toujours** : c'est ce qui donne au personnage la même taille
d'un exercice à l'autre.

Choisir la vue selon ce qui doit se voir, pas par habitude. Une élévation
frontale ne se lit pas de face, une latérale pas de profil, un buste penché ni
de l'une ni de l'autre — d'où `trois-quarts`. Un corps à plat ventre, lui, se
lit très bien de profil : toutes les photos de l'exercice sont prises ainsi.

### 6. Porter dans l'app

    python3 scripts/planche-geste.py <dossier> <slug> --sans-recadrage

Puis déclarer la planche dans `mobile/src/donnees/planches.ts` et associer les
exercices dans `mobile/src/donnees/gestes.ts`. Le test de couverture exige que
les 147 exercices aient un geste ; il échouera si l'un est oublié.

    npx vitest run mobile/src/donnees/gestes.test.ts

## Le corps de référence

Utiliser le mannequin **nu** pour juger une posture. Un personnage habillé cache
les lignes du corps : sur un geste au sol, la cape se confond avec le dos et
l'on ne distingue plus ni les genoux ni l'alignement. Le vêtement se remet une
fois la pose juste.

## Quand s'arrêter

Si les chiffres passent et que l'image ne convainc toujours pas après deux ou
trois essais, c'est qu'il manque un critère, pas un réglage. Chercher lequel —
ou dire franchement que ce geste demande une captation. Un bonhomme vectoriel
lisible vaut mieux qu'un rendu 3D où l'on ne distingue rien : la démonstration
sert à comprendre le mouvement.
