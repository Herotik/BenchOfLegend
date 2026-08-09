/**
 * Remet un compte à zéro sans le supprimer.
 *
 * Efface l'activité — séances, pesées, plan, LP, ajustements de difficulté —
 * et conserve le compte, la connexion Google et les préférences, pour ne pas
 * avoir à refaire l'onboarding.
 *
 *   npx tsx scripts/reset-compte.ts <email>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage : npx tsx scripts/reset-compte.ts <email>");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Aucun compte pour ${email}`);

  const [seances, pesees, jours] = await Promise.all([
    prisma.workoutLog.count({ where: { userId: user.id } }),
    prisma.weighIn.count({ where: { userId: user.id } }),
    prisma.planDay.count({ where: { userId: user.id } }),
  ]);

  await prisma.$transaction([
    prisma.workoutLog.deleteMany({ where: { userId: user.id } }),
    prisma.weighIn.deleteMany({ where: { userId: user.id } }),
    prisma.planDay.deleteMany({ where: { userId: user.id } }),
    prisma.userMuscleGroup.updateMany({
      where: { userId: user.id },
      data: { levelOffset: 0 },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lp: 0 } }),
  ]);

  console.log(`Compte ${email} réinitialisé.`);
  console.log(`  supprimé : ${seances} séance(s), ${pesees} pesée(s), ${jours} jour(s) de plan`);
  console.log("  remis à zéro : LP, ajustements de difficulté");
  console.log("  conservé : connexion Google, taille, niveau, objectif, matériel, groupes");
  console.log("\nLe plan se régénérera au prochain chargement du tableau de bord,");
  console.log("et la pesée du jour sera redemandée à la connexion.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
