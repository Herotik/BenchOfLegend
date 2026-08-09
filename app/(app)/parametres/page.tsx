import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deconnexion } from "@/app/actions/auth";
import { FormulairePreferences } from "@/components/parametres/FormulairePreferences";
import { ZoneDanger } from "@/components/parametres/ZoneDanger";

export default async function ParametresPage() {
  const session = await requireOnboardedUser();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    include: { equipments: true, muscleGroups: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <h1 className="text-2xl font-bold text-ivoire">Réglages</h1>
      <p className="mt-2 text-sm text-brume">
        Connecté avec <span className="text-ivoire">{user.email}</span>. Toute modification
        régénère le plan des semaines à venir, jamais le passé.
      </p>

      <div className="mt-8">
        <FormulairePreferences
          initial={{
            heightCm: user.heightCm,
            level: user.level,
            goal: user.goal,
            daysPerWeek: user.daysPerWeek,
            equipments: user.equipments.map((e) => e.equipmentId),
            muscleGroups: user.muscleGroups.map((g) => g.groupId),
            pointsForts: user.muscleGroups.filter((g) => g.priority >= 2).map((g) => g.groupId),
          }}
        />
      </div>

      <ZoneDanger />

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
