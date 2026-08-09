"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/session";
import { appliquerPreferences } from "@/lib/preferences";
import { signOut } from "@/auth";

/** Enveloppe web de `lib/preferences.ts` — `PUT /api/v1/me/preferences` appelle le même module. */
export async function modifierPreferences(entree: unknown) {
  const user = await requireOnboardedUser();

  const resultat = await appliquerPreferences(user.id, entree);
  if ("erreur" in resultat) return { erreur: resultat.erreur };

  revalidatePath("/dashboard");
  revalidatePath("/calendrier");
  revalidatePath("/parametres");

  return { ok: true as const };
}

/**
 * Suppression de compte (RGPD).
 *
 * Les relations sont en `onDelete: Cascade` : séances, pesées, plan, sessions
 * et comptes OAuth partent avec l'utilisateur. Rien à nettoyer à la main —
 * et rien qui puisse être oublié.
 */
export async function supprimerCompte(confirmation: string) {
  const user = await requireOnboardedUser();

  if (confirmation !== "SUPPRIMER") {
    return { erreur: "Recopie SUPPRIMER en majuscules pour confirmer." };
  }

  await prisma.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/" });
}
