import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Remise à zéro d'un compte, sans le supprimer.
 *
 * Partagé entre `scripts/reset-compte.ts` et `POST /api/v1/me/reinitialiser` :
 * deux implémentations dériveraient, et celle qui oublierait une table
 * laisserait des séances derrière elle sans que rien ne le signale.
 *
 * Ce que la remise à zéro n'est pas : une suppression de compte. Les
 * connexions, l'adresse et l'identifiant survivent, et c'est ce qui la rend
 * réversible du point de vue de l'accès — on se reconnecte comme avant. Ce qui
 * disparaît, en revanche, ne revient pas.
 */

/** Ce qui a été effacé, pour pouvoir le dire plutôt que de l'affirmer. */
export interface BilanReinitialisation {
  seances: number;
  pesees: number;
  joursDePlan: number;
  charges: number;
}

export async function reinitialiserCompte(
  userId: string,
  options: { profil?: boolean } = {},
): Promise<BilanReinitialisation> {
  const [seances, pesees, joursDePlan, charges] = await Promise.all([
    prisma.workoutLog.count({ where: { userId } }),
    prisma.weighIn.count({ where: { userId } }),
    prisma.planDay.count({ where: { userId } }),
    prisma.exerciseLoad.count({ where: { userId } }),
  ]);

  await prisma.$transaction([
    prisma.workoutLog.deleteMany({ where: { userId } }),
    prisma.weighIn.deleteMany({ where: { userId } }),
    prisma.planDay.deleteMany({ where: { userId } }),
    // Les charges partent aussi : les garder ferait proposer « la dernière fois
    // : 60 kg » à un compte qui n'a plus aucune séance derrière lui, et le
    // premier écran de la première séance mentirait sur un passé effacé.
    prisma.exerciseLoad.deleteMany({ where: { userId } }),
    ...(options.profil
      ? [
          prisma.userEquipment.deleteMany({ where: { userId } }),
          prisma.userMuscleGroup.deleteMany({ where: { userId } }),
          prisma.user.update({
            where: { id: userId },
            data: { lp: 0, onboarded: false, heightCm: null },
          }),
        ]
      : [
          prisma.userMuscleGroup.updateMany({
            where: { userId },
            data: { levelOffset: 0 },
          }),
          prisma.user.update({ where: { id: userId }, data: { lp: 0 } }),
        ]),
  ]);

  return { seances, pesees, joursDePlan, charges };
}
