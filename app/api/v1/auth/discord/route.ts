import { z } from "zod";
import { corpsJson, erreur } from "@/lib/api/garde";
import { reponseEchec } from "@/lib/api/reponse";
import { rattacherOuCreer } from "@/lib/api/comptes";
import { creerCouple } from "@/lib/api/jetons";
import { reponseConnexion } from "@/lib/api/connexion";
import { estEchec, identiteDepuisPreuve } from "@/lib/api/preuves";

const schema = z.object({
  /** Code d'autorisation rapporté par la feuille système ouverte sur Discord. */
  code: z.string().min(10).max(512),
  /** Vérificateur PKCE, à présenter avec le code pour l'échanger. */
  verificateur: z.string().min(20).max(256),
  /** Adresse de retour utilisée par l'app : Discord la revérifie à l'échange. */
  redirection: z.string().max(512),
  appareil: z.string().max(120).optional(),
});

/**
 * Connexion Discord de l'app mobile.
 *
 * Discord n'a pas de connexion native : l'app ouvre une feuille système sur
 * `discord.com` et n'en rapporte qu'un code. L'échange se fait côté serveur, où
 * le secret du client peut vivre — dans un binaire distribué, il se lirait au
 * désassemblage. Le détail est dans `lib/api/preuves.ts`.
 */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) {
    return erreur(parse.error.issues[0]?.message ?? "Requête invalide", 400, "requete_invalide");
  }

  const identite = await identiteDepuisPreuve({
    fournisseur: "discord",
    code: parse.data.code,
    verificateur: parse.data.verificateur,
    redirection: parse.data.redirection,
  });
  if (estEchec(identite)) return reponseEchec(identite);

  const user = await rattacherOuCreer(identite);
  return reponseConnexion(user, await creerCouple(user.id, parse.data.appareil));
}
