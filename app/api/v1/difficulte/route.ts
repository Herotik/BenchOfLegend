import { z } from "zod";
import { authentifierOnboarde, corpsJson } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { ajusterDifficultePour } from "@/lib/seance";
import { MUSCLE_GROUPS } from "@/lib/referentiel";

const schema = z.object({
  groupe: z.enum(MUSCLE_GROUPS.map((g) => g.id) as [string, ...string[]]),
  /** Un cran à la fois : sauter deux paliers de variantes est le meilleur moyen de se blesser. */
  delta: z.union([z.literal(1), z.literal(-1)]),
});

/**
 * Applique l'ajustement proposé au bilan de séance.
 *
 * Jamais automatique : la proposition vient du ressenti, l'utilisateur la
 * suit ou non. Une séance facile peut l'être pour mille raisons étrangères au
 * niveau.
 */
export async function POST(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const entree = valider(schema, corps.valeur);
  if (!entree.ok) return entree.reponse;

  const resultat = await ajusterDifficultePour(
    auth.valeur.id,
    entree.valeur.groupe,
    entree.valeur.delta,
  );
  if ("erreur" in resultat) return reponseEchec(resultat);

  return jsonPrive({ groupe: entree.valeur.groupe, decalageNiveau: resultat.levelOffset });
}
