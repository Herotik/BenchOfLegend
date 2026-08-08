import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deconnexion } from "@/app/actions/auth";
import {
  GOAL_LABELS,
  LEVEL_LABELS,
  equipmentLabel,
  muscleGroupLabel,
} from "@/lib/referentiel";

export default async function ParametresPage() {
  const session = await requireOnboardedUser();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    include: { equipments: true, muscleGroups: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <h1 className="text-2xl font-bold text-ivoire">Réglages</h1>

      <dl className="surface mt-8 flex flex-col p-5">
        <Ligne terme="Compte" valeur={user.email ?? "—"} />
        <Ligne terme="Taille" valeur={user.heightCm ? `${user.heightCm} cm` : "—"} />
        <Ligne terme="Niveau" valeur={LEVEL_LABELS[user.level]} />
        <Ligne terme="Objectif" valeur={GOAL_LABELS[user.goal]} />
        <Ligne terme="Rythme" valeur={`${user.daysPerWeek} séances par semaine`} />
        <Ligne
          terme="Matériel"
          valeur={
            user.equipments.length === 0
              ? "Poids de corps uniquement"
              : user.equipments.map((e) => equipmentLabel(e.equipmentId)).join(", ")
          }
        />
        <Ligne
          terme="Groupes"
          valeur={user.muscleGroups.map((g) => muscleGroupLabel(g.groupId)).join(", ")}
          dernier
        />
      </dl>

      <p className="mt-4 text-sm text-cendre">
        La modification de ces préférences, l&apos;export JSON de tes données et la suppression de
        compte arrivent à la dernière phase. Toute modification régénérera le plan des semaines à
        venir, jamais le passé.
      </p>

      <form action={deconnexion} className="mt-8">
        <button
          type="submit"
          className="rounded-lg border border-nuit-600 px-4 py-2.5 text-sm text-brume transition hover:text-ivoire"
        >
          Se déconnecter
        </button>
      </form>

      <p className="mt-10 text-xs text-cendre">
        Cette application ne remplace pas un avis médical.
      </p>
    </main>
  );
}

function Ligne({ terme, valeur, dernier }: { terme: string; valeur: string; dernier?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-6 py-3 text-sm ${dernier ? "" : "border-b border-nuit-700/60"}`}
    >
      <dt className="shrink-0 text-brume">{terme}</dt>
      <dd className="text-right text-ivoire">{valeur}</dd>
    </div>
  );
}
