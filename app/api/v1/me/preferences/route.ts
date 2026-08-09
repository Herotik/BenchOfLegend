import { authentifierOnboarde, corpsJson } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { appliquerPreferences, lirePreferences, schemaPreferencesApi } from "@/lib/preferences";

/**
 * Modifie les préférences et régénère le plan à venir.
 *
 * PUT et non PATCH : les préférences se remplacent en bloc, comme le
 * formulaire des réglages les envoie. Un envoi partiel effacerait des groupes
 * sans le dire.
 */
export async function PUT(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const entree = valider(schemaPreferencesApi, corps.valeur);
  if (!entree.ok) return entree.reponse;

  const resultat = await appliquerPreferences(auth.valeur.id, entree.valeur);
  if ("erreur" in resultat) return reponseEchec(resultat);

  // On relit plutôt que de renvoyer l'entrée : le `levelOffset` conservé et
  // les priorités calculées ne se déduisent pas de ce qui a été envoyé.
  return jsonPrive({ preferences: await lirePreferences(auth.valeur.id) });
}
