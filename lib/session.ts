import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Autorisation qui fait foi, à appeler dans chaque page et route handler
 * protégé. `proxy.ts` ne fait qu'un contrôle optimiste sur le cookie.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/");
  return session.user;
}

/**
 * Comme `requireUser`, mais force le passage par l'onboarding tant que le
 * profil n'est pas complet (spec §4.1).
 */
export async function requireOnboardedUser() {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  return user;
}

/** Réponse 401 standard pour les route handlers. */
export const nonAutorise = () =>
  Response.json({ error: "Authentification requise" }, { status: 401 });
