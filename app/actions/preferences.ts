"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/session";
import { jourUTC } from "@/lib/dates";
import { operationsPreferences, schemaPreferences, type Preferences } from "@/lib/preferences";
import { signOut } from "@/auth";

export async function modifierPreferences(entree: unknown) {
  const user = await requireOnboardedUser();

  const parse = schemaPreferences.safeParse(entree);
  if (!parse.success) {
    return { erreur: parse.error.issues[0]?.message ?? "Données invalides" };
  }

  await prisma.$transaction([
    ...operationsPreferences(user.id, parse.data as Preferences),

    // Le plan à venir est régénéré, jamais le passé (spec §4.2). Les séances
    // déjà validées sont préservées : elles font partie de l'historique et
    // ont rapporté des LP. Les jours restants sont supprimés, la génération
    // les recrée au prochain chargement avec les nouvelles préférences.
    prisma.planDay.deleteMany({
      where: { userId: user.id, date: { gte: jourUTC() }, status: { not: "FAIT" } },
    }),
  ]);

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
