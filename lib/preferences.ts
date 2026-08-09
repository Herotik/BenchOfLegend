import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EQUIPMENTS, MUSCLE_GROUPS } from "@/lib/referentiel";

/**
 * Préférences d'entraînement, partagées par l'onboarding et les réglages.
 *
 * Schéma et écriture au même endroit : c'est la duplication d'une règle entre
 * deux écrans qui les fait diverger en silence.
 */

const idsEquipement = EQUIPMENTS.map((e) => e.id) as [string, ...string[]];
const idsGroupe = MUSCLE_GROUPS.map((g) => g.id) as [string, ...string[]];

export const schemaPreferences = z.object({
  heightCm: z.number().int().min(120, "Taille invalide").max(230, "Taille invalide"),
  level: z.enum(["DEBUTANT", "INTERMEDIAIRE", "AVANCE"]),
  // Aucun matériel coché est un cas normal : poids de corps pur.
  equipments: z.array(z.enum(idsEquipement)),
  muscleGroups: z.array(z.enum(idsGroupe)).min(1, "Choisis au moins un groupe musculaire"),
  /** Groupes prioritaires (priority = 2) : servis en premier quand il y a plus
   *  de groupes que de créneaux dans la semaine. */
  pointsForts: z.array(z.enum(idsGroupe)).default([]),
  goal: z.enum(["HYPERTROPHIE", "FORCE", "ENDURANCE", "PERTE_DE_POIDS"]),
  daysPerWeek: z.number().int().min(2).max(6),
});

export type Preferences = z.infer<typeof schemaPreferences>;

/**
 * Opérations d'écriture des préférences, à insérer dans une transaction.
 * On efface puis recrée matériel et groupes : c'est plus simple à suivre
 * qu'un diff, et ces tables font quelques lignes par utilisateur.
 */
export function operationsPreferences(
  userId: string,
  d: Preferences,
  extra: Prisma.UserUpdateInput = {},
) {
  const pointsForts = new Set(d.pointsForts.filter((g) => d.muscleGroups.includes(g)));

  return [
    prisma.user.update({
      where: { id: userId },
      data: {
        heightCm: d.heightCm,
        level: d.level,
        goal: d.goal,
        daysPerWeek: d.daysPerWeek,
        ...extra,
      },
    }),
    prisma.userEquipment.deleteMany({ where: { userId } }),
    prisma.userEquipment.createMany({
      data: d.equipments.map((equipmentId) => ({ userId, equipmentId })),
    }),
    prisma.userMuscleGroup.deleteMany({ where: { userId } }),
    prisma.userMuscleGroup.createMany({
      data: d.muscleGroups.map((groupId) => ({
        userId,
        groupId,
        priority: pointsForts.has(groupId) ? 2 : 1,
      })),
    }),
  ];
}
