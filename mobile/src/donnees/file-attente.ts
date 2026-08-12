import { ErreurApi, ErreurReseau } from "../api/client";
import { validerSeance } from "../api/routes";
import type { CorpsValidation, ReponseValidation } from "../api/types";
import { jourCivilISO } from "../outils/dates";
import { ecrire, lire } from "../outils/stockage";

/**
 * Séances terminées que le réseau n'a pas laissé partir.
 *
 * Une séance validée en salle sans signal ne doit pas se perdre : elle est
 * écrite au disque, puis renvoyée au premier réveil de l'app qui trouve du
 * réseau. Le serveur reste seul à calculer les Δ — la file ne transporte que ce
 * que l'écran aurait envoyé sur-le-champ, sa date en plus.
 *
 * **Une seule tentative d'envoi à la fois** (`envoiEnCours`). Deux passes
 * concurrentes — l'app revient au premier plan pendant que l'écran d'accueil
 * lance la sienne — enverraient la même séance deux fois : la première
 * comptant, la seconde repartant en double dans l'historique.
 */

const CLE = "fol.validations.v1";

/**
 * Au-delà d'une journée, le serveur refuse la séance (`date_hors_bornes`) :
 * la garder ne ferait qu'échouer chaque matin. La borne est la même des deux
 * côtés — voir `RECUL_MAX_JOURS` dans `lib/seance.ts`.
 */
const RECUL_MAX_JOURS = 1;

export interface ValidationEnAttente {
  /** Identifiant local, pour retirer l'entrée sans ambiguïté. */
  id: string;
  /** Exactement le corps de `POST /seance/valider`, `faiteLe` compris. */
  corps: CorpsValidation;
  creeeLe: number;
  tentatives: number;
  /** Message du dernier échec, à afficher si l'entrée finit abandonnée. */
  dernierEchec: string | null;
}

export interface SeanceEnvoyee {
  groupe: string;
  jour: string;
  resultat: ReponseValidation;
}

export interface SeanceAbandonnee {
  groupe: string;
  jour: string;
  raison: string;
  /** Vrai quand le serveur l'avait déjà : rien n'est perdu. */
  dejaConnue: boolean;
}

export interface BilanEnvoi {
  envoyees: SeanceEnvoyee[];
  abandonnees: SeanceAbandonnee[];
  /** Ce qui reste en file : réseau toujours absent, ou serveur en panne. */
  restantes: number;
}

/** Fabrique plutôt que constante partagée : chaque appelant reçoit le sien. */
const bilanVide = (): BilanEnvoi => ({ envoyees: [], abandonnees: [], restantes: 0 });

// ---------------------------------------------------------------------------
// Lecture et écriture
// ---------------------------------------------------------------------------

const lireFile = async (): Promise<ValidationEnAttente[]> =>
  (await lire<ValidationEnAttente[]>(CLE)) ?? [];

async function ecrireFile(file: ValidationEnAttente[]): Promise<void> {
  await ecrire(CLE, file);
  prevenir(file.length);
}

export const fileEnAttente = lireFile;

/**
 * Sérialise les lectures-modifications-écritures de la file.
 *
 * Sans cela, deux d'entre elles se chevauchant repartent du même contenu et la
 * seconde écrase la première. Le cas n'a rien de théorique : l'envoi met
 * jusqu'à quinze secondes à conclure qu'il n'y a pas de réseau, et c'est
 * précisément le moment où l'on peut terminer une deuxième séance — celle-là
 * même que l'écriture finale de l'envoi ferait disparaître.
 */
let chaine: Promise<unknown> = Promise.resolve();

function enSerie<T>(operation: () => Promise<T>): Promise<T> {
  const suite = chaine.then(operation, operation);
  // La chaîne ne doit jamais porter de rejet : il ferait échouer toutes les
  // opérations suivantes, qui n'y sont pour rien.
  chaine = suite.catch(() => undefined);
  return suite;
}

/**
 * Range une séance terminée, faute de pouvoir l'envoyer.
 *
 * `faiteLe` doit déjà être renseigné par l'appelant : c'est la date de la
 * séance affichée, celle que le serveur a lui-même calculée en la servant. La
 * recalculer ici la ferait basculer au lendemain pour une séance conclue à
 * minuit passé.
 */
export function mettreEnFile(corps: CorpsValidation): Promise<void> {
  return enSerie(async () => {
    const file = await lireFile();
    file.push({
      id: `${Date.now()}-${corps.groupe}`,
      corps,
      creeeLe: Date.now(),
      tentatives: 0,
      dernierEchec: null,
    });
    await ecrireFile(file);
  });
}

// ---------------------------------------------------------------------------
// Abonnement — les écrans suivent le nombre en attente
// ---------------------------------------------------------------------------

type Ecouteur = (restantes: number) => void;
const ecouteurs = new Set<Ecouteur>();

const prevenir = (restantes: number) => ecouteurs.forEach((e) => e(restantes));

export function abonnerFile(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

let envoiEnCours: Promise<BilanEnvoi> | null = null;

/**
 * Tente de vider la file, dans l'ordre où les séances ont été faites.
 *
 * Jamais rejetée : l'appelant est un écran qui se monte ou une app qui revient
 * au premier plan, et une file qui ne part pas n'est pas une erreur — c'est le
 * cas nominal hors ligne.
 */
export function envoyerLaFile(): Promise<BilanEnvoi> {
  envoiEnCours ??= tenterEnvoi().finally(() => {
    envoiEnCours = null;
  });
  return envoiEnCours;
}

async function tenterEnvoi(): Promise<BilanEnvoi> {
  const file = await lireFile();
  if (file.length === 0) return bilanVide();

  const envoyees: SeanceEnvoyee[] = [];
  const abandonnees: SeanceAbandonnee[] = [];
  const restant: ValidationEnAttente[] = [];
  let envoiImpossible = false;

  for (const entree of file) {
    const jour = entree.corps.faiteLe ?? jourCivilISO(new Date(entree.creeeLe));

    // Dès qu'un envoi a échoué pour une raison qui vaut pour toute la file —
    // réseau absent, serveur en panne — on ne martèle pas les suivantes.
    if (envoiImpossible) {
      restant.push(entree);
      continue;
    }

    if (tropAncienne(jour)) {
      abandonnees.push({
        groupe: entree.corps.groupe,
        jour,
        raison: "envoyée trop tard, le serveur n'accepte plus qu'un jour de recul.",
        dejaConnue: false,
      });
      continue;
    }

    try {
      const resultat = await validerSeance(entree.corps);
      envoyees.push({ groupe: entree.corps.groupe, jour, resultat });
    } catch (cause) {
      const suite = classer(cause);
      const marquee = {
        ...entree,
        tentatives: entree.tentatives + 1,
        dernierEchec: cause instanceof Error ? cause.message : "Envoi impossible",
      };

      if (suite === "garder") {
        envoiImpossible = true;
        restant.push(marquee);
      } else {
        abandonnees.push({
          groupe: entree.corps.groupe,
          jour,
          raison: marquee.dernierEchec ?? "Envoi impossible",
          dejaConnue: suite === "deja_connue",
        });
      }
    }
  }

  // Écriture par différence, et non écrasement : une séance terminée pendant
  // que cet envoi tournait a été ajoutée à la file entre-temps, et elle doit y
  // rester. Seules les entrées de la passe en cours sont remplacées.
  const traitees = new Set(file.map((e) => e.id));
  const restantes = await enSerie(async () => {
    const actuelle = await lireFile();
    const suivante = [...restant, ...actuelle.filter((e) => !traitees.has(e.id))];
    await ecrireFile(suivante);
    return suivante.length;
  });

  return { envoyees, abandonnees, restantes };
}

/** Vrai quand le serveur refusera la date, quoi qu'on tente ensuite. */
function tropAncienne(jour: string): boolean {
  const plusAncienAccepte = jourCivilISO(new Date(Date.now() - RECUL_MAX_JOURS * 86_400_000));
  return jour < plusAncienAccepte;
}

/**
 * Que faire d'une séance dont l'envoi vient d'échouer.
 *
 * `garder` couvre tout ce qui peut encore réussir plus tard — réseau absent,
 * session à renouveler, serveur en panne. Le reste est définitif : le serveur a
 * tranché, et réessayer ne changerait pas sa réponse.
 */
function classer(cause: unknown): "garder" | "abandonner" | "deja_connue" {
  if (cause instanceof ErreurReseau) return "garder";

  if (cause instanceof ErreurApi) {
    // 409 : le serveur l'avait déjà — validée depuis le site, ou envoyée deux
    // fois. Rien n'est perdu, et l'entrée n'a plus lieu d'être.
    if (cause.statut === 409) return "deja_connue";
    // 0 : `EXPO_PUBLIC_API_URL` absent. 401 : jetons à renouveler, ou session
    // close — l'écran de connexion s'en charge, la séance attend.
    if (cause.statut === 0 || cause.statut === 401 || cause.statut >= 500) return "garder";
    return "abandonner";
  }

  // Cause inconnue : on garde. Une séance faite mérite qu'on réessaie, et la
  // borne d'un jour finira par la retirer d'elle-même.
  return "garder";
}
