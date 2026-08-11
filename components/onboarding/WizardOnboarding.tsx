"use client";

import { useState, useTransition } from "react";
import {
  EQUIPMENTS,
  MUSCLE_GROUPS,
  LEVEL_LABELS,
  LEVEL_HINTS,
  GOAL_LABELS,
  type Goal,
  type Level,
} from "@/lib/referentiel";
import { terminerOnboarding } from "@/app/actions/onboarding";

const ETAPES = ["Profil", "Matériel", "Objectifs", "Récapitulatif"] as const;

function bascule(liste: string[], valeur: string): string[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
}

export function WizardOnboarding({ prenom }: { prenom: string }) {
  const [etape, setEtape] = useState(0);
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [heightCm, setHeightCm] = useState("");
  const [poidsKg, setPoidsKg] = useState("");
  const [level, setLevel] = useState<Level>("DEBUTANT");
  const [equipments, setEquipments] = useState<string[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [goal, setGoal] = useState<Goal>("HYPERTROPHIE");
  const [daysPerWeek, setDaysPerWeek] = useState(3);

  const taille = Number(heightCm);
  const poids = Number(poidsKg);

  const etapeValide =
    etape === 0
      ? Number.isFinite(taille) && taille >= 120 && taille <= 230 &&
        Number.isFinite(poids) && poids >= 30 && poids <= 300
      : etape === 2
        ? muscleGroups.length > 0
        : true;

  function valider() {
    setErreur(null);
    startTransition(async () => {
      const res = await terminerOnboarding({
        heightCm: Math.round(taille),
        poidsKg: poids,
        level,
        equipments,
        muscleGroups,
        goal,
        daysPerWeek,
      });
      // En cas de succès l'action redirige et rien n'est renvoyé.
      if (res?.erreur) setErreur(res.erreur);
    });
  }

  return (
    <div>
      <ol className="flex gap-2" aria-label="Progression de l'inscription">
        {ETAPES.map((nom, i) => (
          <li key={nom} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors ${
                i <= etape ? "bg-accent" : "bg-filet"
              }`}
            />
            <span
              className={`mt-2 block text-xs ${i === etape ? "text-texte" : "text-texte-3"}`}
              aria-current={i === etape ? "step" : undefined}
            >
              {nom}
            </span>
          </li>
        ))}
      </ol>

      <div className="surface mt-8 p-6">
        {etape === 0 && (
          <section>
            <h2 className="text-xl font-semibold text-texte">Ton profil</h2>
            <p className="mt-2 text-sm text-texte-2">
              Le poids sera demandé chaque jour à la connexion — c&apos;est ce qui alimente tes
              courbes.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-texte-2">Taille (cm)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="175"
                  className="mt-1 w-full rounded-lg border border-filet bg-fond px-3 py-2.5 text-texte"
                />
              </label>
              <label className="block">
                <span className="text-sm text-texte-2">Poids actuel (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={poidsKg}
                  onChange={(e) => setPoidsKg(e.target.value)}
                  placeholder="70"
                  className="mt-1 w-full rounded-lg border border-filet bg-fond px-3 py-2.5 text-texte"
                />
              </label>
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm text-texte-2">Ton niveau</legend>
              <div className="mt-2 flex flex-col gap-2">
                {(Object.keys(LEVEL_LABELS) as Level[]).map((n) => (
                  <label
                    key={n}
                    className={`cursor-pointer rounded-lg border p-3 transition ${
                      level === n ? "border-accent bg-accent/10" : "border-filet"
                    }`}
                  >
                    <input
                      type="radio"
                      name="niveau"
                      className="sr-only"
                      checked={level === n}
                      onChange={() => setLevel(n)}
                    />
                    <span className="block text-sm font-medium text-texte">{LEVEL_LABELS[n]}</span>
                    <span className="mt-0.5 block text-xs text-texte-3">{LEVEL_HINTS[n]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {etape === 1 && (
          <section>
            <h2 className="text-xl font-semibold text-texte">Ton matériel</h2>
            <p className="mt-2 text-sm text-texte-2">
              Tout le monde a une chaise ou un canapé — le poids de corps est toujours disponible.
              Coche ce que tu as en plus, si tu as quelque chose.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {EQUIPMENTS.map((eq) => {
                const actif = equipments.includes(eq.id);
                return (
                  <label
                    key={eq.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      actif ? "border-accent bg-accent/10" : "border-filet"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={actif}
                      onChange={() => setEquipments((l) => bascule(l, eq.id))}
                    />
                    <span
                      aria-hidden
                      className={`flex size-5 shrink-0 items-center justify-center rounded border text-xs ${
                        actif ? "border-accent text-accent" : "border-filet text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-sm text-texte">{eq.label}</span>
                  </label>
                );
              })}
            </div>

            {equipments.length === 0 && (
              <p className="mt-4 text-sm text-texte-3">
                Rien de coché : tes séances seront 100 % au poids de corps. C&apos;est un choix
                parfaitement viable.
              </p>
            )}
          </section>
        )}

        {etape === 2 && (
          <section>
            <h2 className="text-xl font-semibold text-texte">Tes objectifs</h2>

            <fieldset className="mt-6">
              <legend className="text-sm text-texte-2">Groupes musculaires à travailler</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {MUSCLE_GROUPS.map((g) => {
                  const actif = muscleGroups.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                        actif
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-filet text-texte-2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={actif}
                        onChange={() => setMuscleGroups((l) => bascule(l, g.id))}
                      />
                      {g.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm text-texte-2">Objectif global</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((o) => (
                  <label
                    key={o}
                    className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                      goal === o ? "border-accent bg-accent/10 text-accent" : "border-filet text-texte"
                    }`}
                  >
                    <input
                      type="radio"
                      name="objectif"
                      className="sr-only"
                      checked={goal === o}
                      onChange={() => setGoal(o)}
                    />
                    {GOAL_LABELS[o]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-6">
              <label htmlFor="jours" className="text-sm text-texte-2">
                Séances par semaine :{" "}
                <span className="font-medium text-texte">{daysPerWeek}</span>
              </label>
              <input
                id="jours"
                type="range"
                min={2}
                max={6}
                step={1}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--color-accent)]"
              />
              <p className="mt-2 text-xs text-texte-3">
                3 à 4 est le bon compromis pour débuter : assez pour progresser, assez peu pour
                tenir dans la durée.
              </p>
            </div>
          </section>
        )}

        {etape === 3 && (
          <section>
            <h2 className="text-xl font-semibold text-texte">On récapitule, {prenom}</h2>
            <dl className="mt-6 flex flex-col gap-3 text-sm">
              <Ligne terme="Taille" valeur={`${Math.round(taille)} cm`} />
              <Ligne terme="Poids de départ" valeur={`${poids} kg`} />
              <Ligne terme="Niveau" valeur={LEVEL_LABELS[level]} />
              <Ligne
                terme="Matériel"
                valeur={
                  equipments.length === 0
                    ? "Poids de corps uniquement"
                    : EQUIPMENTS.filter((e) => equipments.includes(e.id))
                        .map((e) => e.label)
                        .join(", ")
                }
              />
              <Ligne
                terme="Groupes"
                valeur={MUSCLE_GROUPS.filter((g) => muscleGroups.includes(g.id))
                  .map((g) => g.label)
                  .join(", ")}
              />
              <Ligne terme="Objectif" valeur={GOAL_LABELS[goal]} />
              <Ligne terme="Rythme" valeur={`${daysPerWeek} séances par semaine`} />
            </dl>
            <p className="mt-6 text-sm text-texte-2">
              Tout reste modifiable à tout moment dans les paramètres.
            </p>
          </section>
        )}

        {erreur && (
          <p role="alert" className="mt-4 text-sm text-negatif">
            {erreur}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setEtape((e) => e - 1)}
          disabled={etape === 0 || enCours}
          className="rounded-lg px-4 py-2.5 text-sm text-texte-2 transition hover:text-texte disabled:invisible"
        >
          Retour
        </button>

        {etape < ETAPES.length - 1 ? (
          <button
            type="button"
            onClick={() => setEtape((e) => e + 1)}
            disabled={!etapeValide}
            className="rounded-lg border border-accent/60 bg-accent/10 px-6 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuer
          </button>
        ) : (
          <button
            type="button"
            onClick={valider}
            disabled={enCours}
            className="rounded-lg border border-accent/60 bg-accent/10 px-6 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
          >
            {enCours ? "Création…" : "Commencer"}
          </button>
        )}
      </div>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-filet/60 pb-3">
      <dt className="shrink-0 text-texte-2">{terme}</dt>
      <dd className="text-right text-texte">{valeur}</dd>
    </div>
  );
}
