import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { validerSeance } from "@/app/actions/seance";
import { seanceDuJour } from "@/lib/plan-hebdo";
import { jourUTC } from "@/lib/dates";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

/** Mercredi 12 août 2026, midi : la graine de séance ne bouge plus. */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

/** Utilisateur équipé, dont la séance comporte donc des exercices chargés. */
async function utilisateurEquipe() {
  const user = await creerUtilisateur({
    level: "INTERMEDIAIRE",
    equipments: ["halteres", "banc"],
    muscleGroups: [{ id: "pectoraux" }],
  });
  const planDay = await prisma.planDay.create({
    data: { userId: user.id, date: jourUTC(), muscleGroup: "pectoraux", status: "PREVU" },
  });
  const seance = await seanceDuJour(user.id, "pectoraux");
  return { user, planDay, seance };
}

const tousFaits = (n: number) => Array.from({ length: n }, () => "fait" as const);

describe("charges", () => {
  it("réclame une charge sur les exercices avec haltères, pas au poids de corps", async () => {
    const { seance } = await utilisateurEquipe();

    const avecCharge = seance.exercices.filter((e) => e.chargeRequise);
    const sansCharge = seance.exercices.filter((e) => !e.chargeRequise);

    expect(avecCharge.length).toBeGreaterThan(0);
    // Le poids de corps n'a pas de charge à noter : c'est la variante qui
    // fait office de charge.
    for (const e of sansCharge) {
      expect(e.derniereCharge ?? null).toBeNull();
    }
  });

  it("retient la charge et la repropose à la séance suivante", async () => {
    const { user, planDay, seance } = await utilisateurEquipe();
    const index = seance.exercices.findIndex((e) => e.chargeRequise);
    const charges = seance.exercices.map((e, i) => (i === index ? 32.5 : e.chargeRequise ? 20 : null));

    await validerSeance({
      planDayId: planDay.id,
      muscleGroup: "pectoraux",
      isBonus: false,
      statuts: tousFaits(seance.exercices.length),
      charges,
      ressenti: "juste",
    });

    const suivante = await seanceDuJour(user.id, "pectoraux");
    const memeExercice = suivante.exercices.find((e) => e.nom === seance.exercices[index].nom);
    expect(memeExercice?.derniereCharge).toBe(32.5);
  });

  it("consigne la charge dans le journal de la séance", async () => {
    const { user, planDay, seance } = await utilisateurEquipe();
    const index = seance.exercices.findIndex((e) => e.chargeRequise);

    await validerSeance({
      planDayId: planDay.id,
      muscleGroup: "pectoraux",
      isBonus: false,
      statuts: tousFaits(seance.exercices.length),
      charges: seance.exercices.map((e, i) => (i === index ? 40 : e.chargeRequise ? 15 : null)),
      ressenti: "juste",
    });

    const log = await prisma.workoutLog.findFirstOrThrow({ where: { userId: user.id } });
    const exercices = log.exercises as unknown as { name: string; poidsKg: number | null }[];
    expect(exercices[index].poidsKg).toBe(40);
  });

  it("ignore une charge envoyée sur un exercice au poids de corps", async () => {
    // Un client bricolé ne doit pas faire apparaître 200 kg sur des pompes.
    const { user, planDay, seance } = await utilisateurEquipe();
    const index = seance.exercices.findIndex((e) => !e.chargeRequise);
    expect(index).toBeGreaterThanOrEqual(0);

    await validerSeance({
      planDayId: planDay.id,
      muscleGroup: "pectoraux",
      isBonus: false,
      statuts: tousFaits(seance.exercices.length),
      charges: seance.exercices.map((_, i) => (i === index ? 200 : null)),
      ressenti: "juste",
    });

    const log = await prisma.workoutLog.findFirstOrThrow({ where: { userId: user.id } });
    const exercices = log.exercises as unknown as { poidsKg: number | null }[];
    expect(exercices[index].poidsKg).toBeNull();
    expect(await prisma.exerciseLoad.count({ where: { userId: user.id } })).toBe(0);
  });

  it("ne retient pas la charge d'une série non terminée", async () => {
    // Un poids sur lequel on a calé n'est pas un poids de travail : le
    // reproposer la fois suivante enfermerait dans l'échec.
    const { user, planDay, seance } = await utilisateurEquipe();
    const index = seance.exercices.findIndex((e) => e.chargeRequise);

    await validerSeance({
      planDayId: planDay.id,
      muscleGroup: "pectoraux",
      isBonus: false,
      statuts: seance.exercices.map((_, i) => (i === index ? "partiel" : "fait")),
      charges: seance.exercices.map((e, i) => (i === index ? 60 : e.chargeRequise ? 20 : null)),
      ressenti: "difficile",
    });

    const retenue = await prisma.exerciseLoad.findUnique({
      where: {
        userId_exerciseName: { userId: user.id, exerciseName: seance.exercices[index].nom },
      },
    });
    expect(retenue).toBeNull();
  });

  it("refuse une charge aberrante", async () => {
    const { planDay, seance } = await utilisateurEquipe();
    const r = await validerSeance({
      planDayId: planDay.id,
      muscleGroup: "pectoraux",
      isBonus: false,
      statuts: tousFaits(seance.exercices.length),
      charges: seance.exercices.map(() => 900),
      ressenti: "juste",
    });
    expect(r).toHaveProperty("erreur");
  });

  it("disparaît avec le compte", async () => {
    const { user, planDay, seance } = await utilisateurEquipe();
    await validerSeance({
      planDayId: planDay.id,
      muscleGroup: "pectoraux",
      isBonus: false,
      statuts: tousFaits(seance.exercices.length),
      charges: seance.exercices.map((e) => (e.chargeRequise ? 25 : null)),
      ressenti: "juste",
    });
    expect(await prisma.exerciseLoad.count({ where: { userId: user.id } })).toBeGreaterThan(0);

    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.exerciseLoad.count({ where: { userId: user.id } })).toBe(0);
  });
});
