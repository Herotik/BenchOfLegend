import { z } from "zod";
import { corpsJson, erreur } from "@/lib/api/garde";
import { faireTournerJeton } from "@/lib/api/jetons";

const schema = z.object({
  refreshToken: z.string().min(20),
  appareil: z.string().max(120).optional(),
});

/**
 * Renouvelle le couple de jetons.
 *
 * Le jeton présenté est révoqué au passage : chaque rafraîchissement en rend
 * un neuf. Représenter un jeton déjà consommé signale un vol, et déconnecte
 * alors tous les appareils — voir `faireTournerJeton`.
 */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) {
    return erreur("Requête invalide", 400, "requete_invalide");
  }

  const jetons = await faireTournerJeton(parse.data.refreshToken, parse.data.appareil);
  if (!jetons) {
    return erreur("Jeton de rafraîchissement invalide", 401, "rafraichissement_invalide");
  }

  return Response.json(jetons, { headers: { "Cache-Control": "no-store" } });
}
