import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { modifierPreferences, supprimerCompte } from "@/app/actions/preferences";
import { assurerPlans } from "@/lib/plan-hebdo";
import { jourUTC } from "@/lib/dates";
import type { Preferences } from "@/lib/preferences";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

/** Mercredi 12 août 2026 : deux jours de plan déjà passés dans la semaine. */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);
const AUJOURDHUI = new Date(Date.UTC(2026, 7, 12));

const nouvellesPreferences = (over: Partial<Preferences> = {}): Preferences => ({
  heightCm: 165,
  level: "AVANCE",
  equipments: ["kettlebell"],
  muscleGroups: ["abdos", "cardio"],
  pointsForts: ["cardio"],
  goal: "PERTE_DE_POIDS",
  daysPerWeek: 3,
  ...over,
});

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

describe("modifierPreferences", () => {
  it("remplace profil, matériel et groupes", async () => {
    const user = await creerUtilisateur({
      level: "DEBUTANT",
      equipments: ["halteres", "banc"],
      muscleGroups: [{ id: "pectoraux" }, { id: "dos" }],
    });

    expect(await modifierPreferences(nouvellesPreferences())).toEqual({ ok: true });

    const apres = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { equipments: true, muscleGroups: true },
    });
    expect(apres.heightCm).toBe(165);
    expect(apres.level).toBe("AVANCE");
    expect(apres.goal).toBe("PERTE_DE_POIDS");
    expect(apres.daysPerWeek).toBe(3);
    expect(apres.equipments.map((e) => e.equipmentId)).toEqual(["kettlebell"]);
    expect(apres.muscleGroups.map((g) => g.groupId).sort()).toEqual(["abdos", "cardio"]);
  });

  it("passe les points forts en priorité 2", async () => {
    await creerUtilisateur();

    await modifierPreferences(nouvellesPreferences());

    const groupes = await prisma.userMuscleGroup.findMany({ orderBy: { groupId: "asc" } });
    expect(groupes.map((g) => [g.groupId, g.priority])).toEqual([
      ["abdos", 1],
      ["cardio", 2],
    ]);
  });

  it("ignore un point fort qui n'est pas dans les groupes choisis", async () => {
    await creerUtilisateur();

    await modifierPreferences(
      nouvellesPreferences({ muscleGroups: ["abdos"], pointsForts: ["jambes"] }),
    );

    const groupes = await prisma.userMuscleGroup.findMany();
    expect(groupes.map((g) => [g.groupId, g.priority])).toEqual([["abdos", 1]]);
  });

  it("efface le plan à venir pour le régénérer aux nouvelles préférences", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await assurerPlans(user.id);

    await modifierPreferences(nouvellesPreferences());

    const restants = await prisma.planDay.findMany({ where: { userId: user.id } });
    expect(restants.every((j) => j.date < AUJOURDHUI)).toBe(true);
  });

  it("préserve les séances déjà validées, y compris celle du jour", async () => {
    // Elles font partie de l'historique et ont rapporté des LP.
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await assurerPlans(user.id);

    const duJour = await prisma.planDay.findFirstOrThrow({
      where: { userId: user.id, date: AUJOURDHUI, status: "PREVU" },
    });
    await prisma.planDay.update({ where: { id: duJour.id }, data: { status: "FAIT" } });

    await modifierPreferences(nouvellesPreferences());

    const apres = await prisma.planDay.findUnique({ where: { id: duJour.id } });
    expect(apres?.status).toBe("FAIT");
  });

  it("ne touche à rien avant aujourd'hui", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await assurerPlans(user.id);
    const passeAvant = await prisma.planDay.findMany({
      where: { userId: user.id, date: { lt: AUJOURDHUI } },
      orderBy: { id: "asc" },
    });
    expect(passeAvant.length).toBeGreaterThan(0);

    await modifierPreferences(nouvellesPreferences());

    const passeApres = await prisma.planDay.findMany({
      where: { userId: user.id, date: { lt: AUJOURDHUI } },
      orderBy: { id: "asc" },
    });
    expect(passeApres).toEqual(passeAvant);
  });

  /**
   * BUG CONNU — le calibrage de difficulté est perdu à chaque enregistrement
   * des réglages.
   *
   * `operationsPreferences` (lib/preferences.ts) efface puis recrée toutes les
   * lignes `UserMuscleGroup`, et `levelOffset` retombe donc à sa valeur par
   * défaut, 0. Or ce champ n'est pas une préférence : il est gagné séance après
   * séance par le ressenti déclaré, et c'est lui qui donne accès aux variantes
   * plus dures. Changer sa taille de 1 cm suffit à remettre à zéro la
   * progression de tous les groupes, sans le moindre avertissement.
   *
   * Correctif attendu : conserver le `levelOffset` des groupes reconduits
   * (upsert plutôt que delete + createMany).
   */
  it("conserve le calibrage de difficulté des groupes reconduits", async () => {
    await creerUtilisateur({
      muscleGroups: [
        { id: "pectoraux", levelOffset: 1 },
        { id: "dos", levelOffset: -1 },
      ],
    });

    await modifierPreferences(
      nouvellesPreferences({ muscleGroups: ["pectoraux", "dos"], pointsForts: [] }),
    );

    const groupes = await prisma.userMuscleGroup.findMany({ orderBy: { groupId: "asc" } });
    expect(groupes.map((g) => [g.groupId, g.levelOffset])).toEqual([
      ["dos", -1],
      ["pectoraux", 1],
    ]);
  });

  it("refuse des préférences invalides sans rien modifier", async () => {
    const user = await creerUtilisateur({ heightCm: 172, daysPerWeek: 4 });

    const resultat = await modifierPreferences(nouvellesPreferences({ daysPerWeek: 9 }));

    expect(resultat).toHaveProperty("erreur");
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.daysPerWeek).toBe(4);
    expect(apres.heightCm).toBe(172);
  });
});

describe("supprimerCompte", () => {
  /** Compte garni de tout ce que le RGPD oblige à emporter. */
  async function compteGarni() {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await prisma.session.create({
      data: { sessionToken: `jeton-${user.id}`, userId: user.id, expires: new Date(2027, 0, 1) },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: `google-${user.id}`,
      },
    });
    await prisma.weighIn.create({ data: { userId: user.id, date: jourUTC(), kg: 70 } });
    await prisma.workoutLog.create({
      data: { userId: user.id, date: jourUTC(), muscleGroup: "dos", lpEarned: 20, exercises: [] },
    });
    await assurerPlans(user.id);
    return user;
  }

  it("refuse de supprimer sans la confirmation exacte", async () => {
    const user = await compteGarni();

    expect(await supprimerCompte("supprimer")).toEqual({
      erreur: "Recopie SUPPRIMER en majuscules pour confirmer.",
    });
    expect(await supprimerCompte("")).toHaveProperty("erreur");

    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("emporte toutes les données rattachées au compte", async () => {
    const user = await compteGarni();

    await supprimerCompte("SUPPRIMER");

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.weighIn.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.workoutLog.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.planDay.count({ where: { userId: user.id } })).toBe(0);
  });

  it("laisse le catalogue d'exercices intact", async () => {
    // Le référentiel est partagé : supprimer un compte ne doit pas l'entamer.
    const avant = await prisma.exercise.count();
    await compteGarni();

    await supprimerCompte("SUPPRIMER");

    expect(await prisma.exercise.count()).toBe(avant);
    expect(await prisma.equipment.count()).toBeGreaterThan(0);
  });
});
