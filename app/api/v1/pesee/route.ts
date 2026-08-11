import { authentifierOnboarde, corpsJson } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { enregistrerPeseePour, schemaPesee } from "@/lib/pesee";

/**
 * Pesée du jour.
 *
 * Idempotente dans la journée : rappeler la route corrige la valeur sans
 * recréditer les 2 Δ. Les Δ récompensent le suivi, pas le nombre
 * d'allers-retours.
 */
export async function POST(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const entree = valider(schemaPesee, corps.valeur);
  if (!entree.ok) return entree.reponse;

  const resultat = await enregistrerPeseePour(auth.valeur.id, entree.valeur.kg);
  if ("erreur" in resultat) return reponseEchec(resultat);

  return jsonPrive({
    date: resultat.date,
    kg: resultat.kg,
    lpGagnes: resultat.lpGagnes,
    lpTotal: resultat.lpTotal,
    promotion: resultat.promoted,
    rang: resultat.newRank,
  });
}
