"use client";

import { useState, useTransition } from "react";
import { ChronoRepos } from "./ChronoRepos";
import { ajusterDifficulte, validerSeance, type ResultatValidation } from "@/app/actions/seance";
import type { Seance } from "@/lib/engine";
import { calculerLp, ratioComplete, SEUIL_PARTIEL, type StatutExercice } from "@/lib/lp";
import { RESSENTIS, type Ressenti } from "@/lib/difficulte";
import { muscleGroupLabel } from "@/lib/referentiel";
import { Meandre, SeparateurLosange } from "@/components/ornements/Meandre";

/** -1 = échauffement, 0..n-1 = exercices. */
type Position = number;

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
  const [statuts, setStatuts] = useState<StatutExercice[]>(() =>
    seance.exercices.map(() => "non_fait"),
  );
  const [charges, setCharges] = useState<(number | null)[]>(() =>
    seance.exercices.map((e) => e.derniereCharge ?? null),
  );
  const [position, setPosition] = useState<Position>(-1);
  const [etape, setEtape] = useState<"seance" | "ressenti">("seance");
  const [resultat, setResultat] = useState<ResultatValidation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  const total = seance.exercices.length;

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

  /** Marque l'exercice courant puis enchaîne — on ne revient pas en arrière tout seul. */
  function marquer(statut: StatutExercice) {
    setStatuts((s) => s.map((v, k) => (k === position ? statut : v)));
    if (position < total - 1) setPosition(position + 1);
    else setEtape("ressenti");
  }

  function valider(ressenti: Ressenti) {
    setErreur(null);
    startTransition(async () => {
      const r = await validerSeance({
        planDayId,
        muscleGroup: seance.muscleGroup,
        isBonus,
        statuts,
        charges,
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
          {statuts.filter((s) => s === "fait").length}/{total} exercices bouclés
          {apercu.total > 0 ? ` · +${apercu.total} LP en jeu` : ""}. Ton ressenti ajuste la
          difficulté des prochaines séances sur ce groupe.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {RESSENTIS.map((r, i) => (
            <button
              key={r.cle}
              type="button"
              disabled={enCours}
              onClick={() => valider(r.cle)}
              className="rounded-lg border border-nuit-600 p-4 text-left transition hover:border-or-600/60 disabled:opacity-40 motion-safe:monte"
              style={{ animationDelay: `${i * 70}ms` }}
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
          onClick={() => {
            setEtape("seance");
            setPosition(total - 1);
          }}
          disabled={enCours}
          className="mt-4 text-sm text-cendre transition hover:text-brume"
        >
          Revenir à la séance
        </button>
      </section>
    );
  }

  const exo = position >= 0 ? seance.exercices[position] : null;

  return (
    <section className="surface overflow-hidden">
      <header className="border-b border-nuit-700/60 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ivoire">
              {isBonus ? "Séance bonus" : "Séance du jour"}
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: couleur }}>
              {muscleGroupLabel(seance.muscleGroup)}
            </p>
          </div>
          <p className="shrink-0 text-sm text-cendre tabular-nums">
            {position < 0 ? "Échauffement" : `${position + 1} / ${total}`}
          </p>
        </div>

        <FilDAriane
          statuts={statuts}
          position={position}
          couleur={couleur}
          onAller={setPosition}
          noms={seance.exercices.map((e) => e.nom)}
        />
      </header>

      {exo === null ? (
        <div className="p-6">
          <p className="text-xs tracking-wide text-cendre uppercase">Avant de commencer</p>
          <ul className="mt-3 flex flex-col gap-2">
            {seance.echauffement.map((e) => (
              <li key={e} className="text-sm text-brume">
                {e}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPosition(0)}
            className="mt-6 w-full rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 font-medium text-or-400 transition hover:bg-or-500/20"
          >
            Commencer
          </button>
        </div>
      ) : (
        // La clé force le remontage : chaque exercice entre avec sa propre
        // animation au lieu de voir son texte se substituer sur place.
        <div key={position} className="p-6 motion-safe:apparait">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="font-display text-xl font-bold text-ivoire">{exo.nom}</h3>
            {exo.finisher && (
              <span className="text-xs tracking-wide text-or-500 uppercase">finisher</span>
            )}
          </div>

          <p className="mt-3 text-2xl font-semibold tabular-nums" style={{ color: couleur }}>
            {exo.duree ? `${exo.series} × ${exo.duree}` : `${exo.series} × ${exo.reps}`}
            {!exo.duree && <span className="ml-2 text-base text-brume">répétitions</span>}
          </p>

          <p className="mt-4 text-sm leading-relaxed text-brume">{exo.description}</p>

          {exo.chargeRequise && (
            <div className="mt-5">
              <label className="text-sm text-brume" htmlFor={`charge-${position}`}>
                Charge utilisée
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id={`charge-${position}`}
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={charges[position] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    setCharges((c) => c.map((k, j) => (j === position ? v : k)));
                  }}
                  placeholder="—"
                  className="w-28 rounded-lg border border-nuit-600 bg-nuit-900 px-3 py-2.5 text-lg tabular-nums text-ivoire"
                />
                <span className="text-brume">kg</span>
              </div>
              {exo.derniereCharge != null && (
                <p className="mt-1.5 text-xs text-cendre">
                  La dernière fois : {exo.derniereCharge} kg
                  {charges[position] != null && charges[position] !== exo.derniereCharge && (
                    <span
                      className="ml-2"
                      style={{ color: charges[position]! > exo.derniereCharge ? "var(--color-succes)" : "var(--color-brume)" }}
                    >
                      {charges[position]! > exo.derniereCharge ? "+" : ""}
                      {Math.round((charges[position]! - exo.derniereCharge) * 10) / 10} kg
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          <div className="mt-5">
            <ChronoRepos secondes={exo.restSec} couleur={couleur} />
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => marquer("fait")}
              className="w-full rounded-lg border px-6 py-3.5 font-medium transition"
              style={{ borderColor: couleur, backgroundColor: `${couleur}18`, color: couleur }}
            >
              Série terminée
            </button>
            <button
              type="button"
              onClick={() => marquer("partiel")}
              className="w-full rounded-lg border border-nuit-600 px-6 py-3 text-sm text-brume transition hover:text-ivoire"
            >
              Je n&apos;ai pas fini
            </button>
          </div>

          {position > -1 && (
            <button
              type="button"
              onClick={() => setPosition(position - 1)}
              className="mt-4 text-sm text-cendre transition hover:text-brume"
            >
              ← Exercice précédent
            </button>
          )}
        </div>
      )}

      <footer className="border-t border-nuit-700/60 p-5">
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
              : "Une série non finie compte pour moitié."}
        </p>
        <button
          type="button"
          onClick={() => setEtape("ressenti")}
          disabled={ratio < SEUIL_PARTIEL}
          className="w-full rounded-lg border border-nuit-600 px-6 py-2.5 text-sm text-brume transition hover:border-or-600/60 hover:text-or-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Terminer la séance maintenant
        </button>
      </footer>
    </section>
  );
}

/**
 * Fil d'Ariane de la séance : une pastille par exercice, cliquable pour
 * revenir en arrière. Le fil d'Ariane est d'ailleurs le bon nom — c'est celui
 * qu'Ariane donne à Thésée pour retrouver son chemin dans le labyrinthe.
 */
function FilDAriane({
  statuts,
  position,
  couleur,
  onAller,
  noms,
}: {
  statuts: StatutExercice[];
  position: number;
  couleur: string;
  onAller: (i: number) => void;
  noms: string[];
}) {
  return (
    <ol className="mt-4 flex items-center gap-1.5" aria-label="Avancement de la séance">
      <li>
        <button
          type="button"
          onClick={() => onAller(-1)}
          aria-label="Échauffement"
          aria-current={position === -1 ? "step" : undefined}
          className="block size-2.5 rotate-45 rounded-[2px] border transition"
          style={{
            borderColor: position === -1 ? couleur : "var(--color-nuit-600)",
            backgroundColor: position === -1 ? couleur : "transparent",
          }}
        />
      </li>

      {statuts.map((statut, i) => {
        const courant = i === position;
        const fond =
          statut === "fait" ? couleur : statut === "partiel" ? "var(--color-manque)" : "transparent";
        return (
          <li key={i} className="flex-1">
            <button
              type="button"
              onClick={() => onAller(i)}
              aria-label={`${i + 1}. ${noms[i]}`}
              aria-current={courant ? "step" : undefined}
              className="block h-1.5 w-full rounded-full border transition-all"
              style={{
                backgroundColor: fond,
                borderColor: courant ? couleur : "var(--color-nuit-700)",
                transform: courant ? "scaleY(1.8)" : undefined,
              }}
            />
          </li>
        );
      })}
    </ol>
  );
}

function Bilan({ resultat, couleur }: { resultat: ResultatValidation; couleur: string }) {
  const [proposition, setProposition] = useState(resultat.proposition);
  const [applique, setApplique] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  return (
    <section className="surface relative overflow-hidden p-6 text-center" aria-live="polite">
      {resultat.promoted && <Rayons couleur={couleur} />}

      <div className="relative">
        {resultat.promoted && (
          <p
            className="font-display text-xs tracking-[0.3em] uppercase motion-safe:apparait"
            style={{ color: couleur }}
          >
            Promotion
          </p>
        )}
        <p
          className="mt-2 text-5xl font-bold tabular-nums motion-safe:surgit"
          style={{ color: couleur, textShadow: `0 0 28px ${couleur}55` }}
        >
          +{resultat.lpEarned} LP
        </p>
        <p className="mt-2 text-sm text-brume motion-safe:apparait">
          {resultat.promoted
            ? `Te voilà ${resultat.newRank}.`
            : `${resultat.newRank} · ${resultat.lpTotal} LP au total`}
        </p>

        <div className="mx-auto mt-5 max-w-xs">
          <SeparateurLosange couleur={couleur} />
        </div>

        <ul className="mx-auto mt-4 flex max-w-xs flex-col gap-1.5 text-sm">
          {resultat.details.map((d, i) => (
            <li
              key={d.libelle}
              className="flex justify-between text-brume motion-safe:monte"
              // Les gains se posent l'un après l'autre : on lit d'où viennent
              // les LP au lieu de voir un bloc apparaître.
              style={{ animationDelay: `${180 + i * 110}ms` }}
            >
              <span>{d.libelle}</span>
              <span className="text-ivoire">+{d.lp}</span>
            </li>
          ))}
        </ul>
      </div>

      {proposition && !applique && (
        <div className="relative mt-6 border-t border-nuit-700/60 pt-5">
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

      {applique && <p className="relative mt-6 text-sm text-succes">{applique}</p>}

      <div className="relative mt-6" style={{ color: couleur }}>
        <Meandre opacite={0.25} />
      </div>
    </section>
  );
}

/** Rayons dorés derrière une promotion — la lumière de l'Olympe. */
function Rayons({ couleur }: { couleur: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        className="absolute top-0 left-1/2 size-72 -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl motion-safe:animate-[souffle_4s_ease-in-out_infinite]"
        style={{ backgroundColor: couleur, opacity: 0.3 }}
      />
      {[...Array(7)].map((_, i) => (
        <span
          key={i}
          className="absolute top-0 left-1/2 h-40 w-px origin-top motion-safe:apparait"
          style={{
            background: `linear-gradient(to bottom, ${couleur}, transparent)`,
            transform: `rotate(${-54 + i * 18}deg)`,
            opacity: 0.35,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </span>
  );
}
