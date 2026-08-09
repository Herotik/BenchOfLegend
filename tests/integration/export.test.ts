import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/export/route";
import { jourUTC } from "@/lib/dates";
import { connecter } from "./session-courante";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

/** Midi le 12 août 2026 : le nom du fichier ne dépend plus du fuseau. */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

/** Compte avec un peu de tout, pour vérifier que rien n'est oublié. */
async function compteAvecHistorique() {
  const user = await creerUtilisateur({
    lp: 240,
    heightCm: 181,
    level: "INTERMEDIAIRE",
    goal: "FORCE",
    daysPerWeek: 5,
    equipments: ["halteres", "banc"],
    muscleGroups: [{ id: "pectoraux", priority: 2 }, { id: "dos" }],
  });
  await prisma.weighIn.create({ data: { userId: user.id, date: jourUTC(), kg: 79.3 } });
  await prisma.workoutLog.create({
    data: {
      userId: user.id,
      date: jourUTC(),
      muscleGroup: "pectoraux",
      isBonus: true,
      lpEarned: 8,
      durationMin: 35,
      feeling: 3,
      exercises: [{ name: "Pompes classiques", sets: 4, reps: 10, statut: "fait" }],
    },
  });
  await prisma.planDay.create({
    data: { userId: user.id, date: jourUTC(), muscleGroup: "dos", status: "FAIT" },
  });
  return user;
}

describe("GET /api/export", () => {
  it("répond 401 à qui n'est pas connecté", async () => {
    await compteAvecHistorique();
    connecter(null);

    const reponse = await GET();

    expect(reponse.status).toBe(401);
    expect(await reponse.json()).toEqual({ error: "Authentification requise" });
  });

  it("sert le fichier en téléchargement, daté du jour", async () => {
    await compteAvecHistorique();

    const reponse = await GET();

    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("content-disposition")).toBe(
      'attachment; filename="la-faille-2026-08-12.json"',
    );
    expect(reponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    // Données personnelles : rien ne doit rester dans un cache intermédiaire.
    expect(reponse.headers.get("cache-control")).toBe("no-store");
  });

  it("exporte le profil, le matériel et les groupes avec leur priorité", async () => {
    const user = await compteAvecHistorique();

    const donnees = await (await GET()).json();

    expect(donnees.profil).toMatchObject({
      email: user.email,
      taille: 181,
      niveau: "INTERMEDIAIRE",
      objectif: "FORCE",
      seancesParSemaine: 5,
      lp: 240,
    });
    expect(donnees.materiel.sort()).toEqual(["banc", "halteres"]);
    expect(donnees.groupesMusculaires).toContainEqual({ groupe: "pectoraux", priorite: 2 });
    expect(donnees.groupesMusculaires).toContainEqual({ groupe: "dos", priorite: 1 });
  });

  it("exporte pesées, séances et plan", async () => {
    await compteAvecHistorique();

    const donnees = await (await GET()).json();

    expect(donnees.pesees).toEqual([{ date: jourUTC().toISOString(), kg: 79.3 }]);
    expect(donnees.seances).toHaveLength(1);
    expect(donnees.seances[0]).toMatchObject({
      groupe: "pectoraux",
      bonus: true,
      lpGagnes: 8,
      dureeMin: 35,
      ressenti: 3,
    });
    expect(donnees.seances[0].exercices).toEqual([
      { name: "Pompes classiques", sets: 4, reps: 10, statut: "fait" },
    ]);
    expect(donnees.plan).toEqual([
      { date: jourUTC().toISOString(), groupe: "dos", statut: "FAIT" },
    ]);
  });

  it("ne laisse fuiter les données d'aucun autre compte", async () => {
    const voisin = await creerUtilisateur({ lp: 999 });
    await prisma.weighIn.create({ data: { userId: voisin.id, date: jourUTC(), kg: 111 } });
    const user = await compteAvecHistorique();

    const donnees = await (await GET()).json();

    expect(donnees.profil.email).toBe(user.email);
    expect(donnees.profil.lp).toBe(240);
    expect(donnees.pesees.map((p: { kg: number }) => p.kg)).toEqual([79.3]);
  });
});
