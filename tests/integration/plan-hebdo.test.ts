import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { assurerPlans, SEMAINES_A_LAVANCE } from "@/lib/plan-hebdo";
import { jourUTC } from "@/lib/dates";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

/**
 * Le calendrier est gelé : sans ça, les assertions sur « les jours passés »
 * n'auraient plus rien à mesurer les lundis, et la suite deviendrait
 * silencieusement vacante un jour sur sept.
 *
 * Mercredi 12 août 2026, midi. Lundi de la semaine : le 10.
 */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);
const LUNDI = new Date(Date.UTC(2026, 7, 10));
const MARDI = new Date(Date.UTC(2026, 7, 11));
const AUJOURDHUI = new Date(Date.UTC(2026, 7, 12));
const VENDREDI = new Date(Date.UTC(2026, 7, 14));
/** Dernier jour couvert : 6 semaines à partir du lundi, soit 41 jours plus tard. */
const DERNIER_JOUR = new Date(LUNDI.getTime() + 41 * 86_400_000);

beforeAll(() => {
  // On ne fausse que Date : truquer les minuteries casserait les entrées-sorties.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

const jours = async (userId: string) =>
  prisma.planDay.findMany({ where: { userId }, orderBy: { date: "asc" } });

const datesDistinctes = (lignes: { date: Date }[]) =>
  [...new Set(lignes.map((l) => l.date.getTime()))].sort((a, b) => a - b);

describe("assurerPlans", () => {
  it("couvre six semaines d'un coup, sans laisser de jour vide", async () => {
    // Une vue mensuelle doit être remplie quel que soit le jour de consultation.
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });

    await assurerPlans(user.id);

    const dates = datesDistinctes(await jours(user.id));
    expect(dates).toHaveLength((SEMAINES_A_LAVANCE + 1) * 7);
    expect(new Date(dates[0])).toEqual(LUNDI);
    expect(new Date(dates.at(-1)!)).toEqual(DERNIER_JOUR);
  });

  it("ne planifie rien avant l'inscription", async () => {
    // Le compte n'existait pas : ces jours-là n'ont pas à figurer au calendrier.
    const user = await creerUtilisateur({ createdAt: MERCREDI });

    await assurerPlans(user.id);

    const dates = datesDistinctes(await jours(user.id));
    expect(new Date(dates[0])).toEqual(AUJOURDHUI);
    expect(dates).toHaveLength((SEMAINES_A_LAVANCE + 1) * 7 - 2); // lundi et mardi exclus
  });

  it("bascule en MANQUE les séances passées jamais validées", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });

    await assurerPlans(user.id);

    const passes = (await jours(user.id)).filter((j) => j.date < AUJOURDHUI);
    expect(passes.length).toBeGreaterThan(0);
    expect(passes.some((j) => j.status === "MANQUE")).toBe(true);
    // Aucun jour passé ne reste « à faire ».
    expect(passes.filter((j) => j.status === "PREVU")).toEqual([]);
  });

  it("laisse les jours à venir en PREVU", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });

    await assurerPlans(user.id);

    const futurs = (await jours(user.id)).filter((j) => j.date >= AUJOURDHUI);
    expect(futurs.some((j) => j.status === "PREVU")).toBe(true);
    expect(futurs.some((j) => j.status === "MANQUE")).toBe(false);
  });

  it("ne déclare jamais manquée une séance antérieure à l'inscription", async () => {
    // Quelqu'un qui s'inscrit un mercredi ne doit pas hériter de deux séances
    // « ratées » qu'il n'avait aucun moyen de faire.
    const user = await creerUtilisateur({ createdAt: MARDI });

    // Ligne plantée à la main au lundi : c'est le seul moyen d'avoir un jour
    // passé antérieur à l'inscription, la génération n'en produisant pas.
    await prisma.planDay.create({
      data: { userId: user.id, date: LUNDI, muscleGroup: "pectoraux", status: "PREVU" },
    });

    await assurerPlans(user.id);

    const lundi = await prisma.planDay.findFirstOrThrow({
      where: { userId: user.id, date: LUNDI },
    });
    expect(lundi.status).toBe("PREVU");
  });

  it("marque comme manqué un jour postérieur à l'inscription", async () => {
    // Contrepartie du test précédent : la clémence s'arrête à l'inscription.
    const user = await creerUtilisateur({ createdAt: MARDI });

    await assurerPlans(user.id);

    const mardi = await prisma.planDay.findMany({ where: { userId: user.id, date: MARDI } });
    expect(mardi.length).toBeGreaterThan(0);
    expect(mardi.every((j) => j.status === "MANQUE" || j.status === "REPOS")).toBe(true);
  });

  it("ne duplique rien quand on l'appelle deux fois", async () => {
    // Appelée à chaque chargement du tableau de bord et du calendrier.
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });

    await assurerPlans(user.id);
    const apresPremier = await jours(user.id);

    await assurerPlans(user.id);
    const apresSecond = await jours(user.id);

    expect(apresSecond).toHaveLength(apresPremier.length);
    expect(apresSecond.map((j) => j.id)).toEqual(apresPremier.map((j) => j.id));
  });

  it("complète une semaine partiellement remplie sans écraser l'existant", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });

    const existant = await prisma.planDay.create({
      data: { userId: user.id, date: VENDREDI, muscleGroup: "cardio", status: "PREVU" },
    });

    await assurerPlans(user.id);

    const vendredi = await prisma.planDay.findMany({ where: { userId: user.id, date: VENDREDI } });
    expect(vendredi).toEqual([existant]);

    // Le reste de la semaine a bien été généré autour.
    const semaine = (await jours(user.id)).filter(
      (j) => j.date >= LUNDI && j.date < new Date(LUNDI.getTime() + 7 * 86_400_000),
    );
    expect(datesDistinctes(semaine)).toHaveLength(7);
  });

  it("ne génère aucun plan tant qu'aucun groupe musculaire n'est choisi", async () => {
    // Cas de l'utilisateur créé par OAuth mais pas encore passé par l'onboarding.
    const user = await creerUtilisateur({ muscleGroups: [], createdAt: new Date(2026, 0, 15) });

    await assurerPlans(user.id);

    expect(await jours(user.id)).toEqual([]);
  });

  it("rend la semaine en cours, du lundi au dimanche", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });

    const rendus = await assurerPlans(user.id);

    const dates = datesDistinctes(rendus);
    expect(dates).toHaveLength(7);
    expect(new Date(dates[0])).toEqual(LUNDI);
    expect(new Date(dates.at(-1)!)).toEqual(new Date(LUNDI.getTime() + 6 * 86_400_000));
  });

  it("cale les jours de plan à minuit UTC", async () => {
    // Toute l'app compare des dates : une heure qui traîne casserait la
    // contrainte d'unicité [userId, date, muscleGroup].
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });

    await assurerPlans(user.id);

    for (const jour of await jours(user.id)) {
      expect(jour.date).toEqual(jourUTC(jour.date));
    }
  });
});

describe("continuité entre les semaines engendrées", () => {
  /** Les six groupes, pour que le moteur ait de quoi choisir. */
  const TOUS = ["pectoraux", "dos", "epaules", "bras", "jambes", "abdos"].map((id) => ({ id }));

  const parJour = (lignes: { date: Date; muscleGroup: string }[]) => {
    const carte = new Map<number, string[]>();
    for (const l of lignes) {
      if (l.muscleGroup === "repos") continue;
      const cle = l.date.getTime();
      carte.set(cle, [...(carte.get(cle) ?? []), l.muscleGroup]);
    }
    return [...carte.entries()].sort((a, b) => a[0] - b[0]);
  };

  it("ne répète jamais un groupe deux jours de suite, six semaines durant", async () => {
    // Le moteur ne voyait qu'une semaine à la fois : dimanche et lundi
    // pouvaient porter le même groupe, à un jour d'écart.
    const user = await creerUtilisateur({
      createdAt: new Date(2026, 0, 15),
      muscleGroups: TOUS,
      daysPerWeek: 6,
    });
    await assurerPlans(user.id);

    const journees = parJour(await jours(user.id));
    for (let i = 1; i < journees.length; i++) {
      const [dateAvant, avant] = journees[i - 1]!;
      const [dateApres, apres] = journees[i]!;
      // Uniquement des jours calendaires vraiment consécutifs.
      if (dateApres - dateAvant !== 86_400_000) continue;

      for (const groupe of apres) {
        expect(
          avant.includes(groupe),
          `${groupe} le ${new Date(dateAvant).toISOString().slice(0, 10)} puis le lendemain`,
        ).toBe(false);
      }
    }
  });

  it("n'enchaîne pas deux séances consécutives sur le même groupe", async () => {
    // Samedi puis lundi : le dimanche de repos ne suffit pas à en faire deux
    // séances distinctes pour qui s'entraîne.
    const user = await creerUtilisateur({
      createdAt: new Date(2026, 0, 15),
      muscleGroups: TOUS,
      daysPerWeek: 3,
    });
    await assurerPlans(user.id);

    const journees = parJour(await jours(user.id));
    for (let i = 1; i < journees.length; i++) {
      const [, avant] = journees[i - 1]!;
      const [dateApres, apres] = journees[i]!;
      for (const groupe of apres) {
        expect(
          avant.includes(groupe),
          `${groupe} sur deux séances qui se suivent, avant le ${new Date(dateApres)
            .toISOString()
            .slice(0, 10)}`,
        ).toBe(false);
      }
    }
  });

  it("tient compte de ce qui est déjà en base, non de ce qu'il aurait engendré", async () => {
    // Une semaine passée écrite à la main : le lundi à venir doit la lire.
    const user = await creerUtilisateur({
      createdAt: new Date(2026, 0, 15),
      muscleGroups: TOUS,
      daysPerWeek: 3,
    });

    // Samedi de la semaine précédente — le 8 août 2026.
    const samedi = new Date(LUNDI.getTime() - 2 * 86_400_000);
    await prisma.planDay.create({
      data: { userId: user.id, date: samedi, muscleGroup: "bras", status: "FAIT" },
    });

    await assurerPlans(user.id);

    const lundi = await prisma.planDay.findMany({ where: { userId: user.id, date: LUNDI } });
    expect(lundi.map((l) => l.muscleGroup)).not.toContain("bras");
  });
});
