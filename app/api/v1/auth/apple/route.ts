import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { corpsJson, erreur } from "@/lib/api/garde";
import { rattacherOuCreer } from "@/lib/api/comptes";
import { creerCouple, verifierIdentiteApple } from "@/lib/api/jetons";
import { reponseConnexion } from "@/lib/api/connexion";

const schema = z.object({
  /** `identityToken` rendu par « Sign in with Apple » natif. */
  identityToken: z.string().min(20),
  /**
   * Nom complet, que l'app ne reçoit qu'à la **première** autorisation.
   *
   * Apple ne le remet jamais ensuite, et il n'est pas dans le jeton : ne pas le
   * saisir au passage, c'est ne plus jamais pouvoir l'afficher.
   */
  nom: z.string().max(120).optional(),
  appareil: z.string().max(120).optional(),
});

/**
 * Connexion native Apple de l'app mobile.
 *
 * Le jeton d'identité est vérifié contre les clés publiques d'Apple, avec une
 * audience explicite — celle du flux natif étant l'identifiant de bundle, non
 * celui du service utilisé par le navigateur.
 */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) {
    return erreur(parse.error.issues[0]?.message ?? "Requête invalide", 400, "requete_invalide");
  }

  const identite = await verifierIdentiteApple(parse.data.identityToken);
  if (!identite) {
    return erreur("Identité Apple non vérifiable", 401, "apple_invalide");
  }

  const user = await rattacherOuCreer({
    fournisseur: "apple",
    sub: identite.sub,
    email: identite.email,
    emailVerifie: identite.emailVerifie,
    nom: parse.data.nom ?? null,
    image: null,
  });

  // Le nom n'arrive qu'une fois, et pas forcément à la création du compte :
  // quelqu'un déjà inscrit par Google puis revenu par Apple a un compte, mais
  // peut n'avoir jamais eu de nom. On le complète, sans jamais l'écraser.
  const complete =
    !user.name && parse.data.nom
      ? await prisma.user.update({ where: { id: user.id }, data: { name: parse.data.nom } })
      : user;

  return reponseConnexion(complete, await creerCouple(complete.id, parse.data.appareil));
}
