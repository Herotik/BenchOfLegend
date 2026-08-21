# Refaire une démonstration 3D sur sa machine

Ce que le dépôt ne contient pas, et qu'il faut avoir en local pour rendre un
geste. Rien de tout cela n'est versionné : ce sont des dizaines de mégaoctets
de modèles et de vidéos qui ne changent jamais, et qu'un `git clone` n'a aucune
raison de trimballer.

## Les outils

    apt install blender                 # 4.0 suffit ; le rendu est en EEVEE
    pip install pillow numpy            # planches et mesures
    pip install opencv-python-headless mediapipe   # relevés vidéo seulement

Blender tourne **sans interface** : tous les scripts s'appellent
`blender -b -noaudio -P <script>.py -- <arguments>`.

## Les modèles

Téléchargés sur [mixamo.com](https://www.mixamo.com), gratuitement, en FBX
binaire. Deux catégories :

- **Le corps.** `X Bot` — le mannequin nu. C'est le personnage de toutes les
  démonstrations, et le seul qui doit apparaître dans l'app.
- **Les captations.** `Push Up`, `Air Squat`, `Back Squat`, `Bicep Curl`,
  `Circle Crunch`, `Bicycle Crunch`, `Burpee`. Chacune arrive habillée d'un
  personnage qui n'est pas le nôtre ; `rendre-geste.py --corps` rejoue leur
  mouvement sur le mannequin, ce qui règle la question sans refaire la
  captation.

Un chemin quelconque suffit. Les scripts prennent le fichier en argument :

    blender -b -noaudio -P scripts/rendre-geste.py -- \
        ~/mixamo/X_Bot.fbx /tmp/rendu --geste squat-saute \
        --echelle 2.6 --taille 256 --images 32

## Les vidéos et leurs relevés

Les gestes marqués « relevé sur vidéo » viennent de vidéos de démonstration
trouvées en ligne. Elles ne sont pas redistribuables et ne servent qu'une fois :
`relever-video.py` en extrait un `.npz` de positions d'articulations, et c'est
ce relevé qu'on interroge ensuite.

    python3 scripts/relever-video.py <video.mp4> <slug>     # → <slug>.npz
    python3 scripts/rythme-video.py  <slug>.npz             # cadence et arrêts
    python3 scripts/geste-depuis-video.py <slug>.npz <geste> --images 340,894 …

Sans relevé sous la main, rien n'est perdu : les gestes déjà écrits dans
`gestes_generes.py` se rendent sans vidéo. Le relevé ne sert qu'à en écrire de
nouveaux.

## L'enchaînement, du geste à l'app

    python3 scripts/verifier-gestes.py                  # postures, sans Blender
    blender -b -noaudio -P scripts/auditer-gestes.py -- <X_Bot.fbx>
    blender -b -noaudio -P scripts/rendre-geste.py  -- <X_Bot.fbx> <sortie> --geste <nom> …
    python3 scripts/planche-geste.py <sortie> <slug> --taille 256 --images N --sans-recadrage
    python3 scripts/verifier-planches.py                # les fichiers livrés
    python3 scripts/revue-planches.py --sortie revue.html

Les deux `verifier-*` tournent avec un Python ordinaire et en une seconde :
c'est là qu'il faut regarder avant de lancer un rendu, qui prend des minutes.

## Combien d'images

Ce qui décide n'est pas la durée mais le **chemin parcouru par image**.
`verifier-planches.py` le mesure et refuse au-delà de 4,2 en moyenne. Vingt
suffisent pour un maintien, trente-deux pour un squat, quarante-huit pour un
saut squaté, soixante-quatre pour une fente ou un burpee.

La moyenne cache, et il faut regarder la seconde colonne — le **pire** pas du
tour. Une fente livrée affichait 3,2 de moyenne, donc bonne, en restant sept
images figées au point bas puis en bondissant de 7,3. Le script montre ce
nombre sans refuser dessus : un arrêt voulu et un hachage ont le même profil, et
seul l'œil sait si l'arrêt appartient à l'exercice.

## Trois choses que le moteur sait faire et qu'on oublie

- **`rebond`** — le va-et-vient vertical d'une foulée, deux fois par tour. Sans
  lui, un geste à hauteur de bassin déclarée court en apesanteur. Le relevé
  donne la phase, qui n'est pas celle qu'on croit : le bassin est au plus
  **bas** quand le genou est au plus haut.
- **Les déplacements comptent dans le rythme.** `_horaire` ajoute au chemin d'un
  segment ce que le corps y translate. Sans cela, un saut de soixante
  centimètres ne fait tourner aucune articulation et ne reçoit qu'une image sur
  trente-deux.
- **Une planche se déduit, elle ne se choisit pas.** Le bras y est vertical —
  93° du sol, mesuré —, donc la hauteur du bassin découle de la longueur du
  bras. Voir `HAUTEUR_PLANCHE`.

## Ce qui reste ouvert

- **Une assise par pose clé.** Les directions s'expriment dans le repère du
  corps, fixé une fois pour tout le geste : la colonne ne peut donc pas changer
  d'inclinaison d'une clé à l'autre. Onze exercices attendent ça — relevé en V,
  pont fessier, crunch inversé, russian twist.
- **La suspension.** Rien ne tient un corps qui pend à une barre ; le moteur
  pose toujours le personnage au sol. Sept exercices.
- **Le tapis roulant.** Le sol défile sous les pieds, et une boucle de vingt
  images ne peut pas le dire. Quatre exercices.
- **Le pied arrière de la fente**, au point bas, ne touche pas tout à fait le
  sol. Il est occulté dans la vidéo et l'estimateur le renvoie dans le vide.
- **Une assise par pose clé manque aussi aux grimpeurs.** La planche est écrite
  avec un tronc à douze degrés, fixe pour tout le geste ; un pratiquant qui
  ramène le genou creuse un peu plus les hanches, et cela ne se dit pas.
- **Deux planches ne servent aucun exercice** : `crunch-velo` et
  `planche-jambes-alternees`. La page de revue les signale.
