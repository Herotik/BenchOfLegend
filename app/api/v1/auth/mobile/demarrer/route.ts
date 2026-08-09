import { auth, signIn } from "@/auth";
import { erreur } from "@/lib/api/garde";
import { creerCodeRelais, retourAutorise } from "@/lib/api/relais";

/**
 * Point d'entrée du relais, ouvert dans le navigateur par l'app mobile.
 *
 * Si une session web existe déjà, on rend la main tout de suite avec un code.
 * Sinon on enclenche la connexion Google habituelle, qui repassera ici une
 * fois l'utilisateur identifié — d'où le `redirectTo` pointant sur nous-mêmes.
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
    const moi = `${url.origin}${url.pathname}?retour=${encodeURIComponent(retour)}`;
    await signIn("google", { redirectTo: moi });
    return; // signIn redirige : ce point n'est jamais atteint.
  }

  const code = await creerCodeRelais(session.user.id);
  const destination = new URL(retour);
  destination.searchParams.set("code", code);

  return Response.redirect(destination.toString(), 303);
}
