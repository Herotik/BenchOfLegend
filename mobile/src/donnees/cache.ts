import type { Referentiel, ReponseSeance } from "../api/types";
import { jourCivilISO } from "../outils/dates";
import { ecrire, effacerPrefixe, lire } from "../outils/stockage";

/**
 * Ce que l'app garde sous la main pour tenir une séance sans réseau.
 *
 * Une salle en sous-sol, un vestiaire en béton : c'est précisément là que
 * l'app sert, et là qu'elle n'a pas de signal. Deux choses suffisent à mener
 * une séance de bout en bout — la séance prescrite et le référentiel — et
 * toutes deux sont écrites au disque dès qu'elles arrivent du serveur.
 *
 * Ce cache ne sert **qu'**à lire. Rien de ce qu'il contient n'est renvoyé au
 * serveur comme vérité : les Δ restent calculés à la validation, à partir de la
 * séance que le serveur régénère lui-même.
 */

const CLE_REFERENTIEL = "fol.referentiel.v1";

/** Une entrée par groupe : deux séances du jour peuvent coexister (bonus). */
const cleSeance = (groupe: string) => `fol.seance.v1.${groupe}`;

export const memoriserReferentiel = (referentiel: Referentiel): Promise<void> =>
  ecrire(CLE_REFERENTIEL, referentiel);

/**
 * Référentiel de la dernière session en ligne.
 *
 * Sans péremption : les libellés et le barème bougent au rythme des
 * déploiements, et une version d'hier vaut infiniment mieux qu'un écran de
 * ressentis vide au moment de conclure une séance. La version fraîche l'écrase
 * dès que le réseau revient.
 */
export const referentielEnCache = (): Promise<Referentiel | null> =>
  lire<Referentiel>(CLE_REFERENTIEL);

export const memoriserSeance = (reponse: ReponseSeance): Promise<void> =>
  ecrire(cleSeance(reponse.groupe), reponse);

/**
 * Séance gardée pour ce groupe, si elle est encore celle du jour.
 *
 * La péremption est stricte : le serveur régénère la séance à partir d'une
 * graine quotidienne, si bien que celle d'hier n'est plus celle d'aujourd'hui.
 * La rejouer ferait cocher des exercices que le serveur ne reconnaîtrait pas à
 * la validation.
 */
export async function seanceEnCache(groupe: string): Promise<ReponseSeance | null> {
  const gardee = await lire<ReponseSeance>(cleSeance(groupe));
  if (!gardee) return null;
  return gardee.date === jourCivilISO() ? gardee : null;
}

/**
 * Oublie les séances gardées, tous groupes confondus.
 *
 * Appelé après une remise à zéro du compte : le serveur régénère les séances à
 * partir d'une graine quotidienne **et du profil**, or les ajustements de
 * difficulté viennent d'être effacés. Une séance d'avant la remise à zéro
 * prescrirait des variantes que le serveur ne prescrit plus, et la validation
 * porterait sur des exercices qu'il ne reconnaîtrait pas.
 *
 * Le référentiel, lui, reste : il ne dépend d'aucun compte.
 */
export const oublierSeances = (): Promise<void> => effacerPrefixe("fol.seance.v1.");
