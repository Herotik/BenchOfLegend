import "server-only";
import { Prisma, PlanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { debutSemaineUTC, grainesSemaine, joursDeLaSemaine } from "@/lib/semaine";
import { genererPlanSemaine, genererSeance } from "@/lib/engine";
import type { ExerciceDisponible, ProfilEntrainement, Seance } from "@/lib/engine";
import type { MuscleGroupId } from "@/lib/referentiel";

/** Profil complet d'entraînement, tel que le moteur l'attend. */
export async function chargerProfil(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { equipments: true, muscleGroups: true },
  });

  const profil: ProfilEntrainement = {
    level: user.level,
    goal: user.goal,
    daysPerWeek: user.daysPerWeek,
    equipments: user.equipments.map((e) => e.equipmentId),
    muscleGroups: user.muscleGroups.map((g) => ({
      id: g.groupId as MuscleGroupId,
      priority: g.priority,
    })),
  };

  return { user, profil };
}

export async function chargerCatalogue(): Promise<ExerciceDisponible[]> {
  return prisma.exercise.findMany();
}

/**
 * Garantit que la semaine en cours a un plan, et bascule en MANQUE les jours
 * passés restés à PREVU.
 *
 * Appelé au chargement du dashboard : c'est le « cron logique » de la spec
 * §5.1, qui évite d'avoir à faire tourner une vraie tâche planifiée.
 */
export async function assurerPlanSemaine(userId: string) {
  const { user, profil } = await chargerProfil(userId);
  const jours = joursDeLaSemaine();
  const debut = jours[0];
  const fin = new Date(debut.getTime() + 7 * 86_400_000);

  const existants = await prisma.planDay.findMany({
    where: { userId, date: { gte: debut, lt: fin } },
  });

  const inscription = jourUTC(user.createdAt);

  if (profil.muscleGroups.length > 0) {
    const plan = genererPlanSemaine(profil, grainesSemaine());
    // On complète jour par jour plutôt qu'en tout ou rien : une semaine
    // partiellement remplie — compte créé en cours de semaine, ou préférences
    // modifiées — doit pouvoir se compléter sans écraser ce qui existe.
    const dejaPlanifies = new Set(existants.map((p) => p.date.getTime()));

    const lignes: Prisma.PlanDayCreateManyInput[] = [];
    for (const jour of plan) {
      // Rien avant l'inscription : ces jours-là le compte n'existait pas, les
      // faire figurer au calendrier n'aurait aucun sens.
      if (jours[jour.jour] < inscription) continue;
      if (dejaPlanifies.has(jours[jour.jour].getTime())) continue;

      if (jour.groupes.length === 0) {
        // Un jour de repos est une ligne à part entière : le calendrier doit
        // pouvoir le distinguer d'un jour sans plan du tout.
        lignes.push({
          userId,
          date: jours[jour.jour],
          muscleGroup: "repos",
          status: PlanStatus.REPOS,
        });
        continue;
      }
      for (const groupe of jour.groupes) {
        lignes.push({
          userId,
          date: jours[jour.jour],
          muscleGroup: groupe,
          status: PlanStatus.PREVU,
        });
      }
    }

    await prisma.planDay.createMany({ data: lignes });
  }

  // Les jours passés jamais validés basculent en MANQUE. Neutre visuellement :
  // la spec interdit de culpabiliser, la sanction est l'absence de gain.
  //
  // Jamais avant l'inscription : quelqu'un qui crée son compte un jeudi verrait
  // sinon trois séances « ratées » qu'il n'avait aucun moyen de faire.
  const debutManques = inscription > debut ? inscription : debut;

  await prisma.planDay.updateMany({
    where: { userId, date: { gte: debutManques, lt: jourUTC() }, status: "PREVU" },
    data: { status: "MANQUE" },
  });

  return prisma.planDay.findMany({
    where: { userId, date: { gte: debut, lt: fin } },
    orderBy: { date: "asc" },
  });
}

/**
 * Séance du jour pour un groupe donné.
 *
 * Non persistée : elle est régénérée à chaque affichage. La graine combine
 * semaine et jour, si bien qu'un rechargement rend exactement la même séance,
 * mais que les deux séances hebdomadaires d'un même groupe diffèrent.
 */
export async function seanceDuJour(
  userId: string,
  muscleGroup: string,
  date: Date = new Date(),
): Promise<Seance> {
  const { profil } = await chargerProfil(userId);
  const catalogue = await chargerCatalogue();
  const graine = grainesSemaine(date) + Math.floor(date.getTime() / 86_400_000);
  return genererSeance(profil, muscleGroup, catalogue, graine);
}

/** Séances déjà validées sur les 7 derniers jours glissants. */
export async function seancesSur7Jours(userId: string, avant: Date = new Date()) {
  const depuis = new Date(jourUTC(avant).getTime() - 6 * 86_400_000);
  return prisma.workoutLog.count({
    where: { userId, date: { gte: depuis, lte: jourUTC(avant) } },
  });
}

export { debutSemaineUTC };
