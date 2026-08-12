/**
 * Identité Frame of Legends, transposée de `app/globals.css`.
 *
 * Marbre, graphite, porphyre. Le porphyre est la pierre pourpre des empereurs
 * romains : il ne porte que l'identité, jamais la donnée.
 *
 * Deux thèmes au choix de l'utilisateur. Les **couleurs de marque** ne bougent
 * pas d'un thème à l'autre ; seuls les **jetons sémantiques** s'inversent, si
 * bien qu'un écran n'a jamais à savoir dans lequel il se trouve : il lit
 * `c.fond`, et c'est le thème actif qui décide.
 */

/** Couleurs de marque, invariantes. Réservées à la matière, jamais aux états. */
export const MARQUE = {
  marbre: "#f4f4f1",
  veine: "#e9e9e3",
  graphite: "#2a2c2e",
  porphyre: "#6b2e3b",
  porphyreClair: "#b4636f",
  basalte: "#1a1c1e",
  /** Dorure et gaufrage seulement — jamais posé en aplat à l'écran. */
  bronze: "#9c7a4a",
  jade: "#4a7a62",
  jadeClair: "#6fa687",
  ardoise: "#7a7e81",
} as const;

export interface Couleurs {
  /** Fond de page. */
  fond: string;
  /** Fond d'une surface posée sur la page — carte, encart. */
  fond2: string;
  /** Fond d'un élément posé sur une surface — puce, champ. */
  fond3: string;
  texte: string;
  texte2: string;
  texte3: string;
  /** Filet ordinaire. L'identité ne connaît que des traits, jamais d'ombre. */
  filet: string;
  /** Filet appuyé — équerres, séparateurs porteurs. */
  filetFort: string;
  accent: string;
  positif: string;
  /**
   * Un delta négatif s'affiche en ardoise, jamais en rouge : une semaine en
   * creux est une information, pas une faute. La spec interdit de culpabiliser.
   */
  negatif: string;
}

export const CLAIR: Couleurs = {
  fond: MARQUE.marbre,
  fond2: MARQUE.veine,
  fond3: "#deded6",
  texte: MARQUE.graphite,
  texte2: "#63676a",
  texte3: "#8d9194",
  filet: "rgba(42, 44, 46, 0.13)",
  filetFort: "rgba(42, 44, 46, 0.28)",
  accent: MARQUE.porphyre,
  positif: MARQUE.jade,
  negatif: MARQUE.ardoise,
};

export const SOMBRE: Couleurs = {
  fond: MARQUE.basalte,
  fond2: "#232527",
  fond3: "#2e3133",
  texte: MARQUE.marbre,
  texte2: "#9a9ea1",
  texte3: "#74797c",
  filet: "rgba(244, 244, 241, 0.16)",
  filetFort: "rgba(244, 244, 241, 0.34)",
  accent: MARQUE.porphyreClair,
  positif: MARQUE.jadeClair,
  negatif: MARQUE.ardoise,
};

/**
 * Familles de police.
 *
 * Cinzel pour les titres et les chiffres de donnée — une capitale gravée, pas
 * un titre de magazine. Manrope pour le texte courant, qui se lit en petit
 * corps. Les deux sont embarquées par `chargerPolices`, faute de quoi les
 * constantes ci-dessous ne désigneraient rien et le rendu retomberait sur la
 * police système.
 */
export const POLICE_TITRE = "Cinzel_600SemiBold";
export const POLICE_TITRE_MOYEN = "Cinzel_500Medium";
export const POLICE_TEXTE = "Manrope_400Regular";
export const POLICE_TEXTE_MOYEN = "Manrope_500Medium";
export const POLICE_TEXTE_GRAS = "Manrope_700Bold";

/** Interlettrage des intertitres, gravés en capitales. */
export const LETTRAGE_TITRE = 1.6;

/** Opacité d'un élément désactivé, partout la même. */
export const OPACITE_INACTIF = 0.4;
