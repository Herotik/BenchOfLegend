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
 * Affinité entre deux groupes réunis dans la même séance.
 *
 * Les salles s'organisent depuis toujours autour de trois découpes : pousser /
 * tirer / jambes, haut / bas, ou l'appariement d'antagonistes. Toutes reposent
 * sur la même idée — regrouper ce qui travaille ensemble, séparer ce qui se
 * gênerait.
 *
 * Une note haute rapproche, une note négative éloigne :
 *  · pectoraux + bras, dos + bras — les bras finissent ce que le grand
 *    mouvement a commencé, c'est la découpe pousser/tirer classique ;
 *  · pectoraux + dos — antagonistes, la paire des superséries ;
 *  · jambes + abdos — le bas et le gainage, rien ne se recouvre ;
 *  · pectoraux + épaules — le deltoïde antérieur travaille déjà au développé :
 *    l'enchaîner le fatigue deux fois pour un seul gain ;
 *  · jambes + dos — deux séances les plus lourdes du programme, réunies elles
 *    dépassent ce qu'on tient en une fois.
 *
 * Le cardio reste neutre partout : il ne dispute la récupération à personne.
 */
const AFFINITES: Record<string, number> = {
  "bras|pectoraux": 3,
  "bras|dos": 3,
  "dos|pectoraux": 3,
  "abdos|jambes": 2,
  "bras|epaules": 2,
  "abdos|pectoraux": 1,
  "abdos|dos": 1,
  "dos|epaules": 1,
  "epaules|pectoraux": -2,
  "dos|jambes": -2,
  "jambes|pectoraux": -1,
};

/** Note d'un appariement, indépendante de l'ordre des deux groupes. */
function affinite(a: MuscleGroupId, b: MuscleGroupId): number {
  if (a === "cardio" || b === "cardio") return 0;
  return AFFINITES[[a, b].sort().join("|")] ?? 0;
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

      // Au premier tour la journée est vide : l'ordre de la file décide, et il
      // porte déjà les priorités. Au second, on choisit le meilleur compagnon
      // du groupe déjà posé plutôt que le premier venu — à égalité, la file
      // tranche, donc la priorité continue de primer.
      let index = -1;
      let meilleure = -Infinity;
      for (let i = 0; i < restants.length; i++) {
        if (!placementValide(plan, jour, restants[i])) continue;
        const note = plan[jour].groupes.reduce((s, pose) => s + affinite(pose, restants[i]), 0);
        if (note > meilleure) {
          meilleure = note;
          index = i;
        }
      }
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
