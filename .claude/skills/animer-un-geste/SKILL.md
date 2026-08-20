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

## Deux points de départ

**Une vidéo, quand on en a une.** C'est de loin le meilleur : elle contient
déjà la réponse, et `scripts/geste-depuis-video.py` en tire les directions de
tous les os. YouTube ne passe pas le proxy, mais un fichier fourni par
l'utilisateur, si.

    pip install opencv-python-headless mediapipe
    curl -o /tmp/pg/pose_landmarker.task https://storage.googleapis.com/\
mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/\
pose_landmarker_full.task
    python3 scripts/geste-depuis-video.py <video> <geste> \
        --images 504,528 --assise ventre

Repérer les bonnes images d'abord — une vidéo de démonstration passe la moitié
de son temps sur des plans de coupe et des postures de transition.

**Une description écrite, sinon.** Les pages de forme suffisent largement :
elles disent « mains directement sous les épaules », « ligne droite de la tête
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
pas l'impression que donne le rendu. Un relevé vidéo ne dispense **pas** de
cette étape : il donne la forme, pas le jugement sur elle.

### 1 bis. Ce qu'un relevé vidéo ne donne pas

Trois choses manquent systématiquement, et chacune a livré une faute :

- **La pente par rapport au sol.** L'estimateur replie le corps dans ses
  propres axes ; l'inclinaison se perd. La verticale de l'image la rend en
  partie, une caméra qui plonge la fausse. C'est le sol qui tranche : déclarer
  `"ancrage"` sur les os qui portent et `"aplomb": True`, et le corps se
  redresse jusqu'à ce que ses appuis soient de niveau.
- **Les proportions.** Elles ne sont pas celles du personnage. Encore une
  raison de contraindre par le sol plutôt que de recopier des angles.
- **Ce qui n'est pas dans le squelette de l'estimateur.** Il n'a ni poignet
  orienté ni omoplate. La main se relève avec l'index (`INDEX`), la tête avec
  les **oreilles** — s'en remettre au nez enfonce le menton dans la poitrine.

- **La profondeur.** Les deux premières coordonnées se lisent sur les pixels,
  la troisième s'infère et se trompe. Un sujet filmé de trois quarts a son
  écartement de bras en partie dans cette profondeur. Trois options rendent au
  relevé ce que la mesure ne sait pas donner, et chacune dit une hypothèse :
  `--bras-tendus` (les bras porteurs descendent à la verticale, main à plat),
  `--pieds-sur-pointes` (les deux pieds sous la cheville), `--symetrique`
  (gauche et droite en miroir exact, colonne dans le plan sagittal).

  `--symetrique` mérite qu'on insiste : quatre appuis ne peuvent pas être remis
  de niveau par une rotation si le corps est vrillé — trois points définissent
  un plan, le quatrième n'y tombe que si la posture le veut. Cinq degrés de
  torsion dans les cuisses suffisaient à laisser une main et un pied à cinq
  millimètres du sol, en diagonale. Et une fois le geste symétrisé, on peut
  retirer `symetrique: False` : le contrôle devient une garantie.

### 1 ter. Ce qui touche le sol est la chair, pas l'os

L'os de la main passe au milieu de la paume : le poser à zéro enfonce la main
de trois centimètres dans le plancher. `contacts()` mesure les sommets du
maillage que chaque os d'appui emporte — lui et sa descendance, la main avec
ses doigts, le pied avec ses orteils.

Et une main **posée** n'est pas encore une main **à plat** : la direction des
doigts ne dit rien du roulis, et une paume peut regarder de côté ou le
plafond. D'où `APlat(direction, paume)`. Le sens de la paume se tranche par le
**pouce**, jamais par un signe supposé : main droite à plat sur une table,
doigts vers le nord, le pouce pointe à l'ouest — donc la normale vaut
`pouce × doigts` à droite et `doigts × pouce` à gauche. Le signe posé au
jugé s'est révélé inversé, et les deux mains étaient à plat… dos au sol.

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

Deux contrôles méritent une mention. Le **regard** départage une planche d'un
corps couché sur le dos, ce que l'image seule laisse ambigu et ce qui a coûté
plusieurs tours. Les **appuis**, eux, se lisent en premier sur un geste au sol :
si un os déclaré porteur flotte, la posture est fausse quoi que disent les
autres mesures.

### 4 bis. Matérialiser le sol pour juger à l'œil

    blender -b -noaudio -P scripts/rendre-geste.py -- <corps.fbx> <sortie> \
        --geste <nom> --echelle 2.4 --images 1 --sol

Sur fond blanc, une main posée et une main flottant à trois centimètres sont
indiscernables : c'est ce qui a laissé passer des chevilles en l'air, puis des
mains enfoncées dans le plancher. `--sol` pose un plancher, fait plonger la
caméra de quatorze degrés — sans quoi le plan est vu par la tranche — et
n'allume qu'une source, à l'opposé de l'objectif, pour que l'ombre tombe du
côté où on la voit.

Un détail qui a coûté quatre essais : la carte d'ombre d'un soleil s'étale par
défaut sur deux cents mètres, où l'ombre d'une main tient dans moins d'un
pixel. `shadow_cascade_max_distance` la ramène à la taille du sujet.

Ce mode ne sert **qu'au contrôle** : la vignette de l'app est détourée, un
plancher la fermerait.

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
