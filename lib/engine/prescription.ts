import type { Goal } from "@/lib/referentiel";

/**
 * Fourchettes de répétitions, de repos et de séries par objectif (spec §5.2).
 *
 * Ces valeurs sont volontairement regroupées ici et commentées : ce sont les
 * seuls curseurs à bouger pour ajuster la programmation, sans toucher à la
 * logique de sélection des exercices.
 *
 * Sources des fourchettes : repos long sur les polyarticulaires lourds pour
 * laisser la filière phosphagène se reconstituer, repos court en endurance et
 * en perte de poids pour maintenir la densité de la séance.
 */
export interface Prescription {
  /** Fourchette de répétitions [min, max]. */
  reps: [number, number];
  /** Repos après un exercice polyarticulaire, en secondes. */
  restPolyarticulaire: number;
  /** Repos après un exercice d'isolation, en secondes. */
  restIsolation: number;
  /** Fourchette de séries par exercice [min, max]. */
  series: [number, number];
}

export const PRESCRIPTIONS: Record<Goal, Prescription> = {
  // 6-12 reps, 2-3 min sur les polyarticulaires, 60-90 s en isolation, 3-4 séries
  HYPERTROPHIE: {
    reps: [6, 12],
    restPolyarticulaire: 150,
    restIsolation: 75,
    series: [3, 4],
  },
  // 3-6 reps, 3-5 min, 2 min en isolation, 3-5 séries
  FORCE: {
    reps: [3, 6],
    restPolyarticulaire: 240,
    restIsolation: 120,
    series: [3, 5],
  },
  // 15-20+ reps, 30-45 s, 30 s en isolation, 2-3 séries
  ENDURANCE: {
    reps: [15, 20],
    restPolyarticulaire: 40,
    restIsolation: 30,
    series: [2, 3],
  },
  // 12-15 reps en circuit, 30-60 s, 30-45 s en isolation, 3 séries
  PERTE_DE_POIDS: {
    reps: [12, 15],
    restPolyarticulaire: 45,
    restIsolation: 40,
    series: [3, 3],
  },
};

/** Volume visé par séance, en séries de travail (échauffement non compté). */
export const VOLUME_SEANCE = { min: 10, max: 16 } as const;

/**
 * Prescription de cardio : en durée et en intervalles plutôt qu'en séries ×
 * répétitions, qui n'a pas de sens sur une course ou des burpees.
 */
export const CARDIO_PAR_OBJECTIF: Record<Goal, { series: number; duree: string; restSec: number }> = {
  HYPERTROPHIE: { series: 1, duree: "15 min à allure modérée", restSec: 60 },
  FORCE: { series: 1, duree: "10 min d'activation, allure facile", restSec: 60 },
  ENDURANCE: { series: 1, duree: "30 min en endurance fondamentale", restSec: 60 },
  PERTE_DE_POIDS: { series: 8, duree: "30 s effort / 90 s récup", restSec: 90 },
};
