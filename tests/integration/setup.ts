import { afterAll, beforeAll, vi } from "vitest";

/**
 * Doublures communes à tous les fichiers d'intégration.
 *
 * Trois choses ne peuvent pas tourner telles quelles hors d'une requête
 * Next : l'authentification, le cache et la révalidation. Tout le reste —
 * Prisma, le moteur, les actions — est le vrai code.
 */

// Garde-fou : si DATABASE_URL n'a pas été forcée, on s'arrête avant d'avoir
// écrit quoi que ce soit dans la base de développement.
if (!/\/lafaille_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    `DATABASE_URL vaut « ${process.env.DATABASE_URL} ». Les tests d'intégration ` +
      `n'écrivent que dans la base lafaille_test — lance-les avec npm run test:integration.`,
  );
}

// Deuxième garde-fou, cette fois sur la base à laquelle Postgres est
// réellement connecté : la variable d'environnement pourrait mentir, pas lui.
beforeAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  const [{ current_database }] = await prisma.$queryRawUnsafe<{ current_database: string }[]>(
    "SELECT current_database()",
  );
  if (current_database !== "lafaille_test") {
    throw new Error(`Les tests écriraient dans « ${current_database} ». Suite interrompue.`);
  }
});

// On libère la connexion : sans ça, le DROP DATABASE de la prochaine
// exécution resterait bloqué par une session encore ouverte.
afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});

vi.mock("@/auth", async () => {
  const { sessionDeTest } = await import("./session-courante");
  return {
    auth: async () => sessionDeTest(),
    signOut: vi.fn(async () => {}),
    signIn: vi.fn(async () => {}),
    handlers: {},
    fournisseursActifs: () => [],
  };
});

// Réimplémentation fidèle de lib/session.ts, dont on ne remplace que la source
// de la session : les redirections d'autorisation restent testables.
vi.mock("@/lib/session", async () => {
  const { redirect } = await import("next/navigation");
  const { sessionDeTest } = await import("./session-courante");

  const requireUser = async () => {
    const session = await sessionDeTest();
    if (!session?.user) redirect("/");
    return session!.user;
  };

  return {
    requireUser,
    requireOnboardedUser: async () => {
      const user = await requireUser();
      if (!user.onboarded) redirect("/onboarding");
      return user;
    },
    nonAutorise: () => Response.json({ error: "Authentification requise" }, { status: 401 }),
  };
});

// `revalidatePath` exige le store de génération de Next et lève sans lui.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
