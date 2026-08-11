import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { assurerPlans, seanceDuJour } from "@/lib/plan-hebdo";
import { rankForLp } from "@/lib/ranks";
import { muscleGroupLabel } from "@/lib/referentiel";
import { EcussonRang } from "@/components/EcussonRang";
import { SeanceDuJour } from "@/components/dashboard/SeanceDuJour";
import { deconnexion } from "@/app/actions/auth";

export default async function DashboardPage() {
  const session = await requireOnboardedUser();

  // « Cron logique » de la spec §5.1 : le plan de la semaine se crée au
  // premier chargement, et les jours passés non validés basculent en MANQUE.
  const plan = await assurerPlans(session.id);
  const aujourdhui = jourUTC();

  const duJour = plan.filter(
    (p) => p.date.getTime() === aujourdhui.getTime() && p.status !== "REPOS",
  );

  const [user, totalSeances, derniereePesee] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { lp: true, name: true } }),
    prisma.workoutLog.count({ where: { userId: session.id } }),
    prisma.weighIn.findFirst({ where: { userId: session.id }, orderBy: { date: "desc" } }),
  ]);

  const [streak, bonusDuJour] = await Promise.all([
    prisma.workoutLog.count({
      where: {
        userId: session.id,
        date: { gte: new Date(aujourdhui.getTime() - 6 * 86_400_000) },
      },
    }),
    prisma.workoutLog.count({
      where: { userId: session.id, date: aujourdhui, isBonus: true },
    }),
  ]);

  const rang = rankForLp(user.lp);
  const seances = await Promise.all(
    duJour.map(async (p) => ({
      planDay: p,
      seance: await seanceDuJour(session.id, p.muscleGroup),
    })),
  );

  const prenom = user.name?.split(" ")[0] ?? "toi";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texte">Salut {prenom}</h1>
          <p className="mt-1 text-sm text-texte-2">
            {duJour.length > 0
              ? `Au programme : ${duJour.map((p) => muscleGroupLabel(p.muscleGroup)).join(" et ")}.`
              : "Jour de repos. La récupération fait partie de la progression."}
          </p>
        </div>
        <form action={deconnexion}>
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-filet px-3 py-1.5 text-sm text-texte-2 transition hover:text-texte"
          >
            Déconnexion
          </button>
        </form>
      </header>

      <section className="surface mt-8 flex justify-center p-7">
        <EcussonRang lp={user.lp} />
      </section>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Stat terme="Séances" valeur={String(totalSeances)} />
        <Stat terme="Sur 7 jours" valeur={String(streak)} />
        <Stat terme="Poids" valeur={derniereePesee ? `${derniereePesee.kg} kg` : "—"} />
      </dl>

      <div className="mt-8 flex flex-col gap-6">
        {seances.map(({ planDay, seance }) =>
          planDay.status === "FAIT" ? (
            <section key={planDay.id} className="surface p-5 text-center">
              <p className="text-sm text-positif">
                {muscleGroupLabel(planDay.muscleGroup)} — séance validée. À demain.
              </p>
            </section>
          ) : (
            <SeanceDuJour
              key={planDay.id}
              seance={seance}
              planDayId={planDay.id}
              couleur={rang.color}
              seancesSur7Jours={streak}
              bonusDejaCompte={bonusDuJour > 0}
            />
          ),
        )}

        {duJour.length === 0 && (
          <section className="surface p-6 text-center">
            <p className="text-sm text-texte-2">
              Rien de prévu aujourd&apos;hui — ton plan te fait récupérer.
            </p>
          </section>
        )}

        <Link
          href="/seance-bonus"
          className="rounded-lg border border-filet px-6 py-3 text-center text-sm text-texte-2 transition hover:border-accent/60 hover:text-accent"
        >
          {duJour.length === 0 ? "Faire une séance bonus quand même" : "Ajouter une séance bonus"}
        </Link>
      </div>
    </main>
  );
}

function Stat({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="surface p-3 text-center">
      <dt className="text-xs text-texte-3">{terme}</dt>
      <dd className="mt-1 text-lg font-medium text-texte">{valeur}</dd>
    </div>
  );
}
