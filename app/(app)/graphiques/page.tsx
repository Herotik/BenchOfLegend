import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function GraphiquesPage() {
  const session = await requireOnboardedUser();

  const [pesees, seances] = await Promise.all([
    prisma.weighIn.count({ where: { userId: session.id } }),
    prisma.workoutLog.count({ where: { userId: session.id } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <h1 className="text-2xl font-bold text-ivoire">Courbes</h1>
      <p className="mt-2 text-sm leading-relaxed text-brume">
        Poids, volume d&apos;entraînement, assiduité et progression des LP. Cinq graphiques, à
        construire dans la prochaine phase.
      </p>

      <div className="surface mt-8 p-6">
        <p className="text-sm text-brume">
          Données déjà collectées : <span className="text-ivoire">{pesees}</span> pesée
          {pesees > 1 ? "s" : ""} et <span className="text-ivoire">{seances}</span> séance
          {seances > 1 ? "s" : ""}.
        </p>
        <p className="mt-3 text-sm text-cendre">
          Une courbe de poids devient lisible à partir d&apos;une dizaine de pesées. Le check-in
          quotidien, qui les collecte automatiquement à la connexion, arrive juste avant.
        </p>
      </div>
    </main>
  );
}
