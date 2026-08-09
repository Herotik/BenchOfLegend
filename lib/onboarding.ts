import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { champPoidsKg } from "@/lib/pesee";
import {
  objetPreferencesApi,
  operationsPreferences,
  schemaPreferences,
  versPreferences,
} from "@/lib/preferences";
import { echec, type EchecMetier } from "@/lib/erreurs";

/**
 * Fin de l'onboarding, partagée par l'action web et `POST /api/v1/me/onboarding`.
 *
 * L'onboarding demande la même chose que les réglages, plus le poids de départ
 * — et il le demande avec **les mêmes** validateurs : `schemaPreferences` pour
 * le profil, `champPoidsKg` pour le poids, celui-là même dont se sert la pesée
 * quotidienne.
 */

export const schemaOnboarding = schemaPreferences.extend({ poidsKg: champPoidsKg });

export type DonneesOnboarding = z.input<typeof schemaOnboarding>;

/** Même schéma, clés en français, pour l'API. */
export const schemaOnboardingApi = objetPreferencesApi
  .extend({ poidsKg: champPoidsKg })
  .transform((d) => ({ ...versPreferences(d), poidsKg: d.poidsKg }));

export async function terminerOnboardingPour(
  userId: string,
  donnees: unknown,
): Promise<{ ok: true } | EchecMetier> {
  // La garde vivait dans l'écran — /onboarding redirige quand le profil est
  // rempli — mais une Server Action est une URL appelable avec une simple
  // session valide. La rejouer écrasait préférences et pesée du jour. La règle
  // appartient donc ici, où les deux appelants en héritent.
  const deja = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { onboarded: true },
  });
  if (deja.onboarded) {
    return echec(
      "Ton profil est déjà rempli. Passe par les réglages pour le modifier.",
      "deja_onboarde",
      409,
    );
  }

  // Le client est un composant React, mais rien n'empêche d'appeler l'action
  // directement : tout est revalidé ici.
  const parse = schemaOnboarding.safeParse(donnees);
  if (!parse.success) {
    return echec(parse.error.issues[0]?.message ?? "Données invalides", "onboarding_invalide", 400);
  }
  const d = parse.data;

  await prisma.$transaction([
    ...operationsPreferences(userId, d, { onboarded: true }),

    // Première pesée : c'est le point de départ de la courbe de poids.
    prisma.weighIn.upsert({
      where: { userId_date: { userId, date: jourUTC() } },
      update: { kg: d.poidsKg },
      create: { userId, date: jourUTC(), kg: d.poidsKg },
    }),
  ]);

  return { ok: true };
}
