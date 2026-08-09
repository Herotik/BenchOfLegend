import "server-only";
import type { z } from "zod";
import { erreur, type Resultat } from "@/lib/api/garde";
import type { EchecMetier } from "@/lib/erreurs";

/**
 * Mise en forme des réponses de `/api/v1/*`.
 *
 * Trois gestes reviennent dans chaque route : marquer une réponse comme
 * personnelle, traduire un échec métier en statut, et refuser une entrée
 * invalide. Les factoriser ici évite qu'une route oublie le `no-store` ou
 * invente son propre format d'erreur — `lib/api/garde.ts` reste l'unique
 * source de la forme des erreurs.
 */

/** Données personnelles : ni cache navigateur, ni cache intermédiaire. */
export const jsonPrive = (donnees: unknown, statut = 200) =>
  Response.json(donnees, { status: statut, headers: { "Cache-Control": "no-store" } });

/**
 * Un échec de `lib/` porte déjà son statut et son code : la route n'a rien à
 * réinterpréter, et deux routes ne peuvent pas répondre différemment au même
 * refus.
 */
export const reponseEchec = (e: EchecMetier) => erreur(e.erreur, e.statut, e.code);

/** Valide une entrée (corps ou paramètres) et rend 400 en cas de refus. */
export function valider<S extends z.ZodType>(schema: S, valeur: unknown): Resultat<z.output<S>> {
  const parse = schema.safeParse(valeur);
  if (parse.success) return { ok: true, valeur: parse.data };

  return {
    ok: false,
    reponse: erreur(
      parse.error.issues[0]?.message ?? "Requête invalide",
      400,
      "requete_invalide",
    ),
  };
}
