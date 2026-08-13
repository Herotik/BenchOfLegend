import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { construireFournisseurs, emailVerifie, fournisseursActifs } from "@/lib/fournisseurs";

/**
 * Auth.js v5. Le fichier vit à la racine (pas dans app/) pour être importable
 * aussi bien depuis les Server Components que depuis proxy.ts.
 *
 * Trois portes d'entrée — Google, Apple, Discord — chacune active à la présence
 * de ses variables d'environnement. Le détail est dans `lib/fournisseurs.ts` :
 * ici, on ne fait que les assembler.
 *
 * La configuration est **une fonction**, non un objet : le secret d'Apple est
 * un jeton signé qu'il faut fabriquer, donc obtenu de façon asynchrone.
 */
export const { handlers, signIn, signOut, auth } = NextAuth(async () => ({
  adapter: PrismaAdapter(prisma),

  // Stratégie « database » : la session vit dans la table Session, ce qui
  // permet de lire l'état métier à jour (lp, onboarded) à chaque requête
  // plutôt qu'un JWT figé à la connexion.
  session: { strategy: "database" },

  providers: await construireFournisseurs(),

  pages: {
    signIn: "/",
    error: "/",
  },

  callbacks: {
    /**
     * Dernier verrou avant la création ou le rattachement d'un compte.
     *
     * Les fournisseurs rattachent au même utilisateur deux connexions de même
     * adresse (`allowDangerousEmailAccountLinking`), sans quoi revenir par
     * Apple après s'être inscrit par Google claquerait la porte. Ce rattachement
     * ne vaut que si l'adresse a réellement été vérifiée par le fournisseur :
     * sinon, il suffirait de déclarer l'adresse d'autrui pour entrer chez lui.
     */
    signIn({ account, profile }) {
      // Sans compte fournisseur, il n'y a rien à rattacher : le cas ne se
      // présente pas ici, aucune connexion par mot de passe n'étant déclarée.
      if (!account) return true;
      return emailVerifie(account.provider, profile);
    },

    // `strategy: "database"` fournit `user` : on recopie ce dont l'app a
    // besoin partout (garde de redirection onboarding, affichage du rang).
    session({ session, user }) {
      session.user.id = user.id;
      session.user.onboarded = (user as { onboarded?: boolean }).onboarded ?? false;
      session.user.lp = (user as { lp?: number }).lp ?? 0;
      return session;
    },
  },
}));

export { fournisseursActifs };
