/**
 * Remet un compte à zéro sans le supprimer.
 *
 * Efface l'activité — séances, pesées, plan, charges, Δ, ajustements de
 * difficulté — et conserve le compte, ses connexions et ses préférences, pour
 * ne pas avoir à refaire l'onboarding.
 *
 *   npx tsx scripts/reset-compte.ts <email> [--profil]
 *
 * L'app a le même bouton dans ses Réglages, qui appelle la même fonction. Ce
 * script reste utile pour ce que l'app ne fait pas : agir sur un compte qui
 * n'est pas le sien, et remettre le questionnaire d'entrée avec `--profil`.
 */
import { prisma } from "../lib/prisma";
import { reinitialiserCompte } from "../lib/reinitialiser";

async function main() {
  const email = process.argv[2];
  if (!email || email.startsWith("--")) {
    throw new Error("Usage : npx tsx scripts/reset-compte.ts <email> [--profil]");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Aucun compte pour ${email}`);

  // Avec `--profil`, le questionnaire d'entrée redevient franchissable. Sans
  // ce drapeau, `POST /me/onboarding` répond 409 : il refuse d'être rejoué,
  // précisément pour ne pas écraser des préférences choisies.
  const profil = process.argv.includes("--profil");

  const bilan = await reinitialiserCompte(user.id, { profil });

  console.log(`Compte ${email} réinitialisé.`);
  console.log(
    `  supprimé : ${bilan.seances} séance(s), ${bilan.pesees} pesée(s), ` +
      `${bilan.joursDePlan} jour(s) de plan, ${bilan.charges} charge(s)`,
  );

  if (profil) {
    console.log("  remis à zéro : Δ, préférences, questionnaire d'entrée");
    console.log("  conservé : les connexions (Google, Apple, Discord)");
    console.log("\nLe questionnaire sera redemandé à la prochaine ouverture.");
  } else {
    console.log("  remis à zéro : Δ, ajustements de difficulté");
    console.log("  conservé : les connexions, taille, niveau, objectif, matériel, groupes");
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
