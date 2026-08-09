import { Platform } from "react-native";

/**
 * Palette « hextech », reprise telle quelle de `app/globals.css` à la racine du
 * dépôt.
 *
 * L'app native et le web partagent les mêmes écussons — des PNG détourés sur
 * fond noir — donc la même obligation : sombre en permanence, jamais de
 * variante claire qui les entourerait d'un halo gris.
 */
export const COULEURS = {
  /* Fonds, du plus profond au plus clair */
  nuit950: "#05080d",
  nuit900: "#0a0f17",
  nuit850: "#0e141e",
  nuit800: "#131b27",
  nuit700: "#1c2634",
  nuit600: "#2a3648",

  /* Or hextech — accent principal, promotions, LP */
  or600: "#a58a4e",
  or500: "#c8aa6e",
  or400: "#dcc38d",

  /* Bleu hextech — accent secondaire, liens, focus */
  hextech600: "#0a8f8a",
  hextech500: "#0ac8b9",
  hextech400: "#4fe0d4",

  /* Texte */
  ivoire: "#e8eaee",
  brume: "#98a1b0",
  cendre: "#5f6a7a",

  /* États — le rouge reste discret : la spec interdit de culpabiliser */
  succes: "#4ba368",
  manque: "#8a5560",
} as const;

/**
 * Sérif des grands titres.
 *
 * Le web utilise Cinzel ; l'embarquer coûterait un fichier de police et un
 * chargement asynchrone pour un gain purement décoratif. On prend la sérif
 * système la plus proche — les capitales et l'interlettrage font le reste.
 */
export const POLICE_TITRE = Platform.select({
  ios: "Didot",
  android: "serif",
  default: "serif",
});

/** Opacité d'un élément désactivé, partout la même. */
export const OPACITE_INACTIF = 0.4;
