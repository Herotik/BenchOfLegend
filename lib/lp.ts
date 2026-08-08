/**
 * Barème des LP (spec §6). Fonction pure : le calcul se fait toujours côté
 * serveur, jamais d'après une valeur envoyée par le client.
 *
 * Principe directeur : **aucune perte de LP**, jamais. Une semaine manquée
 * n'enlève rien — la seule sanction est l'absence de gain. C'est ce qui rend
 * le compteur toujours motivant.
 */

export const BAREME = {
  seanceComplete: 20,
  seancePartielle: 12,
  seanceBonus: 8,
  finisher: 4,
  regularite: 3,
  pesee: 2,
} as const;

/** Part d'exercices cochés à partir de laquelle la séance compte pleinement. */
export const SEUIL_COMPLET = 0.8;
/** En dessous de ce seuil, la séance ne rapporte rien. */
export const SEUIL_PARTIEL = 0.5;
/** Rang de la séance, sur 7 jours glissants, à partir duquel la régularité paie. */
export const SEANCES_AVANT_REGULARITE = 2;

export interface EntreeLp {
  /** Part d'exercices cochés, entre 0 et 1. */
  ratioComplete: number;
  isBonus: boolean;
  /** Vrai si la séance avait un finisher et qu'il a été coché. */
  finisherComplete: boolean;
  /** Séances déjà validées sur les 7 derniers jours, celle-ci non comprise. */
  seancesSur7Jours: number;
  /** Un bonus a-t-il déjà été comptabilisé aujourd'hui ? (plafond : 1/jour) */
  bonusDejaCompteAujourdhui: boolean;
}

export interface DetailLp {
  libelle: string;
  lp: number;
}

export interface ResultatLp {
  total: number;
  details: DetailLp[];
}

export function calculerLp(entree: EntreeLp): ResultatLp {
  const details: DetailLp[] = [];
  const ratio = Math.min(Math.max(entree.ratioComplete, 0), 1);

  if (entree.isBonus) {
    // Le plafond d'un bonus par jour évite d'inciter au surentraînement en
    // empilant les séances libres.
    if (ratio >= SEUIL_PARTIEL && !entree.bonusDejaCompteAujourdhui) {
      details.push({ libelle: "Séance bonus", lp: BAREME.seanceBonus });
    }
  } else if (ratio >= SEUIL_COMPLET) {
    details.push({ libelle: "Séance du jour validée", lp: BAREME.seanceComplete });
  } else if (ratio >= SEUIL_PARTIEL) {
    details.push({ libelle: "Séance partiellement validée", lp: BAREME.seancePartielle });
  }

  // Rien d'autre ne se cumule sur une séance qui n'a pas atteint le seuil :
  // sinon cocher un seul exercice rapporterait des LP.
  if (details.length === 0) return { total: 0, details };

  if (entree.finisherComplete) {
    details.push({ libelle: "Finisher complété", lp: BAREME.finisher });
  }

  if (entree.seancesSur7Jours >= SEANCES_AVANT_REGULARITE) {
    details.push({ libelle: "Régularité", lp: BAREME.regularite });
  }

  return { total: details.reduce((s, d) => s + d.lp, 0), details };
}

/** Part d'exercices cochés dans une séance. */
export function ratioComplete(exercices: { done: boolean }[]): number {
  if (exercices.length === 0) return 0;
  return exercices.filter((e) => e.done).length / exercices.length;
}
