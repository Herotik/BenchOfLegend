import { z } from "zod";
import { authentifierOnboarde, corpsJson } from "@/lib/api/garde";
import { jsonPrive, valider } from "@/lib/api/reponse";
import { reinitialiserCompte } from "@/lib/reinitialiser";

/**
 * Efface l'activité d'un compte sans le supprimer.
 *
 * `authentifierOnboarde` et non `authentifier` : un compte sans profil n'a ni
 * séance ni plan à effacer, et le laisser appeler cette route lui répondrait
 * « rien effacé » là où le vrai message est « tu n'as pas encore commencé ».
 *
 * Le profil, lui, n'est **jamais** remis à zéro ici — pas d'équivalent du
 * `--profil` du script en ligne de commande. L'onboarding mobile renvoie vers
 * le site : rendre `onboarded` faux depuis l'app enfermerait l'utilisateur
 * devant une carte « profil à compléter » sans moyen de le compléter.
 */
const schemaCorps = z.object({
  // Le client fournit cette constante automatiquement : elle ne protège donc
  // pas l'utilisateur — c'est la confirmation à l'écran qui s'en charge. Elle
  // rend seulement impossible qu'un POST égaré, sans corps ou mal formé,
  // efface un compte au passage.
  confirmation: z.literal("REINITIALISER"),
});

export async function POST(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const valide = valider(schemaCorps, corps.valeur);
  if (!valide.ok) return valide.reponse;

  const bilan = await reinitialiserCompte(auth.valeur.id);

  // Le plan n'est pas régénéré ici : `assurerPlans` tourne au prochain
  // chargement du tableau de bord, qui suit immédiatement. Le faire deux fois
  // ne changerait rien au résultat, seulement au temps de réponse.
  return jsonPrive({ efface: bilan });
}
