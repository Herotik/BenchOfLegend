"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { EQUIPMENTS, MUSCLE_GROUPS } from "@/lib/referentiel";
import { jourUTC } from "@/lib/dates";

const idsEquipement = EQUIPMENTS.map((e) => e.id);
const idsGroupe = MUSCLE_GROUPS.map((g) => g.id);

// Le client est un composant React, mais rien n'empêche d'appeler l'action
// directement : tout est revalidé ici.
const schemaOnboarding = z.object({
  heightCm: z.number().int().min(120, "Taille invalide").max(230, "Taille invalide"),
  poidsKg: z.number().min(30, "Poids invalide").max(300, "Poids invalide"),
  level: z.enum(["DEBUTANT", "INTERMEDIAIRE", "AVANCE"]),
  // Aucun matériel coché est un cas normal : poids de corps pur.
  equipments: z.array(z.enum(idsEquipement as [string, ...string[]])),
  muscleGroups: z
    .array(z.enum(idsGroupe as [string, ...string[]]))
    .min(1, "Choisis au moins un groupe musculaire"),
  goal: z.enum(["HYPERTROPHIE", "FORCE", "ENDURANCE", "PERTE_DE_POIDS"]),
  daysPerWeek: z.number().int().min(2).max(6),
});

export type DonneesOnboarding = z.infer<typeof schemaOnboarding>;

export async function terminerOnboarding(donnees: DonneesOnboarding) {
  const user = await requireUser();

  const parse = schemaOnboarding.safeParse(donnees);
  if (!parse.success) {
    return { erreur: parse.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parse.data;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        heightCm: d.heightCm,
        level: d.level,
        goal: d.goal,
        daysPerWeek: d.daysPerWeek,
        onboarded: true,
      },
    }),

    // Rejouable : on repart d'une table rase pour ces deux relations, ce qui
    // permettra de réutiliser cette action depuis /parametres.
    prisma.userEquipment.deleteMany({ where: { userId: user.id } }),
    prisma.userEquipment.createMany({
      data: d.equipments.map((equipmentId) => ({ userId: user.id, equipmentId })),
    }),

    prisma.userMuscleGroup.deleteMany({ where: { userId: user.id } }),
    prisma.userMuscleGroup.createMany({
      data: d.muscleGroups.map((groupId) => ({ userId: user.id, groupId })),
    }),

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
