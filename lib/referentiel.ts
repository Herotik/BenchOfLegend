/**
 * Référentiels métier : matériel et groupes musculaires.
 *
 * Source de vérité unique — le seed Prisma remplit les tables `Equipment` et
 * `MuscleGroup` à partir d'ici, et l'UI y lit ses libellés. Ne pas redéfinir
 * ces listes ailleurs.
 */

export const EQUIPMENTS = [
  { id: "halteres", label: "Haltères" },
  { id: "banc", label: "Banc de musculation" },
  { id: "barre_dc", label: "Barre de développé couché" },
  { id: "barre_traction", label: "Barre de traction" },
  { id: "elastiques", label: "Élastiques" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "tapis_course", label: "Tapis de course" },
  { id: "corde_a_sauter", label: "Corde à sauter" },
] as const;

export const MUSCLE_GROUPS = [
  { id: "pectoraux", label: "Pectoraux" },
  { id: "dos", label: "Dos" },
  { id: "epaules", label: "Épaules" },
  { id: "bras", label: "Bras" },
  { id: "jambes", label: "Jambes" },
  { id: "abdos", label: "Abdos" },
  { id: "cardio", label: "Cardio" },
] as const;

export type EquipmentId = (typeof EQUIPMENTS)[number]["id"];
export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number]["id"];

export type Level = "DEBUTANT" | "INTERMEDIAIRE" | "AVANCE";
export type ExoType = "POLYARTICULAIRE" | "ISOLATION" | "CARDIO";
export type Goal = "HYPERTROPHIE" | "FORCE" | "ENDURANCE" | "PERTE_DE_POIDS";

/** Valeur d'`Exercise.equipment` signifiant « poids de corps ». */
export const AUCUN_EQUIPEMENT = "aucun";

export const LEVEL_LABELS: Record<Level, string> = {
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  AVANCE: "Avancé",
};

/** Phrase d'auto-évaluation affichée à l'onboarding. */
export const LEVEL_HINTS: Record<Level, string> = {
  DEBUTANT: "Moins de 6 mois de pratique régulière.",
  INTERMEDIAIRE: "6 mois à 2 ans de pratique suivie, tu maîtrises les mouvements de base.",
  AVANCE: "Plus de 2 ans de pratique, tu sais programmer tes séances.",
};

export const GOAL_LABELS: Record<Goal, string> = {
  HYPERTROPHIE: "Prise de muscle",
  FORCE: "Force",
  ENDURANCE: "Endurance",
  PERTE_DE_POIDS: "Perte de poids",
};

export const equipmentLabel = (id: string): string =>
  EQUIPMENTS.find((e) => e.id === id)?.label ?? id;

export const muscleGroupLabel = (id: string): string =>
  MUSCLE_GROUPS.find((g) => g.id === id)?.label ?? id;

/**
 * Décompose la valeur `Exercise.equipment` ("banc+halteres") en slugs.
 * Renvoie un tableau vide pour un exercice au poids de corps.
 */
export const parseEquipment = (value: string): string[] =>
  value === AUCUN_EQUIPEMENT ? [] : value.split("+");

/** Vrai si l'utilisateur possède tout le matériel requis par l'exercice. */
export const canPerform = (exerciseEquipment: string, owned: readonly string[]): boolean =>
  parseEquipment(exerciseEquipment).every((slug) => owned.includes(slug));
