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
 */

export interface Planche {
  source: ImageSourcePropType;
  /** Nombre d'images dans la planche. */
  images: number;
  /** Images par ligne. `scripts/planche-geste.py` en pose quatre. */
  colonnes: number;
  /** Millisecondes pour une répétition entière. Par défaut 1400. */
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
    images: 20,
    colonnes: 4,
  },
  // Squat barre, mains aux épaules
  "squat-barre": {
    source: require("../../assets/gestes/squat-barre.png"),
    images: 20,
    colonnes: 4,
  },
  // Curl biceps
  curl: {
    source: require("../../assets/gestes/curl.png"),
    images: 20,
    colonnes: 4,
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
  // Vingt-quatre images et non vingt : celle-ci enchaîne deux élévations, une
  // par jambe, là où les deux autres ne montrent qu'une mise en position.
  "planche-jambes-alternees": {
    source: require("../../assets/gestes/planche-jambes-alternees.png"),
    images: 24,
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
  // Un défaut connu subsiste : au point bas, le pied arrière ne touche pas
  // tout à fait le sol. Il est occulté par le corps dans la vidéo, et
  // l'estimateur le renvoie orteils vers l'arrière, pointant dans le vide. La
  // correction propre demande que la cinématique inverse puisse poser une
  // cheville sans figer la hauteur du bassin.
  fente: {
    source: require("../../assets/gestes/fente.png"),
    images: 20,
    colonnes: 4,
    duree: 3000,
  },
  // Burpee
  burpee: {
    source: require("../../assets/gestes/burpee.png"),
    images: 20,
    colonnes: 4,
    duree: 2000,
  },
  // Saut vertical
  saut: {
    source: require("../../assets/gestes/saut.png"),
    images: 20,
    colonnes: 4,
    duree: 1100,
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
  // Deux gestes de cardio tirés d'une même vidéo, qui en contenait trois.
  //
  // Tous deux de **trois-quarts** : ce sont des alternances gauche-droite, et
  // de profil les deux jambes se superposent au point que le personnage
  // paraît immobile. C'est la seule vue qui montre le mouvement.
  "montee-genoux": {
    source: require("../../assets/gestes/montee-genoux.png"),
    images: 20,
    colonnes: 4,
    duree: 900,
  },
  "talons-fesses": {
    source: require("../../assets/gestes/talons-fesses.png"),
    images: 20,
    colonnes: 4,
    duree: 900,
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
  // Huit cents millisecondes : c'est un geste **rapide**, et la démonstration
  // doit le dire. Deux poses seulement, genou droit puis genou gauche, ce qui
  // fait un grand pas d'une image à l'autre — la boucle se referme donc moins
  // finement que sur les gestes lents, et c'est le rythme qui le veut.
  "mountain-climber": {
    source: require("../../assets/gestes/mountain-climber.png"),
    images: 20,
    colonnes: 4,
    duree: 800,
  },
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const plancheDe = (slug: string | null | undefined): Planche | null =>
  (slug ? PLANCHES[slug] : null) ?? null;
