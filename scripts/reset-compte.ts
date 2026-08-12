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

  // Avec `--profil`, le questionnaire d'entrée redevient franchissable. Sans
  // ce drapeau, `POST /me/onboarding` répond 409 : il refuse d'être rejoué,
  // précisément pour ne pas écraser des préférences choisies.
  const remettreProfil = process.argv.includes("--profil");

  await prisma.$transaction([
    prisma.workoutLog.deleteMany({ where: { userId: user.id } }),
    prisma.weighIn.deleteMany({ where: { userId: user.id } }),
    prisma.planDay.deleteMany({ where: { userId: user.id } }),
    ...(remettreProfil
      ? [
          prisma.userEquipment.deleteMany({ where: { userId: user.id } }),
          prisma.userMuscleGroup.deleteMany({ where: { userId: user.id } }),
          prisma.user.update({
            where: { id: user.id },
            data: { lp: 0, onboarded: false, heightCm: null },
          }),
        ]
      : [
          prisma.userMuscleGroup.updateMany({
            where: { userId: user.id },
            data: { levelOffset: 0 },
          }),
          prisma.user.update({ where: { id: user.id }, data: { lp: 0 } }),
        ]),
  ]);

  console.log(`Compte ${email} réinitialisé.`);
  console.log(`  supprimé : ${seances} séance(s), ${pesees} pesée(s), ${jours} jour(s) de plan`);
  if (remettreProfil) {
    console.log("  remis à zéro : Δ, préférences, questionnaire d'entrée");
    console.log("  conservé : connexion Google");
    console.log("\nLe questionnaire sera redemandé à la prochaine ouverture.");
  } else {
    console.log("  remis à zéro : Δ, ajustements de difficulté");
    console.log("  conservé : connexion Google, taille, niveau, objectif, matériel, groupes");
    console.log("\nLe plan se régénérera au prochain chargement du tableau de bord,");
    console.log("et la pesée du jour sera redemandée à la connexion.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
