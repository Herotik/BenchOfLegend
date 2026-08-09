import { prisma } from "@/lib/prisma";

/**
 * L'utilisateur « connecté » du test en cours.
 *
 * Sert de source aux doublures de `@/auth` et `@/lib/session` : les Server
 * Actions n'ont aucun moyen d'obtenir une session autrement, et monter un vrai
 * cookie Auth.js n'apporterait rien de plus au test du comportement métier.
 */

let idCourant: string | null = null;

export function connecter(userId: string | null): void {
  idCourant = userId;
}

export function idConnecte(): string | null {
  return idCourant;
}

/**
 * Session au format que produit le callback `session` de `auth.ts`.
 *
 * Relue en base à chaque appel : c'est ce que fait la stratégie « database »,
 * et c'est ce qui permet à une action de voir les LP à jour laissés par la
 * précédente.
 */
export async function sessionDeTest() {
  if (!idCourant) return null;
  const u = await prisma.user.findUnique({ where: { id: idCourant } });
  if (!u) return null;
  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      onboarded: u.onboarded,
      lp: u.lp,
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}
