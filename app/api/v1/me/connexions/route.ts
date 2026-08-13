import { prisma } from "@/lib/prisma";
import { authentifier } from "@/lib/api/garde";
import { corpsJson } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { listerConnexions, rattacherA } from "@/lib/api/comptes";
import { estEchec, identiteDepuisPreuve, schemaPreuve } from "@/lib/api/preuves";

/**
 * Façons de se connecter rattachées au compte.
 *
 * À la connexion, deux comptes ne se rejoignent que s'ils portent la **même
 * adresse vérifiée**. C'est la seule règle sûre quand personne n'est encore
 * identifié — mais elle laisse de côté le cas le plus banal : l'identifiant
 * Apple et le compte Google d'une même personne n'ont aucune raison de partager
 * une adresse.
 *
 * Ici, l'utilisateur est **déjà connecté**. Son identité est prouvée par sa
 * session, l'adresse n'a plus rien à arbitrer, et rattacher une deuxième porte
 * d'entrée devient une opération sûre.
 */
export async function GET(requete: Request) {
  const auth = await authentifier(requete);
  if (!auth.ok) return auth.reponse;

  return jsonPrive({ connexions: await listerConnexions(auth.valeur.id) });
}

export async function POST(requete: Request) {
  const auth = await authentifier(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const preuve = valider(schemaPreuve, corps.valeur);
  if (!preuve.ok) return preuve.reponse;

  // Vérifiée exactement comme à la connexion : une identité rattachée sans
  // preuve serait une identité usurpée.
  const identite = await identiteDepuisPreuve(preuve.valeur);
  if (estEchec(identite)) return reponseEchec(identite);

  const resultat = await rattacherA(auth.valeur.id, identite);
  if (estEchec(resultat)) return reponseEchec(resultat);

  // Apple ne livre le nom qu'à la toute première autorisation. Si le compte n'en
  // a pas encore, c'est le seul moment où on peut le recueillir.
  if (identite.nom) {
    await prisma.user.updateMany({
      where: { id: auth.valeur.id, name: null },
      data: { name: identite.nom },
    });
  }

  return jsonPrive({ connexions: await listerConnexions(auth.valeur.id) }, 201);
}
