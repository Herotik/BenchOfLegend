/**
 * Les 8 rangs de La Faille.
 *
 * Les écussons sont découpés depuis la planche source à la racine du dépôt et
 * exportés en PNG transparents 512x512 dans `public/ranks/`.
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
  /** Couleur d'accent, échantillonnée sur le titre de la planche source. */
  color: string;
  /** Chemin de l'écusson (servi depuis `public/`). */
  logo: string;
  /** LP cumulés requis pour entrer dans le rang. */
  minLp: number;
  /** Nombre de divisions (IV → I), 100 LP chacune. 1 = rang sans division. */
  divisions: number;
}

export const LP_PER_DIVISION = 100;

export const RANKS: readonly Rank[] = [
  {
    slug: "hoplite",
    metal: "Fer",
    name: "Hoplite",
    subtitle: "Soldat débutant",
    description: "Chaque répétition forge ton esprit.",
    lore: "Le fantassin citoyen, casque de fer et bouclier rond : tout commence par tenir la ligne.",
    color: "#9A958C",
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
    color: "#C1793C",
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
    color: "#C6CBD1",
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
    color: "#C99247",
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
    color: "#6FA39C",
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
    color: "#4E90C4",
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
    color: "#8A62B8",
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
    color: "#D9992F",
    logo: "/ranks/dieu-olympe.png",
    minLp: 3000,
    divisions: 1,
  },
] as const;

/** Rang correspondant à un total de LP. */
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
  /** LP acquis dans la division en cours. */
  lpInDivision: number;
  /** LP nécessaires pour terminer la division en cours. */
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
