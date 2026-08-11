import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { EQUIPMENTS, MUSCLE_GROUPS } from "@/lib/referentiel";
import { echec, type EchecMetier } from "@/lib/erreurs";

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
    // Les groupes, eux, se mettent à jour ligne par ligne plutôt que d'être
    // effacés puis recréés : `levelOffset` n'est pas une préférence, c'est un
    // calibrage gagné séance après séance par le ressenti. Un effacement le
    // remettait à zéro, si bien que corriger sa taille d'un centimètre
    // annulait la progression de tous les groupes, sans le dire.
    prisma.userMuscleGroup.deleteMany({
      where: { userId, groupId: { notIn: d.muscleGroups } },
    }),
    ...d.muscleGroups.map((groupId) =>
      prisma.userMuscleGroup.upsert({
        where: { userId_groupId: { userId, groupId } },
        update: { priority: pointsForts.has(groupId) ? 2 : 1 },
        create: { userId, groupId, priority: pointsForts.has(groupId) ? 2 : 1 },
      }),
    ),
  ];
}

/**
 * Enregistre les préférences et repart du plan à venir.
 *
 * Appelé par l'action `modifierPreferences` comme par `PUT /api/v1/me/preferences`.
 */
export async function appliquerPreferences(
  userId: string,
  entree: unknown,
): Promise<{ ok: true } | EchecMetier> {
  const parse = schemaPreferences.safeParse(entree);
  if (!parse.success) {
    return echec(
      parse.error.issues[0]?.message ?? "Données invalides",
      "preferences_invalides",
      400,
    );
  }

  await prisma.$transaction([
    ...operationsPreferences(userId, parse.data as Preferences),

    // Le plan à venir est régénéré, jamais le passé (spec §4.2). Les séances
    // déjà validées sont préservées : elles font partie de l'historique et
    // ont rapporté des Δ. Les jours restants sont supprimés, la génération
    // les recrée au prochain chargement avec les nouvelles préférences.
    prisma.planDay.deleteMany({
      where: { userId, date: { gte: jourUTC() }, status: { not: "FAIT" } },
    }),
  ]);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vue API
// ---------------------------------------------------------------------------

/**
 * Mêmes préférences, clés en français : c'est la forme que voit l'app mobile,
 * en entrée comme en sortie.
 *
 * Chaque champ **réutilise le validateur** de `schemaPreferences` au lieu d'en
 * recopier les bornes. Renommer une clé est une affaire de transport ; changer
 * une règle ne doit pouvoir se faire qu'à un seul endroit.
 */
export const objetPreferencesApi = z.object({
  tailleCm: schemaPreferences.shape.heightCm,
  niveau: schemaPreferences.shape.level,
  materiel: schemaPreferences.shape.equipments,
  groupesMusculaires: schemaPreferences.shape.muscleGroups,
  pointsForts: schemaPreferences.shape.pointsForts,
  objectif: schemaPreferences.shape.goal,
  joursParSemaine: schemaPreferences.shape.daysPerWeek,
});

export function versPreferences(d: z.output<typeof objetPreferencesApi>): Preferences {
  return {
    heightCm: d.tailleCm,
    level: d.niveau,
    equipments: d.materiel,
    muscleGroups: d.groupesMusculaires,
    pointsForts: d.pointsForts,
    goal: d.objectif,
    daysPerWeek: d.joursParSemaine,
  };
}

export const schemaPreferencesApi = objetPreferencesApi.transform(versPreferences);

export interface PreferencesApi {
  tailleCm: number | null;
  niveau: string;
  objectif: string;
  joursParSemaine: number;
  materiel: string[];
  groupesMusculaires: { groupe: string; priorite: number; decalageNiveau: number }[];
}

/** Préférences enregistrées, telles que l'API les rend. */
export async function lirePreferences(userId: string): Promise<PreferencesApi> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { equipments: true, muscleGroups: { orderBy: { groupId: "asc" } } },
  });

  return {
    tailleCm: user.heightCm,
    niveau: user.level,
    objectif: user.goal,
    joursParSemaine: user.daysPerWeek,
    materiel: user.equipments.map((e) => e.equipmentId),
    groupesMusculaires: user.muscleGroups.map((g) => ({
      groupe: g.groupId,
      priorite: g.priority,
      // Gagné séance après séance par le ressenti : ce n'est pas une
      // préférence, l'app ne le renvoie donc jamais en écriture.
      decalageNiveau: g.levelOffset,
    })),
  };
}
