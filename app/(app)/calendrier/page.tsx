import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { muscleGroupLabel } from "@/lib/referentiel";

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

export default async function CalendrierPage({ searchParams }: PageProps<"/calendrier">) {
  const session = await requireOnboardedUser();
  const { m } = await searchParams;

  const aujourdhui = jourUTC();
  const base = typeof m === "string" && /^\d{4}-\d{2}$/.test(m)
    ? new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1))
    : new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), 1));

  const debut = base;
  const fin = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));

  const jours = await prisma.planDay.findMany({
    where: { userId: session.id, date: { gte: debut, lt: fin } },
    orderBy: { date: "asc" },
  });

  // Un jour peut porter plusieurs groupes : on regroupe par date.
  const parJour = new Map<number, typeof jours>();
  for (const j of jours) {
    const cle = j.date.getTime();
    parJour.set(cle, [...(parJour.get(cle) ?? []), j]);
  }

  // La grille commence au lundi précédant le 1er du mois.
  const decalage = (debut.getUTCDay() + 6) % 7;
  const nbJours = Math.round((fin.getTime() - debut.getTime()) / 86_400_000);
  const cases = Array.from({ length: decalage + nbJours }, (_, i) =>
    i < decalage ? null : new Date(debut.getTime() + (i - decalage) * 86_400_000),
  );

  const moisPrec = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1));
  const moisSuiv = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  const cle = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ivoire">
          {MOIS[base.getUTCMonth()]} {base.getUTCFullYear()}
        </h1>
        <div className="flex gap-2">
          <Lien href={`/calendrier?m=${cle(moisPrec)}`} libelle="Mois précédent">←</Lien>
          <Lien href={`/calendrier?m=${cle(moisSuiv)}`} libelle="Mois suivant">→</Lien>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-7 gap-1.5">
        {JOURS_COURTS.map((j, i) => (
          <div key={i} className="pb-1 text-center text-xs text-cendre">
            {j}
          </div>
        ))}

        {cases.map((date, i) => {
          if (!date) return <div key={`vide-${i}`} />;

          const duJour = parJour.get(date.getTime()) ?? [];
          const seances = duJour.filter((d) => d.muscleGroup !== "repos");
          const estAujourdhui = date.getTime() === aujourdhui.getTime();

          const statut = seances.some((s) => s.status === "FAIT")
            ? "fait"
            : seances.some((s) => s.status === "MANQUE")
              ? "manque"
              : seances.length > 0
                ? "prevu"
                : "repos";

          return (
            <div
              key={date.getTime()}
              className={`min-h-16 rounded-lg border p-1.5 ${
                estAujourdhui ? "border-or-600/70" : "border-nuit-700/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${estAujourdhui ? "text-or-400" : "text-cendre"}`}>
                  {date.getUTCDate()}
                </span>
                {statut === "fait" && <span className="text-xs text-succes">✓</span>}
                {statut === "manque" && <span className="text-xs text-manque">·</span>}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {seances.map((s) => (
                  <span
                    key={s.id}
                    className={`truncate text-[10px] leading-tight ${
                      s.status === "FAIT"
                        ? "text-succes"
                        : s.status === "MANQUE"
                          ? "text-cendre"
                          : "text-brume"
                    }`}
                  >
                    {muscleGroupLabel(s.muscleGroup)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-cendre">
        <li><span className="text-succes">✓</span> séance faite</li>
        <li><span className="text-brume">—</span> séance prévue</li>
        <li><span className="text-manque">·</span> non faite</li>
        <li>case vide : repos</li>
      </ul>

      {jours.length === 0 && (
        <p className="surface mt-8 p-6 text-center text-sm text-brume">
          Rien encore sur ce mois. Ton plan se crée semaine par semaine, au premier passage sur
          le tableau de bord.
        </p>
      )}
    </main>
  );
}

function Lien({ href, libelle, children }: { href: string; libelle: string; children: string }) {
  return (
    <Link
      href={href}
      aria-label={libelle}
      className="rounded-lg border border-nuit-600 px-3 py-1.5 text-sm text-brume transition hover:text-ivoire"
    >
      {children}
    </Link>
  );
}
