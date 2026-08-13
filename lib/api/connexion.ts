import "server-only";
import type { User } from "@prisma/client";
import type { CoupleJetons } from "@/lib/api/jetons";

/**
 * Réponse commune aux connexions de l'app mobile.
 *
 * Les quatre chemins d'entrée — relais navigateur, Google, Apple, Discord —
 * rendent tous la même chose : le couple de jetons et le profil minimal dont
 * l'app a besoin pour afficher son premier écran sans attendre `GET /me`.
 *
 * L'app type cette forme une seule fois (`ReponseEchange`) ; qu'une route
 * s'en écarte casserait un écran sans que rien ne le signale à la compilation,
 * les deux projets n'ayant pas de types en commun.
 */
export function reponseConnexion(user: User, jetons: CoupleJetons): Response {
  return Response.json(
    {
      ...jetons,
      utilisateur: {
        id: user.id,
        email: user.email,
        nom: user.name,
        image: user.image,
        onboarded: user.onboarded,
        lp: user.lp,
      },
    },
    // Jamais mis en cache : la réponse porte des jetons.
    { headers: { "Cache-Control": "no-store" } },
  );
}
