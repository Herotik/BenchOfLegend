import { z } from "zod";
import { authentifierOnboarde, erreur } from "@/lib/api/garde";
import { jsonPrive, valider } from "@/lib/api/reponse";
import { planSurPlage } from "@/lib/plan-hebdo";

/**
 * Jour civil à minuit UTC, comme tout ce que l'app stocke en date (`lib/dates.ts`).
 *
 * Le contrôle du format ne suffit pas : « 2026-02-31 » y répond, et `Date` le
 * décale silencieusement au 3 mars. On vérifie donc que la date relue est bien
 * celle qui a été demandée.
 */
const jourISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00.000Z`);
      // Zod enchaîne les contrôles sans s'arrêter au premier : celui-ci reçoit
      // aussi les chaînes que la regex vient de refuser, et doit les traverser
      // sans lever.
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "Date inexistante" },
  )
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

const schema = z.object({ debut: jourISO, fin: jourISO });

/** Un an d'un coup suffit à toute vue calendaire ; au-delà, c'est un ratissage. */
const PLAGE_MAX_JOURS = 366;

export async function GET(requete: Request) {
  const auth = await authentifierOnboarde(requete);
  if (!auth.ok) return auth.reponse;

  const { searchParams } = new URL(requete.url);
  const plage = valider(schema, {
    debut: searchParams.get("debut") ?? undefined,
    fin: searchParams.get("fin") ?? undefined,
  });
  if (!plage.ok) return plage.reponse;

  const { debut, fin } = plage.valeur;
  if (fin < debut) {
    return erreur("La fin de la plage précède son début", 422, "plage_inversee");
  }
  if ((fin.getTime() - debut.getTime()) / 86_400_000 > PLAGE_MAX_JOURS) {
    return erreur(`Plage limitée à ${PLAGE_MAX_JOURS} jours`, 422, "plage_trop_large");
  }

  // La lecture déclenche la génération : c'est le « cron logique » de la
  // spec §5.1, celui-là même que déclenchent le tableau de bord et le
  // calendrier. L'app n'a donc rien à provoquer elle-même.
  const jours = await planSurPlage(auth.valeur.id, debut, fin);

  return jsonPrive({
    jours: jours.map((j) => ({
      id: j.id,
      date: j.date.toISOString().slice(0, 10),
      groupe: j.muscleGroup,
      statut: j.status,
      seanceId: j.workoutId,
    })),
  });
}
