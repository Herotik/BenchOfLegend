/**
 * Les 8 rangs de Frame of Legends.
 *
 * Les écussons sont des médaillons gravés, normalisés par
 * `scripts/normaliser-ecussons.py` depuis `docs/ecussons-source/` vers
 * `public/ranks/` — même diamètre et même cadrage, faute de quoi l'image
 * semblerait « respirer » à chaque promotion.
 *
 * Les six premiers paliers reprennent la progression métallique classique
 * (fer → diamant) mais sont nommés d'après la mythologie grecque, pour rester
 * cohérents avec les deux derniers rangs : on monte du simple fantassin
 * jusqu'à l'Olympe.
 */

export type RankSlug =
  | "hoplite"
  | "myrmidon"
  | "spartiate"
  | "heracles"
  | "elyseen"
  | "titan"
  | "demi-dieu"
  | "dieu-olympe";

export interface Rank {
  slug: RankSlug;
  /** Palier métallique correspondant, conservé pour référence visuelle. */
  metal: string;
  /** Nom affiché du rang. */
  name: string;
  /** Sous-titre : le statut du joueur à ce rang. */
  subtitle: string;
  /** Phrase de progression, affichée sur l'écusson du dashboard. */
  description: string;
  /** D'où vient l'imagerie de l'écusson — sert aussi d'infobulle. */
  lore: string;
  /**
   * Couleur d'accompagnement en thème clair — titre du rang, barre de
   * progression, équerres. Reprise de la **matière de l'écusson** : fer,
   * bronze, argent, or, jade, améthyste, braise, foudre. L'échelle se lit
   * ainsi à la couleur avant même qu'on distingue le motif, ce qui est le
   * seul repère qui tienne à 48 pixels.
   */
  color: string;
  /**
   * Même matière, éclaircie pour le thème sombre. Le fer et le basalte
   * disparaîtraient sinon dans le fond, et l'or y perdrait son éclat.
   */
  colorSombre: string;
  /** Chemin de l'écusson (servi depuis `public/`). */
  logo: string;
  /**
   * Δ cumulés requis pour entrer dans le rang.
   *
   * L'identifiant reste `lp` dans tout le code et en base : renommer la
   * colonne n'apporterait rien à l'utilisateur et coûterait une migration sur
   * chaque table qui la référence. Δ est l'unité affichée, pas le champ.
   */
  minLp: number;
  /** Nombre de divisions (IV → I), 100 Δ chacune. 1 = rang sans division. */
  divisions: number;
}

/** Δ nécessaires pour franchir une division. */
export const LP_PER_DIVISION = 100;

export const RANKS: readonly Rank[] = [
  {
    slug: "hoplite",
    metal: "Fer",
    name: "Hoplite",
    subtitle: "Soldat débutant",
    description: "Chaque répétition forge ton esprit.",
    lore: "Le fantassin citoyen, casque de fer et bouclier rond : tout commence par tenir la ligne.",
    color: "#6E7276",
    colorSombre: "#8B9095",
    logo: "/ranks/hoplite.png",
    minLp: 0,
    divisions: 4,
  },
  {
    slug: "myrmidon",
    metal: "Bronze",
    name: "Myrmidon",
    subtitle: "Guerrier entraîné",
    description: "La discipline façonne le corps et l'âme.",
    lore: "Les soldats d'élite d'Achille, réputés pour leur endurance et leur discipline absolue.",
    color: "#8A6A3E",
    colorSombre: "#B89968",
    logo: "/ranks/myrmidon.png",
    minLp: 400,
    divisions: 4,
  },
  {
    slug: "spartiate",
    metal: "Argent",
    name: "Spartiate",
    subtitle: "Athlète consacré",
    description: "La persévérance élève ton potentiel.",
    lore: "À Sparte, l'entraînement du corps était un devoir quotidien, pas un loisir.",
    color: "#7C8085",
    colorSombre: "#C3C7CB",
    logo: "/ranks/spartiate.png",
    minLp: 800,
    divisions: 4,
  },
  {
    slug: "heracles",
    metal: "Or",
    name: "Héraclès",
    subtitle: "Héros légendaire",
    description: "La volonté te distingue des mortels.",
    lore: "Le héros aux douze travaux, drapé de la peau du lion de Némée qu'il a terrassé.",
    color: "#A8862F",
    colorSombre: "#D0A94A",
    logo: "/ranks/heracles.png",
    minLp: 1200,
    divisions: 4,
  },
  {
    slug: "elyseen",
    metal: "Platine",
    name: "Élyséen",
    subtitle: "Champion divin",
    description: "Ton corps est ton temple, ton esprit ton guide.",
    lore: "Les Champs Élysées, séjour réservé aux âmes héroïques : on y entre par mérite.",
    color: "#2F7A4A",
    colorSombre: "#57B07C",
    logo: "/ranks/elyseen.png",
    minLp: 1600,
    divisions: 4,
  },
  {
    slug: "titan",
    metal: "Diamant",
    name: "Titan",
    subtitle: "Fils des dieux",
    description: "Peu sont élus pour atteindre ce niveau.",
    lore: "Race primordiale née de Gaïa et d'Ouranos, d'une puissance qui précède celle des Olympiens.",
    color: "#5B3FA0",
    colorSombre: "#9B7BE8",
    logo: "/ranks/titan.png",
    minLp: 2000,
    divisions: 4,
  },
  {
    slug: "demi-dieu",
    metal: "Maître",
    name: "Demi-Dieu",
    subtitle: "Être d'exception",
    description: "Ta force dépasse les limites des mortels.",
    lore: "Né d'un dieu et d'une mortelle : ni tout à fait humain, ni tout à fait divin.",
    color: "#A33B2A",
    colorSombre: "#E0644A",
    logo: "/ranks/demi-dieu.png",
    minLp: 2400,
    divisions: 1,
  },
  {
    slug: "dieu-olympe",
    metal: "Challenger",
    name: "Dieu de l'Olympe",
    subtitle: "Sommet de la perfection",
    description: "Tu es une légende. Ton nom résonnera à jamais.",
    lore: "Le trône du mont Olympe, foudre en main. Il n'y a rien au-dessus.",
    color: "#1F6FA8",
    colorSombre: "#7FD4FF",
    logo: "/ranks/dieu-olympe.png",
    minLp: 3000,
    divisions: 1,
  },
] as const;

/** Rang correspondant à un total de Δ. */
export function rankForLp(lp: number): Rank {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (lp >= rank.minLp) current = rank;
  }
  return current;
}

export interface RankProgress {
  rank: Rank;
  /** Division affichée (4 → 1). `null` pour les rangs sans division. */
  division: number | null;
  /** Δ acquis dans la division en cours. */
  lpInDivision: number;
  /** Δ nécessaires pour terminer la division en cours. */
  lpToNextDivision: number;
  /** Avancement dans la division, entre 0 et 1. */
  progress: number;
}

/**
 * Position exacte dans l'échelle : rang, division et avancement.
 * Le dernier rang n'a pas de plafond — la barre y reste pleine.
 */
export function rankProgressForLp(lp: number): RankProgress {
  const rank = rankForLp(lp);
  const lpInRank = lp - rank.minLp;

  if (rank.divisions <= 1) {
    return {
      rank,
      division: null,
      lpInDivision: lpInRank,
      lpToNextDivision: LP_PER_DIVISION,
      progress: rank.slug === "dieu-olympe" ? 1 : Math.min(lpInRank / LP_PER_DIVISION, 1),
    };
  }

  const index = Math.min(Math.floor(lpInRank / LP_PER_DIVISION), rank.divisions - 1);
  return {
    rank,
    division: rank.divisions - index, // IV en entrant, I en sortant
    lpInDivision: lpInRank - index * LP_PER_DIVISION,
    lpToNextDivision: LP_PER_DIVISION,
    progress: (lpInRank - index * LP_PER_DIVISION) / LP_PER_DIVISION,
  };
}

/** Libellé complet, ex. « Spartiate II ». */
export function rankLabel(lp: number): string {
  const { rank, division } = rankProgressForLp(lp);
  if (division === null) return rank.name;
  return `${rank.name} ${["I", "II", "III", "IV"][division - 1]}`;
}

export const getRank = (slug: RankSlug): Rank =>
  RANKS.find((r) => r.slug === slug) as Rank;
