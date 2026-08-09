import "server-only";
import { prisma } from "@/lib/prisma";
import { RESSENTI_DEPUIS_VALEUR, type Ressenti } from "@/lib/difficulte";
import { echec, type EchecMetier } from "@/lib/erreurs";

/**
 * Historique paginé des séances validées.
 *
 * Pagination par curseur, pas par `skip` : l'historique s'allonge par le haut,
 * et un décalage numérique ferait réapparaître ou sauter une séance dès qu'une
 * nouvelle est validée entre deux pages. Le curseur est le dernier identifiant
 * reçu, et l'ordre porte sur `(date, id)` — deux séances du même jour, la
 * planifiée et la bonus, se départagent donc au lieu de s'écraser.
 */

export const LIMITE_DEFAUT = 20;
export const LIMITE_MAX = 100;

export interface SeancePassee {
  id: string;
  /** Jour de la séance, AAAA-MM-JJ. */
  date: string;
  groupe: string;
  bonus: boolean;
  lpGagnes: number;
  dureeMin: number | null;
  ressenti: Ressenti | null;
  /** Snapshot des exercices, tel qu'enregistré à la validation. */
  exercices: unknown;
}

export interface PageHistorique {
  seances: SeancePassee[];
  /** Curseur à repasser en `avant` pour la page suivante. `null` = fin. */
  suivant: string | null;
}

export async function chargerHistorique(
  userId: string,
  options: { limite?: number; avant?: string } = {},
): Promise<PageHistorique | EchecMetier> {
  const limite = Math.min(Math.max(options.limite ?? LIMITE_DEFAUT, 1), LIMITE_MAX);

  let borne: { id: string; date: Date } | null = null;
  if (options.avant) {
    // Le curseur est cherché **dans les séances de l'utilisateur** : celui d'un
    // autre compte est simplement introuvable, et ne révèle donc pas qu'il
    // existe. Aucune page ne peut être ouverte sur l'historique d'autrui.
    borne = await prisma.workoutLog.findFirst({
      where: { id: options.avant, userId },
      select: { id: true, date: true },
    });
    if (!borne) return echec("Curseur invalide", "curseur_invalide", 400);
  }

  const lignes = await prisma.workoutLog.findMany({
    where: {
      userId,
      ...(borne
        ? { OR: [{ date: { lt: borne.date } }, { date: borne.date, id: { lt: borne.id } }] }
        : {}),
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    // Une ligne de plus que demandé : c'est ce qui dit s'il reste une page,
    // sans avoir à compter tout l'historique.
    take: limite + 1,
  });

  const page = lignes.slice(0, limite);

  return {
    seances: page.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      groupe: s.muscleGroup,
      bonus: s.isBonus,
      lpGagnes: s.lpEarned,
      dureeMin: s.durationMin,
      // Le modèle stocke une échelle 1-5 ; l'app manipule les trois ressentis
      // qu'elle propose. La conversion vit dans `lib/difficulte.ts`.
      ressenti: RESSENTI_DEPUIS_VALEUR(s.feeling),
      exercices: s.exercises,
    })),
    suivant: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
  };
}
