"use client";

import { useState, useTransition } from "react";
import { ChronoRepos } from "./ChronoRepos";
import { ajusterDifficulte, validerSeance, type ResultatValidation } from "@/app/actions/seance";
import type { Seance } from "@/lib/engine";
import { calculerLp, ratioComplete, SEUIL_PARTIEL, type StatutExercice } from "@/lib/lp";
import { RESSENTIS, type Ressenti } from "@/lib/difficulte";
import { muscleGroupLabel } from "@/lib/referentiel";

export function SeanceDuJour({
  seance,
  planDayId,
  isBonus = false,
  couleur,
  seancesSur7Jours = 0,
  bonusDejaCompte = false,
}: {
  seance: Seance;
  planDayId?: string;
  isBonus?: boolean;
  couleur: string;
  seancesSur7Jours?: number;
  bonusDejaCompte?: boolean;
}) {
  const [statuts, setStatuts] = useState<StatutExercice[]>(
    () => seance.exercices.map(() => "non_fait"),
  );
  const [etape, setEtape] = useState<"seance" | "ressenti">("seance");
  const [resultat, setResultat] = useState<ResultatValidation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  // Aperçu calculé par la **même** fonction que le serveur : une formule
  // dupliquée ici annonçait 20 LP sur une séance bonus qui en rapporte 8.
  const ratio = ratioComplete(statuts.map((statut) => ({ statut })));
  const apercu = calculerLp({
    ratioComplete: ratio,
    isBonus,
    finisherComplete: seance.exercices.some((e, i) => e.finisher && statuts[i] === "fait"),
    seancesSur7Jours,
    bonusDejaCompteAujourdhui: bonusDejaCompte,
  });

  function definir(i: number, statut: StatutExercice) {
    setStatuts((s) => s.map((v, k) => (k === i ? (v === statut ? "non_fait" : statut) : v)));
  }

  function valider(ressenti: Ressenti) {
    setErreur(null);
    startTransition(async () => {
      const r = await validerSeance({
        planDayId,
        muscleGroup: seance.muscleGroup,
        isBonus,
        statuts,
        ressenti,
      });
      if ("erreur" in r) {
        setErreur(r.erreur);
        setEtape("seance");
      } else {
        setResultat(r);
      }
    });
  }

  if (resultat) return <Bilan resultat={resultat} couleur={couleur} />;

  if (etape === "ressenti") {
    return (
      <section className="surface p-6">
        <h2 className="text-lg font-semibold text-ivoire">C&apos;était comment ?</h2>
        <p className="mt-1 text-sm text-brume">
          Ça sert à ajuster la difficulté de tes prochaines séances sur ce groupe.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {RESSENTIS.map((r) => (
            <button
              key={r.cle}
              type="button"
              disabled={enCours}
              onClick={() => valider(r.cle)}
              className="rounded-lg border border-nuit-600 p-4 text-left transition hover:border-or-600/60 disabled:opacity-40"
            >
              <span className="block font-medium text-ivoire">{r.label}</span>
              <span className="mt-0.5 block text-xs text-cendre">{r.aide}</span>
            </button>
          ))}
        </div>

        {erreur && (
          <p role="alert" className="mt-4 text-sm text-manque">
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={() => setEtape("seance")}
          disabled={enCours}
          className="mt-4 text-sm text-cendre transition hover:text-brume"
        >
          Retour à la séance
        </button>
      </section>
    );
  }

  return (
    <section className="surface overflow-hidden">
      <header className="flex items-baseline justify-between gap-4 border-b border-nuit-700/60 p-5">
        <div>
          <h2 className="text-lg font-semibold text-ivoire">
            {isBonus ? "Séance bonus" : "Séance du jour"}
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: couleur }}>
            {muscleGroupLabel(seance.muscleGroup)}
          </p>
        </div>
        <p className="shrink-0 text-sm text-cendre">{Math.round(ratio * 100)} %</p>
      </header>

      <div className="border-b border-nuit-700/60 px-5 py-3">
        <p className="text-xs tracking-wide text-cendre uppercase">Échauffement</p>
        <p className="mt-1 text-sm text-brume">{seance.echauffement.join(" · ")}</p>
      </div>

      <ul>
        {seance.exercices.map((exo, i) => {
          const statut = statuts[i];
          const fait = statut === "fait";
          const partiel = statut === "partiel";

          return (
            <li key={exo.exerciceId} className="border-b border-nuit-700/60 last:border-0">
              <div className="flex items-start gap-3 p-4">
                <button
                  type="button"
                  onClick={() => definir(i, "fait")}
                  aria-pressed={fait}
                  aria-label={`${exo.nom} : série terminée`}
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm transition"
                  style={{
                    borderColor: fait ? couleur : "var(--color-nuit-600)",
                    backgroundColor: fait ? `${couleur}20` : "transparent",
                    color: fait ? couleur : "transparent",
                  }}
                >
                  ✓
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span
                      className={`font-medium ${fait ? "text-cendre line-through" : "text-ivoire"}`}
                    >
                      {exo.nom}
                    </span>
                    {exo.finisher && (
                      <span className="text-xs tracking-wide text-or-500 uppercase">finisher</span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-brume">
                    {exo.duree
                      ? `${exo.series} × ${exo.duree}`
                      : `${exo.series} séries × ${exo.reps} répétitions`}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-cendre">{exo.description}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <ChronoRepos secondes={exo.restSec} couleur={couleur} />
                    <button
                      type="button"
                      onClick={() => definir(i, "partiel")}
                      aria-pressed={partiel}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        partiel
                          ? "border-manque text-manque"
                          : "border-nuit-600 text-cendre hover:text-brume"
                      }`}
                    >
                      Série non finie
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="p-5">
        {erreur && (
          <p role="alert" className="mb-3 text-sm text-manque">
            {erreur}
          </p>
        )}
        <p className="mb-3 text-xs text-cendre">
          {apercu.total > 0
            ? `${apercu.details.map((d) => d.libelle).join(", ")} — +${apercu.total} LP.`
            : bonusDejaCompte && isBonus
              ? "Tu as déjà validé une séance bonus aujourd'hui : celle-ci ne rapportera pas de LP."
              : "Coche tes exercices — une série non finie compte pour moitié."}
        </p>
        <button
          type="button"
          onClick={() => setEtape("ressenti")}
          disabled={enCours || ratio < SEUIL_PARTIEL}
          className="w-full rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 font-medium text-or-400 transition hover:bg-or-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Valider la séance
        </button>
      </footer>
    </section>
  );
}

function Bilan({ resultat, couleur }: { resultat: ResultatValidation; couleur: string }) {
  const [proposition, setProposition] = useState(resultat.proposition);
  const [applique, setApplique] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  return (
    <section className="surface p-6 text-center" aria-live="polite">
      {resultat.promoted && (
        <p className="font-display text-xs tracking-[0.3em] uppercase" style={{ color: couleur }}>
          Promotion
        </p>
      )}
      <p className="mt-2 text-4xl font-bold" style={{ color: couleur }}>
        +{resultat.lpEarned} LP
      </p>
      <p className="mt-2 text-sm text-brume">
        {resultat.promoted
          ? `Te voilà ${resultat.newRank}.`
          : `${resultat.newRank} · ${resultat.lpTotal} LP au total`}
      </p>

      <ul className="mx-auto mt-5 flex max-w-xs flex-col gap-1.5 text-sm">
        {resultat.details.map((d) => (
          <li key={d.libelle} className="flex justify-between text-brume">
            <span>{d.libelle}</span>
            <span className="text-ivoire">+{d.lp}</span>
          </li>
        ))}
      </ul>

      {proposition && !applique && (
        <div className="mt-6 border-t border-nuit-700/60 pt-5">
          <p className="text-sm leading-relaxed text-brume">{proposition.message}</p>
          <div className="mt-3 flex justify-center gap-3">
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                startTransition(async () => {
                  const r = await ajusterDifficulte(proposition.muscleGroup, proposition.delta);
                  if ("ok" in r) {
                    setApplique(
                      proposition.delta > 0
                        ? "C'est noté, on corse à partir de la prochaine séance."
                        : "C'est noté, on redescend d'un cran dès la prochaine séance.",
                    );
                  }
                })
              }
              className="rounded-lg border border-or-600/60 bg-or-500/10 px-5 py-2.5 text-sm font-medium text-or-400 transition hover:bg-or-500/20 disabled:opacity-40"
            >
              D&apos;accord
            </button>
            <button
              type="button"
              onClick={() => setProposition(null)}
              className="rounded-lg px-5 py-2.5 text-sm text-brume transition hover:text-ivoire"
            >
              Non, ça va
            </button>
          </div>
        </div>
      )}

      {applique && <p className="mt-6 text-sm text-succes">{applique}</p>}
    </section>
  );
}
