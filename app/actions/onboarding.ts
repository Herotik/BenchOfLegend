"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { jourUTC } from "@/lib/dates";
import { operationsPreferences, schemaPreferences } from "@/lib/preferences";

// L'onboarding demande la même chose que les réglages, plus le poids de départ.
const schemaOnboarding = schemaPreferences.extend({
  poidsKg: z.number().min(30, "Poids invalide").max(300, "Poids invalide"),
});

export type DonneesOnboarding = z.input<typeof schemaOnboarding>;

export async function terminerOnboarding(donnees: DonneesOnboarding) {
  const user = await requireUser();

  // Le client est un composant React, mais rien n'empêche d'appeler l'action
  // directement : tout est revalidé ici.
  const parse = schemaOnboarding.safeParse(donnees);
  if (!parse.success) {
    return { erreur: parse.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parse.data;

  await prisma.$transaction([
    ...operationsPreferences(user.id, d, { onboarded: true }),

    // Première pesée : c'est le point de départ de la courbe de poids.
    prisma.weighIn.upsert({
      where: { userId_date: { userId: user.id, date: jourUTC() } },
      update: { kg: d.poidsKg },
      create: { userId: user.id, date: jourUTC(), kg: d.poidsKg },
    }),
  ]);

  // Hors du try/catch : redirect() lève une exception de contrôle que Next
  // doit recevoir intacte.
  redirect("/dashboard");
}
