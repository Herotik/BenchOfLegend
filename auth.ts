import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Auth.js v5. Le fichier vit à la racine (pas dans app/) pour être importable
 * aussi bien depuis les Server Components que depuis proxy.ts.
 *
 * Les identifiants Google sont lus automatiquement dans AUTH_GOOGLE_ID et
 * AUTH_GOOGLE_SECRET, et le secret de session dans AUTH_SECRET.
 */

/** Vrai si les identifiants OAuth sont renseignés. */
export const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

  // Stratégie « database » : la session vit dans la table Session, ce qui
  // permet de lire l'état métier à jour (lp, onboarded) à chaque requête
  // plutôt qu'un JWT figé à la connexion.
  session: { strategy: "database" },

  // Sans identifiants, on n'enregistre aucun provider : Auth.js lèverait
  // sinon une erreur de configuration au chargement du module.
  providers: googleConfigured ? [Google] : [],

  pages: {
    signIn: "/",
    error: "/",
  },

  callbacks: {
    // `strategy: "database"` fournit `user` : on recopie ce dont l'app a
    // besoin partout (garde de redirection onboarding, affichage du rang).
    session({ session, user }) {
      session.user.id = user.id;
      session.user.onboarded = (user as { onboarded?: boolean }).onboarded ?? false;
      session.user.lp = (user as { lp?: number }).lp ?? 0;
      return session;
    },
  },
});
