"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Stats } from "@/lib/stats";
import { RANKS } from "@/lib/ranks";
import { muscleGroupLabel } from "@/lib/referentiel";

const GRILLE = "var(--color-nuit-700)";
const AXE = { stroke: "var(--color-cendre)", fontSize: 11 };

// Une teinte par groupe musculaire, stable d'un graphique à l'autre.
const COULEURS_GROUPES: Record<string, string> = {
  pectoraux: "#C1793C",
  dos: "#4E90C4",
  epaules: "#6FA39C",
  bras: "#8A62B8",
  jambes: "#C99247",
  abdos: "#C6CBD1",
  cardio: "#4FE0D4",
};

const PERIODES = [
  { cle: 30, label: "30 jours" },
  { cle: 90, label: "90 jours" },
  { cle: 0, label: "Tout" },
] as const;

export function Graphiques({ stats }: { stats: Stats }) {
  const [periode, setPeriode] = useState<number>(90);

  const poids =
    periode === 0
      ? stats.poids
      : stats.poids.filter(
          (p) => new Date(p.date).getTime() >= Date.now() - periode * 86_400_000,
        );

  const lpMax = stats.lp.at(-1)?.lp ?? 0;
  const seuils = RANKS.filter((r) => r.minLp > 0 && r.minLp <= lpMax * 1.3 + 100);

  return (
    <div className="flex flex-col gap-6">
      <Carte
        titre="Poids"
        vide={poids.length < 2}
        message="Il faut au moins deux pesées pour tracer une courbe. Le check-in quotidien s'en charge."
        action={
          <div className="flex gap-1">
            {PERIODES.map((p) => (
              <button
                key={p.cle}
                type="button"
                onClick={() => setPeriode(p.cle)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  periode === p.cle ? "bg-or-500/15 text-or-400" : "text-cendre hover:text-brume"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={poids} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={jourMois} {...AXE} tickLine={false} />
            <YAxis domain={["dataMin - 1", "dataMax + 1"]} {...AXE} tickLine={false} width={44} />
            <Tooltip content={<Infobulle unite=" kg" />} />
            <Line
              type="monotone"
              dataKey="kg"
              name="Poids"
              stroke="var(--color-or-500)"
              strokeWidth={2}
              dot={{ r: 2.5 }}
            />
            <Line
              type="monotone"
              dataKey="tendance"
              name="Tendance 7 j"
              stroke="var(--color-hextech-500)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </Carte>

      <Carte
        titre="Variation hebdomadaire"
        sousTitre="De combien ton poids bouge d'une semaine à l'autre."
        vide={stats.semaines.every((s) => s.delta === null)}
        message="Deux semaines de pesées sont nécessaires pour comparer."
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats.semaines} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="semaine" tickFormatter={jourMois} {...AXE} tickLine={false} />
            <YAxis {...AXE} tickLine={false} width={44} />
            <Tooltip content={<Infobulle unite=" kg" />} />
            <ReferenceLine y={0} stroke={GRILLE} />
            <Bar dataKey="delta" name="Variation" fill="var(--color-or-500)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Carte>

      <Carte
        titre="Volume d'entraînement"
        sousTitre="Séries de travail par semaine, empilées par groupe."
        vide={stats.groupesUtilises.length === 0}
        message="Valide une séance et ton volume apparaîtra ici."
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.semaines} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="semaine" tickFormatter={jourMois} {...AXE} tickLine={false} />
            <YAxis {...AXE} tickLine={false} width={44} />
            <Tooltip content={<Infobulle unite=" séries" />} />
            {stats.groupesUtilises.map((g) => (
              <Bar
                key={g}
                dataKey={`volume.${g}`}
                name={muscleGroupLabel(g)}
                stackId="volume"
                fill={COULEURS_GROUPES[g] ?? "var(--color-brume)"}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {stats.groupesUtilises.map((g) => (
            <li key={g} className="flex items-center gap-1.5 text-xs text-brume">
              <span
                aria-hidden
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: COULEURS_GROUPES[g] }}
              />
              {muscleGroupLabel(g)}
            </li>
          ))}
        </ul>
      </Carte>

      <Carte
        titre="Assiduité"
        sousTitre="Part des séances prévues que tu as validées."
        vide={stats.semaines.every((s) => s.assiduite === null)}
        message="Ta première semaine de programme alimentera cette barre."
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats.semaines} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="semaine" tickFormatter={jourMois} {...AXE} tickLine={false} />
            <YAxis domain={[0, 100]} {...AXE} tickLine={false} width={44} unit="%" />
            <Tooltip content={<Infobulle unite=" %" />} />
            <Bar
              dataKey="assiduite"
              name="Assiduité"
              fill="var(--color-succes)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Carte>

      <Carte
        titre="Progression des LP"
        sousTitre="Cumul dans le temps, avec les seuils de rang."
        vide={stats.lp.length === 0}
        message="Chaque séance validée fera monter cette courbe."
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={stats.lp} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="degradeLp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-or-500)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-or-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRILLE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={jourMois} {...AXE} tickLine={false} />
            <YAxis {...AXE} tickLine={false} width={44} />
            <Tooltip content={<Infobulle unite=" LP" />} />
            {seuils.map((r) => (
              <ReferenceLine
                key={r.slug}
                y={r.minLp}
                stroke={r.color}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{ value: r.name, position: "insideTopLeft", fill: r.color, fontSize: 10 }}
              />
            ))}
            <Area
              type="monotone"
              dataKey="lp"
              name="LP cumulés"
              stroke="var(--color-or-500)"
              strokeWidth={2}
              fill="url(#degradeLp)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Carte>
    </div>
  );
}

function Carte({
  titre,
  sousTitre,
  action,
  vide,
  message,
  children,
}: {
  titre: string;
  sousTitre?: string;
  action?: React.ReactNode;
  vide: boolean;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ivoire">{titre}</h2>
          {sousTitre && <p className="mt-0.5 text-xs text-cendre">{sousTitre}</p>}
        </div>
        {!vide && action}
      </header>

      <div className="mt-4">
        {vide ? <p className="py-8 text-center text-sm text-brume">{message}</p> : children}
      </div>
    </section>
  );
}

function jourMois(valeur: string): string {
  const d = new Date(valeur);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

interface EntreeInfobulle {
  name?: string;
  value?: number | string;
  color?: string;
}

function Infobulle({
  active,
  payload,
  label,
  unite,
}: {
  active?: boolean;
  payload?: EntreeInfobulle[];
  label?: string;
  unite: string;
}) {
  if (!active || !payload?.length) return null;

  const lignes = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (lignes.length === 0) return null;

  return (
    <div className="rounded-lg border border-nuit-600 bg-nuit-900/95 px-3 py-2 text-xs">
      <p className="text-cendre">{label ? jourMois(label) : ""}</p>
      {lignes.map((l, i) => (
        <p key={i} style={{ color: l.color }} className="mt-1">
          {l.name} : {l.value}
          {unite}
        </p>
      ))}
    </div>
  );
}
