"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/session";
import { jourUTC } from "@/lib/dates";
import { calculerLp, ratioComplete, type StatutExercice } from "@/lib/lp";
import { rankForLp, rankLabel } from "@/lib/ranks";
import { seanceDuJour, seancesSur7Jours } from "@/lib/plan-hebdo";
import { MUSCLE_GROUPS } from "@/lib/referentiel";
import { decalagePropose, VALEUR_RESSENTI, type Ressenti } from "@/lib/difficulte";

const schemaValidation = z.object({
  planDayId: z.string().optional(),
  muscleGroup: z.enum(MUSCLE_GROUPS.map((g) => g.id) as [string, ...string[]]),
  isBonus: z.boolean(),
  /** Statut de chaque exercice, dans l'ordre de la séance affichée. */
  statuts: z.array(z.enum(["non_fait", "partiel", "fait"])),
  ressenti: z.enum(["facile", "juste", "difficile"]),
  durationMin: z.number().int().min(1).max(600).optional(),
});

export type ResultatValidation = {
  lpEarned: number;
  details: { libelle: string; lp: number }[];
  promoted: boolean;
  newRank: string;
  lpTotal: number;
  /** Proposition d'ajustement de difficulté, si le ressenti en appelle une. */
  proposition: { delta: 1 | -1; message: string; muscleGroup: string } | null;
};

/**
 * Valide une séance et crédite les LP.
 *
 * **Tout le calcul se fait ici.** Le client n'envoie que les statuts : la
 * séance est régénérée côté serveur à partir de la même graine, si bien qu'un
 * client modifié ne peut ni inventer des exercices, ni s'attribuer des LP, ni
 * faire passer une séance partielle pour complète.
 */
export async function validerSeance(
  entree: z.input<typeof schemaValidation>,
): Promise<ResultatValidation | { erreur: string }> {
  const user = await requireOnboardedUser();

  const parse = schemaValidation.safeParse(entree);
  if (!parse.success) return { erreur: parse.error.issues[0]?.message ?? "Requête invalide" };
  const d = parse.data;

  const aujourdhui = jourUTC();
  const seance = await seanceDuJour(user.id, d.muscleGroup);
  if (seance.exercices.length === 0) return { erreur: "Aucune séance à valider" };

  // Une seule validation de séance minimum par PlanDay.
  if (!d.isBonus) {
    if (!d.planDayId) return { erreur: "Séance du jour introuvable" };
    const planDay = await prisma.planDay.findUnique({ where: { id: d.planDayId } });
    if (!planDay || planDay.userId !== user.id) return { erreur: "Séance du jour introuvable" };
    if (planDay.status === "FAIT") return { erreur: "Cette séance est déjà validée" };
  }

  const exercices = seance.exercices.map((e, i) => ({
    ...e,
    statut: (d.statuts[i] ?? "non_fait") as StatutExercice,
  }));

  const finisher = exercices.find((e) => e.finisher);
  const bonusDuJour = await prisma.workoutLog.count({
    where: { userId: user.id, date: aujourdhui, isBonus: true },
  });

  const lp = calculerLp({
    ratioComplete: ratioComplete(exercices),
    isBonus: d.isBonus,
    finisherComplete: finisher?.statut === "fait",
    seancesSur7Jours: await seancesSur7Jours(user.id),
    bonusDejaCompteAujourdhui: bonusDuJour > 0,
  });

  const lpTotal = user.lp + lp.total;
  const rangAvant = rankForLp(user.lp);
  const rangApres = rankForLp(lpTotal);

  const [workout] = await prisma.$transaction([
    prisma.workoutLog.create({
      data: {
        userId: user.id,
        date: aujourdhui,
        muscleGroup: d.muscleGroup,
        isBonus: d.isBonus,
        lpEarned: lp.total,
        exercises: exercices.map((e) => ({
          name: e.nom,
          sets: e.series,
          reps: e.reps ?? null,
          duree: e.duree ?? null,
          restSec: e.restSec,
          statut: e.statut,
        })),
        durationMin: d.durationMin,
        feeling: VALEUR_RESSENTI[d.ressenti as Ressenti],
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lp: lpTotal } }),
  ]);

  if (!d.isBonus && d.planDayId) {
    await prisma.planDay.update({
      where: { id: d.planDayId },
      data: { status: "FAIT", workoutId: workout.id },
    });
  }

  // Le décalage n'est jamais appliqué d'office : on propose, l'utilisateur
  // décide. Une séance facile peut l'être pour mille raisons étrangères au
  // niveau — bonne nuit, journée légère, groupe déjà échauffé.
  const groupe = await prisma.userMuscleGroup.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: d.muscleGroup } },
  });
  const propose = groupe ? decalagePropose(d.ressenti as Ressenti, groupe.levelOffset) : null;

  revalidatePath("/dashboard");

  return {
    lpEarned: lp.total,
    details: lp.details,
    // Le changement de division compte autant que le changement de rang :
    // c'est ce qui rythme la progression au quotidien.
    promoted: rankLabel(user.lp) !== rankLabel(lpTotal) || rangAvant.slug !== rangApres.slug,
    newRank: rankLabel(lpTotal),
    lpTotal,
    proposition: propose ? { ...propose, muscleGroup: d.muscleGroup } : null,
  };
}

/** Applique l'ajustement de difficulté proposé après une séance. */
export async function ajusterDifficulte(muscleGroup: string, delta: number) {
  const user = await requireOnboardedUser();

  if (delta !== 1 && delta !== -1) return { erreur: "Ajustement invalide" };

  const groupe = await prisma.userMuscleGroup.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: muscleGroup } },
  });
  if (!groupe) return { erreur: "Groupe introuvable" };

  const nouveau = Math.max(-1, Math.min(1, groupe.levelOffset + delta));
  await prisma.userMuscleGroup.update({
    where: { userId_groupId: { userId: user.id, groupId: muscleGroup } },
    data: { levelOffset: nouveau },
  });

  revalidatePath("/dashboard");
  return { ok: true as const, levelOffset: nouveau };
}
