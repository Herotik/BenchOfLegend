import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { corpsJson, erreur } from "@/lib/api/garde";
import { creerCouple } from "@/lib/api/jetons";
import { consommerCodeRelais } from "@/lib/api/relais";

const schema = z.object({
  code: z.string().min(20),
  appareil: z.string().max(120).optional(),
});

/** Échange le code du relais contre un couple de jetons. */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) return erreur("Requête invalide", 400, "requete_invalide");

  const userId = await consommerCodeRelais(parse.data.code);
  if (!userId) {
    return erreur("Code expiré ou déjà utilisé", 401, "code_invalide");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const jetons = await creerCouple(userId, parse.data.appareil);

  return Response.json(
    {
      ...jetons,
      utilisateur: {
        id: user.id,
        email: user.email,
        nom: user.name,
        image: user.image,
        onboarded: user.onboarded,
        lp: user.lp,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
