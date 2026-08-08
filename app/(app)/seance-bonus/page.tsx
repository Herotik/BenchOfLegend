import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { seanceDuJour } from "@/lib/plan-hebdo";
import { rankForLp } from "@/lib/ranks";
import { MUSCLE_GROUPS, muscleGroupLabel } from "@/lib/referentiel";
import { avertissementRecuperation } from "@/app/actions/bonus";
import { SeanceDuJour } from "@/components/dashboard/SeanceDuJour";
import { prisma } from "@/lib/prisma";

export default async function SeanceBonusPage({ searchParams }: PageProps<"/seance-bonus">) {
  const session = await requireOnboardedUser();
  const { groupe } = await searchParams;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { lp: true },
  });
  const rang = rankForLp(user.lp);

  const choisi = typeof groupe === "string" && MUSCLE_GROUPS.some((g) => g.id === groupe)
    ? groupe
    : null;

  if (!choisi) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <h1 className="text-2xl font-bold text-ivoire">Séance bonus</h1>
        <p className="mt-2 text-sm leading-relaxed text-brume">
          Hors programme, quand tu veux. Choisis n&apos;importe quel groupe, même en dehors de
          ceux que tu as sélectionnés. Une séance bonus rapporte 8 LP, une par jour comptabilisée.
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MUSCLE_GROUPS.map((g) => (
            <li key={g.id}>
              <Link
                href={`/seance-bonus?groupe=${g.id}`}
                className="surface block px-4 py-5 text-center text-sm text-ivoire transition hover:border-or-600/60"
              >
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const [seance, avertissement] = await Promise.all([
    seanceDuJour(session.id, choisi),
    avertissementRecuperation(choisi),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <Link href="/seance-bonus" className="text-sm text-cendre transition hover:text-brume">
        ← Changer de groupe
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-ivoire">
        Bonus — {muscleGroupLabel(choisi)}
      </h1>

      {avertissement && (
        <p
          role="status"
          className="surface mt-5 border-manque/50 p-4 text-sm leading-relaxed text-brume"
        >
          {avertissement} Tu peux quand même la faire, mais garde-le en tête.
        </p>
      )}

      <div className="mt-6">
        {seance.exercices.length > 0 ? (
          <SeanceDuJour seance={seance} isBonus couleur={rang.color} />
        ) : (
          <p className="surface p-6 text-center text-sm text-brume">
            Aucun exercice disponible pour ce groupe avec ton matériel et ton niveau.
          </p>
        )}
      </div>
    </main>
  );
}
