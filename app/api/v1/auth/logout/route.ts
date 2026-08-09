import { z } from "zod";
import { authentifier, corpsJson } from "@/lib/api/garde";
import { revoquer, revoquerTout } from "@/lib/api/jetons";

const schema = z.object({
  refreshToken: z.string().optional(),
  /** Déconnecte tous les appareils — utile en cas de téléphone perdu. */
  partout: z.boolean().optional(),
});

export async function POST(requete: Request) {
  const auth = await authentifier(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  const parse = corps.ok ? schema.safeParse(corps.valeur) : null;
  const d = parse?.success ? parse.data : {};

  if (d.partout) await revoquerTout(auth.valeur.id);
  else if (d.refreshToken) await revoquer(d.refreshToken);

  // Le jeton d'accès reste techniquement valide jusqu'à son expiration : c'est
  // le prix d'un JWT non consulté en base. Quinze minutes, et sans possibilité
  // de le renouveler.
  return new Response(null, { status: 204 });
}
