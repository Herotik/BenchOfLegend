import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Faux tant que le wizard d'onboarding n'a pas été validé. */
      onboarded: boolean;
      /** LP cumulés, pour afficher le rang sans requête supplémentaire. */
      lp: number;
    } & DefaultSession["user"];
  }

  // Champs métier ajoutés au modèle User côté Prisma, exposés à Auth.js.
  interface User {
    onboarded?: boolean;
    lp?: number;
  }
}
