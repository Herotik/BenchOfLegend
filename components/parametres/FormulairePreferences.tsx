"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EQUIPMENTS,
  GOAL_LABELS,
  LEVEL_HINTS,
  LEVEL_LABELS,
  MUSCLE_GROUPS,
  type Goal,
  type Level,
} from "@/lib/referentiel";
import { modifierPreferences } from "@/app/actions/preferences";

export interface PreferencesInitiales {
  heightCm: number | null;
  level: Level;
  goal: Goal;
  daysPerWeek: number;
  equipments: string[];
  muscleGroups: string[];
  pointsForts: string[];
}

function bascule(liste: string[], valeur: string): string[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
}

export function FormulairePreferences({ initial }: { initial: PreferencesInitiales }) {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  const [heightCm, setHeightCm] = useState(initial.heightCm ? String(initial.heightCm) : "");
  const [level, setLevel] = useState<Level>(initial.level);
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [daysPerWeek, setDaysPerWeek] = useState(initial.daysPerWeek);
  const [equipments, setEquipments] = useState<string[]>(initial.equipments);
  const [muscleGroups, setMuscleGroups] = useState<string[]>(initial.muscleGroups);
  const [pointsForts, setPointsForts] = useState<string[]>(initial.pointsForts);

  function enregistrer() {
    setMessage(null);
    startTransition(async () => {
      const r = await modifierPreferences({
        heightCm: Math.round(Number(heightCm)),
        level,
        goal,
        daysPerWeek,
        equipments,
        muscleGroups,
        // Un point fort sur un groupe décoché n'a plus de sens.
        pointsForts: pointsForts.filter((g) => muscleGroups.includes(g)),
      });

      if ("erreur" in r) {
        setMessage({ type: "erreur", texte: r.erreur ?? "Enregistrement impossible" });
        return;
      }
      setMessage({
        type: "ok",
        texte: "Préférences enregistrées. Ton plan à venir a été régénéré ; les séances déjà validées sont conservées.",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="surface p-5">
        <h2 className="text-base font-semibold text-ivoire">Profil</h2>

        <label className="mt-4 block max-w-40">
          <span className="text-sm text-brume">Taille (cm)</span>
          <input
            type="number"
            inputMode="numeric"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-nuit-600 bg-nuit-900 px-3 py-2.5 text-ivoire"
          />
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm text-brume">Niveau</legend>
          <div className="mt-2 flex flex-col gap-2">
            {(Object.keys(LEVEL_LABELS) as Level[]).map((n) => (
              <label
                key={n}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  level === n ? "border-or-600 bg-or-500/10" : "border-nuit-600"
                }`}
              >
                <input
                  type="radio"
                  name="niveau"
                  className="sr-only"
                  checked={level === n}
                  onChange={() => setLevel(n)}
                />
                <span className="block text-sm font-medium text-ivoire">{LEVEL_LABELS[n]}</span>
                <span className="mt-0.5 block text-xs text-cendre">{LEVEL_HINTS[n]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="surface p-5">
        <h2 className="text-base font-semibold text-ivoire">Matériel</h2>
        <p className="mt-1 text-xs text-cendre">
          Rien de coché : séances 100 % au poids de corps.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {EQUIPMENTS.map((eq) => {
            const actif = equipments.includes(eq.id);
            return (
              <label
                key={eq.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                  actif ? "border-or-600 bg-or-500/10" : "border-nuit-600"
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
                    actif ? "border-or-500 text-or-400" : "border-nuit-600 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="text-sm text-ivoire">{eq.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-base font-semibold text-ivoire">Objectifs</h2>

        <fieldset className="mt-4">
          <legend className="text-sm text-brume">Groupes musculaires</legend>
          <p className="mt-1 text-xs text-cendre">
            Touche une deuxième fois un groupe sélectionné pour en faire un point fort : il passera
            devant les autres les semaines où il y a plus de groupes que de créneaux.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((g) => {
              const actif = muscleGroups.includes(g.id);
              const fort = pointsForts.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => {
                    if (!actif) return setMuscleGroups((l) => bascule(l, g.id));
                    if (!fort) return setPointsForts((l) => [...l, g.id]);
                    setPointsForts((l) => l.filter((v) => v !== g.id));
                    setMuscleGroups((l) => l.filter((v) => v !== g.id));
                  }}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    fort
                      ? "border-or-500 bg-or-500/20 text-or-400"
                      : actif
                        ? "border-or-600 bg-or-500/10 text-or-400"
                        : "border-nuit-600 text-brume"
                  }`}
                >
                  {g.label}
                  {fort && <span className="ml-1.5 text-xs">★</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm text-brume">Objectif global</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(Object.keys(GOAL_LABELS) as Goal[]).map((o) => (
              <label
                key={o}
                className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                  goal === o
                    ? "border-or-600 bg-or-500/10 text-or-400"
                    : "border-nuit-600 text-ivoire"
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

        <div className="mt-5">
          <label htmlFor="jours" className="text-sm text-brume">
            Séances par semaine : <span className="font-medium text-ivoire">{daysPerWeek}</span>
          </label>
          <input
            id="jours"
            type="range"
            min={2}
            max={6}
            step={1}
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--color-or-500)]"
          />
        </div>
      </section>

      {message && (
        <p
          role="status"
          className={`text-sm ${message.type === "ok" ? "text-succes" : "text-manque"}`}
        >
          {message.texte}
        </p>
      )}

      <button
        type="button"
        onClick={enregistrer}
        disabled={enCours || muscleGroups.length === 0}
        className="rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 font-medium text-or-400 transition hover:bg-or-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
