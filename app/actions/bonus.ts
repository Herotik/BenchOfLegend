"use server";

import { requireOnboardedUser } from "@/lib/session";
import { avertissementRecuperationPour } from "@/lib/recuperation";

/** Enveloppe web de `lib/recuperation.ts` — `GET /api/v1/seance` rend le même avertissement. */
export async function avertissementRecuperation(muscleGroup: string): Promise<string | null> {
  const user = await requireOnboardedUser();
  return avertissementRecuperationPour(user.id, muscleGroup);
}
