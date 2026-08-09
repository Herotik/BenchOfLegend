import { authentifierOnboarde, corpsJson } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { schemaValidationSeanceApi, validerSeancePour } from "@/lib/seance";

/**
 * Valide une séance et crédite les LP.
 *
 * Le calcul reste entièrement serveur : l'app n'envoie que le statut de chaque
 * exercice et son ressenti. La séance est régénérée à partir de la même
 * graine, les LP en sont déduits, et rien de ce que le client annonce comme
 * gain n'est lu.
 *
 * Statuts : 409 si la séance du jour est déjà validée, 404 si le jour de plan
 * n'existe pas ou n'appartient pas à l'appelant, 422 pour les autres refus
 * métier — séance d'un autre jour, groupe qui ne correspond pas.
 */
export async function POST(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const entree = valider(schemaValidationSeanceApi, corps.valeur);
  if (!entree.ok) return entree.reponse;

  const resultat = await validerSeancePour(auth.valeur.id, entree.valeur);
  if ("erreur" in resultat) return reponseEchec(resultat);

  return jsonPrive(
    {
      lpGagnes: resultat.lpEarned,
      details: resultat.details,
      lpTotal: resultat.lpTotal,
      promotion: resultat.promoted,
      rang: resultat.newRank,
      proposition: resultat.proposition
        ? {
            delta: resultat.proposition.delta,
            message: resultat.proposition.message,
            groupe: resultat.proposition.muscleGroup,
          }
        : null,
    },
    201,
  );
}
