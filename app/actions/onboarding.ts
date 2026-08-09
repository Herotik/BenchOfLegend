"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { terminerOnboardingPour, type DonneesOnboarding } from "@/lib/onboarding";

export type { DonneesOnboarding };

/** Enveloppe web de `lib/onboarding.ts` — `POST /api/v1/me/onboarding` appelle le même module. */
export async function terminerOnboarding(donnees: DonneesOnboarding) {
  const user = await requireUser();

  const resultat = await terminerOnboardingPour(user.id, donnees);
  if ("erreur" in resultat) return { erreur: resultat.erreur };

  // Hors du try/catch : redirect() lève une exception de contrôle que Next
  // doit recevoir intacte.
  redirect("/dashboard");
}
