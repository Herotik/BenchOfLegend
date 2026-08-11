import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { muscleGroupLabel } from "@/lib/referentiel";

interface ExerciceJournal {
  name: string;
  sets: number;
  /** Nombre précis depuis le passage au ressenti ; anciennes séances : fourchette. */
  reps: number | [number, number] | null;
  duree: string | null;
  restSec: number;
  statut?: "non_fait" | "partiel" | "fait";
  /** Charge utilisée, en kilos. Absente au poids de corps. */
  poidsKg?: number | null;
  /** Champ des séances enregistrées avant le suivi en trois états. */
  done?: boolean;
}

const statutDe = (e: ExerciceJournal) => e.statut ?? (e.done ? "fait" : "non_fait");

const doseDe = (e: ExerciceJournal) => {
  if (e.duree) return `${e.sets} × ${e.duree}`;
  const reps = Array.isArray(e.reps) ? `${e.reps[0]}-${e.reps[1]}` : e.reps;
  return e.poidsKg != null ? `${e.sets} × ${reps} · ${e.poidsKg} kg` : `${e.sets} × ${reps}`;
};

export default async function HistoriquePage() {
  const session = await requireOnboardedUser();

  const seances = await prisma.workoutLog.findMany({
    where: { userId: session.id },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <h1 className="text-2xl font-bold text-texte">Historique</h1>
      <p className="mt-2 text-sm text-texte-2">
        {seances.length === 0
          ? "Aucune séance validée pour l'instant."
          : `${seances.length} séance${seances.length > 1 ? "s" : ""} enregistrée${seances.length > 1 ? "s" : ""}.`}
      </p>

      {seances.length === 0 ? (
        <p className="surface mt-8 p-6 text-center text-sm text-texte-2">
          Ta première séance validée apparaîtra ici, avec le détail des exercices réalisés.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {seances.map((s) => {
            const exercices = s.exercises as unknown as ExerciceJournal[];
            const faits = exercices.filter((e) => statutDe(e) === "fait").length;

            return (
              <li key={s.id}>
                <details className="surface overflow-hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium text-texte">
                        {muscleGroupLabel(s.muscleGroup)}
                        {s.isBonus && (
                          <span className="ml-2 text-xs tracking-wide text-accent uppercase">
                            bonus
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-texte-3">
                        {s.date.toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          timeZone: "UTC",
                        })}{" "}
                        · {faits}/{exercices.length} exercices
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-accent">+{s.lpEarned} Δ</span>
                  </summary>

                  <ul className="border-t border-filet/60">
                    {exercices.map((e, i) => {
                      const statut = statutDe(e);
                      return (
                        <li
                          key={`${s.id}-${i}`}
                          className="flex items-baseline justify-between gap-4 border-b border-filet/40 px-4 py-2.5 last:border-0"
                        >
                          <span
                            className={
                              statut === "fait"
                                ? "text-sm text-texte-2"
                                : statut === "partiel"
                                  ? "text-sm text-texte-2"
                                  : "text-sm text-texte-3 line-through"
                            }
                          >
                            {e.name}
                            {statut === "partiel" && (
                              <span className="ml-2 text-xs text-negatif">non finie</span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-texte-3">{doseDe(e)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
