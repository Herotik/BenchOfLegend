import { z } from "zod";
import { corpsJson, erreur } from "@/lib/api/garde";
import { rattacherOuCreer } from "@/lib/api/comptes";
import { creerCouple, verifierIdentiteDiscord } from "@/lib/api/jetons";
import { reponseConnexion } from "@/lib/api/connexion";
import { retourAutorise } from "@/lib/api/relais";

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
 * `discord.com` et n'en rapporte qu'un code. L'échange se fait ici, où le
 * secret du client peut vivre — dans un binaire distribué, il se lirait au
 * désassemblage.
 */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) {
    return erreur(parse.error.issues[0]?.message ?? "Requête invalide", 400, "requete_invalide");
  }

  // La redirection vient de la requête et repart chez Discord. On n'accepte
  // donc que les schémas de l'app, comme le relais navigateur : sans ce
  // filtre, elle ferait de cette route un moyen d'obtenir un code pour une
  // application tierce.
  if (!retourAutorise(parse.data.redirection)) {
    return erreur("Adresse de retour non autorisée", 400, "retour_invalide");
  }

  const identite = await verifierIdentiteDiscord(
    parse.data.code,
    parse.data.verificateur,
    parse.data.redirection,
  );
  if (!identite) {
    return erreur("Identité Discord non vérifiable", 401, "discord_invalide");
  }

  const user = await rattacherOuCreer({ fournisseur: "discord", ...identite });
  return reponseConnexion(user, await creerCouple(user.id, parse.data.appareil));
}
