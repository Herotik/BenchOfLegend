import { z } from "zod";
import { authentifierOnboarde } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { chargerHistorique, LIMITE_DEFAUT, LIMITE_MAX } from "@/lib/historique";

const schema = z.object({
  limite: z.coerce.number().int().min(1).max(LIMITE_MAX).default(LIMITE_DEFAUT),
  /** Identifiant de la dernière séance reçue — curseur de la page suivante. */
  avant: z.string().min(1).optional(),
});

/**
 * Séances passées, de la plus récente à la plus ancienne.
 *
 * Pagination par curseur : voir `lib/historique.ts`. Un curseur qui n'est pas
 * une séance de l'appelant est refusé en 400, sans distinguer « inexistant »
 * de « appartient à quelqu'un d'autre ».
 */
export async function GET(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const { searchParams } = new URL(requete.url);
  const params = valider(schema, {
    limite: searchParams.get("limite") ?? undefined,
    avant: searchParams.get("avant") ?? undefined,
  });
  if (!params.ok) return params.reponse;

  const page = await chargerHistorique(auth.valeur.id, params.valeur);
  if ("erreur" in page) return reponseEchec(page);

  return jsonPrive(page);
}
