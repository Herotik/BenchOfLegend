import { requireOnboardedUser } from "@/lib/session";
import { chargerStats } from "@/lib/stats";
import { Graphiques } from "@/components/graphiques/Graphiques";

export default async function GraphiquesPage() {
  const session = await requireOnboardedUser();
  const stats = await chargerStats(session.id);

  const aucuneDonnee = stats.poids.length === 0 && stats.lp.length === 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <h1 className="text-2xl font-bold text-texte">Courbes</h1>
      <p className="mt-2 text-sm text-texte-2">
        {aucuneDonnee
          ? "Tes graphiques se remplissent au fil des pesées et des séances validées."
          : "Poids, volume, assiduité et progression des Δ."}
      </p>

      <div className="mt-8">
        <Graphiques stats={stats} />
      </div>
    </main>
  );
}
