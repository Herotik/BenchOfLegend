import { z } from "zod";
import { corpsJson, erreur } from "@/lib/api/garde";
import { reponseEchec } from "@/lib/api/reponse";
import { rattacherOuCreer } from "@/lib/api/comptes";
import { creerCouple } from "@/lib/api/jetons";
import { reponseConnexion } from "@/lib/api/connexion";
import { estEchec, identiteDepuisPreuve } from "@/lib/api/preuves";

const schema = z.object({
  /** `id_token` obtenu par la connexion Google native de l'app. */
  idToken: z.string().min(20),
  /** Libellé libre, pour distinguer les appareils dans les réglages. */
  appareil: z.string().max(120).optional(),
});

/**
 * Connexion native Google de l'app mobile.
 *
 * L'app mène le flux avec le SDK de Google — la feuille de comptes du système,
 * sans navigateur — puis nous transmet le jeton d'identité, vérifié contre les
 * clés publiques de Google par `lib/api/preuves.ts`.
 *
 * Le compte est rattaché par `providerAccountId`, exactement comme le fait
 * l'adaptateur Auth.js côté web : se connecter depuis le téléphone retrouve le
 * même utilisateur que depuis le navigateur, pas un doublon.
 */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) {
    return erreur(parse.error.issues[0]?.message ?? "Requête invalide", 400, "requete_invalide");
  }

  const identite = await identiteDepuisPreuve({
    fournisseur: "google",
    idToken: parse.data.idToken,
  });
  if (estEchec(identite)) return reponseEchec(identite);

  const user = await rattacherOuCreer(identite);
  return reponseConnexion(user, await creerCouple(user.id, parse.data.appareil));
}
