import { authentifier } from "@/lib/api/garde";
import { jsonPrive, reponseEchec } from "@/lib/api/reponse";
import { detacher, listerConnexions } from "@/lib/api/comptes";
import { estEchec } from "@/lib/erreurs";

/**
 * Retire une façon de se connecter.
 *
 * Jamais la dernière : l'app n'ayant pas de mot de passe, retirer la seule
 * connexion restante fermerait le compte définitivement, sans recours. Le refus
 * vient de `detacher`, où la règle est vérifiée en même temps que la lecture —
 * pas ici, où deux appelants pourraient l'oublier chacun de leur côté.
 */
export async function DELETE(
  requete: Request,
  { params }: { params: Promise<{ fournisseur: string }> },
) {
  const auth = await authentifier(requete);
  if (!auth.ok) return auth.reponse;

  const { fournisseur } = await params;

  const resultat = await detacher(auth.valeur.id, fournisseur);
  if (estEchec(resultat)) return reponseEchec(resultat);

  return jsonPrive({ connexions: await listerConnexions(auth.valeur.id) });
}
