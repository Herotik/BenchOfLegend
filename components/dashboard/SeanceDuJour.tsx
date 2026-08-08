"use client";

import { useState, useTransition } from "react";
import { ChronoRepos } from "./ChronoRepos";
import { validerSeance, type ResultatValidation } from "@/app/actions/seance";
import type { Seance } from "@/lib/engine";
import { SEUIL_COMPLET, SEUIL_PARTIEL } from "@/lib/lp";
import { muscleGroupLabel } from "@/lib/referentiel";

export function SeanceDuJour({
  seance,
  planDayId,
  isBonus = false,
  couleur,
}: {
  seance: Seance;
  planDayId?: string;
  isBonus?: boolean;
  couleur: string;
}) {
  const [coches, setCoches] = useState<Set<number>>(new Set());
  const [resultat, setResultat] = useState<ResultatValidation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  const ratio = seance.exercices.length === 0 ? 0 : coches.size / seance.exercices.length;
  const seuil =
    ratio >= SEUIL_COMPLET ? "complete" : ratio >= SEUIL_PARTIEL ? "partielle" : "insuffisante";

  function basculer(i: number) {
    setCoches((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  function valider() {
    setErreur(null);
    startTransition(async () => {
      const r = await validerSeance({
        planDayId,
        muscleGroup: seance.muscleGroup,
        isBonus,
        coches: [...coches],
      });
      if ("erreur" in r) setErreur(r.erreur);
      else setResultat(r);
    });
  }

  if (resultat) {
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
          {resultat.promoted ? `Te voilà ${resultat.newRank}.` : `${resultat.newRank} · ${resultat.lpTotal} LP au total`}
        </p>

        <ul className="mx-auto mt-5 flex max-w-xs flex-col gap-1.5 text-sm">
          {resultat.details.map((d) => (
            <li key={d.libelle} className="flex justify-between text-brume">
              <span>{d.libelle}</span>
              <span className="text-ivoire">+{d.lp}</span>
            </li>
          ))}
        </ul>
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
        <p className="shrink-0 text-sm text-cendre">
          {coches.size}/{seance.exercices.length}
        </p>
      </header>

      <div className="border-b border-nuit-700/60 px-5 py-3">
        <p className="text-xs tracking-wide text-cendre uppercase">Échauffement</p>
        <p className="mt-1 text-sm text-brume">{seance.echauffement.join(" · ")}</p>
      </div>

      <ul>
        {seance.exercices.map((exo, i) => {
          const coche = coches.has(i);
          return (
            <li key={exo.exerciceId} className="border-b border-nuit-700/60 last:border-0">
              <div className="flex items-start gap-3 p-4">
                <button
                  type="button"
                  onClick={() => basculer(i)}
                  aria-pressed={coche}
                  aria-label={`Marquer ${exo.nom} comme fait`}
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm transition"
                  style={{
                    borderColor: coche ? couleur : "var(--color-nuit-600)",
                    backgroundColor: coche ? `${couleur}20` : "transparent",
                    color: coche ? couleur : "transparent",
                  }}
                >
                  ✓
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`font-medium ${coche ? "text-cendre line-through" : "text-ivoire"}`}>
                      {exo.nom}
                    </span>
                    {exo.finisher && (
                      <span className="text-xs tracking-wide text-or-500 uppercase">finisher</span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-brume">
                    {exo.duree
                      ? `${exo.series} × ${exo.duree}`
                      : `${exo.series} séries × ${exo.reps![0]}-${exo.reps![1]} reps`}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-cendre">{exo.description}</p>

                  <div className="mt-2.5">
                    <ChronoRepos secondes={exo.restSec} couleur={couleur} />
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
          {seuil === "complete"
            ? "Séance complète : +20 LP."
            : seuil === "partielle"
              ? "Séance partielle : +12 LP. Encore quelques exercices pour la compter pleine."
              : `Coche au moins ${Math.ceil(seance.exercices.length * SEUIL_PARTIEL)} exercices pour qu'elle compte.`}
        </p>
        <button
          type="button"
          onClick={valider}
          disabled={enCours || seuil === "insuffisante"}
          className="w-full rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 font-medium text-or-400 transition hover:bg-or-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enCours ? "Validation…" : "Valider la séance"}
        </button>
      </footer>
    </section>
  );
}
