import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { muscleGroupLabel } from "@/lib/referentiel";

interface ExerciceJournal {
  name: string;
  sets: number;
  reps: [number, number] | null;
  duree: string | null;
  restSec: number;
  done: boolean;
}

export default async function HistoriquePage() {
  const session = await requireOnboardedUser();

  const seances = await prisma.workoutLog.findMany({
    where: { userId: session.id },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <h1 className="text-2xl font-bold text-ivoire">Historique</h1>
      <p className="mt-2 text-sm text-brume">
        {seances.length === 0
          ? "Aucune séance validée pour l'instant."
          : `${seances.length} séance${seances.length > 1 ? "s" : ""} enregistrée${seances.length > 1 ? "s" : ""}.`}
      </p>

      {seances.length === 0 ? (
        <p className="surface mt-8 p-6 text-center text-sm text-brume">
          Ta première séance validée apparaîtra ici, avec le détail des exercices réalisés.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {seances.map((s) => {
            const exercices = s.exercises as unknown as ExerciceJournal[];
            const faits = exercices.filter((e) => e.done).length;

            return (
              <li key={s.id}>
                <details className="surface overflow-hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium text-ivoire">
                        {muscleGroupLabel(s.muscleGroup)}
                        {s.isBonus && (
                          <span className="ml-2 text-xs tracking-wide text-or-500 uppercase">
                            bonus
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-cendre">
                        {s.date.toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          timeZone: "UTC",
                        })}{" "}
                        · {faits}/{exercices.length} exercices
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-or-400">+{s.lpEarned} LP</span>
                  </summary>

                  <ul className="border-t border-nuit-700/60">
                    {exercices.map((e, i) => (
                      <li
                        key={`${s.id}-${i}`}
                        className="flex items-baseline justify-between gap-4 border-b border-nuit-700/40 px-4 py-2.5 last:border-0"
                      >
                        <span className={e.done ? "text-sm text-brume" : "text-sm text-cendre line-through"}>
                          {e.name}
                        </span>
                        <span className="shrink-0 text-xs text-cendre">
                          {e.duree ? `${e.sets} × ${e.duree}` : `${e.sets} × ${e.reps?.[0]}-${e.reps?.[1]}`}
                        </span>
                      </li>
                    ))}
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
