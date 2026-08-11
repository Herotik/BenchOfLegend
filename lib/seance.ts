import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { calculerLp, ratioComplete, type StatutExercice } from "@/lib/lp";
import { rankForLp, rankLabel } from "@/lib/ranks";
import { seanceDuJour, seancesSur7Jours } from "@/lib/plan-hebdo";
import { MUSCLE_GROUPS } from "@/lib/referentiel";
import { decalagePropose, VALEUR_RESSENTI, type Ressenti } from "@/lib/difficulte";
import { echec, type EchecMetier } from "@/lib/erreurs";

/**
 * Validation d'une séance et ajustement de difficulté.
 *
 * Extrait de `app/actions/seance.ts` : l'action web et la route `/api/v1` en
 * ont besoin toutes les deux, et une règle recopiée d'un appelant à l'autre
 * finit par diverger — l'aperçu des Δ annonçait 20 sur une séance bonus qui
 * en rapporte 8, pour exactement cette raison. L'action et la route ne sont
 * plus que deux enveloppes autour de ce module.
 */

const idsGroupe = MUSCLE_GROUPS.map((g) => g.id) as [string, ...string[]];

export const schemaValidationSeance = z.object({
  planDayId: z.string().optional(),
  muscleGroup: z.enum(idsGroupe),
  isBonus: z.boolean(),
  /** Statut de chaque exercice, dans l'ordre de la séance affichée. */
  statuts: z.array(z.enum(["non_fait", "partiel", "fait"])),
  /** Charge utilisée par exercice, en kilos. `null` quand il n'y en a pas. */
  charges: z.array(z.number().min(0).max(500).nullable()).default([]),
  ressenti: z.enum(["facile", "juste", "difficile"]),
  durationMin: z.number().int().min(1).max(600).optional(),
});

export type EntreeValidationSeance = z.input<typeof schemaValidationSeance>;

/**
 * Même schéma, nommé pour l'API : les clés y sont en français, mais chaque
 * règle est reprise telle quelle de `schemaValidationSeance`. Rien n'est
 * revalidé une seconde fois, donc rien ne peut diverger.
 */
export const schemaValidationSeanceApi = z
  .object({
    planDayId: schemaValidationSeance.shape.planDayId,
    groupe: schemaValidationSeance.shape.muscleGroup,
    bonus: schemaValidationSeance.shape.isBonus,
    statuts: schemaValidationSeance.shape.statuts,
    charges: schemaValidationSeance.shape.charges,
    ressenti: schemaValidationSeance.shape.ressenti,
    dureeMin: schemaValidationSeance.shape.durationMin,
  })
  .transform(
    (d): EntreeValidationSeance => ({
      planDayId: d.planDayId,
      muscleGroup: d.groupe,
      isBonus: d.bonus,
      statuts: d.statuts,
      charges: d.charges,
      ressenti: d.ressenti,
      durationMin: d.dureeMin,
    }),
  );

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
 * Valide une séance et crédite les Δ.
 *
 * **Tout le calcul se fait ici.** Le client n'envoie que les statuts : la
 * séance est régénérée côté serveur à partir de la même graine, si bien qu'un
 * client modifié ne peut ni inventer des exercices, ni s'attribuer des Δ, ni
 * faire passer une séance partielle pour complète.
 */
export async function validerSeancePour(
  userId: string,
  entree: EntreeValidationSeance,
): Promise<ResultatValidation | EchecMetier> {
  const parse = schemaValidationSeance.safeParse(entree);
  if (!parse.success) {
    return echec(parse.error.issues[0]?.message ?? "Requête invalide", "requete_invalide", 400);
  }
  const d = parse.data;

  // Les Δ se calculent à partir du total en base, jamais d'un total porté par
  // la session ou par le client : deux appareils connectés au même compte
  // partiraient sinon du même solde et l'un écraserait le gain de l'autre.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lp: true },
  });

  const aujourdhui = jourUTC();
  const seance = await seanceDuJour(userId, d.muscleGroup);
  if (seance.exercices.length === 0) {
    return echec("Aucune séance à valider", "aucune_seance", 422);
  }

  // Une seule validation de séance minimum par PlanDay, et seulement celle
  // du jour. Le plan est publié six semaines à l'avance et le calendrier en
  // expose les identifiants : sans le contrôle de date, un client bricolé
  // encaissait d'un coup la trentaine de séances à venir, 20 Δ pièce.
  if (!d.isBonus) {
    if (!d.planDayId) {
      return echec("Séance du jour introuvable", "plan_day_requis", 422);
    }
    const planDay = await prisma.planDay.findUnique({ where: { id: d.planDayId } });
    // Le `userId` est confronté ici plutôt que dans le `where` pour que le
    // message reste le même dans les deux cas : le jour d'autrui doit être
    // indiscernable d'un identifiant inexistant.
    if (!planDay || planDay.userId !== userId) {
      return echec("Séance du jour introuvable", "plan_day_introuvable", 404);
    }
    if (planDay.status === "FAIT") {
      return echec("Cette séance est déjà validée", "deja_validee", 409);
    }
    if (planDay.date.getTime() > aujourdhui.getTime()) {
      return echec("Cette séance est prévue pour plus tard", "seance_future", 422);
    }
    if (planDay.date.getTime() < aujourdhui.getTime()) {
      return echec("Cette séance est passée. Fais-la en séance bonus.", "seance_passee", 422);
    }
    // Sans ça, on solderait le jour « dos » en présentant une séance de
    // pectoraux : le calendrier et l'historique se contrediraient.
    if (planDay.muscleGroup !== d.muscleGroup) {
      return echec("Cette séance ne correspond pas au groupe prévu", "groupe_incoherent", 422);
    }
  }

  const exercices = seance.exercices.map((e, i) => ({
    ...e,
    statut: (d.statuts[i] ?? "non_fait") as StatutExercice,
    // Une charge n'est retenue que sur un exercice qui en demande une : un
    // client bricolé ne fera pas apparaître 200 kg sur des pompes.
    charge: e.chargeRequise ? (d.charges[i] ?? null) : null,
  }));

  const finisher = exercices.find((e) => e.finisher);
  const bonusDuJour = await prisma.workoutLog.count({
    where: { userId, date: aujourdhui, isBonus: true },
  });

  const lp = calculerLp({
    ratioComplete: ratioComplete(exercices),
    isBonus: d.isBonus,
    finisherComplete: finisher?.statut === "fait",
    seancesSur7Jours: await seancesSur7Jours(userId),
    bonusDejaCompteAujourdhui: bonusDuJour > 0,
  });

  const rangAvant = rankForLp(user.lp);

  // Transaction interactive : le PlanDay doit basculer dans le **même** atome
  // que le crédit des Δ. Séparés, un échec entre les deux laissait les Δ
  // acquis et le jour encore rejouable.
  const lpTotal = await prisma.$transaction(async (tx) => {
    const workout = await tx.workoutLog.create({
      data: {
        userId,
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
          poidsKg: e.charge,
        })),
        durationMin: d.durationMin,
        feeling: VALEUR_RESSENTI[d.ressenti as Ressenti],
      },
    });

    // `increment` plutôt qu'un total calculé depuis une lecture antérieure :
    // c'est la base qui additionne, pas nous. Deux validations simultanées —
    // le téléphone et le navigateur du même compte — liraient sinon le même
    // solde, et la seconde écraserait le gain de la première.
    const majUser = await tx.user.update({
      where: { id: userId },
      data: { lp: { increment: lp.total } },
    });

    if (!d.isBonus && d.planDayId) {
      await tx.planDay.update({
        where: { id: d.planDayId },
        data: { status: "FAIT", workoutId: workout.id },
      });
    }

    // La charge de référence ne bouge que sur une série menée à son terme :
    // un poids sur lequel on a calé n'est pas un poids de travail.
    for (const e of exercices) {
      if (e.charge === null || e.statut !== "fait") continue;
      await tx.exerciseLoad.upsert({
        where: { userId_exerciseName: { userId, exerciseName: e.nom } },
        update: { kg: e.charge },
        create: { userId, exerciseName: e.nom, kg: e.charge },
      });
    }

    return majUser.lp;
  });

  const rangApres = rankForLp(lpTotal);

  // Le décalage n'est jamais appliqué d'office : on propose, l'utilisateur
  // décide. Une séance facile peut l'être pour mille raisons étrangères au
  // niveau — bonne nuit, journée légère, groupe déjà échauffé.
  const groupe = await prisma.userMuscleGroup.findUnique({
    where: { userId_groupId: { userId, groupId: d.muscleGroup } },
  });
  const propose = groupe ? decalagePropose(d.ressenti as Ressenti, groupe.levelOffset) : null;

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
export async function ajusterDifficultePour(
  userId: string,
  muscleGroup: string,
  delta: number,
): Promise<{ ok: true; levelOffset: number } | EchecMetier> {
  if (delta !== 1 && delta !== -1) {
    return echec("Ajustement invalide", "ajustement_invalide", 400);
  }

  const groupe = await prisma.userMuscleGroup.findUnique({
    where: { userId_groupId: { userId, groupId: muscleGroup } },
  });
  if (!groupe) return echec("Groupe introuvable", "groupe_introuvable", 404);

  const nouveau = Math.max(-1, Math.min(1, groupe.levelOffset + delta));
  await prisma.userMuscleGroup.update({
    where: { userId_groupId: { userId, groupId: muscleGroup } },
    data: { levelOffset: nouveau },
  });

  return { ok: true as const, levelOffset: nouveau };
}
