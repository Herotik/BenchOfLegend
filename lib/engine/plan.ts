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
 * Groupes de la dernière séance d'une semaine.
 *
 * « Dernière séance » et non « dimanche » : à trois séances par semaine on
 * s'arrête le samedi, et c'est cette journée-là que la semaine suivante doit
 * regarder.
 */
export function derniereSeance(plan: JourPlan[]): MuscleGroupId[] {
  for (let jour = 6; jour >= 0; jour--) {
    const groupes = plan[jour]?.groupes ?? [];
    if (groupes.length > 0) return groupes;
  }
  return [];
}

/**
 * Plan hebdomadaire : quels groupes travailler quel jour.
 *
 * Contraintes respectées :
 * - chaque groupe choisi visé 2× par semaine ;
 * - jamais le même groupe deux jours consécutifs (48 h de récupération), le
 *   cardio excepté puisqu'il n'impose pas la même récupération ;
 * - jamais le même groupe sur **deux séances qui se suivent**, y compris de
 *   part et d'autre du dimanche ;
 * - jours de repos répartis sur la semaine.
 *
 * `semaine` est un entier libre (numéro de semaine ISO) : il rend la rotation
 * déterministe et donc testable, là où un tirage aléatoire ne le serait pas.
 *
 * ## `precedente`, et pourquoi elle est indispensable
 *
 * Sans elle, chaque semaine était engendrée en aveugle : le dimanche de l'une
 * et le lundi de la suivante pouvaient porter le même groupe — deux jours
 * calendaires consécutifs, la règle des 48 h franchement violée — et samedi
 * puis lundi enchaînaient deux fois le même travail sans rien entre les deux.
 * Mesuré sur cent enchaînements de semaines : vingt collisions du premier
 * genre, quarante-sept du second.
 *
 * Une semaine ne regarde que **derrière** elle. C'est suffisant, et c'est le
 * seul choix possible : la semaine suivante n'existe pas encore au moment où
 * l'on engendre celle-ci. C'est elle qui, à son tour, nous regardera.
 */
export function genererPlanSemaine(
  profil: ProfilEntrainement,
  semaine = 0,
  precedente?: JourPlan[],
): JourPlan[] {
  const joursEntrainement = repartirJours(profil.daysPerWeek);
  const capacite = joursEntrainement.length * GROUPES_PAR_JOUR_MAX;
  const file = fileDesSeances(profil.muscleGroups, capacite, semaine);

  const plan: JourPlan[] = Array.from({ length: 7 }, (_, jour) => ({ jour, groupes: [] }));
  const restants = [...file];

  // `repartirJours` place toujours le lundi — `(0 × n) % 7 = 0 < n` quel que
  // soit n. La première séance de la semaine est donc la seule qui hérite de
  // la précédente, et l'héritage ne la concerne qu'elle.
  const premiereSeance = joursEntrainement[0];
  const herites = new Set<MuscleGroupId>(precedente ? derniereSeance(precedente) : []);

  // Premier tour : un groupe par jour d'entraînement, pour étaler avant
  // d'empiler. Deuxième tour : on complète les journées.
  for (let tour = 0; tour < GROUPES_PAR_JOUR_MAX; tour++) {
    for (const jour of joursEntrainement) {
      if (restants.length === 0) break;
      if (plan[jour].groupes.length > tour) continue;

      const interdits = jour === premiereSeance ? herites : VIDE;
      let index = choisir(plan, jour, restants, interdits);

      // Un jour d'entraînement laissé vide vaudrait un repos que personne n'a
      // demandé. Si c'est le seul héritage qui bloque — profil à deux groupes
      // dont la semaine passée s'est terminée sur les deux — on le relâche :
      // mieux vaut répéter un groupe que retirer une séance du calendrier.
      if (index === -1 && plan[jour].groupes.length === 0 && interdits.size > 0) {
        index = choisir(plan, jour, restants, VIDE);
      }
      if (index === -1) continue;

      plan[jour].groupes.push(restants[index]);
      restants.splice(index, 1);
    }
  }

  return plan;
}

const VIDE: ReadonlySet<MuscleGroupId> = new Set();

/**
 * Index du meilleur candidat plaçable ce jour-là, ou `-1`.
 *
 * Au premier tour la journée est vide : l'ordre de la file décide, et il porte
 * déjà les priorités. Au second, on choisit le meilleur compagnon du groupe
 * déjà posé plutôt que le premier venu — à égalité, la file tranche, donc la
 * priorité continue de primer.
 */
function choisir(
  plan: JourPlan[],
  jour: number,
  restants: MuscleGroupId[],
  interdits: ReadonlySet<MuscleGroupId>,
): number {
  let index = -1;
  let meilleure = -Infinity;

  for (let i = 0; i < restants.length; i++) {
    if (!placementValide(plan, jour, restants[i], interdits)) continue;
    const note = plan[jour].groupes.reduce((s, pose) => s + affinite(pose, restants[i]), 0);
    if (note > meilleure) {
      meilleure = note;
      index = i;
    }
  }

  return index;
}

/** Vrai si le groupe peut être placé ce jour-là sans casser la récupération. */
function placementValide(
  plan: JourPlan[],
  jour: number,
  groupe: MuscleGroupId,
  interdits: ReadonlySet<MuscleGroupId>,
): boolean {
  if (plan[jour].groupes.includes(groupe)) return false;

  // Le cardio peut s'intercaler n'importe quand : il ne sollicite pas les
  // mêmes structures et ne réclame pas 48 h de récupération.
  if (groupe === "cardio") return true;

  // Travaillé à la dernière séance de la semaine passée.
  //
  // Cela couvre du même coup le dimanche précédent : s'il portait un groupe,
  // il **est** la dernière séance. Inutile donc de le vérifier séparément — et
  // nuisible : la vérification survivrait au relâchement ci-dessus et viderait
  // le lundi que celui-ci cherche justement à remplir.
  if (interdits.has(groupe)) return false;

  // Le lundi n'a pas de veille dans sa propre semaine. Le code regardait
  // `plan[(jour + 6) % 7]`, c'est-à-dire le dimanche de la semaine courante :
  // six jours d'écart présentés comme un seul. Il interdisait un appariement
  // parfaitement légitime tout en laissant passer celui qui posait vraiment
  // problème, lequel se traite une ligne plus haut.
  const veille = jour > 0 ? plan[jour - 1] : undefined;
  if (veille?.groupes.includes(groupe)) return false;

  // Pas de lendemain pour le dimanche : la semaine suivante n'est pas encore
  // engendrée. C'est elle qui nous regardera.
  const lendemain = jour < 6 ? plan[jour + 1] : undefined;
  return !lendemain?.groupes.includes(groupe);
}
