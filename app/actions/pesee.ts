"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/session";
import { jourUTC } from "@/lib/dates";
import { BAREME } from "@/lib/lp";
import { rankLabel } from "@/lib/ranks";

const schema = z.object({
  kg: z.number().min(30, "Poids invalide").max(300, "Poids invalide"),
});

export async function enregistrerPesee(kg: number) {
  const user = await requireOnboardedUser();

  const parse = schema.safeParse({ kg });
  if (!parse.success) return { erreur: parse.error.issues[0]?.message ?? "Poids invalide" };

  const aujourdhui = jourUTC();
  const deja = await prisma.weighIn.findUnique({
    where: { userId_date: { userId: user.id, date: aujourdhui } },
  });

  // Les LP ne sont accordés qu'à la première pesée du jour : corriger sa
  // valeur ensuite ne doit pas rapporter deux fois.
  const lpGagnes = deja ? 0 : BAREME.pesee;
  const lpTotal = user.lp + lpGagnes;

  await prisma.$transaction([
    prisma.weighIn.upsert({
      where: { userId_date: { userId: user.id, date: aujourdhui } },
      update: { kg: parse.data.kg },
      create: { userId: user.id, date: aujourdhui, kg: parse.data.kg },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lp: lpTotal } }),
  ]);

  revalidatePath("/dashboard");

  return {
    lpGagnes,
    promoted: lpGagnes > 0 && rankLabel(user.lp) !== rankLabel(lpTotal),
    newRank: rankLabel(lpTotal),
  };
}
