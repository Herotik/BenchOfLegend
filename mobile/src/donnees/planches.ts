import type { ImageSourcePropType } from "react-native";

/**
 * Gestes rendus en 3D, découpés en planches d'images.
 *
 * ## Pourquoi deux façons de montrer un geste
 *
 * Les motifs vectoriels (`motifs.ts`) sont instantanés à écrire, pèsent
 * quelques centaines d'octets et partent par `eas update` — mais ce sont des
 * bonshommes. Un rendu 3D texturé est autrement plus parlant, et c'est ce
 * qu'on veut partout où il existe.
 *
 * Les deux coexistent **exprès**. Les bibliothèques d'animation gratuites
 * couvrent les gestes communs — pompes, squat, curl — et ignorent le kickback
 * triceps ou l'oiseau buste penché, qui n'ont aucun usage en jeu vidéo.
 *
 * Ces manquants-là ne sont plus tous à attendre : `scripts/gestes_generes.py`
 * en écrit une partie directement, en posant le squelette du personnage. Ça
 * marche pour les gestes où une seule articulation travaille pendant que le
 * corps tient debout, c'est-à-dire justement ceux que personne ne capte. Ça ne
 * marche pas pour un corps entier qui bascule — burpee, traction — ni pour les
 * gestes de trop faible amplitude, qui restent au bonhomme vectoriel.
 *
 * D'où la règle : **une planche si elle existe, le motif vectoriel sinon.**
 * Aucun exercice ne se retrouve sans démonstration en attendant, et remplacer
 * un bonhomme par un rendu ne demande qu'une ligne ici — rien à toucher dans
 * les écrans.
 *
 * ## Fabriquer une planche
 *
 *     python scripts/planche-geste.py <dossier-des-rendus> <slug>
 *
 * Le script recadre, met au carré, assemble en grille et affiche la ligne à
 * coller ci-dessous.
 *
 * ## Ce que le rendu doit respecter
 *
 *  · **Fond transparent.** Un fond opaque, même blanc, se voit comme un
 *    rectangle sur le thème sombre.
 *  · **De profil, tourné vers la droite** — comme les motifs vectoriels, pour
 *    qu'un exercice ne change pas d'orientation selon qu'il est rendu ou
 *    dessiné. Les gestes symétriques (jumping jacks) se rendent de face.
 *  · **Une répétition entière et bouclable** : la dernière image doit enchaîner
 *    sur la première sans saut.
 *  · **Cadrage constant** d'un geste à l'autre : le personnage ne doit pas
 *    changer de taille quand on passe d'un exercice au suivant.
 *  · **Le même personnage partout** — le mannequin nu. Les captations Mixamo
 *    arrivent chacune avec le sien, en l'occurrence un hoplite en robe rouge,
 *    et l'app en venait à mélanger un chevalier pour les pompes et un
 *    mannequin pour les planches dans la même séance. Rien n'oblige à
 *    refaire les captations pour autant : les squelettes sont les mêmes d'un
 *    personnage Mixamo à l'autre, et `rendre-geste.py --corps <fbx>` rejoue
 *    l'animation sur le corps voulu sans toucher au mouvement.
 */

export interface Planche {
  source: ImageSourcePropType;
  /**
   * Nombre d'images dans la planche.
   *
   * Vingt suffisent tant que le corps se déplace peu d'une image à l'autre. Ce
   * qui décide n'est pas la durée mais le **chemin parcouru par image** : un
   * maintien de planche de 3,6 s en vingt images est fluide parce que rien n'y
   * bouge, alors qu'un burpee de 2 s en vingt images saccade parce que le
   * corps y traverse tout le cadre. Les gestes de grande amplitude — squat,
   * squat barre, squat sauté, fente, planche jambes alternées, corde à sauter
   * — en ont donc trente-deux, et le burpee soixante-quatre.
   *
   * `scripts/verifier-planches.py` mesure ce saut par image et refuse au-delà
   * de 4,2 : c'est la valeur qui sépare les planches livrées jugées fluides de
   * celles qu'il a fallu re-rendre.
   */
  images: number;
  /** Images par ligne. `scripts/planche-geste.py` en pose quatre. */
  colonnes: number;
  /**
   * Millisecondes pour une répétition entière. Par défaut 1400.
   *
   * À **mesurer**, pas à estimer. Les gestes relevés en vidéo portent la
   * cadence que `scripts/rythme-video.py` a lue sur la vidéo entière, et non
   * un chiffre rond choisi à l'œil : les trois gestes de la vidéo de cardio
   * avaient été livrés à 700 et 900 ms alors qu'ils tournent à 417, 751 et
   * 792. Une corde à sauter démontrée à 60 % de sa vitesse n'est plus une
   * corde à sauter.
   */
  duree?: number;
}

/**
 * Gestes déjà rendus. Les autres tombent sur le motif vectoriel, ce qui est le
 * repli voulu et non une panne.
 *
 * Tous rendus avec `--echelle 2.6` : **garder cette valeur** pour les suivants,
 * faute de quoi le personnage changerait de taille d'un exercice à l'autre.
 */
/*
 * `require` et non `import` : le bundler React Native doit connaître le chemin
 * de l'image à la compilation, une chaîne calculée ne se résoudrait pas. La
 * règle est donc neutralisée ici plutôt que sur chaque ligne — le registre
 * comptera une entrée par geste, et le nombre d'avertissements ne doit pas
 * croître avec le contenu.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export const PLANCHES: Record<string, Planche> = {
  // Pompes
  pompe: {
    source: require("../../assets/gestes/pompe.png"),
    images: 20,
    colonnes: 4,
  },
  // Squat au poids du corps
  squat: {
    source: require("../../assets/gestes/squat.png"),
    images: 32,
    colonnes: 4,
  },
  // Squat barre, mains aux épaules
  "squat-barre": {
    source: require("../../assets/gestes/squat-barre.png"),
    images: 32,
    colonnes: 4,
  },
  // Curl biceps. Deux mille quatre cents millisecondes : à la cadence par
  // défaut le geste passait en 1,4 s, ce qui est un lancer et non une flexion
  // contrôlée — exactement ce qu'une démonstration ne doit pas montrer.
  curl: {
    source: require("../../assets/gestes/curl.png"),
    images: 20,
    colonnes: 4,
    duree: 2400,
  },
  // Crunchs
  crunch: {
    source: require("../../assets/gestes/crunch.png"),
    images: 20,
    colonnes: 4,
  },
  // Crunchs vélo, jambes alternées
  "crunch-velo": {
    source: require("../../assets/gestes/crunch-velo.png"),
    images: 20,
    colonnes: 4,
  },
  // Les deux planches, relevées sur une même vidéo de démonstration plutôt que
  // prises dans une bibliothèque de captation — voir
  // `scripts/geste-depuis-video.py`.
  //
  // Elles **montrent la mise en position**, et pas seulement la position
  // tenue : le personnage part à quatre pattes et se hisse. C'est la moitié de
  // ce qu'un débutant a besoin de voir, et c'est ce que la seule pose finale
  // laissait deviner. Chacune a donc trois temps — position de départ, mise en
  // position, maintien — et les poses clés sont doublées aux extrémités, deux
  // clés identiques faisant une pause.
  "planche-basse": {
    source: require("../../assets/gestes/planche-basse.png"),
    images: 20,
    colonnes: 4,
    duree: 3600,
  },
  "planche-haute": {
    source: require("../../assets/gestes/planche-haute.png"),
    images: 20,
    colonnes: 4,
    duree: 3600,
  },
  // Trente-deux images et non vingt : celle-ci enchaîne deux élévations, une
  // par jambe, là où les deux autres ne montrent qu'une mise en position.
  "planche-jambes-alternees": {
    source: require("../../assets/gestes/planche-jambes-alternees.png"),
    images: 32,
    colonnes: 4,
    duree: 4400,
  },
  // Fente avant, relevée sur une vidéo de démonstration. Elle sert les fentes
  // au poids du corps **et** les fentes haltères : le personnage ne porte
  // aucune charge, et les deux exercices ont le même mouvement.
  //
  // C'est la planche qui se déplace le plus du registre — le pied arrière
  // reste planté et le corps avance de soixante-huit centimètres au-dessus de
  // lui. Sans ce clou, les deux pieds s'écartaient autour d'un bassin
  // immobile : un grand écart, pas un pas.
  //
  // Quarante-huit images, en vignettes de 192 px. Le passage de cinq clés
  // doublées à trois clés avec temps d'arrêt déclarés a **révélé** un saut
  // par image de 4,4 : les quatorze images figées d'avant tiraient la
  // moyenne vers le bas et cachaient un geste qui, une fois en mouvement,
  // traversait le cadre trop vite.
  //
  // Un défaut connu subsiste : au point bas, le pied arrière ne touche pas
  // tout à fait le sol. Il est occulté par le corps dans la vidéo, et
  // l'estimateur le renvoie orteils vers l'arrière, pointant dans le vide. La
  // correction propre demande que la cinématique inverse puisse poser une
  // cheville sans figer la hauteur du bassin.
  fente: {
    source: require("../../assets/gestes/fente.png"),
    images: 64,
    colonnes: 4,
    duree: 3087,
  },
  // Soixante-quatre images, le maximum du registre, et des vignettes de 192 px
  // plutôt que 256 pour que la planche tienne en 768 × 3072 — au-delà, on
  // s'approche de la taille de texture que certains téléphones refusent.
  //
  // Le burpee est le geste qui parcourt le plus de chemin : debout, à plat
  // ventre, et retour, en deux secondes. Il saccadait encore à quarante-huit
  // images. Ce n'est pas la durée qui le veut mais l'amplitude — le ralentir
  // n'aurait fait que strober les mêmes sauts moins souvent.
  burpee: {
    source: require("../../assets/gestes/burpee.png"),
    images: 64,
    colonnes: 4,
    duree: 2000,
  },

  // --- Gestes écrits plutôt que captés -----------------------------------
  //
  // Ceux-ci ne viennent d'aucune bibliothèque : ils sont décrits dans
  // `scripts/gestes_generes.py` et posés sur le squelette du personnage. C'est
  // ce qui permet d'avoir un rendu 3D pour des mouvements que personne n'a
  // captés, faute d'usage hors d'une salle de sport.
  //
  // Ils sont plus lents que les gestes captés — une élévation latérale se fait
  // en contrôlant la charge, pas en la lançant, et la démonstration doit le
  // montrer.
  "elevations-laterales": {
    source: require("../../assets/gestes/elevations-laterales.png"),
    images: 20,
    colonnes: 4,
    duree: 2000,
  },
  "elevations-frontales": {
    source: require("../../assets/gestes/elevations-frontales.png"),
    images: 20,
    colonnes: 4,
    duree: 2000,
  },
  "developpe-militaire": {
    source: require("../../assets/gestes/developpe-militaire.png"),
    images: 20,
    colonnes: 4,
    duree: 2200,
  },
  "extension-triceps": {
    source: require("../../assets/gestes/extension-triceps.png"),
    images: 20,
    colonnes: 4,
    duree: 2000,
  },
  "kickback-triceps": {
    source: require("../../assets/gestes/kickback-triceps.png"),
    images: 20,
    colonnes: 4,
    duree: 1800,
  },
  oiseau: {
    source: require("../../assets/gestes/oiseau.png"),
    images: 20,
    colonnes: 4,
    duree: 2200,
  },
  rowing: {
    source: require("../../assets/gestes/rowing.png"),
    images: 20,
    colonnes: 4,
    duree: 2000,
  },
  // Ces deux-là étaient écrits et contrôlés depuis longtemps ; il ne leur
  // manquait qu'un rendu. Cinq gestes dans ce cas dormaient dans
  // `gestes_generes.py` — c'est la couverture la moins chère du catalogue.
  "developpe-couche": {
    source: require("../../assets/gestes/developpe-couche.png"),
    images: 20,
    colonnes: 4,
    duree: 2200,
  },
  mollets: {
    source: require("../../assets/gestes/mollets.png"),
    images: 20,
    colonnes: 4,
    duree: 1400,
  },
  // La variante unipodale, qui est la progression du mollet debout : le même
  // geste sur une seule cheville, l'autre jambe repliée en arrière. Elle a sa
  // planche à elle plutôt que de partager celle du mollet à deux jambes, parce
  // que c'est exactement ce qui change entre les deux exercices.
  "mollets-une-jambe": {
    source: require("../../assets/gestes/mollets-une-jambe.png"),
    images: 20,
    colonnes: 4,
    duree: 1600,
  },
  // Squat sauté. **Écrit** et non capté, contrairement à ce qui était livré
  // ici sous le nom `saut` : la captation Mixamo était un saut de personnage
  // de jeu vidéo — élan, genoux ramenés, réception souple — et non l'exercice,
  // qui part du squat et n'ajoute que l'extension.
  "squat-saute": {
    source: require("../../assets/gestes/squat-saute.png"),
    images: 48,
    colonnes: 4,
    duree: 2200,
  },
  // Deux gestes de cardio tirés d'une même vidéo, qui en contenait trois.
  //
  // Tous deux de **trois-quarts** : ce sont des alternances gauche-droite, et
  // de profil les deux jambes se superposent au point que le personnage
  // paraît immobile. C'est la seule vue qui montre le mouvement.
  "montee-genoux": {
    source: require("../../assets/gestes/montee-genoux.png"),
    images: 32,
    colonnes: 4,
    duree: 751,
  },
  "talons-fesses": {
    source: require("../../assets/gestes/talons-fesses.png"),
    images: 32,
    colonnes: 4,
    duree: 792,
  },
  // Troisième geste de la même vidéo, et le seul qu'on croyait impossible : la
  // démonstratrice y **mime** le mouvement sans corde. Le personnage n'en tient
  // pas davantage — l'agrès qu'on tenait pour rédhibitoire n'en était pas un.
  //
  // De face : c'est là que la position des avant-bras se lit, et elle est le
  // seul signe qui distingue ce geste d'un simple rebond. De profil ils se
  // cachent l'un l'autre.
  "corde-a-sauter": {
    source: require("../../assets/gestes/corde-a-sauter.png"),
    images: 32,
    colonnes: 4,
    duree: 417,
  },
  // De trois-quarts, et c'est la seule du registre : de profil, un corps couché
  // sur le côté est regardé dans l'axe de son regard et l'on ne voit plus de
  // quel côté il est tourné.
  "gainage-lateral": {
    source: require("../../assets/gestes/gainage-lateral.png"),
    images: 20,
    colonnes: 4,
    duree: 2600,
  },
  // Mille quatre cents millisecondes, et non huit cents. Le geste n'est pas un
  // ciseau continu : la vidéo montre quatre temps — genou ramené, temps
  // d'arrêt, retour en planche, autre genou. Cinq poses clés le disent, dont
  // la planche pleine qui manquait ; un quart du tour se passe immobile de
  // chaque côté. Joué en huit cents millisecondes, tout cela s'effaçait.
  // Les croisés ont leur planche à eux : le genou y traverse l'axe du corps
  // pour aller chercher le coude opposé, ce que la version droite ne montre
  // pas. Ils partageaient jusqu'ici la même démonstration — deux exercices du
  // catalogue, et celle qui montrait l'autre mouvement.
  "mountain-climber-croise": {
    source: require("../../assets/gestes/mountain-climber-croise.png"),
    images: 20,
    colonnes: 4,
    duree: 1400,
  },
  "mountain-climber": {
    source: require("../../assets/gestes/mountain-climber.png"),
    images: 20,
    colonnes: 4,
    duree: 1400,
  },
  // Quatre gestes relevés sur des vidéos fournies, qui ouvrent le dos et les
  // abdominaux — les deux catégories les moins couvertes du catalogue.
  //
  // Trois mille cent trente millisecondes mesurées de crête à crête, trois
  // fois de suite au même compte. C'est lent, et c'est l'exercice : on monte,
  // on tient, on redescend sans lâcher. Vingt images suffisent, rien n'y
  // traverse le cadre.
  superman: {
    source: require("../../assets/gestes/superman.png"),
    images: 20,
    colonnes: 4,
    duree: 3130,
  },
  // Le premier geste du catalogue dont le tronc change d'inclinaison en cours
  // de route — ce qui était noté comme impossible et ne l'était pas.
  "releve-en-v": {
    source: require("../../assets/gestes/releve-en-v.png"),
    images: 32,
    colonnes: 4,
    duree: 3220,
  },
  // De trois-quarts : la rotation se fait dans la largeur et disparaît de
  // profil, l'inclinaison du buste disparaît de face.
  "russian-twist": {
    source: require("../../assets/gestes/russian-twist.png"),
    images: 32,
    colonnes: 4,
    duree: 1750,
  },
  // Le seul du lot dont la vidéo n'a rien donné — elle montre deux personnes
  // et l'estimateur a suivi le coach. La posture vient de la géométrie : les
  // talons au sol, les mains sur la barre, le corps droit.
  "rowing-inverse": {
    source: require("../../assets/gestes/rowing-inverse.png"),
    images: 20,
    colonnes: 4,
    duree: 2400,
  },

  // Les trois gestes pendus à la barre. Ils partagent leur position de départ
  // et leur agrès ; ce qui les sépare tient à une clé.
  //
  // Sept exercices étaient rangés derrière un obstacle « suspension » qui
  // n'existait pas : `ancrage: False` laisse le corps quitter le sol depuis le
  // saut squaté, et la barre était déjà dessinée pour le rowing inversé.
  "suspension": {
    source: require("../../assets/gestes/suspension.png"),
    images: 20,
    colonnes: 4,
    duree: 3000,
  },
  "traction": {
    source: require("../../assets/gestes/traction.png"),
    images: 32,
    colonnes: 4,
    duree: 2600,
  },
  // De trois-quarts : de profil, les deux montants de la barre tombent pile
  // sur le corps et lui plantent un poteau du crâne aux pieds.
  "releve-jambes-suspendu": {
    source: require("../../assets/gestes/releve-jambes-suspendu.png"),
    images: 32,
    colonnes: 4,
    duree: 2800,
  },
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const plancheDe = (slug: string | null | undefined): Planche | null =>
  (slug ? PLANCHES[slug] : null) ?? null;
