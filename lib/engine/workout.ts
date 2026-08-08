import { canPerform, type Level } from "@/lib/referentiel";
import { CARDIO_PAR_OBJECTIF, PRESCRIPTIONS, VOLUME_SEANCE } from "./prescription";
import type { ExerciceDisponible, ExercicePrescrit, ProfilEntrainement, Seance } from "./types";

const ORDRE_NIVEAU: Record<Level, number> = { DEBUTANT: 0, INTERMEDIAIRE: 1, AVANCE: 2 };

/** Nombre d'exercices par séance (spec §5.2). */
const EXERCICES = { min: 4, max: 6, cible: 5 } as const;

/** Fait tourner un tableau, pour varier la sélection d'une semaine à l'autre. */
function tourner<T>(liste: T[], decalage: number): T[] {
  if (liste.length === 0) return liste;
  const d = ((decalage % liste.length) + liste.length) % liste.length;
  return [...liste.slice(d), ...liste.slice(0, d)];
}

/**
 * Génère une séance pour un groupe musculaire.
 *
 * Sélection (spec §5.2) : le groupe demandé, du matériel que l'utilisateur
 * possède, d'un niveau au plus égal au sien, avec **au moins un exercice à son
 * niveau exact** — sinon un pratiquant avancé se retrouverait avec une séance
 * entièrement débutante. Les polyarticulaires passent en premier, tant que
 * l'énergie est là ; l'isolation ensuite ; le finisher en dernier.
 *
 * `graine` est un entier libre (numéro de semaine) : il fait tourner la
 * sélection pour éviter de servir les cinq mêmes exercices indéfiniment, tout
 * en restant déterministe et donc testable.
 */
export function genererSeance(
  profil: ProfilEntrainement,
  muscleGroup: string,
  catalogue: ExerciceDisponible[],
  graine = 0,
): Seance {
  const plafond = ORDRE_NIVEAU[profil.level];

  const eligibles = catalogue.filter(
    (e) =>
      e.muscleGroup === muscleGroup &&
      canPerform(e.equipment, profil.equipments) &&
      ORDRE_NIVEAU[e.level] <= plafond,
  );

  if (eligibles.length === 0) {
    return { muscleGroup, echauffement: [], exercices: [], seriesTotal: 0 };
  }

  const choisis = choisirExercices(eligibles, plafond, graine, indexerChaines(catalogue));
  const exercices = prescrire(choisis, profil, muscleGroup);

  return {
    muscleGroup,
    echauffement: [
      "5 min de mobilité articulaire",
      `2 séries légères de ${exercices[0]?.nom ?? "l'exercice principal"}`,
    ],
    exercices,
    seriesTotal: exercices.reduce((total, e) => total + e.series, 0),
  };
}

/**
 * Regroupe les exercices par chaîne de progression.
 *
 * « Pompes sur les genoux », « Pompes inclinées » et « Pompes classiques » sont
 * trois maillons d'une même chaîne : les servir dans la même séance revient à
 * répéter le même mouvement trois fois. On les fusionne pour n'en retenir
 * qu'un représentant, et on ne repioche dans une chaîne déjà utilisée qu'en
 * dernier recours, quand le catalogue ne propose rien d'autre.
 *
 * Union-find sur les liens `progression`, calculé sur tout le catalogue : une
 * chaîne peut traverser les groupes musculaires.
 */
function indexerChaines(catalogue: ExerciceDisponible[]): Map<string, string> {
  const parent = new Map<string, string>();
  const racine = (n: string): string => {
    let r = n;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };

  for (const e of catalogue) parent.set(e.name, e.name);
  for (const e of catalogue) {
    if (!e.progression || !parent.has(e.progression)) continue;
    const a = racine(e.name);
    const b = racine(e.progression);
    if (a !== b) parent.set(a, b);
  }

  return new Map(catalogue.map((e) => [e.name, racine(e.name)]));
}

/**
 * Un représentant par chaîne : le maillon le plus dur que l'utilisateur peut
 * assumer. Servir « pompes sur les genoux » à quelqu'un qui tient les pompes
 * classiques serait une régression.
 */
function representants(
  liste: ExerciceDisponible[],
  chaines: Map<string, string>,
): ExerciceDisponible[] {
  const disponibles = new Set(liste.map((e) => e.name));

  // Départage à niveau égal : les quatre paliers de pompes accessibles à un
  // débutant portent tous le niveau DEBUTANT. On retient celui dont la
  // variante suivante lui est encore hors de portée — c'est le bout de la
  // chaîne qu'il peut assumer, les précédents n'en sont que des régressions.
  const score = (e: ExerciceDisponible) =>
    ORDRE_NIVEAU[e.level] * 2 + (!e.progression || !disponibles.has(e.progression) ? 1 : 0);

  const meilleur = new Map<string, ExerciceDisponible>();
  for (const e of liste) {
    const cle = chaines.get(e.name) ?? e.name;
    const actuel = meilleur.get(cle);
    if (!actuel || score(e) > score(actuel)) meilleur.set(cle, e);
  }
  return [...meilleur.values()];
}

function choisirExercices(
  eligibles: ExerciceDisponible[],
  plafond: number,
  graine: number,
  chaines: Map<string, string>,
): ExerciceDisponible[] {
  // Dédoublonnage **global**, avant de séparer par type : « pompes prise
  // large » est classée en isolation mais appartient à la chaîne des pompes,
  // et un tri par type la laisserait passer à côté de « pompes déclinées ».
  const distincts = representants(eligibles, chaines);
  const parType = (t: string) => tourner(distincts.filter((e) => e.type === t), graine);

  const poly = parType("POLYARTICULAIRE");
  const iso = parType("ISOLATION");
  const cardio = parType("CARDIO");

  // Séance de cardio : pas de découpage poly/isolation qui tienne.
  const choisis: ExerciceDisponible[] =
    cardio.length > 0 && poly.length === 0 && iso.length === 0
      ? cardio.slice(0, EXERCICES.cible)
      : composerSeance(poly, iso, cardio);

  // Dernier recours seulement : repiocher dans une chaîne déjà servie. Chez un
  // débutant sans matériel, le haut du corps se résume parfois à une seule
  // famille de mouvements — mieux vaut deux variantes de pompes qu'une séance
  // de deux exercices.
  if (choisis.length < EXERCICES.min) {
    for (const e of tourner(eligibles, graine)) {
      if (choisis.length >= EXERCICES.min) break;
      if (!choisis.includes(e)) choisis.push(e);
    }
  }

  // Au moins un exercice au niveau exact de l'utilisateur, quitte à remplacer
  // le dernier choisi.
  const aSonNiveau = choisis.some((e) => ORDRE_NIVEAU[e.level] === plafond);
  if (!aSonNiveau) {
    const candidat = [...poly, ...iso, ...cardio].find(
      (e) => ORDRE_NIVEAU[e.level] === plafond && !choisis.includes(e),
    );
    if (candidat) choisis[choisis.length - 1] = candidat;
  }

  return trier(choisis.slice(0, EXERCICES.max));
}

/** Les polyarticulaires portent la séance, sans occuper toute la place. */
function composerSeance(
  poly: ExerciceDisponible[],
  iso: ExerciceDisponible[],
  cardio: ExerciceDisponible[],
): ExerciceDisponible[] {
  const nbPoly = Math.min(poly.length, 3);
  const choisis = [...poly.slice(0, nbPoly)];

  for (const e of iso) {
    if (choisis.length >= EXERCICES.cible) break;
    choisis.push(e);
  }
  // Le catalogue peut manquer d'isolation sur ce groupe : on complète avec ce
  // qui reste plutôt que de rendre une séance trop courte.
  for (const e of [...poly.slice(nbPoly), ...cardio]) {
    if (choisis.length >= EXERCICES.min) break;
    choisis.push(e);
  }
  return choisis;
}

/** Polyarticulaires d'abord, isolation ensuite, cardio en finisher. */
function trier(liste: ExerciceDisponible[]): ExerciceDisponible[] {
  const rang = { POLYARTICULAIRE: 0, ISOLATION: 1, CARDIO: 2 } as const;
  return [...liste].sort((a, b) => rang[a.type] - rang[b.type]);
}

function prescrire(
  choisis: ExerciceDisponible[],
  profil: ProfilEntrainement,
  muscleGroup: string,
): ExercicePrescrit[] {
  const p = PRESCRIPTIONS[profil.goal];
  const series = repartirSeries(choisis.length, p.series);

  return choisis.map((e, i) => {
    const dernier = i === choisis.length - 1;
    const finisher = dernier && choisis.length >= 5 && e.type !== "POLYARTICULAIRE";

    if (e.type === "CARDIO" || muscleGroup === "cardio") {
      const c = CARDIO_PAR_OBJECTIF[profil.goal];
      return {
        exerciceId: e.id,
        nom: e.name,
        type: e.type,
        description: e.description,
        series: c.series,
        duree: c.duree,
        restSec: c.restSec,
        finisher,
        progression: e.progression,
      };
    }

    return {
      exerciceId: e.id,
      nom: e.name,
      type: e.type,
      description: e.description,
      series: series[i],
      reps: p.reps,
      restSec: e.type === "POLYARTICULAIRE" ? p.restPolyarticulaire : p.restIsolation,
      finisher,
      progression: e.progression,
    };
  });
}

/**
 * Répartit les séries pour atteindre le volume visé (10 à 16 séries de
 * travail). On part du minimum par exercice et on ajoute une série à la fois,
 * en tournant, jusqu'à entrer dans la fourchette — ce qui répartit la charge
 * plutôt que de saturer le premier mouvement.
 */
function repartirSeries(nbExercices: number, [min, max]: [number, number]): number[] {
  if (nbExercices === 0) return [];

  const series = Array<number>(nbExercices).fill(min);
  let total = min * nbExercices;

  for (let i = 0; total < VOLUME_SEANCE.min && series.some((s) => s < max); i++) {
    const index = i % nbExercices;
    if (series[index] >= max) continue;
    if (total + 1 > VOLUME_SEANCE.max) break;
    series[index] += 1;
    total += 1;
  }

  return series;
}
