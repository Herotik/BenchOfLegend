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

/**
 * Origines autorisées à appeler l'API depuis un navigateur, **en développement
 * seulement**.
 *
 * L'app mobile native n'est pas soumise au CORS : `fetch` en React Native
 * n'envoie pas d'`Origin` et le navigateur n'arbitre rien. Ces en-têtes ne
 * servent donc qu'à une chose — prévisualiser les écrans de l'app dans un
 * navigateur, où Expo sert le bundle sur un autre port que l'API. En
 * production, `EN_DEV` est faux et rien n'est ajouté : l'API reste fermée aux
 * requêtes inter-origines.
 */
const EN_DEV = process.env.NODE_ENV !== "production";
const ORIGINES_APERCU = /^http:\/\/localhost:\d+$/;

function apercuAutorise(origine: string | null): boolean {
  return EN_DEV && origine !== null && ORIGINES_APERCU.test(origine);
}

export function proxy(request: NextRequest) {
  const origine = request.headers.get("origin");

  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!apercuAutorise(origine)) return NextResponse.next();

    // Le contrôle préalable ne doit pas atteindre la route : celle-ci
    // n'exporte pas `OPTIONS` et répondrait 405, ce que le navigateur lit
    // comme un refus.
    const reponse =
      request.method === "OPTIONS"
        ? new NextResponse(null, { status: 204 })
        : NextResponse.next();

    reponse.headers.set("Access-Control-Allow-Origin", origine!);
    reponse.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    reponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reponse.headers.set("Vary", "Origin");
    return reponse;
  }

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
   * `/api/*` figure ici pour les seuls en-têtes CORS de développement — la
   * fonction s'en va aussitôt sans toucher à l'autorisation. Rediriger un
   * appel d'API vers la landing renverrait du HTML à un appel JSON : chaque
   * route handler appelle `auth()` et répond 401 lui-même.
   */
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/seance-bonus/:path*",
    "/calendrier/:path*",
    "/graphiques/:path*",
    "/historique/:path*",
    "/parametres/:path*",
  ],
};
