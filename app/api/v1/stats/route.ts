import { authentifierOnboarde } from "@/lib/api/garde";
import { jsonPrive } from "@/lib/api/reponse";
import { chargerStats } from "@/lib/stats";

/**
 * Agrégats des cinq graphiques (spec §8).
 *
 * `chargerStats` rend déjà des tableaux prêts à tracer, dates en AAAA-MM-JJ :
 * la route n'a rien à recalculer, et l'app native trace les mêmes courbes que
 * le web à partir des mêmes chiffres.
 */
export async function GET(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  return jsonPrive(await chargerStats(auth.valeur.id));
}
