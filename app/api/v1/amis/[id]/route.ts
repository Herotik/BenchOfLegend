import { z } from "zod";
import { authentifierOnboarde, corpsJson } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { listerPhalange, repondre, rompre } from "@/lib/amis";
import { estEchec } from "@/lib/erreurs";

const schemaReponse = z.object({ accepte: z.boolean() });

/**
 * Répond à une demande reçue.
 *
 * Seul le destinataire peut répondre, et une demande adressée à quelqu'un
 * d'autre est traitée comme inexistante — le refus vient de `repondre`, où la
 * règle est vérifiée en même temps que la lecture, et non ici où deux appelants
 * pourraient l'oublier chacun de leur côté.
 */
export async function POST(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const valide = valider(schemaReponse, corps.valeur);
  if (!valide.ok) return valide.reponse;

  const { id } = await params;
  const resultat = await repondre(auth.valeur.id, id, valide.valeur.accepte);
  if (estEchec(resultat)) return reponseEchec(resultat);

  return jsonPrive(await listerPhalange(auth.valeur.id));
}

/** Rompt le lien. Chacun des deux peut partir, sans l'accord de l'autre. */
export async function DELETE(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const { id } = await params;
  const resultat = await rompre(auth.valeur.id, id);
  if (estEchec(resultat)) return reponseEchec(resultat);

  return jsonPrive(await listerPhalange(auth.valeur.id));
}
