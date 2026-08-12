import type { ImageSourcePropType } from "react-native";

/**
 * Écussons de rang, copiés de `public/ranks/` à la racine du dépôt.
 *
 * Ce fichier ne contient **aucune règle métier** : ni nom, ni couleur, ni seuil
 * de Δ — tout cela vient de `GET /api/v1/referentiel` et de `GET /api/v1/me`.
 * Il ne fait qu'associer un slug à un fichier embarqué, ce que `require` impose
 * de faire avec un chemin littéral : le bundler doit connaître les images à
 * l'avance, une chaîne calculée ne se résoudrait pas.
 */
const ECUSSONS: Record<string, ImageSourcePropType> = {
  hoplite: require("../../assets/rangs/hoplite.png"),
  myrmidon: require("../../assets/rangs/myrmidon.png"),
  spartiate: require("../../assets/rangs/spartiate.png"),
  heracles: require("../../assets/rangs/heracles.png"),
  elyseen: require("../../assets/rangs/elyseen.png"),
  titan: require("../../assets/rangs/titan.png"),
  "demi-dieu": require("../../assets/rangs/demi-dieu.png"),
  "dieu-olympe": require("../../assets/rangs/dieu-olympe.png"),
};

/**
 * Écusson d'un rang, ou `null` si le serveur en annonce un que cette version de
 * l'app ne connaît pas encore — un rang ajouté après publication, par exemple.
 * L'appelant affiche alors un cartouche sobre plutôt qu'une image cassée.
 */
export const ecussonDuRang = (slug: string): ImageSourcePropType | null =>
  ECUSSONS[slug] ?? null;
