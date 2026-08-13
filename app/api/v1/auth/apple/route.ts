import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { corpsJson, erreur } from "@/lib/api/garde";
import { reponseEchec } from "@/lib/api/reponse";
import { rattacherOuCreer } from "@/lib/api/comptes";
import { creerCouple } from "@/lib/api/jetons";
import { reponseConnexion } from "@/lib/api/connexion";
import { estEchec, identiteDepuisPreuve } from "@/lib/api/preuves";

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
 * La vérification du jeton vit dans `lib/api/preuves.ts`, partagée avec le
 * rattachement d'une connexion supplémentaire : c'est le seul endroit où l'on
 * décide qu'une identité est authentique.
 */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) {
    return erreur(parse.error.issues[0]?.message ?? "Requête invalide", 400, "requete_invalide");
  }

  const identite = await identiteDepuisPreuve({
    fournisseur: "apple",
    identityToken: parse.data.identityToken,
    nom: parse.data.nom,
  });
  if (estEchec(identite)) return reponseEchec(identite);

  const user = await rattacherOuCreer(identite);

  // Le nom n'arrive qu'une fois, et pas forcément à la création du compte :
  // quelqu'un déjà inscrit par Google puis revenu par Apple a un compte, mais
  // peut n'avoir jamais eu de nom. On le complète, sans jamais l'écraser.
  const complete =
    !user.name && identite.nom
      ? await prisma.user.update({ where: { id: user.id }, data: { name: identite.nom } })
      : user;

  return reponseConnexion(complete, await creerCouple(complete.id, parse.data.appareil));
}
