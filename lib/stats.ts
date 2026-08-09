import "server-only";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { debutSemaineUTC } from "@/lib/semaine";
import { MUSCLE_GROUPS } from "@/lib/referentiel";

/**
 * Agrégats des cinq graphiques (spec §8), calculés côté serveur.
 *
 * Tout est renvoyé en tableaux prêts à tracer : les composants Recharts sont
 * des composants client, autant leur épargner le moindre calcul et surtout
 * ne pas leur envoyer l'historique brut.
 */

export interface PointPoids {
  date: string;
  kg: number;
  /** Moyenne glissante sur 7 jours — lisse le bruit quotidien. */
  tendance: number | null;
}

export interface PointSemaine {
  semaine: string;
  delta: number | null;
  prevues: number;
  faites: number;
  assiduite: number | null;
  volume: Record<string, number>;
  volumeTotal: number;
}

export interface PointLp {
  date: string;
  lp: number;
}

export interface Stats {
  poids: PointPoids[];
  semaines: PointSemaine[];
  lp: PointLp[];
  groupesUtilises: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function chargerStats(userId: string): Promise<Stats> {
  const [pesees, seances, plan] = await Promise.all([
    prisma.weighIn.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.workoutLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.planDay.findMany({
      where: { userId, muscleGroup: { not: "repos" }, date: { lte: jourUTC() } },
    }),
  ]);

  // --- Courbe de poids + tendance 7 jours glissants ---
  const poids: PointPoids[] = pesees.map((p, i) => {
    const debutFenetre = new Date(p.date.getTime() - 6 * 86_400_000);
    const fenetre = pesees.slice(0, i + 1).filter((q) => q.date >= debutFenetre);
    return {
      date: iso(p.date),
      kg: p.kg,
      // Une moyenne sur un seul point ne lisse rien : on l'affiche à partir
      // de trois pesées, sinon la « tendance » suit exactement la courbe.
      tendance:
        fenetre.length >= 3
          ? Math.round((fenetre.reduce((s, q) => s + q.kg, 0) / fenetre.length) * 100) / 100
          : null,
    };
  });

  // --- Agrégats hebdomadaires ---
  const semaines = new Map<number, PointSemaine>();
  const toucher = (d: Date): PointSemaine => {
    const cle = debutSemaineUTC(d).getTime();
    if (!semaines.has(cle)) {
      semaines.set(cle, {
        semaine: iso(new Date(cle)),
        delta: null,
        prevues: 0,
        faites: 0,
        assiduite: null,
        volume: {},
        volumeTotal: 0,
      });
    }
    return semaines.get(cle)!;
  };

  for (const p of plan) {
    const s = toucher(p.date);
    s.prevues += 1;
    if (p.status === "FAIT") s.faites += 1;
  }

  for (const w of seances) {
    const s = toucher(w.date);
    const exercices = w.exercises as unknown as { sets: number; done: boolean }[];
    const series = exercices.filter((e) => e.done).reduce((total, e) => total + e.sets, 0);
    s.volume[w.muscleGroup] = (s.volume[w.muscleGroup] ?? 0) + series;
    s.volumeTotal += series;
  }

  // Delta de poids : dernière pesée de la semaine moins celle de la précédente.
  const dernierePeseeParSemaine = new Map<number, number>();
  for (const p of pesees) dernierePeseeParSemaine.set(debutSemaineUTC(p.date).getTime(), p.kg);
  for (const p of pesees) toucher(p.date);

  const cles = [...semaines.keys()].sort((a, b) => a - b);
  let precedent: number | null = null;
  for (const cle of cles) {
    const kg = dernierePeseeParSemaine.get(cle);
    const s = semaines.get(cle)!;
    if (kg !== undefined) {
      s.delta = precedent === null ? null : Math.round((kg - precedent) * 100) / 100;
      precedent = kg;
    }
    s.assiduite = s.prevues > 0 ? Math.round((s.faites / s.prevues) * 100) : null;
  }

  // --- LP cumulés ---
  let cumul = 0;
  const lp: PointLp[] = [];
  for (const w of seances) {
    cumul += w.lpEarned;
    lp.push({ date: iso(w.date), lp: cumul });
  }

  return {
    poids,
    semaines: cles.map((c) => semaines.get(c)!),
    lp,
    groupesUtilises: MUSCLE_GROUPS.map((g) => g.id).filter((id) =>
      [...semaines.values()].some((s) => s.volume[id] > 0),
    ),
  };
}
