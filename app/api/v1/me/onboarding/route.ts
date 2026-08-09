import { authentifier, corpsJson, erreur } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { schemaOnboardingApi, terminerOnboardingPour } from "@/lib/onboarding";
import { lirePreferences } from "@/lib/preferences";

/**
 * Termine l'onboarding.
 *
 * `authentifier` seul, évidemment : exiger `onboarded` ici rendrait l'étape
 * impossible à franchir.
 */
export async function POST(requete: Request) {
  const auth = await authentifier(requete);
  if (!auth.ok) return auth.reponse;

  // Repasser par l'onboarding écraserait des préférences déjà choisies, et
  // remettrait la pesée du jour à la valeur du formulaire. Les modifications
  // passent par `PUT /api/v1/me/preferences`.
  if (auth.valeur.onboarded) {
    return erreur("Profil déjà complété", 409, "deja_onboarde");
  }

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const entree = valider(schemaOnboardingApi, corps.valeur);
  if (!entree.ok) return entree.reponse;

  const resultat = await terminerOnboardingPour(auth.valeur.id, entree.valeur);
  if ("erreur" in resultat) return reponseEchec(resultat);

  return jsonPrive(
    { onboarded: true, preferences: await lirePreferences(auth.valeur.id) },
    201,
  );
}
