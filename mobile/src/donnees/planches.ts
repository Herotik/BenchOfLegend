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
  // Gainage planche, relevé sur une vidéo de démonstration plutôt que pris
  // dans une bibliothèque de captation — voir `scripts/geste-depuis-video.py`.
  // C'est un maintien : le personnage tient la position au lieu de répéter un
  // mouvement, ce que la durée longue accompagne.
  planche: {
    source: require("../../assets/gestes/planche.png"),
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
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const plancheDe = (slug: string | null | undefined): Planche | null =>
  (slug ? PLANCHES[slug] : null) ?? null;
