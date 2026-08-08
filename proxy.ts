import { NextResponse, type NextRequest } from "next/server";

/**
 * Ex-`middleware.ts` : Next.js 16 a renommé la convention en `proxy.ts`, avec
 * une fonction `proxy` (ou un export par défaut) et un runtime Node imposé.
 *
 * Le contrôle fait ici est volontairement **optimiste** : on regarde la seule
 * présence du cookie de session, sans requête en base. Les sessions sont
 * stockées en base (`strategy: "database"`), donc valider vraiment la session
 * ici coûterait un aller-retour Prisma sur chaque requête traversant le
 * matcher. L'autorisation qui fait foi est faite côté serveur par
 * `requireUser()` dans les pages protégées — un cookie périmé ou forgé passe
 * le proxy mais est rejeté juste après.
 */

// Auth.js v5 préfixe le cookie de `__Secure-` dès que la connexion est en HTTPS.
const COOKIES_SESSION = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const connecte = COOKIES_SESSION.some((nom) => request.cookies.has(nom));
  if (connecte) return NextResponse.next();

  const url = new URL("/", request.url);
  // Permet de renvoyer l'utilisateur là où il voulait aller après connexion.
  url.searchParams.set("suivant", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  /*
   * Liste explicite plutôt qu'un catch-all négatif : ce dernier engloberait
   * aussi `/`, et la landing redirigerait vers elle-même en boucle pour un
   * visiteur déconnecté.
   *
   * À tenir à jour en ajoutant toute nouvelle route protégée.
   *
   * Les routes `/api/*` sont volontairement absentes : les rediriger vers la
   * landing renverrait du HTML à un appel JSON. Chaque route handler appelle
   * `auth()` et répond 401 lui-même.
   */
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/seance-bonus/:path*",
    "/calendrier/:path*",
    "/graphiques/:path*",
    "/historique/:path*",
    "/parametres/:path*",
  ],
};
