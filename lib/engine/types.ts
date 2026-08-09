import type { ExoType, Goal, Level, MuscleGroupId } from "@/lib/referentiel";

/**
 * Le moteur est un module **pur** : il ne connaît ni Prisma ni la requête HTTP.
 * On lui passe des données simples, il renvoie des données simples. C'est ce
 * qui le rend testable unitairement, et c'est le seul endroit où vivent les
 * règles d'entraînement.
 */

/** Ce que le moteur a besoin de savoir d'un utilisateur. */
export interface ProfilEntrainement {
  level: Level;
  goal: Goal;
  /** 2 à 6 */
  daysPerWeek: number;
  /** Slugs du matériel possédé. Vide = poids de corps pur. */
  equipments: string[];
  /**
   * Groupes choisis, avec leur priorité (2 = point fort souhaité) et leur
   * décalage de difficulté (-1 à +1), piloté par le ressenti de fin de séance.
   */
  muscleGroups: { id: MuscleGroupId; priority: number; levelOffset?: number }[];
}

/** Un exercice tel que lu en base, réduit à ce dont le moteur se sert. */
export interface ExerciceDisponible {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  level: Level;
  type: ExoType;
  description: string;
  progression: string | null;
}

/** Un exercice prescrit dans une séance. */
export interface ExercicePrescrit {
  exerciceId: string;
  nom: string;
  type: ExoType;
  description: string;
  series: number;
  /**
   * Objectif de répétitions par série. Un nombre précis, jamais une
   * fourchette : c'est ce qui rend une série « non terminée » signifiable.
   * Absent pour le cardio, prescrit en durée.
   */
  reps?: number;
  /** Consigne de durée pour le cardio, ex. « 8 × 30 s effort / 90 s récup ». */
  duree?: string;
  /** Temps de repos entre séries, en secondes. */
  restSec: number;
  /** Vrai pour le dernier exercice quand c'est un finisher. */
  finisher: boolean;
  /** Variante plus difficile, proposée quand la fourchette haute est dépassée. */
  progression: string | null;
}

export interface Seance {
  muscleGroup: string;
  echauffement: string[];
  exercices: ExercicePrescrit[];
  /** Total des séries de travail (l'échauffement ne compte pas). */
  seriesTotal: number;
}

/** Un jour du plan hebdomadaire. */
export interface JourPlan {
  /** 0 = lundi … 6 = dimanche. */
  jour: number;
  /** Vide = jour de repos. */
  groupes: MuscleGroupId[];
}
