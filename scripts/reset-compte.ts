/**
 * Remet un compte à zéro sans le supprimer.
 *
 * Efface l'activité — séances, pesées, plan, LP, ajustements de difficulté —
 * et conserve le compte, ses connexions et ses préférences, pour ne pas avoir
 * à refaire l'onboarding.
 *
 *   npx tsx --conditions=react-server scripts/reset-compte.ts <email> [--profil] [--aujourdhui]
 *
 * `--conditions=react-server` est nécessaire depuis que le script sait
 * regénérer le plan : `lib/plan-hebdo` est marqué `server-only`, et ce module
 * lève une erreur s'il est chargé sans cette condition.
 */
import { PlanStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { jourUTC } from "../lib/dates";
import { assurerPlans } from "../lib/plan-hebdo";
import type { MuscleGroupId } from "../lib/referentiel";

/** Même plafond que le moteur (`lib/engine/plan.ts`) : deux groupes par jour. */
const GROUPES_PAR_JOUR_MAX = 2;

/**
 * Ce que le forçage a fait. Un `null` unique ne suffisait pas : « il y avait
 * déjà une séance » et « aucun groupe ne convenait » demandent des messages
 * opposés, et les confondre faisait annoncer une séance là où le calendrier
 * affichait un repos.
 */
type Forcage =
  | { etat: "deja" }
  | { etat: "force"; groupes: MuscleGroupId[]; relache: boolean };

/**
 * Force le jour courant à être un jour de séance.
 *
 * Les jours d'entraînement sont fixés par `repartirJours(daysPerWeek)` : selon
 * la fréquence choisie, aujourd'hui peut tomber sur un repos, et il n'y a alors
 * rien à essayer avant demain. Ce drapeau existe pour le test, pas pour le
 * confort — s'octroyer une séance de plus fausserait la progression.
 *
 * Les groupes ne sont pas tirés au hasard : on reprend ceux de l'utilisateur
 * par ordre de priorité, en écartant ceux travaillés la veille ou le lendemain.
 * C'est la seule contrainte dure du moteur — 48 h de récupération, le cardio
 * excepté. L'affinité entre groupes d'une même séance, elle, n'est qu'une
 * préférence : la sacrifier ici ne produit pas de plan invalide.
 *
 * Cette règle peut ne laisser aucun candidat : à 3 séances par semaine, la
 * veille et le lendemain sont tous deux des jours d'entraînement et peuvent
 * couvrir à eux seuls les groupes d'un profil qui en a peu. On la relâche alors
 * plutôt que de ne rien produire — le drapeau a été demandé explicitement, et
 * un outil de test qui répond « non » sans expliquer ne sert à rien. Le rapport
 * le signale.
 */
async function forcerSeanceAujourdhui(userId: string): Promise<Forcage> {
  const aujourdhui = jourUTC();
  const existants = await prisma.planDay.findMany({
    where: { userId, date: aujourdhui },
  });

  // Déjà une séance prévue : le plan du moteur convient tel quel, on n'y touche
  // pas. Rien à forcer est le cas le plus fréquent avec 4 séances/semaine.
  if (existants.some((p) => p.status === PlanStatus.PREVU)) return { etat: "deja" };

  const veille = new Date(aujourdhui.getTime() - 86_400_000);
  const lendemain = new Date(aujourdhui.getTime() + 86_400_000);
  const voisins = await prisma.planDay.findMany({
    where: { userId, date: { in: [veille, lendemain] } },
    select: { muscleGroup: true },
  });
  const occupes = new Set(voisins.map((p) => p.muscleGroup));

  const groupes = await prisma.userMuscleGroup.findMany({
    where: { userId },
    orderBy: { priority: "desc" },
    select: { groupId: true },
  });
  if (groupes.length === 0) throw new Error("Ce compte n'a aucun groupe musculaire.");

  const prendre = (filtrer: boolean): MuscleGroupId[] => {
    const choisis: MuscleGroupId[] = [];
    for (const { groupId } of groupes) {
      if (choisis.length >= GROUPES_PAR_JOUR_MAX) break;
      // Le cardio ne réclame pas les mêmes 48 h : il peut s'intercaler partout.
      if (filtrer && groupId !== "cardio" && occupes.has(groupId)) continue;
      choisis.push(groupId as MuscleGroupId);
    }
    return choisis;
  };

  const respectueux = prendre(true);
  const relache = respectueux.length === 0;
  const choisis = relache ? prendre(false) : respectueux;

  await prisma.$transaction([
    // La ligne de repos part : le calendrier distingue un repos d'un jour sans
    // plan, la laisser afficherait les deux à la fois.
    prisma.planDay.deleteMany({ where: { userId, date: aujourdhui } }),
    prisma.planDay.createMany({
      data: choisis.map((groupe) => ({
        userId,
        date: aujourdhui,
        muscleGroup: groupe,
        status: PlanStatus.PREVU,
      })),
    }),
  ]);

  return { etat: "force", groupes: choisis, relache };
}

async function main() {
  const email = process.argv[2];
  if (!email || email.startsWith("--")) {
    throw new Error(
      "Usage : npx tsx --conditions=react-server scripts/reset-compte.ts <email> [--profil] [--aujourdhui]",
    );
  }

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
  const forcerAujourdhui = process.argv.includes("--aujourdhui");

  // Les deux ensemble n'ont pas de sens : sans groupes musculaires, le moteur
  // n'a rien à planifier. Mieux vaut le dire que produire un plan vide.
  if (remettreProfil && forcerAujourdhui) {
    throw new Error(
      "--profil et --aujourdhui sont incompatibles : le plan ne peut pas être construit\n" +
        "avant que le questionnaire ne soit refait. Relance avec --aujourdhui seul ensuite.",
    );
  }

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
    console.log("  conservé : les connexions (Google, Apple, Discord)");
    console.log("\nLe questionnaire sera redemandé à la prochaine ouverture.");
  } else {
    console.log("  remis à zéro : Δ, ajustements de difficulté");
    console.log("  conservé : les connexions, taille, niveau, objectif, matériel, groupes");
  }

  if (forcerAujourdhui) {
    // Le plan est régénéré ici plutôt qu'attendu du tableau de bord : il faut
    // connaître les jours voisins pour choisir des groupes valides.
    await assurerPlans(user.id);
    const forcage = await forcerSeanceAujourdhui(user.id);
    if (forcage.etat === "deja") {
      console.log("\nAujourd'hui était déjà un jour de séance : plan du moteur conservé.");
    } else {
      console.log(`\nAujourd'hui forcé en jour de séance : ${forcage.groupes.join(", ")}.`);
      if (forcage.relache) {
        console.log(
          "  ⚠ 48 h de récupération non respectées : la veille et le lendemain couvraient\n" +
            "    déjà tous tes groupes. Sans conséquence pour un test, à ne pas prendre\n" +
            "    pour une recommandation d'entraînement.",
        );
      }
    }
  } else if (!remettreProfil) {
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
