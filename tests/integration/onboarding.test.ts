import { afterEach, describe, expect, it } from "vitest";
import { terminerOnboarding, type DonneesOnboarding } from "@/app/actions/onboarding";
import { jourUTC } from "@/lib/dates";
import { attraperRedirection, creerUtilisateur, nettoyerBase, prisma } from "./aide";

/** Réponses valides du formulaire, que chaque test dévie à sa guise. */
const reponses = (over: Partial<DonneesOnboarding> = {}): DonneesOnboarding => ({
  heightCm: 178,
  level: "INTERMEDIAIRE",
  equipments: ["halteres", "banc"],
  muscleGroups: ["pectoraux", "dos", "jambes"],
  pointsForts: ["dos"],
  goal: "FORCE",
  daysPerWeek: 4,
  poidsKg: 74.5,
  ...over,
});

afterEach(nettoyerBase);

describe("terminerOnboarding", () => {
  it("enregistre le profil, le matériel et les groupes choisis", async () => {
    const user = await creerUtilisateur({
      onboarded: false,
      heightCm: null,
      muscleGroups: [],
      daysPerWeek: 3,
    });

    await attraperRedirection(() => terminerOnboarding(reponses()));

    const apres = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { equipments: true, muscleGroups: true },
    });

    expect(apres.heightCm).toBe(178);
    expect(apres.level).toBe("INTERMEDIAIRE");
    expect(apres.goal).toBe("FORCE");
    expect(apres.daysPerWeek).toBe(4);
    expect(apres.equipments.map((e) => e.equipmentId).sort()).toEqual(["banc", "halteres"]);
    expect(apres.muscleGroups.map((g) => g.groupId).sort()).toEqual(["dos", "jambes", "pectoraux"]);
  });

  it("marque les points forts en priorité 2 et les autres groupes en 1", async () => {
    await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    await attraperRedirection(() =>
      terminerOnboarding(reponses({ muscleGroups: ["pectoraux", "dos"], pointsForts: ["dos"] })),
    );

    const groupes = await prisma.userMuscleGroup.findMany({ orderBy: { groupId: "asc" } });
    expect(groupes.map((g) => [g.groupId, g.priority])).toEqual([
      ["dos", 2],
      ["pectoraux", 1],
    ]);
  });

  it("ouvre la courbe de poids avec la pesée de départ", async () => {
    const user = await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    await attraperRedirection(() => terminerOnboarding(reponses({ poidsKg: 81.2 })));

    const pesees = await prisma.weighIn.findMany({ where: { userId: user.id } });
    expect(pesees).toHaveLength(1);
    expect(pesees[0].kg).toBe(81.2);
    expect(pesees[0].date).toEqual(jourUTC());
  });

  it("débloque l'accès à l'application en passant onboarded à true", async () => {
    const user = await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    await attraperRedirection(() => terminerOnboarding(reponses()));

    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.onboarded).toBe(true);
  });

  it("envoie sur le tableau de bord une fois le profil complet", async () => {
    await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    const destination = await attraperRedirection(() => terminerOnboarding(reponses()));

    expect(destination).toBe("/dashboard");
  });

  it("refuse une taille hors bornes sans rien enregistrer", async () => {
    const user = await creerUtilisateur({ onboarded: false, heightCm: null, muscleGroups: [] });

    const resultat = await terminerOnboarding(reponses({ heightCm: 250 }));

    expect(resultat).toEqual({ erreur: "Taille invalide" });
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.onboarded).toBe(false);
    expect(apres.heightCm).toBeNull();
    expect(await prisma.userMuscleGroup.count()).toBe(0);
  });

  it("refuse un poids hors bornes sans rien enregistrer", async () => {
    const user = await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    const resultat = await terminerOnboarding(reponses({ poidsKg: 12 }));

    expect(resultat).toEqual({ erreur: "Poids invalide" });
    expect(await prisma.weighIn.count()).toBe(0);
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.onboarded).toBe(false);
  });

  it("exige au moins un groupe musculaire", async () => {
    await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    const resultat = await terminerOnboarding(reponses({ muscleGroups: [] }));

    expect(resultat).toEqual({ erreur: "Choisis au moins un groupe musculaire" });
  });

  it("accepte un profil sans aucun matériel", async () => {
    // Cas normal et non dégradé : l'app doit rester utilisable au poids de corps.
    const user = await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    await attraperRedirection(() => terminerOnboarding(reponses({ equipments: [] })));

    const apres = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { equipments: true },
    });
    expect(apres.onboarded).toBe(true);
    expect(apres.equipments).toEqual([]);
  });
});
