import { auth, signIn } from "@/auth";
import { erreur } from "@/lib/api/garde";
import { fournisseursActifs } from "@/lib/fournisseurs";
import { creerCodeRelais, retourAutorise } from "@/lib/api/relais";

/**
 * Point d'entrée du relais, ouvert dans le navigateur par l'app mobile.
 *
 * Si une session web existe déjà, on rend la main tout de suite avec un code.
 * Sinon il faut identifier l'utilisateur, puis repasser ici — d'où les
 * destinations pointant toutes sur nous-mêmes.
 *
 * Avec un seul fournisseur configuré, on l'enclenche directement : imposer un
 * écran de choix à une seule option ne serait qu'une étape de plus. Avec
 * plusieurs, c'est la page d'accueil qui les présente, et elle nous revient
 * par son `suivant`.
 */
export async function GET(requete: Request) {
  const url = new URL(requete.url);
  const retour = url.searchParams.get("retour") ?? "";

  if (!retourAutorise(retour)) {
    // Sans ce refus, l'adresse de retour venant de la requête ferait de cette
    // route une redirection ouverte expédiant un code d'authentification.
    return erreur("Adresse de retour non autorisée", 400, "retour_invalide");
  }

  const session = await auth();

  if (!session?.user) {
    const chemin = `${url.pathname}?retour=${encodeURIComponent(retour)}`;
    const moi = `${url.origin}${chemin}`;
    const fournisseurs = fournisseursActifs();

    if (fournisseurs.length === 0) {
      return erreur("Aucune connexion configurée", 503, "connexion_indisponible");
    }

    if (fournisseurs.length > 1) {
      // La landing sait déjà dessiner les boutons et rattraper les erreurs
      // d'Auth.js. Elle nous ramène ici par `suivant`, qu'elle passe en
      // `redirectTo` — un chemin interne, seul format qu'elle accepte.
      const choix = new URL("/", url.origin);
      choix.searchParams.set("suivant", chemin);
      return Response.redirect(choix.toString(), 303);
    }

    // `redirect: false` plutôt que de laisser `signIn` rediriger lui-même.
    // Sa redirection passe par le mécanisme des Server Actions ; dans un route
    // handler elle retombait sur la destination par défaut — la page
    // d'accueil — et `redirectTo` était perdu. L'utilisateur s'identifiait
    // chez le fournisseur puis atterrissait sur le site, l'app restant en plan.
    const versFournisseur = await signIn(fournisseurs[0]!.id, {
      redirect: false,
      redirectTo: moi,
    });
    return Response.redirect(versFournisseur, 303);
  }

  const code = await creerCodeRelais(session.user.id);
  const destination = new URL(retour);
  destination.searchParams.set("code", code);

  return Response.redirect(destination.toString(), 303);
}
