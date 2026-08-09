"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/session";
import { enregistrerPeseePour } from "@/lib/pesee";

/** Enveloppe web de `lib/pesee.ts` — la route `/api/v1/pesee` appelle le même module. */
export async function enregistrerPesee(kg: number) {
  const user = await requireOnboardedUser();

  const resultat = await enregistrerPeseePour(user.id, kg);
  if ("erreur" in resultat) return { erreur: resultat.erreur };

  revalidatePath("/dashboard");

  return {
    lpGagnes: resultat.lpGagnes,
    promoted: resultat.promoted,
    newRank: resultat.newRank,
  };
}
