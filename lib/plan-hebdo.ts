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
      levelOffset: g.levelOffset,
    })),
  };

  return { user, profil };
}

export async function chargerCatalogue(): Promise<ExerciceDisponible[]> {
  return prisma.exercise.findMany();
}

/** Nombre de semaines couvertes à l'avance, au-delà de la semaine en cours. */
export const SEMAINES_A_LAVANCE = 5;

/**
 * Garantit que les semaines à venir ont un plan, et bascule en MANQUE les
 * jours passés restés à PREVU.
 *
 * Appelé au chargement du tableau de bord et du calendrier : c'est le « cron
 * logique » de la spec §5.1, qui évite d'avoir à faire tourner une vraie tâche
 * planifiée.
 *
 * Six semaines d'un coup — la courante plus cinq — pour qu'une vue mensuelle
 * soit remplie quel que soit le jour où on la consulte. Tout tient en quatre
 * requêtes : une lecture de l'existant sur toute la plage, un createMany, un
 * updateMany, une relecture. Boucler semaine par semaine en multipliait le
 * nombre par six.
 */
export async function assurerPlans(userId: string, semaines = SEMAINES_A_LAVANCE) {
  const { user, profil } = await chargerProfil(userId);

  const semaineCourante = joursDeLaSemaine();
  const debut = semaineCourante[0];
  const fin = new Date(debut.getTime() + (semaines + 1) * 7 * 86_400_000);

  const existants = await prisma.planDay.findMany({
    where: { userId, date: { gte: debut, lt: fin } },
    select: { date: true },
  });

  const inscription = jourUTC(user.createdAt);
  const dejaPlanifies = new Set(existants.map((p) => p.date.getTime()));
  const lignes: Prisma.PlanDayCreateManyInput[] = [];

  if (profil.muscleGroups.length > 0) {
    for (let decalage = 0; decalage <= semaines; decalage++) {
      const reference = new Date(Date.now() + decalage * 7 * 86_400_000);
      const jours = joursDeLaSemaine(reference);

      // La graine dépend du numéro de semaine ISO : chaque semaine reçoit donc
      // une rotation différente des groupes, plutôt que six copies conformes.
      const plan = genererPlanSemaine(profil, grainesSemaine(reference));

      for (const jour of plan) {
        const date = jours[jour.jour];

        // Rien avant l'inscription : ces jours-là le compte n'existait pas, les
        // faire figurer au calendrier n'aurait aucun sens.
        if (date < inscription) continue;
        // On complète jour par jour plutôt qu'en tout ou rien : une semaine
        // partiellement remplie doit pouvoir se compléter sans rien écraser.
        if (dejaPlanifies.has(date.getTime())) continue;
        dejaPlanifies.add(date.getTime());

        if (jour.groupes.length === 0) {
          // Un jour de repos est une ligne à part entière : le calendrier doit
          // pouvoir le distinguer d'un jour sans plan du tout.
          lignes.push({ userId, date, muscleGroup: "repos", status: PlanStatus.REPOS });
          continue;
        }
        for (const groupe of jour.groupes) {
          lignes.push({ userId, date, muscleGroup: groupe, status: PlanStatus.PREVU });
        }
      }
    }

    if (lignes.length > 0) await prisma.planDay.createMany({ data: lignes });
  }

  // Les jours passés jamais validés basculent en MANQUE. Neutre visuellement :
  // la spec interdit de culpabiliser, la sanction est l'absence de gain.
  //
  // Jamais avant l'inscription : quelqu'un qui crée son compte un jeudi verrait
  // sinon trois séances « ratées » qu'il n'avait aucun moyen de faire.
  const debutManques = inscription > debut ? inscription : debut;

  await prisma.planDay.updateMany({
    where: { userId, date: { gte: debutManques, lt: jourUTC() }, status: PlanStatus.PREVU },
    data: { status: PlanStatus.MANQUE },
  });

  return prisma.planDay.findMany({
    where: { userId, date: { gte: debut, lt: new Date(debut.getTime() + 7 * 86_400_000) } },
    orderBy: { date: "asc" },
  });
}

/**
 * Jours de plan sur une plage, génération assurée au passage.
 *
 * Bornes incluses : la plage est exprimée en jours, pas en instants. C'est ce
 * que fait déjà le calendrier — `assurerPlans` puis lecture de la fenêtre
 * voulue — et ce que `GET /api/v1/plan` doit faire à son tour.
 */
export async function planSurPlage(userId: string, debut: Date, fin: Date) {
  await assurerPlans(userId);

  return prisma.planDay.findMany({
    where: { userId, date: { gte: debut, lte: fin } },
    orderBy: [{ date: "asc" }, { muscleGroup: "asc" }],
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
  const seance = genererSeance(profil, muscleGroup, catalogue, graine);

  // Le moteur reste pur et ignore l'historique : c'est ici qu'on rattache la
  // dernière charge connue, pour que l'utilisateur retrouve son poids de
  // travail sans le chercher dans son journal.
  const aCharge = seance.exercices.filter((e) => e.chargeRequise).map((e) => e.nom);
  if (aCharge.length === 0) return seance;

  const charges = await prisma.exerciseLoad.findMany({
    where: { userId, exerciseName: { in: aCharge } },
  });
  const parNom = new Map(charges.map((c) => [c.exerciseName, c.kg]));

  return {
    ...seance,
    exercices: seance.exercices.map((e) => ({
      ...e,
      derniereCharge: e.chargeRequise ? (parNom.get(e.nom) ?? null) : null,
    })),
  };
}

/** Séances déjà validées sur les 7 derniers jours glissants. */
export async function seancesSur7Jours(userId: string, avant: Date = new Date()) {
  const depuis = new Date(jourUTC(avant).getTime() - 6 * 86_400_000);
  return prisma.workoutLog.count({
    where: { userId, date: { gte: depuis, lte: jourUTC(avant) } },
  });
}

export { debutSemaineUTC };
