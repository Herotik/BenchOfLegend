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
tous les os.

Le proxy est en **liste blanche** : GitHub, PyPI et `storage.googleapis.com`
passent, aucun hébergeur vidéo ne passe — ni YouTube, ni Vimeo, ni archive.org,
ni même Wikipédia. Vérifié, pas supposé. Deux entrées restent donc ouvertes :
un fichier que l'utilisateur dépose, ou un **relevé** qu'il produit lui-même
avec `scripts/relever-video.py` — un `.npz` d'articulations plus une planche
de vignettes numérotées, quelques centaines de kilo-octets au lieu de la
vidéo. `geste-depuis-video.py` accepte l'un comme l'autre.

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

### 1 bis. Ce qu'un relevé vidéo ne peut pas décrire du tout

**Un geste dont le tronc change d'inclinaison en cours de route.** C'est une
limite du moteur, pas de l'estimateur, et elle se voit à ceci : les directions
sont exprimées dans le repère du corps, donc `Spine` vaut **toujours** l'axe
« haut » de l'assise, et l'assise est une donnée du geste entier. La colonne ne
peut pas se redresser d'une pose clé à la suivante.

Les gestes au sol qui gardent le tronc droit — planches, pompes — s'en tirent :
`aplomb` retrouve la pente par le contact au sol. Un relevé en V, un crunch
inversé, un burpee, non : leur mouvement **est** le décollement du tronc, et
rien ne peut le reconstituer. Le relevé sort un corps à la verticale, et aucun
réglage n'y change quoi que ce soit.

Il faudra une assise **par pose clé** pour ceux-là. Tant que ce n'est pas fait,
ne pas perdre de temps dessus : le contrôle les déclare cohérents et l'audit
les pose proprement au sol. Seul le rendu montre la faute.

### 1 ter. Ce qu'un relevé vidéo ne donne pas

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

  Les autres options disent chacune un fait physique, jamais un réglage :
  `--jambes-tendues` (debout, le genou tombe sur la ligne hanche-cheville ;
  l'estimateur le renvoie deux centimètres en arrière, une hyperextension),
  `--bras-libres` (les bras ne travaillent pas : les rendre au modèle plutôt
  que de copier la garde de boxe de la démonstratrice — la même planche sert
  souvent la version au poids du corps et la version avec haltères),
  `--avant-bras-au-sol` (le coude porte, l'avant-bras repose de tout son long),
  `--bras-au-sol` (le bras entier repose ; on garde de la mesure son
  orientation vue de dessus, on lui retire sa hauteur), `--dans-le-plan` (le
  mouvement se fait de profil, la dérive latérale est du bruit), `--miroir`
  (démontrer des deux côtés un mouvement relevé d'un seul).

  **Toutes se donnent par clé** — `--bras-tendus 2`, `--symetrique 0,1` — et
  c'est indispensable dès qu'un geste montre sa mise en position : à quatre
  pattes les bras sont tendus, en planche sur les avant-bras ils ne le sont
  plus, et une correction posée pour tout le geste décrirait une posture que
  personne ne tient.

### 1 quater. Ne pas demander à l'estimateur ce qu'il ne peut pas voir

C'est la leçon la plus rentable de toutes, et elle a coûté trois tours.

L'entrée en planche avait d'abord été relevée **à plat ventre**, comme dans la
vidéo. Or un corps écrasé au sol est le cas où l'estimateur se trompe le plus :
la profondeur y est presque entièrement devinée, les membres se cachent. Il
plaçait le coude cinquante centimètres au-dessus de l'épaule sur une femme
couchée à plat. Le corps descendait jusqu'à poser ce coude et le buste passait
sous le plancher ; forcer le bras à plat ne faisait que déplacer la faute —
c'était la tête qui s'enfonçait, de treize centimètres.

Le départ **à quatre pattes** sépare les membres, se mesure bien, et c'est de
surcroît la consigne classique. Une image bien choisie vaut mieux que trois
corrections sur une mauvaise.

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

Dans `scripts/gestes_generes.py`, et **par `scripts/poser-geste.py`** plutôt
qu'à la main : le fichier fait plus de mille lignes, les gestes s'y suivent, et
repérer les bornes du bon bloc à l'œil marche deux fois sur trois. La
troisième, on coupe au milieu du geste précédent et l'on obtient une
parenthèse non fermée quatre cents lignes plus haut. L'outil relit et compile
avant d'écrire. Les règles qui coûtent cher quand on les
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

**Un geste qui montre sa mise en position a trois temps** : position de
départ, mise en position, maintien. Les deux premiers viennent des clés, le
troisième d'une **pause** — deux clés identiques à la suite. Sans elle, le
parcours passe autant de temps dans la transition que dans la position tenue,
et un maintien ressemble à un passage. `cles: [A, A, B, B]` donne un sixième de
pause au départ, un sixième de montée, un tiers de maintien.

**La hauteur du corps se donne, ou se déduit, jamais les deux.** Un geste qui
plante des appuis déclare `hauteur` ; les autres laissent `ancrage` poser le
corps au sol. Quand le personnage porte un vêtement long, l'ancrage doit porter
sur les **os** qui portent : `"ancrage": ("RightForeArm", "RightFoot")`, sans
quoi c'est la cape qui touche le sol pendant que les pieds flottent.

### 3. Contrôler sans rien rendre

    python3 scripts/verifier-gestes.py

Sept contrôles instantanés : direction nulle, genou à l'envers, dos rond,
asymétrie non déclarée, assise dégénérée, appui hors de portée ou sous le sol,
pôle qui plie à l'envers. Chacun a été ajouté après une faute réellement
livrée.

Puis, une fois par lot de corrections, l'audit du sol sur **tout** le
catalogue :

    blender -b -noaudio -P scripts/auditer-gestes.py -- <corps.fbx>

Une ligne par geste. Il répond à la seule question qui compte après avoir
touché au moteur — qu'est-ce que ça a cassé, et qu'est-ce que ça n'a pas encore
réparé. Son premier passage a trouvé trois fautes sur des démonstrations
**déjà livrées** : un mountain climber enfoncé de dix-sept centimètres, un
gainage latéral les pieds à cinquante centimètres en l'air, et sa main d'appui
posée sur le chant. Aucune ne se voyait sans dessiner le sol.

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

### 4 ter. Le rythme se mesure sur la vidéo, il ne s'estime pas

    python3 scripts/rythme-video.py <relevé.npz> [--debut N] [--fin N]

Un relevé garde **toutes** les images de la vidéo et sa cadence. Ne prendre que
les deux poses extrêmes jette la durée d'une répétition, les temps d'arrêt, le
fait qu'un genou marque en haut — et c'est souvent là qu'est l'exercice. Les
trois gestes d'une vidéo de cardio avaient été écrits à 700 et 900 ms ; ils
tournent à 417, 751 et 792. Une corde à sauter démontrée à 60 % de sa vitesse
n'est plus une corde à sauter.

L'outil sort la période, les poses clés, et les `pauses` à recopier — la part
du tour passée immobile sur chaque pose. Le moteur répartit le reste **au
prorata du chemin parcouru**, un grand mouvement prenant plus de temps qu'un
petit. Sans `pauses` déclarées, le découpage régulier d'origine est rendu à
l'identique.

Il refuse de répondre quand il n'y a rien à mesurer : une autocorrélation qui
ne fait que décroître dit qu'il n'y a **aucune** période, pas qu'il y en a une
courte. Et il signale un aller-retour dissymétrique — descente lente, remontée
rapide —, que le moteur ne sait pas rendre puisqu'il rejoue ses clés en miroir.

### 5. Rendre, et seulement alors

    blender -b -noaudio -P scripts/rendre-geste.py -- <corps.fbx> <sortie> \
        --geste <nom> --echelle 2.6 --taille 512

`--echelle 2.6` **toujours** : c'est ce qui donne au personnage la même taille
d'un exercice à l'autre.

Choisir la vue selon ce qui doit se voir, pas par habitude. Une élévation
frontale ne se lit pas de face, une latérale pas de profil, un buste penché ni
de l'une ni de l'autre — d'où `trois-quarts`. Un corps à plat ventre, lui, se
lit très bien de profil : toutes les photos de l'exercice sont prises ainsi.

Une **alternance gauche-droite** ne se rend jamais de profil : les deux jambes
s'y superposent et les deux poses deviennent des images en miroir, donc
indiscernables. Montées de genoux, talons-fesses et mountain climber sont tous
passés au trois-quarts pour cette raison.

### 5 bis. Combien d'images, et pourquoi vingt ne suffisent pas toujours

Ce qui décide n'est pas la durée mais le **chemin parcouru par image**. Un
maintien de planche de 3,6 s en vingt images est fluide parce que rien n'y
bouge ; un burpee de 2 s saccade parce que le corps traverse tout le cadre.
`scripts/revue-planches.py` donne ce « saut par image » pour chaque planche :
au-delà de 4, passer à trente-deux.

Et la planche doit être **jouée** au même pas dans les deux sens. Une grille de
quatre colonnes et vingt images avance d'une colonne toutes les `durée / 20`,
donc les colonnes font un tour en `durée × 4 / 20` — et non `durée / 4`, qui
n'est la même chose que sur une planche carrée. L'erreur fait dériver colonnes
et lignes l'une par rapport à l'autre : la planche joue alors ses images dans
le désordre, certaines deux fois, d'autres jamais. Ça se voyait comme un
personnage montant deux fois le genou gauche puis deux fois le droit.

Côté app, le battement se règle sur la planche — une image par battement — et
non sur une cadence fixe. À douze images par seconde, une corde à sauter de
417 ms n'en montrait que cinq sur vingt, et pas les mêmes d'un tour à l'autre.

### 5 ter. Les mains, quand le geste tient quelque chose

La pose de repos du mannequin a les mains **ouvertes**, doigts écartés. C'est
le bon défaut : le personnage ne tient pas l'haltère non plus, et personne ne
s'en plaint. Mais un geste dont les mains **sont** la démonstration — la corde
à sauter, qu'on ne distingue d'un rebond sur place que par la prise — réclame
un poing fermé. `"poings": 1.0` s'en charge.

C'est la seule rotation **locale** du moteur, et c'est justifié : un poing est
un poing quelle que soit l'orientation de la main, alors que tout le reste se
dit en directions du monde parce que la question y est toujours « où pointe ce
membre ». Le repli se fait autour du X local de chaque phalange, dans le sens
positif — mesuré, pas supposé : le bout du doigt passe de +0,3 à +5,7 cm sur la
normale de la paume, le sens opposé l'en éloigne d'autant.

### 6. Porter dans l'app

    python3 scripts/planche-geste.py <dossier> <slug> --sans-recadrage

Puis déclarer la planche dans `mobile/src/donnees/planches.ts` et associer les
exercices dans `mobile/src/donnees/gestes.ts`. Le test de couverture exige que
les 147 exercices aient un geste ; il échouera si l'un est oublié.

    npx vitest run mobile/src/donnees/gestes.test.ts

## Le corps de référence

Le mannequin **nu**, et pas seulement pour juger : c'est le personnage que
l'app montre partout. Un personnage habillé cache les lignes du corps — sur un
geste au sol, la cape se confond avec le dos et l'on ne distingue plus ni les
genoux ni l'alignement.

Une captation Mixamo arrive avec son propre personnage. Il n'y a pas à la
refaire pour autant : les squelettes sont les mêmes d'un personnage Mixamo à
l'autre, et une action ne stocke que des rotations d'os nommés.

    blender ... -- <captation.fbx> <sortie> --corps <X_Bot.fbx>

la rejoue sur le mannequin sans toucher au mouvement. Le contrôle de
compatibilité porte sur les os que l'action **anime**, jamais sur tous ceux du
squelette source : les gréements diffèrent sur des détails — un os d'œil — qui
ne tournent pas et ne concernent pas la démonstration.

Contrôler que rien ne porte encore l'ancien personnage se fait en une passe sur
les planches livrées : chercher les pixels franchement rouges, la robe de
l'hoplite étant la seule teinte saturée du lot. Sept planches écrites avaient
été rendues sur lui et personne ne l'avait vu.

## Quand s'arrêter

Si les chiffres passent et que l'image ne convainc toujours pas après deux ou
trois essais, c'est qu'il manque un critère, pas un réglage. Chercher lequel —
ou dire franchement que ce geste demande une captation. Un bonhomme vectoriel
lisible vaut mieux qu'un rendu 3D où l'on ne distingue rien : la démonstration
sert à comprendre le mouvement.
