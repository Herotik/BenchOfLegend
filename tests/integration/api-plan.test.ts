import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getPlan } from "@/app/api/v1/plan/route";
import { GET as getSeance } from "@/app/api/v1/seance/route";
import { jourUTC } from "@/lib/dates";
import { creerUtilisateur, nettoyerBase, prisma, reponseJson, requeteApi } from "./aide";

/** Mercredi 12 août 2026 : la semaine ISO court du lundi 10 au dimanche 16. */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);
const LUNDI_ISO = "2026-08-10";
const MERCREDI_ISO = "2026-08-12";
const DIMANCHE_ISO = "2026-08-16";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

const plan = async (userId: string | undefined, requete = `debut=${LUNDI_ISO}&fin=${DIMANCHE_ISO}`) =>
  reponseJson(await getPlan(await requeteApi(`/api/v1/plan?${requete}`, { userId })));

interface JourPlanApi {
  id: string;
  date: string;
  groupe: string;
  statut: string;
  seanceId: string | null;
}

describe("GET /api/v1/plan", () => {
  it("refuse une requête sans jeton", async () => {
    const { statut, corps } = await plan(undefined);

    expect(statut).toBe(401);
    expect(corps.code).toBe("jeton_absent");
  });

  it("refuse un profil non onboardé", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    const { statut, corps } = await plan(user.id);

    expect(statut).toBe(409);
    expect(corps.code).toBe("onboarding_requis");
  });

  it("déclenche la génération et rend la semaine demandée", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    expect(await prisma.planDay.count({ where: { userId: user.id } })).toBe(0);

    const { statut, corps, cache } = await plan(user.id);

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    const jours = corps.jours as JourPlanApi[];
    expect(jours.length).toBeGreaterThan(0);
    expect(jours.map((j) => j.date)).toEqual([...jours.map((j) => j.date)].sort());
    expect(jours.every((j) => j.date >= LUNDI_ISO && j.date <= DIMANCHE_ISO)).toBe(true);
    // Format de date symétrique de celui des paramètres : AAAA-MM-JJ.
    expect(jours.every((j) => /^\d{4}-\d{2}-\d{2}$/.test(j.date))).toBe(true);
    expect(jours.some((j) => j.groupe !== "repos")).toBe(true);
  });

  it("ne remonte jamais un jour antérieur à l'inscription", async () => {
    // Créer son compte un mercredi ne doit pas faire apparaître trois séances
    // « ratées » qu'on n'avait aucun moyen de faire. `createdAt` est explicite :
    // le défaut vient de l'horloge de Postgres, que `vi.setSystemTime` ne gèle
    // pas.
    const user = await creerUtilisateur({ createdAt: MERCREDI });

    const { corps } = await plan(user.id);

    const jours = corps.jours as JourPlanApi[];
    expect(jours.every((j) => j.date >= MERCREDI_ISO)).toBe(true);
  });

  it("relie le jour validé à sa séance", async () => {
    const user = await creerUtilisateur();
    const seance = await prisma.workoutLog.create({
      data: { userId: user.id, date: jourUTC(), muscleGroup: "dos", lpEarned: 20, exercises: [] },
    });
    await prisma.planDay.create({
      data: {
        userId: user.id,
        date: jourUTC(),
        muscleGroup: "dos",
        status: "FAIT",
        workoutId: seance.id,
      },
    });

    const { corps } = await plan(user.id);

    const jours = corps.jours as JourPlanApi[];
    expect(jours).toContainEqual(
      expect.objectContaining({ date: MERCREDI_ISO, statut: "FAIT", seanceId: seance.id }),
    );
  });

  it("rejette une date mal formée", async () => {
    const user = await creerUtilisateur();

    const { statut, corps } = await plan(user.id, `debut=12/08/2026&fin=${DIMANCHE_ISO}`);

    expect(statut).toBe(400);
    expect(corps.error).toBe("Date attendue au format AAAA-MM-JJ");
  });

  it("rejette une date qui n'existe pas plutôt que de la décaler", async () => {
    // `new Date("2026-02-31")` rend le 3 mars sans broncher : la plage
    // demandée et celle servie ne seraient plus les mêmes.
    const user = await creerUtilisateur();

    const { statut, corps } = await plan(user.id, "debut=2026-02-31&fin=2026-03-05");

    expect(statut).toBe(400);
    expect(corps.error).toBe("Date inexistante");
  });

  it("exige les deux bornes", async () => {
    const user = await creerUtilisateur();

    expect((await plan(user.id, `debut=${LUNDI_ISO}`)).statut).toBe(400);
    expect((await plan(user.id, "")).statut).toBe(400);
  });

  it("refuse une plage inversée", async () => {
    const user = await creerUtilisateur();

    const { statut, corps } = await plan(user.id, `debut=${DIMANCHE_ISO}&fin=${LUNDI_ISO}`);

    expect(statut).toBe(422);
    expect(corps.code).toBe("plage_inversee");
  });

  it("refuse un ratissage sur plusieurs années", async () => {
    const user = await creerUtilisateur();

    const { statut, corps } = await plan(user.id, "debut=2020-01-01&fin=2030-01-01");

    expect(statut).toBe(422);
    expect(corps.code).toBe("plage_trop_large");
  });

  it("ne laisse pas fuir le plan d'un autre compte", async () => {
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    const jourDeB = await prisma.planDay.create({
      data: { userId: b.id, date: jourUTC(), muscleGroup: "bras", status: "PREVU" },
    });

    const { corps } = await plan(a.id);

    const jours = corps.jours as JourPlanApi[];
    expect(jours.some((j) => j.id === jourDeB.id)).toBe(false);
    const idsDeA = await prisma.planDay.findMany({
      where: { userId: a.id },
      select: { id: true },
    });
    expect(jours.every((j) => idsDeA.some((p) => p.id === j.id))).toBe(true);
  });
});

describe("GET /api/v1/seance", () => {
  const seance = async (userId: string | undefined, groupe = "pectoraux") =>
    reponseJson(await getSeance(await requeteApi(`/api/v1/seance?groupe=${groupe}`, { userId })));

  it("refuse une requête sans jeton", async () => {
    expect((await seance(undefined)).statut).toBe(401);
  });

  it("refuse un profil non onboardé", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    const { statut, corps } = await seance(user.id);

    expect(statut).toBe(409);
    expect(corps.code).toBe("onboarding_requis");
  });

  it("rend la séance du jour et le jour de plan à solder", async () => {
    const user = await creerUtilisateur({ muscleGroups: [{ id: "pectoraux" }, { id: "dos" }] });
    const planDay = await prisma.planDay.create({
      data: { userId: user.id, date: jourUTC(), muscleGroup: "pectoraux", status: "PREVU" },
    });

    const { statut, corps, cache } = await seance(user.id);

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    expect(corps.groupe).toBe("pectoraux");
    expect(corps.date).toBe(MERCREDI_ISO);
    expect(corps.planDayId).toBe(planDay.id);
    expect(corps.dejaValidee).toBe(false);
    const contenu = corps.seance as { exercices: { nom: string }[]; echauffement: string[] };
    expect(contenu.exercices.length).toBeGreaterThan(0);
    expect(contenu.echauffement.length).toBeGreaterThan(0);
  });

  it("rend la même séance à deux appels : la graine ne bouge pas dans la journée", async () => {
    const user = await creerUtilisateur();

    const premier = await seance(user.id);
    const second = await seance(user.id);

    expect(second.corps.seance).toEqual(premier.corps.seance);
  });

  it("accepte un groupe hors préférences, sans jour de plan : c'est une séance bonus", async () => {
    const user = await creerUtilisateur({ muscleGroups: [{ id: "dos" }] });

    const { statut, corps } = await seance(user.id, "abdos");

    expect(statut).toBe(200);
    expect(corps.planDayId).toBeNull();
    expect((corps.seance as { exercices: unknown[] }).exercices.length).toBeGreaterThan(0);
  });

  it("avertit quand le groupe a déjà été travaillé la veille", async () => {
    const user = await creerUtilisateur();
    await prisma.workoutLog.create({
      data: {
        userId: user.id,
        date: new Date(jourUTC().getTime() - 86_400_000),
        muscleGroup: "pectoraux",
        lpEarned: 20,
        exercises: [],
      },
    });

    const { corps } = await seance(user.id);

    expect(corps.avertissement).toContain("hier");
  });

  it("n'avertit pas quand le groupe est reposé", async () => {
    const user = await creerUtilisateur();

    const { corps } = await seance(user.id);

    expect(corps.avertissement).toBeNull();
  });

  it("rejette un groupe musculaire inconnu", async () => {
    const user = await creerUtilisateur();

    const { statut, corps } = await seance(user.id, "mollets");

    expect(statut).toBe(400);
    expect(corps.code).toBe("requete_invalide");
  });

  it("ne propose pas le jour de plan d'un autre utilisateur", async () => {
    const a = await creerUtilisateur({ muscleGroups: [{ id: "pectoraux" }] });
    const b = await creerUtilisateur({ muscleGroups: [{ id: "pectoraux" }] });
    const jourDeB = await prisma.planDay.create({
      data: { userId: b.id, date: jourUTC(), muscleGroup: "pectoraux", status: "PREVU" },
    });

    const { corps } = await seance(a.id);

    expect(corps.planDayId).not.toBe(jourDeB.id);
    const planDayA = await prisma.planDay.findUnique({ where: { id: corps.planDayId as string } });
    expect(planDayA?.userId).toBe(a.id);
  });

  it("rend les compteurs qui servent à l'aperçu des LP", async () => {
    // L'app ne recalcule rien : elle applique le barème publié par
    // /api/v1/referentiel à ces deux entrées, exactement comme le serveur.
    const user = await creerUtilisateur();
    await prisma.workoutLog.create({
      data: {
        userId: user.id,
        date: jourUTC(),
        muscleGroup: "dos",
        isBonus: true,
        lpEarned: 8,
        exercises: [],
      },
    });

    const { corps } = await seance(user.id);

    expect(corps.seancesSur7Jours).toBe(1);
    expect(corps.bonusDejaCompte).toBe(true);
  });
});
