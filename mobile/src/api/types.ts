/**
 * Formes exactes de `/api/v1`, relevées dans `app/api/v1/**\/route.ts` et
 * `lib/` à la racine du dépôt.
 *
 * Rien n'est déduit ni deviné : chaque champ correspond à une clé réellement
 * écrite par une route. Quand le serveur renvoie un enregistrement de `lib/`
 * tel quel (les stats, l'historique), le type ci-dessous en est la copie.
 */

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

/** `POST /auth/mobile/echanger` et `POST /auth/refresh`. */
export interface CoupleJetons {
  accessToken: string;
  refreshToken: string;
  /** Durée de vie du jeton d'accès, en secondes (900 côté serveur). */
  expiresIn: number;
}

/** `POST /auth/mobile/echanger` : le couple de jetons, plus le profil minimal. */
export interface ReponseEchange extends CoupleJetons {
  utilisateur: {
    id: string;
    email: string | null;
    nom: string | null;
    image: string | null;
    onboarded: boolean;
    lp: number;
  };
}

// ---------------------------------------------------------------------------
// Référentiel — `GET /referentiel` (publique)
// ---------------------------------------------------------------------------

export type Ressenti = "facile" | "juste" | "difficile";

export interface RangReferentiel {
  slug: string;
  nom: string;
  sousTitre: string;
  description: string;
  lore: string;
  metal: string;
  couleur: string;
  /** Chemin web de l'écusson, ex. « /ranks/hoplite.png ». */
  logo: string;
  minLp: number;
  divisions: number;
}

export interface Referentiel {
  materiel: { id: string; label: string }[];
  groupesMusculaires: { id: string; label: string }[];
  rangs: RangReferentiel[];
  lpParDivision: number;
  objectifs: { id: string; label: string }[];
  niveaux: { id: string; label: string; aide: string }[];
  ressentis: { id: Ressenti; label: string; aide: string }[];
  lp: {
    bareme: {
      seanceComplete: number;
      seancePartielle: number;
      seanceBonus: number;
      finisher: number;
      regularite: number;
      pesee: number;
    };
    seuilComplet: number;
    seuilPartiel: number;
    seancesAvantRegularite: number;
  };
}

// ---------------------------------------------------------------------------
// Profil — `GET /me`, `PUT /me/preferences`
// ---------------------------------------------------------------------------

export interface PreferencesApi {
  tailleCm: number | null;
  niveau: string;
  objectif: string;
  joursParSemaine: number;
  materiel: string[];
  groupesMusculaires: { groupe: string; priorite: number; decalageNiveau: number }[];
}

/** Rang et position dans l'échelle, calculés par le serveur. */
export interface RangCourant {
  slug: string;
  nom: string;
  sousTitre: string;
  couleur: string;
  logo: string;
  /** 4 → 1, ou `null` pour les deux rangs sans division. */
  division: number | null;
  /** Libellé complet, ex. « Spartiate II ». */
  libelle: string;
  lpDansDivision: number;
  lpProchaineDivision: number;
  /** Avancement dans la division, entre 0 et 1. */
  progression: number;
}

export interface ReponseMoi {
  utilisateur: {
    id: string;
    nom: string | null;
    email: string | null;
    image: string | null;
    onboarded: boolean;
    inscritLe: string;
  };
  /** `null` tant que l'onboarding n'est pas terminé. */
  preferences: PreferencesApi | null;
  lp: number;
  rang: RangCourant;
}

// ---------------------------------------------------------------------------
// Plan — `GET /plan?debut=&fin=`
// ---------------------------------------------------------------------------

export type StatutPlan = "PREVU" | "FAIT" | "MANQUE" | "REPOS";

export interface JourPlan {
  id: string;
  /** AAAA-MM-JJ. */
  date: string;
  /** Identifiant de groupe, ou « repos ». */
  groupe: string;
  statut: StatutPlan;
  seanceId: string | null;
}

export interface ReponsePlan {
  jours: JourPlan[];
}

// ---------------------------------------------------------------------------
// Séance — `GET /seance?groupe=`, `POST /seance/valider`
// ---------------------------------------------------------------------------

export type TypeExercice = "POLYARTICULAIRE" | "ISOLATION" | "CARDIO";

export interface ExercicePrescrit {
  exerciceId: string;
  nom: string;
  type: TypeExercice;
  description: string;
  series: number;
  /** Objectif de répétitions. Absent pour le cardio, prescrit en durée. */
  reps?: number;
  /** Consigne de durée pour le cardio, ex. « 8 × 30 s effort / 90 s récup ». */
  duree?: string;
  restSec: number;
  finisher: boolean;
  chargeRequise: boolean;
  /** Absent quand la séance ne comporte aucun exercice à charge. */
  derniereCharge?: number | null;
  progression: string | null;
}

export interface SeancePrescrite {
  muscleGroup: string;
  echauffement: string[];
  exercices: ExercicePrescrit[];
  seriesTotal: number;
}

export interface ReponseSeance {
  groupe: string;
  /** Jour civil UTC, AAAA-MM-JJ. */
  date: string;
  /** `null` = groupe hors programme du jour : validable seulement en bonus. */
  planDayId: string | null;
  dejaValidee: boolean;
  seance: SeancePrescrite;
  /** Garde-fou de récupération, ou `null`. */
  avertissement: string | null;
  seancesSur7Jours: number;
  bonusDejaCompte: boolean;
}

export type StatutExercice = "non_fait" | "partiel" | "fait";

export interface CorpsValidation {
  planDayId?: string;
  groupe: string;
  bonus: boolean;
  /** Un statut par exercice, dans l'ordre de la séance reçue. */
  statuts: StatutExercice[];
  /** Une charge par exercice, `null` quand il n'y en a pas. */
  charges: (number | null)[];
  ressenti: Ressenti;
  dureeMin?: number;
}

export interface ReponseValidation {
  lpGagnes: number;
  details: { libelle: string; lp: number }[];
  lpTotal: number;
  promotion: boolean;
  /** Libellé du rang atteint, ex. « Spartiate II » — pas un objet. */
  rang: string;
  proposition: { delta: 1 | -1; message: string; groupe: string } | null;
}

/** `POST /difficulte`. */
export interface ReponseDifficulte {
  groupe: string;
  decalageNiveau: number;
}

// ---------------------------------------------------------------------------
// Pesée — `POST /pesee`
// ---------------------------------------------------------------------------

export interface ReponsePesee {
  date: string;
  kg: number;
  /** 0 si une pesée du jour existait déjà : les LP ne paient qu'une fois. */
  lpGagnes: number;
  lpTotal: number;
  promotion: boolean;
  rang: string;
}

// ---------------------------------------------------------------------------
// Statistiques — `GET /stats`
// ---------------------------------------------------------------------------

export interface PointPoids {
  date: string;
  kg: number;
  /** Moyenne glissante 7 jours, `null` sous trois pesées. */
  tendance: number | null;
}

export interface PointSemaine {
  /** Lundi de la semaine, AAAA-MM-JJ. */
  semaine: string;
  delta: number | null;
  prevues: number;
  faites: number;
  /** Pourcentage entier, ou `null` sans séance prévue. */
  assiduite: number | null;
  volume: Record<string, number>;
  volumeTotal: number;
}

export interface PointLp {
  date: string;
  lp: number;
}

export interface Stats {
  poids: PointPoids[];
  semaines: PointSemaine[];
  lp: PointLp[];
  groupesUtilises: string[];
}

// ---------------------------------------------------------------------------
// Historique — `GET /historique?limite=&avant=`
// ---------------------------------------------------------------------------

export interface SeancePassee {
  id: string;
  date: string;
  groupe: string;
  bonus: boolean;
  lpGagnes: number;
  dureeMin: number | null;
  ressenti: Ressenti | null;
  /** Instantané JSON des exercices, tel qu'enregistré à la validation. */
  exercices: unknown;
}

export interface PageHistorique {
  seances: SeancePassee[];
  /** Curseur de la page suivante. `null` = fin. */
  suivant: string | null;
}
