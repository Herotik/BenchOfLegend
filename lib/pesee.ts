import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { BAREME } from "@/lib/lp";
import { rankLabel } from "@/lib/ranks";
import { echec, type EchecMetier } from "@/lib/erreurs";

/**
 * Pesée du jour, partagée par l'action web et la route `/api/v1/pesee`.
 *
 * Les bornes du poids vivent ici et nulle part ailleurs : l'onboarding les
 * réutilise (`lib/onboarding.ts`), au lieu de les redéclarer à l'identique et
 * de les laisser diverger au premier ajustement.
 */

export const champPoidsKg = z.number().min(30, "Poids invalide").max(300, "Poids invalide");

export const schemaPesee = z.object({ kg: champPoidsKg });

export interface ResultatPesee {
  /** Jour de la pesée, AAAA-MM-JJ. */
  date: string;
  kg: number;
  lpGagnes: number;
  promoted: boolean;
  newRank: string;
  lpTotal: number;
}

export async function enregistrerPeseePour(
  userId: string,
  kg: number,
): Promise<ResultatPesee | EchecMetier> {
  const parse = schemaPesee.safeParse({ kg });
  if (!parse.success) {
    return echec(parse.error.issues[0]?.message ?? "Poids invalide", "poids_invalide", 400);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { lp: true } });

  const aujourdhui = jourUTC();
  const deja = await prisma.weighIn.findUnique({
    where: { userId_date: { userId, date: aujourdhui } },
  });

  // Les Δ ne sont accordés qu'à la première pesée du jour : corriger sa
  // valeur ensuite ne doit pas rapporter deux fois.
  const lpGagnes = deja ? 0 : BAREME.pesee;


  const [, majUser] = await prisma.$transaction([
    prisma.weighIn.upsert({
      where: { userId_date: { userId, date: aujourdhui } },
      update: { kg: parse.data.kg },
      create: { userId, date: aujourdhui, kg: parse.data.kg },
    }),
    // `increment` : le total est calculé par la base, pas depuis une lecture
    // antérieure qu'une action concurrente pourrait avoir périmée.
    prisma.user.update({ where: { id: userId }, data: { lp: { increment: lpGagnes } } }),
  ]);

  const lpTotal = majUser.lp;

  return {
    date: aujourdhui.toISOString().slice(0, 10),
    kg: parse.data.kg,
    lpGagnes,
    promoted: lpGagnes > 0 && rankLabel(user.lp) !== rankLabel(lpTotal),
    newRank: rankLabel(lpTotal),
    lpTotal,
  };
}
