import { authentifierOnboarde } from "@/lib/api/garde";
import { jsonPrive } from "@/lib/api/reponse";
import { codePersonnel } from "@/lib/amis";

/**
 * Le code personnel à partager.
 *
 * `GET` le crée au premier appel plutôt qu'à l'inscription : la plupart des
 * comptes n'en auront jamais besoin, et un identifiant public qu'on n'a pas
 * demandé n'a pas à exister.
 */
export async function GET(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  return jsonPrive({ code: await codePersonnel(auth.valeur.id) });
}

/**
 * Régénère le code. L'ancien cesse aussitôt de fonctionner ; les amitiés déjà
 * nouées survivent, le code ne servant qu'à demander.
 */
export async function POST(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  return jsonPrive({ code: await codePersonnel(auth.valeur.id, { regenerer: true }) });
}
