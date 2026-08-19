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
 * triceps ou l'oiseau buste penché, qui n'ont aucun usage en jeu vidéo. Chaque
 * geste manquant devra donc être animé à la main, un par un, sur des mois.
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
 * Aucune planche pour l'instant : les rendus 3D restent à produire.
 *
 * Tant que ce registre est vide, tous les gestes s'affichent en vectoriel —
 * ce qui est exactement le repli voulu, pas une panne.
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
  pompe: {
    source: require("../../assets/gestes/pompe.png"),
    images: 20,
    colonnes: 4,
  },
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const plancheDe = (slug: string | null | undefined): Planche | null =>
  (slug ? PLANCHES[slug] : null) ?? null;
