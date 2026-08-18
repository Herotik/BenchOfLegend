import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { chargerStats } from "@/lib/stats";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

/**
 * Assiduité hebdomadaire, telle que le graphe des progrès la trace.
 *
 * Le calcul jugeait la semaine sur les jours écoulés **aujourd'hui compris** :
 * un lundi matin affichait donc 0 %, la séance du jour comptant pour ratée
 * avant qu'on ait pu la faire.
 */

/** Jeudi 13 août 2026, midi. Lundi de la semaine : le 10. */
const JEUDI = new Date(2026, 7, 13, 12, 0, 0);
const LUNDI = new Date(Date.UTC(2026, 7, 10));
const jourDe = (decalage: number) => new Date(LUNDI.getTime() + decalage * 86_400_000);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(JEUDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

/** Semaine en cours, celle que le graphe montre en dernier. */
async function semaineCourante(userId: string) {
  const { semaines } = await chargerStats(userId);
  return semaines.find((s) => s.semaine === "2026-08-10");
}

describe("assiduité de la semaine en cours", () => {
  it("part de 100 % quand rien n'est encore jugé", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await prisma.planDay.deleteMany({ where: { userId: user.id } });
    await prisma.planDay.createMany({
      data: [
        // Aujourd'hui et les jours suivants : rien n'est encore manqué.
        { userId: user.id, date: jourDe(3), muscleGroup: "dos", status: "PREVU" },
        { userId: user.id, date: jourDe(5), muscleGroup: "bras", status: "PREVU" },
      ],
    });

    expect(await semaineCourante(user.id)).toMatchObject({
      prevues: 2,
      faites: 0,
      assiduite: 100,
    });
  });

  it("compte les séances à venir parmi les prévues", async () => {
    // La tuile annonce « 1/3 séances cette semaine » : ce qu'il reste à faire
    // fait partie du programme, même si cela ne pèse pas encore.
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await prisma.planDay.deleteMany({ where: { userId: user.id } });
    await prisma.planDay.createMany({
      data: [
        { userId: user.id, date: jourDe(0), muscleGroup: "dos", status: "FAIT" },
        { userId: user.id, date: jourDe(3), muscleGroup: "bras", status: "PREVU" },
        { userId: user.id, date: jourDe(5), muscleGroup: "jambes", status: "PREVU" },
      ],
    });

    expect(await semaineCourante(user.id)).toMatchObject({
      prevues: 3,
      faites: 1,
      assiduite: 100,
    });
  });

  it("descend dès qu'une journée écoulée est restée vide", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await prisma.planDay.deleteMany({ where: { userId: user.id } });
    await prisma.planDay.createMany({
      data: [
        { userId: user.id, date: jourDe(0), muscleGroup: "dos", status: "FAIT" },
        { userId: user.id, date: jourDe(1), muscleGroup: "bras", status: "MANQUE" },
        { userId: user.id, date: jourDe(3), muscleGroup: "jambes", status: "PREVU" },
      ],
    });

    // Deux jours jugés, un tenu. Le jour même n'entre pas encore au compte.
    expect(await semaineCourante(user.id)).toMatchObject({ assiduite: 50 });
  });

  it("ne fait pas apparaître les semaines suivantes dans le graphe", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await prisma.planDay.deleteMany({ where: { userId: user.id } });
    await prisma.planDay.createMany({
      data: [
        { userId: user.id, date: jourDe(3), muscleGroup: "dos", status: "PREVU" },
        // Semaine prochaine : le plan la connaît, le graphe ne doit pas.
        { userId: user.id, date: jourDe(8), muscleGroup: "bras", status: "PREVU" },
      ],
    });

    const { semaines } = await chargerStats(user.id);
    expect(semaines.map((s) => s.semaine)).toEqual(["2026-08-10"]);
  });
});
