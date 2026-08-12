import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as postValider } from "@/app/api/v1/seance/valider/route";
import { POST as postDifficulte } from "@/app/api/v1/difficulte/route";
import { seanceDuJour } from "@/lib/plan-hebdo";
import { jourUTC, midiLocal } from "@/lib/dates";
import { BAREME } from "@/lib/lp";
import { creerUtilisateur, nettoyerBase, prisma, reponseJson, requeteApi } from "./aide";

/** Mercredi 12 août 2026, midi : la graine de séance ne bouge plus. */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);
const GROUPE = "pectoraux";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

type Statut = "non_fait" | "partiel" | "fait";
const tousFaits = (n: number): Statut[] => Array.from({ length: n }, () => "fait");

/** Utilisateur onboardé avec une séance du jour prête à valider. */
async function utilisateurAvecSeanceDuJour(lp = 0) {
  const user = await creerUtilisateur({
    lp,
    muscleGroups: [{ id: GROUPE }, { id: "dos" }, { id: "jambes" }],
  });
  const planDay = await prisma.planDay.create({
    data: { userId: user.id, date: jourUTC(), muscleGroup: GROUPE, status: "PREVU" },
  });
  // La séance n'est pas persistée : la route la régénère à l'identique. Le
  // test s'en sert seulement pour connaître le décor.
  const seance = await seanceDuJour(user.id, GROUPE);
  return { user, planDay, seance };
}

const valider = async (userId: string | undefined, corps: Record<string, unknown>) =>
  reponseJson(await postValider(await requeteApi("/api/v1/seance/valider", { userId, corps })));

describe("POST /api/v1/seance/valider", () => {
  it("refuse une requête sans jeton", async () => {
    const { statut, corps } = await valider(undefined, {
      groupe: GROUPE,
      bonus: true,
      statuts: ["fait"],
      ressenti: "juste",
    });

    expect(statut).toBe(401);
    expect(corps.code).toBe("jeton_absent");
    expect(await prisma.workoutLog.count()).toBe(0);
  });

  it("refuse un profil non onboardé", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    const { statut, corps } = await valider(user.id, {
      groupe: GROUPE,
      bonus: true,
      statuts: ["fait"],
      ressenti: "juste",
    });

    expect(statut).toBe(409);
    expect(corps.code).toBe("onboarding_requis");
    expect(await prisma.workoutLog.count()).toBe(0);
  });

  it("crédite les LP d'une séance entièrement cochée", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const aUnFinisher = seance.exercices.some((e) => e.finisher);

    const { statut, corps, cache } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
    });

    expect(statut).toBe(201);
    expect(cache).toBe("no-store");
    expect(corps.lpGagnes).toBe(BAREME.seanceComplete + (aUnFinisher ? BAREME.finisher : 0));
    expect(corps.rang).toBe("Hoplite IV");
    expect(corps.promotion).toBe(false);
    expect(corps.details).toContainEqual({
      libelle: "Séance du jour validée",
      lp: BAREME.seanceComplete,
    });

    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(corps.lpGagnes);
    expect(corps.lpTotal).toBe(apres.lp);
    const jour = await prisma.planDay.findUniqueOrThrow({ where: { id: planDay.id } });
    expect(jour.status).toBe("FAIT");
  });

  it("ne lit jamais les LP annoncés par le client", async () => {
    // Le calcul reste serveur : la séance est régénérée à partir de la même
    // graine, et rien de ce que le client prétend gagner n'est retenu.
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();

    const { corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
      lpGagnes: 5000,
      lpTotal: 5000,
    });

    expect(corps.lpGagnes).toBeLessThanOrEqual(BAREME.seanceComplete + BAREME.finisher);
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(corps.lpGagnes);
  });

  it("ignore les statuts surnuméraires d'un client bricolé", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const n = seance.exercices.length;

    const { corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: [...Array.from({ length: n }, () => "non_fait"), ...tousFaits(50)],
      ressenti: "juste",
    });

    expect(corps.lpGagnes).toBe(0);
    const workout = await prisma.workoutLog.findFirstOrThrow({ where: { userId: user.id } });
    expect(workout.exercises).toHaveLength(n);
  });

  it("signale un conflit sur une séance déjà validée", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const corpsValide = {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
    };

    const premier = await valider(user.id, corpsValide);
    const second = await valider(user.id, corpsValide);

    expect(premier.statut).toBe(201);
    expect(second.statut).toBe(409);
    expect(second.corps.code).toBe("deja_validee");
    expect(await prisma.workoutLog.count()).toBe(1);
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(premier.corps.lpGagnes);
  });

  it("refuse une séance planifiée pour plus tard", async () => {
    const { user } = await utilisateurAvecSeanceDuJour();
    const dansTroisJours = await prisma.planDay.create({
      data: {
        userId: user.id,
        date: new Date(jourUTC().getTime() + 3 * 86_400_000),
        muscleGroup: GROUPE,
        status: "PREVU",
      },
    });

    const { statut, corps } = await valider(user.id, {
      planDayId: dansTroisJours.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(12),
      ressenti: "juste",
    });

    expect(statut).toBe(422);
    expect(corps.code).toBe("seance_future");
    const apres = await prisma.planDay.findUniqueOrThrow({ where: { id: dansTroisJours.id } });
    expect(apres.status).toBe("PREVU");
  });

  it("refuse de solder un jour de plan avec la séance d'un autre groupe", async () => {
    const { user } = await utilisateurAvecSeanceDuJour();
    const jourDos = await prisma.planDay.create({
      data: { userId: user.id, date: jourUTC(), muscleGroup: "dos", status: "PREVU" },
    });

    const { statut, corps } = await valider(user.id, {
      planDayId: jourDos.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(12),
      ressenti: "juste",
    });

    expect(statut).toBe(422);
    expect(corps.code).toBe("groupe_incoherent");
  });

  it("exige un jour de plan hors séance bonus", async () => {
    const { user } = await utilisateurAvecSeanceDuJour();

    const { statut, corps } = await valider(user.id, {
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(12),
      ressenti: "juste",
    });

    expect(statut).toBe(422);
    expect(corps.code).toBe("plan_day_requis");
  });

  it("ne laisse pas valider le jour de plan d'un autre utilisateur", async () => {
    const autre = await creerUtilisateur();
    const jourDeAutrui = await prisma.planDay.create({
      data: { userId: autre.id, date: jourUTC(), muscleGroup: GROUPE, status: "PREVU" },
    });
    const { user, seance } = await utilisateurAvecSeanceDuJour();

    const { statut, corps } = await valider(user.id, {
      planDayId: jourDeAutrui.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
    });

    // 404 et non 403 : le jour d'autrui doit être indiscernable d'un
    // identifiant inexistant, sinon l'API confirme qu'il existe.
    expect(statut).toBe(404);
    expect(corps.code).toBe("plan_day_introuvable");
    const inchange = await prisma.planDay.findUniqueOrThrow({ where: { id: jourDeAutrui.id } });
    expect(inchange.status).toBe("PREVU");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: autre.id } })).lp).toBe(0);
  });

  it("valide une séance bonus sans jour de plan", async () => {
    const { user, seance } = await utilisateurAvecSeanceDuJour();

    const { statut, corps } = await valider(user.id, {
      groupe: GROUPE,
      bonus: true,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
    });

    expect(statut).toBe(201);
    expect(corps.details).toContainEqual({ libelle: "Séance bonus", lp: BAREME.seanceBonus });
  });

  it("propose de durcir les variantes après une séance jugée facile", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();

    const { corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "facile",
    });

    expect(corps.proposition).toMatchObject({ delta: 1, groupe: GROUPE });
  });

  it("enregistre les charges des séries menées à terme", async () => {
    const user = await creerUtilisateur({
      equipments: ["halteres", "banc"],
      muscleGroups: [{ id: GROUPE }],
    });
    const planDay = await prisma.planDay.create({
      data: { userId: user.id, date: jourUTC(), muscleGroup: GROUPE, status: "PREVU" },
    });
    const seance = await seanceDuJour(user.id, GROUPE);
    const avecCharge = seance.exercices.findIndex((e) => e.chargeRequise);
    expect(avecCharge).toBeGreaterThanOrEqual(0);

    await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      charges: seance.exercices.map((_, i) => (i === avecCharge ? 22.5 : null)),
      ressenti: "juste",
    });

    const charge = await prisma.exerciseLoad.findUniqueOrThrow({
      where: {
        userId_exerciseName: {
          userId: user.id,
          exerciseName: seance.exercices[avecCharge].nom,
        },
      },
    });
    expect(charge.kg).toBe(22.5);
  });

  it("rejette un groupe musculaire inconnu", async () => {
    const { user, planDay } = await utilisateurAvecSeanceDuJour();

    const { statut, corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: "mollets",
      bonus: false,
      statuts: ["fait"],
      ressenti: "juste",
    });

    expect(statut).toBe(400);
    expect(corps.code).toBe("requete_invalide");
    expect(await prisma.workoutLog.count()).toBe(0);
  });

  it("rejette un corps incomplet", async () => {
    const { user, planDay } = await utilisateurAvecSeanceDuJour();

    const { statut } = await valider(user.id, { planDayId: planDay.id, groupe: GROUPE });

    expect(statut).toBe(400);
    expect(await prisma.workoutLog.count()).toBe(0);
  });
});

/**
 * Séances remontées de la file d'attente hors ligne.
 *
 * Le cas courant : séance du soir dans une salle sans réseau, app rouverte le
 * lendemain matin. Sans date déclarée, elle serait refusée en « séance passée »
 * et la salle aurait été faite pour rien.
 */
describe("POST /api/v1/seance/valider — séance différée", () => {
  const HIER = new Date(jourUTC().getTime() - 86_400_000);
  const iso = (jour: Date) => jour.toISOString().slice(0, 10);

  /** Jour de plan d'hier, resté au programme, et la séance qui allait avec. */
  async function seanceDHier() {
    const user = await creerUtilisateur({ muscleGroups: [{ id: GROUPE }, { id: "dos" }] });
    const planDay = await prisma.planDay.create({
      data: { userId: user.id, date: HIER, muscleGroup: GROUPE, status: "PREVU" },
    });
    return { user, planDay, seance: await seanceDuJour(user.id, GROUPE, midiLocal(HIER)) };
  }

  it("date la séance du jour où elle a été faite, et solde ce jour-là", async () => {
    const { user, planDay, seance } = await seanceDHier();
    const aUnFinisher = seance.exercices.some((e) => e.finisher);

    const { statut, corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
      faiteLe: iso(HIER),
    });

    expect(statut).toBe(201);
    expect(corps.lpGagnes).toBe(BAREME.seanceComplete + (aUnFinisher ? BAREME.finisher : 0));

    const workout = await prisma.workoutLog.findFirstOrThrow({ where: { userId: user.id } });
    expect(workout.date).toEqual(HIER);
    expect((await prisma.planDay.findUniqueOrThrow({ where: { id: planDay.id } })).status).toBe(
      "FAIT",
    );
  });

  it("rejoue les exercices d'hier, pas ceux d'aujourd'hui", async () => {
    // Le fond du sujet : la séance est régénérée à partir d'une graine du jour.
    // Prise sur celle d'aujourd'hui, elle sortirait d'autres exercices et les
    // statuts envoyés se rattacheraient à des mouvements jamais faits.
    const { user, planDay, seance } = await seanceDHier();

    await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
      faiteLe: iso(HIER),
    });

    const workout = await prisma.workoutLog.findFirstOrThrow({ where: { userId: user.id } });
    const noms = (workout.exercises as { name: string }[]).map((e) => e.name);
    expect(noms).toEqual(seance.exercices.map((e) => e.nom));
  });

  it("refuse une séance d'avant-hier", async () => {
    const { user, planDay, seance } = await seanceDHier();

    const { statut, corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
      faiteLe: iso(new Date(HIER.getTime() - 86_400_000)),
    });

    expect(statut).toBe(422);
    expect(corps.code).toBe("date_hors_bornes");
    expect(await prisma.workoutLog.count()).toBe(0);
  });

  it("refuse une date à venir", async () => {
    const { user, planDay, seance } = await seanceDHier();

    const { statut, corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
      faiteLe: iso(new Date(jourUTC().getTime() + 86_400_000)),
    });

    expect(statut).toBe(422);
    expect(corps.code).toBe("date_hors_bornes");
    expect(await prisma.workoutLog.count()).toBe(0);
  });

  it("refuse une date qui n'existe pas au calendrier", async () => {
    const { user, planDay, seance } = await seanceDHier();

    const { statut, corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
      faiteLe: "2026-02-31",
    });

    expect(statut).toBe(400);
    expect(corps.code).toBe("date_invalide");
    expect(await prisma.workoutLog.count()).toBe(0);
  });

  it("refuse toujours de solder hier sans date déclarée", async () => {
    // La règle d'origine tient : sans `faiteLe`, un jour passé reste
    // irrattrapable. Le rattrapage rétroactif d'un jour manqué n'est pas
    // ouvert, seul l'envoi différé d'une séance réellement faite l'est.
    const { user, planDay, seance } = await seanceDHier();

    const { statut, corps } = await valider(user.id, {
      planDayId: planDay.id,
      groupe: GROUPE,
      bonus: false,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
    });

    expect(statut).toBe(422);
    expect(corps.code).toBe("seance_passee");
    expect(await prisma.workoutLog.count()).toBe(0);
  });

  it("compte une séance bonus d'hier sur les bonus d'hier", async () => {
    // Le barème se lit au jour de la séance : un bonus déjà compté hier reste
    // compté, et un bonus d'hier ne consomme pas celui d'aujourd'hui.
    const { user } = await seanceDHier();
    const seance = await seanceDuJour(user.id, "dos", midiLocal(HIER));
    await prisma.workoutLog.create({
      data: {
        userId: user.id,
        date: HIER,
        muscleGroup: GROUPE,
        isBonus: true,
        lpEarned: BAREME.seanceBonus,
        exercises: [],
      },
    });

    const { statut, corps } = await valider(user.id, {
      groupe: "dos",
      bonus: true,
      statuts: tousFaits(seance.exercices.length),
      ressenti: "juste",
      faiteLe: iso(HIER),
    });

    expect(statut).toBe(201);
    expect(corps.lpGagnes).toBe(0);
  });
});

describe("POST /api/v1/difficulte", () => {
  const ajuster = async (userId: string | undefined, corps: Record<string, unknown>) =>
    reponseJson(await postDifficulte(await requeteApi("/api/v1/difficulte", { userId, corps })));

  it("refuse une requête sans jeton", async () => {
    expect((await ajuster(undefined, { groupe: GROUPE, delta: 1 })).statut).toBe(401);
  });

  it("refuse un profil non onboardé", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    const { statut, corps } = await ajuster(user.id, { groupe: GROUPE, delta: 1 });

    expect(statut).toBe(409);
    expect(corps.code).toBe("onboarding_requis");
  });

  it("durcit le groupe d'un cran", async () => {
    const user = await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });

    const { statut, corps, cache } = await ajuster(user.id, { groupe: GROUPE, delta: 1 });

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    expect(corps).toEqual({ groupe: GROUPE, decalageNiveau: 1 });
    const groupe = await prisma.userMuscleGroup.findFirstOrThrow({ where: { userId: user.id } });
    expect(groupe.levelOffset).toBe(1);
  });

  it("ne dépasse jamais les bornes, même en insistant", async () => {
    const user = await creerUtilisateur({ muscleGroups: [{ id: GROUPE, levelOffset: 1 }] });

    const { corps } = await ajuster(user.id, { groupe: GROUPE, delta: 1 });

    expect(corps.decalageNiveau).toBe(1);
  });

  it("refuse un ajustement de plus d'un cran", async () => {
    const user = await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });

    expect((await ajuster(user.id, { groupe: GROUPE, delta: 2 })).statut).toBe(400);
    expect((await ajuster(user.id, { groupe: GROUPE, delta: 0 })).statut).toBe(400);
    const groupe = await prisma.userMuscleGroup.findFirstOrThrow({ where: { userId: user.id } });
    expect(groupe.levelOffset).toBe(0);
  });

  it("refuse un groupe que l'utilisateur n'a pas choisi", async () => {
    const user = await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });

    const { statut, corps } = await ajuster(user.id, { groupe: "abdos", delta: 1 });

    expect(statut).toBe(404);
    expect(corps.code).toBe("groupe_introuvable");
  });

  it("n'ajuste que le groupe du porteur du jeton", async () => {
    const a = await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });
    const b = await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });

    await ajuster(a.id, { groupe: GROUPE, delta: -1 });

    const groupeA = await prisma.userMuscleGroup.findFirstOrThrow({ where: { userId: a.id } });
    const groupeB = await prisma.userMuscleGroup.findFirstOrThrow({ where: { userId: b.id } });
    expect(groupeA.levelOffset).toBe(-1);
    expect(groupeB.levelOffset).toBe(0);
  });
});
