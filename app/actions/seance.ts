"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/session";
import {
  ajusterDifficultePour,
  validerSeancePour,
  type EntreeValidationSeance,
  type ResultatValidation,
} from "@/lib/seance";

/**
 * Enveloppes web de `lib/seance.ts`.
 *
 * La règle métier n'est plus ici : la route `/api/v1/seance/valider` appelle le
 * même module, et c'est le seul moyen que les deux ne divergent pas. Il ne
 * reste que ce qui est propre au web — la session par cookie et la
 * révalidation du cache.
 */

export type { ResultatValidation };

export async function validerSeance(
  entree: EntreeValidationSeance,
): Promise<ResultatValidation | { erreur: string }> {
  const user = await requireOnboardedUser();

  const resultat = await validerSeancePour(user.id, entree);
  // Le code et le statut HTTP portés par l'échec n'intéressent que l'API :
  // l'interface web n'a qu'un message à afficher.
  if ("erreur" in resultat) return { erreur: resultat.erreur };

  revalidatePath("/dashboard");
  return resultat;
}

/** Applique l'ajustement de difficulté proposé après une séance. */
export async function ajusterDifficulte(muscleGroup: string, delta: number) {
  const user = await requireOnboardedUser();

  const resultat = await ajusterDifficultePour(user.id, muscleGroup, delta);
  if ("erreur" in resultat) return { erreur: resultat.erreur };

  revalidatePath("/dashboard");
  return resultat;
}
