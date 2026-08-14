import { z } from "zod";
import { authentifierOnboarde, corpsJson } from "@/lib/api/garde";
import { jsonPrive, reponseEchec, valider } from "@/lib/api/reponse";
import { demander, listerPhalange } from "@/lib/amis";
import { estEchec } from "@/lib/erreurs";

/**
 * La phalange : compagnons acceptés, demandes reçues, demandes envoyées.
 *
 * Aucune route de ce dossier ne prend d'identifiant d'utilisateur en entrée.
 * On part toujours de la session, et l'on ne rend que des comptes déjà liés —
 * il n'existe donc nulle part de « donne-moi les statistiques de X ».
 */
export async function GET(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  return jsonPrive(await listerPhalange(auth.valeur.id));
}

const schemaDemande = z.object({ code: z.string().min(1, "Code requis") });

/** Demande à rejoindre la phalange du porteur d'un code. */
export async function POST(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const valide = valider(schemaDemande, corps.valeur);
  if (!valide.ok) return valide.reponse;

  const resultat = await demander(auth.valeur.id, valide.valeur.code);
  if (estEchec(resultat)) return reponseEchec(resultat);

  return jsonPrive({ amitieId: resultat.amitieId }, 201);
}
