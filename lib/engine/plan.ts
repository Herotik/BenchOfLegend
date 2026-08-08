import type { MuscleGroupId } from "@/lib/referentiel";
import type { JourPlan, ProfilEntrainement } from "./types";

/** Nombre maximum de groupes travaillés dans une même journée. */
const GROUPES_PAR_JOUR_MAX = 2;

/** Objectif de fréquence : chaque groupe choisi est travaillé 2× par semaine. */
const FREQUENCE_CIBLE = 2;

/**
 * Répartit les jours d'entraînement sur la semaine, aussi régulièrement que
 * possible.
 *
 * Algorithme de Bresenham : le jour `i` est un jour d'entraînement si
 * `(i × n) mod 7 < n`. Contrairement à un simple `floor(k × 7 / n)`, il évite
 * d'empiler les séances en début de semaine — la spec demande explicitement de
 * ne pas produire « 4 séances d'affilée puis 3 jours off ».
 *
 * Exemples : 2 → lundi, vendredi · 3 → lundi, jeudi, samedi ·
 * 4 → lundi, mercredi, vendredi, dimanche · 6 → repos le mardi.
 */
export function repartirJours(daysPerWeek: number): number[] {
  const n = Math.min(Math.max(Math.round(daysPerWeek), 2), 6);
  const jours: number[] = [];
  for (let i = 0; i < 7; i++) {
    if ((i * n) % 7 < n) jours.push(i);
  }
  return jours;
}

/**
 * Construit la file des séances à placer : chaque groupe autant de fois que la
 * fréquence cible le permet, les priorités hautes d'abord.
 *
 * Quand il y a trop de groupes pour le nombre de jours, on ne peut pas tout
 * caser. Le décalage `semaine` fait alors tourner l'ordre d'une semaine à
 * l'autre, pour que les groupes sacrifiés cette semaine passent devant la
 * suivante — sinon les derniers de la liste ne seraient jamais travaillés.
 */
function fileDesSeances(
  groupes: ProfilEntrainement["muscleGroups"],
  capacite: number,
  semaine: number,
): MuscleGroupId[] {
  if (groupes.length === 0) return [];

  const tries = [...groupes].sort((a, b) => b.priority - a.priority);
  const decalage = semaine % tries.length;
  const tournants = [...tries.slice(decalage), ...tries.slice(0, decalage)];

  // Un premier passage garantit une séance à chacun avant d'en donner une
  // deuxième à quiconque : mieux vaut sept groupes vus une fois que trois vus
  // deux fois et quatre jamais.
  const file: MuscleGroupId[] = [];
  for (let passage = 0; passage < FREQUENCE_CIBLE; passage++) {
    for (const g of tournants) {
      if (file.length >= capacite) return file;
      file.push(g.id);
    }
  }
  return file;
}

/**
 * Plan hebdomadaire : quels groupes travailler quel jour.
 *
 * Contraintes respectées :
 * - chaque groupe choisi visé 2× par semaine ;
 * - jamais le même groupe deux jours consécutifs (48 h de récupération), le
 *   cardio excepté puisqu'il n'impose pas la même récupération ;
 * - jours de repos répartis sur la semaine.
 *
 * `semaine` est un entier libre (numéro de semaine ISO) : il rend la rotation
 * déterministe et donc testable, là où un tirage aléatoire ne le serait pas.
 */
export function genererPlanSemaine(profil: ProfilEntrainement, semaine = 0): JourPlan[] {
  const joursEntrainement = repartirJours(profil.daysPerWeek);
  const capacite = joursEntrainement.length * GROUPES_PAR_JOUR_MAX;
  const file = fileDesSeances(profil.muscleGroups, capacite, semaine);

  const plan: JourPlan[] = Array.from({ length: 7 }, (_, jour) => ({ jour, groupes: [] }));
  const restants = [...file];

  // Premier tour : un groupe par jour d'entraînement, pour étaler avant
  // d'empiler. Deuxième tour : on complète les journées.
  for (let tour = 0; tour < GROUPES_PAR_JOUR_MAX; tour++) {
    for (const jour of joursEntrainement) {
      if (restants.length === 0) break;
      if (plan[jour].groupes.length > tour) continue;

      const index = restants.findIndex((g) => placementValide(plan, jour, g));
      if (index === -1) continue;

      plan[jour].groupes.push(restants[index]);
      restants.splice(index, 1);
    }
  }

  return plan;
}

/** Vrai si le groupe peut être placé ce jour-là sans casser la récupération. */
function placementValide(plan: JourPlan[], jour: number, groupe: MuscleGroupId): boolean {
  if (plan[jour].groupes.includes(groupe)) return false;

  // Le cardio peut s'intercaler n'importe quand : il ne sollicite pas les
  // mêmes structures et ne réclame pas 48 h de récupération.
  if (groupe === "cardio") return true;

  const veille = plan[(jour + 6) % 7];
  const lendemain = plan[(jour + 1) % 7];
  return !veille.groupes.includes(groupe) && !lendemain.groupes.includes(groupe);
}
