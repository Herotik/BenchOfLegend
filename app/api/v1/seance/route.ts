import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authentifierOnboarde } from "@/lib/api/garde";
import { jsonPrive, valider } from "@/lib/api/reponse";
import { jourUTC } from "@/lib/dates";
import { assurerPlans, seanceDuJour, seancesSur7Jours } from "@/lib/plan-hebdo";
import { avertissementRecuperationPour } from "@/lib/recuperation";
import { MUSCLE_GROUPS } from "@/lib/referentiel";

const schema = z.object({
  groupe: z.enum(MUSCLE_GROUPS.map((g) => g.id) as [string, ...string[]]),
});

/**
 * Séance du jour pour un groupe.
 *
 * Non persistée : elle est régénérée à partir de la graine du jour, donc
 * identique d'un appel à l'autre. Le serveur la régénérera encore à la
 * validation — ce que l'app renvoie n'est jamais cru sur parole.
 *
 * N'importe quel groupe est accepté, y compris hors préférences : c'est ce qui
 * permet une séance bonus.
 */
export async function GET(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const { searchParams } = new URL(requete.url);
  const params = valider(schema, { groupe: searchParams.get("groupe") ?? undefined });
  if (!params.ok) return params.reponse;

  const { groupe } = params.valeur;
  const userId = auth.valeur.id;
  const aujourdhui = jourUTC();

  // Une app fraîchement installée peut arriver ici avant d'avoir consulté le
  // plan : sans génération, elle ne trouverait aucun `planDayId` et ne
  // pourrait valider sa séance qu'en bonus, à 8 Δ au lieu de 20.
  await assurerPlans(userId);

  const [seance, planDay, avertissement, sur7Jours, bonusDuJour] = await Promise.all([
    seanceDuJour(userId, groupe),
    prisma.planDay.findFirst({
      where: { userId, date: aujourdhui, muscleGroup: groupe, status: { not: "REPOS" } },
    }),
    avertissementRecuperationPour(userId, groupe),
    seancesSur7Jours(userId),
    prisma.workoutLog.count({ where: { userId, date: aujourdhui, isBonus: true } }),
  ]);

  return jsonPrive({
    groupe,
    date: aujourdhui.toISOString().slice(0, 10),
    // `null` = ce groupe n'est pas au programme du jour : la séance ne peut
    // être validée qu'en bonus.
    planDayId: planDay && planDay.status === "PREVU" ? planDay.id : null,
    dejaValidee: planDay?.status === "FAIT",
    seance,
    avertissement,
    // De quoi afficher un aperçu des Δ avec le barème de `/api/v1/referentiel` :
    // ce sont exactement les deux entrées que le calcul serveur consomme.
    seancesSur7Jours: sur7Jours,
    bonusDejaCompte: bonusDuJour > 0,
  });
}
