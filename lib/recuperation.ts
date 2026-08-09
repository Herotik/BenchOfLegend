import "server-only";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { muscleGroupLabel } from "@/lib/referentiel";

/**
 * Garde-fou de récupération (spec §5.3).
 *
 * Une séance bonus est libre — l'utilisateur choisit n'importe quel groupe,
 * même hors de ses préférences — mais on l'avertit si ce groupe a été
 * sollicité il y a moins de 48 h. L'avertissement n'interdit rien : il demande
 * une confirmation explicite.
 */
export async function avertissementRecuperationPour(
  userId: string,
  muscleGroup: string,
): Promise<string | null> {
  const veille = new Date(jourUTC().getTime() - 86_400_000);

  const recent = await prisma.workoutLog.findFirst({
    where: { userId, muscleGroup, date: { gte: veille } },
    orderBy: { date: "desc" },
  });

  if (!recent) return null;

  const quand = recent.date.getTime() === jourUTC().getTime() ? "aujourd'hui" : "hier";
  return `${muscleGroupLabel(muscleGroup)} a été travaillé ${quand} — la récupération fait partie de la progression.`;
}
