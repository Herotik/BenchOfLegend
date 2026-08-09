import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ajusterDifficulte, validerSeance } from "@/app/actions/seance";
import { seanceDuJour } from "@/lib/plan-hebdo";
import { jourUTC } from "@/lib/dates";
import { BAREME } from "@/lib/lp";
import { rankLabel } from "@/lib/ranks";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

/** Mercredi 12 août 2026, midi : la graine de séance ne bouge plus. */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);

const GROUPE = "pectoraux";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

/** Utilisateur onboardé avec une séance du jour prête à valider. */
async function utilisateurAvecSeanceDuJour(lp = 0) {
  const user = await creerUtilisateur({
    lp,
    muscleGroups: [{ id: GROUPE }, { id: "dos" }, { id: "jambes" }],
  });
  const planDay = await prisma.planDay.create({
    data: { userId: user.id, date: jourUTC(), muscleGroup: GROUPE, status: "PREVU" },
  });
  // La séance n'est pas persistée : elle est régénérée à l'identique par
  // l'action. Le test s'en sert seulement pour connaître le décor.
  const seance = await seanceDuJour(user.id, GROUPE);
  return { user, planDay, seance };
}

type Statut = "non_fait" | "partiel" | "fait";

const tousFaits = (n: number): Statut[] => Array.from({ length: n }, () => "fait");
const aucunFait = (n: number): Statut[] => Array.from({ length: n }, () => "non_fait");

const valider = (
  planDayId: string,
  statuts: Statut[],
  over: Partial<Parameters<typeof validerSeance>[0]> = {},
) =>
  validerSeance({
    planDayId,
    muscleGroup: GROUPE,
    isBonus: false,
    statuts,
    ressenti: "juste",
    ...over,
  });

describe("validerSeance", () => {
  it("crédite 20 LP pour une séance entièrement cochée", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const aUnFinisher = seance.exercices.some((e) => e.finisher);

    const resultat = await valider(planDay.id, tousFaits(seance.exercices.length));

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.details).toContainEqual({
      libelle: "Séance du jour validée",
      lp: BAREME.seanceComplete,
    });
    // Ni régularité (première séance) ni bonus : seul le finisher peut s'ajouter.
    expect(resultat.lpEarned).toBe(BAREME.seanceComplete + (aUnFinisher ? BAREME.finisher : 0));

    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(resultat.lpEarned);
    expect(resultat.lpTotal).toBe(apres.lp);
  });

  it("ne crédite qu'une séance partielle quand il manque des exercices", async () => {
    const { planDay, seance } = await utilisateurAvecSeanceDuJour();
    const n = seance.exercices.length;
    // Entre 50 % et 80 % d'avancement : le palier partiel, pas le complet.
    const faits = Math.round(n * 0.6);
    const statuts = [...tousFaits(faits), ...aucunFait(n - faits)];

    const resultat = await valider(planDay.id, statuts);

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.details).toContainEqual({
      libelle: "Séance partiellement validée",
      lp: BAREME.seancePartielle,
    });
  });

  it("ne rapporte rien quand presque rien n'a été fait", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const statuts: Statut[] = seance.exercices.map((_, i) => (i === 0 ? "fait" : "non_fait"));

    const resultat = await valider(planDay.id, statuts);

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.lpEarned).toBe(0);
    expect(resultat.details).toEqual([]);
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(0);
  });

  it("ignore les statuts surnuméraires envoyés par un client bricolé", async () => {
    // Un client modifié pourrait allonger le tableau pour gonfler le ratio.
    // Le serveur ne compte que les exercices de la séance qu'il a régénérée.
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const n = seance.exercices.length;
    const statuts = [...aucunFait(n), ...tousFaits(50)];

    const resultat = await valider(planDay.id, statuts);

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.lpEarned).toBe(0);
    const workout = await prisma.workoutLog.findFirstOrThrow({ where: { userId: user.id } });
    expect(workout.exercises).toHaveLength(n);
  });

  it("compte comme non faits les exercices dont le statut manque", async () => {
    const { planDay, seance } = await utilisateurAvecSeanceDuJour();

    const resultat = await valider(planDay.id, ["fait"]);

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    // Un seul exercice sur 4 à 6 : sous le seuil, rien n'est crédité.
    expect(seance.exercices.length).toBeGreaterThan(2);
    expect(resultat.lpEarned).toBe(0);
  });

  it("enregistre le détail des exercices et leur statut", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const statuts: Statut[] = seance.exercices.map((_, i) => (i === 0 ? "partiel" : "fait"));

    await valider(planDay.id, statuts, { durationMin: 47 });

    const workout = await prisma.workoutLog.findFirstOrThrow({ where: { userId: user.id } });
    const snapshot = workout.exercises as { name: string; sets: number; statut: string }[];
    expect(snapshot.map((e) => e.name)).toEqual(seance.exercices.map((e) => e.nom));
    expect(snapshot.map((e) => e.statut)).toEqual(statuts);
    expect(snapshot.map((e) => e.sets)).toEqual(seance.exercices.map((e) => e.series));
    expect(workout.durationMin).toBe(47);
    expect(workout.muscleGroup).toBe(GROUPE);
    expect(workout.date).toEqual(jourUTC());
  });

  it("marque le jour du plan comme fait et le relie à la séance", async () => {
    const { planDay, seance } = await utilisateurAvecSeanceDuJour();

    await valider(planDay.id, tousFaits(seance.exercices.length));

    const apres = await prisma.planDay.findUniqueOrThrow({ where: { id: planDay.id } });
    const workout = await prisma.workoutLog.findFirstOrThrow();
    expect(apres.status).toBe("FAIT");
    expect(apres.workoutId).toBe(workout.id);
  });

  it("refuse de valider deux fois la même séance du jour", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    const statuts = tousFaits(seance.exercices.length);

    const premier = await valider(planDay.id, statuts);
    const second = await valider(planDay.id, statuts);

    if ("erreur" in premier) throw new Error(premier.erreur);
    expect(second).toEqual({ erreur: "Cette séance est déjà validée" });
    expect(await prisma.workoutLog.count()).toBe(1);
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(premier.lpEarned);
  });

  it("refuse de valider le jour de plan d'un autre utilisateur", async () => {
    const autre = await creerUtilisateur();
    const planDayAutrui = await prisma.planDay.create({
      data: { userId: autre.id, date: jourUTC(), muscleGroup: GROUPE, status: "PREVU" },
    });
    await utilisateurAvecSeanceDuJour();

    const resultat = await valider(planDayAutrui.id, tousFaits(6));

    expect(resultat).toEqual({ erreur: "Séance du jour introuvable" });
    const inchange = await prisma.planDay.findUniqueOrThrow({ where: { id: planDayAutrui.id } });
    expect(inchange.status).toBe("PREVU");
  });

  it("annonce la promotion quand le total change de division", async () => {
    // 95 LP = Hoplite IV ; une séance complète fait basculer en Hoplite III.
    const { planDay, seance } = await utilisateurAvecSeanceDuJour(95);

    const resultat = await valider(planDay.id, tousFaits(seance.exercices.length));

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(rankLabel(95)).toBe("Hoplite IV");
    expect(resultat.promoted).toBe(true);
    expect(resultat.newRank).toBe("Hoplite III");
  });

  it("n'annonce pas de promotion quand on reste dans la même division", async () => {
    const { planDay, seance } = await utilisateurAvecSeanceDuJour(0);

    const resultat = await valider(planDay.id, tousFaits(seance.exercices.length));

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.promoted).toBe(false);
    expect(resultat.newRank).toBe("Hoplite IV");
  });

  it("ne compte qu'une seule séance bonus par jour", async () => {
    // Plafond anti-surentraînement : empiler les séances libres ne paie pas.
    const { user, seance } = await utilisateurAvecSeanceDuJour();
    const statuts = tousFaits(seance.exercices.length);

    const premier = await validerSeance({
      muscleGroup: GROUPE,
      isBonus: true,
      statuts,
      ressenti: "juste",
    });
    const second = await validerSeance({
      muscleGroup: GROUPE,
      isBonus: true,
      statuts,
      ressenti: "juste",
    });

    if ("erreur" in premier || "erreur" in second) throw new Error("validation refusée");
    expect(premier.details).toContainEqual({ libelle: "Séance bonus", lp: BAREME.seanceBonus });
    expect(second.lpEarned).toBe(0);
    expect(second.details).toEqual([]);

    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(premier.lpEarned);
    // La séance est tout de même consignée : elle a eu lieu, elle ne paie pas.
    expect(await prisma.workoutLog.count({ where: { isBonus: true } })).toBe(2);
  });

  it("ajoute la prime de régularité à partir de la troisième séance de la semaine", async () => {
    const { user, planDay, seance } = await utilisateurAvecSeanceDuJour();
    for (const jours of [1, 2]) {
      await prisma.workoutLog.create({
        data: {
          userId: user.id,
          date: new Date(jourUTC().getTime() - jours * 86_400_000),
          muscleGroup: "dos",
          lpEarned: 20,
          exercises: [],
        },
      });
    }

    const resultat = await valider(planDay.id, tousFaits(seance.exercices.length));

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.details).toContainEqual({ libelle: "Régularité", lp: BAREME.regularite });
  });

  it("propose de durcir les variantes après une séance jugée facile", async () => {
    const { planDay, seance } = await utilisateurAvecSeanceDuJour();

    const resultat = await valider(planDay.id, tousFaits(seance.exercices.length), {
      ressenti: "facile",
    });

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.proposition).toMatchObject({ delta: 1, muscleGroup: GROUPE });
  });

  it("ne propose rien quand le ressenti est juste", async () => {
    const { planDay, seance } = await utilisateurAvecSeanceDuJour();

    const resultat = await valider(planDay.id, tousFaits(seance.exercices.length));

    if ("erreur" in resultat) throw new Error(resultat.erreur);
    expect(resultat.proposition).toBeNull();
  });

  it("exige un jour de plan pour une séance qui n'est pas un bonus", async () => {
    await utilisateurAvecSeanceDuJour();

    const resultat = await validerSeance({
      muscleGroup: GROUPE,
      isBonus: false,
      statuts: ["fait"],
      ressenti: "juste",
    });

    expect(resultat).toEqual({ erreur: "Séance du jour introuvable" });
  });

  /**
   * BUG CONNU — les séances à venir peuvent être encaissées d'avance.
   *
   * `validerSeance` ne vérifie du `PlanDay` que deux choses : qu'il appartient
   * bien à l'utilisateur et qu'il n'est pas déjà FAIT. Sa date n'est jamais
   * comparée à aujourd'hui. Comme `assurerPlans` publie six semaines de plan
   * d'avance, un client bricolé n'a qu'à lire les identifiants rendus par le
   * calendrier et appeler l'action pour chacun : une trentaine de séances
   * validées dans la même minute, 20 LP pièce, toutes datées d'aujourd'hui.
   *
   * C'est précisément ce que le commentaire de l'action dit empêcher (« un
   * client modifié ne peut pas s'attribuer des LP »).
   *
   * Reproduction : générer le plan, prendre le PlanDay le plus lointain, et
   * appeler `validerSeance` dessus — il passe à FAIT et crédite 20 LP.
   *
   * Correctif attendu : refuser un PlanDay dont la date n'est pas celle du jour.
   */
  it("refuse de valider une séance planifiée pour plus tard", async () => {
    const { user } = await utilisateurAvecSeanceDuJour();
    const dansTroisJours = await prisma.planDay.create({
      data: {
        userId: user.id,
        date: new Date(jourUTC().getTime() + 3 * 86_400_000),
        muscleGroup: GROUPE,
        status: "PREVU",
      },
    });

    const resultat = await valider(dansTroisJours.id, tousFaits(12));

    expect(resultat).toHaveProperty("erreur");
    const apres = await prisma.planDay.findUniqueOrThrow({ where: { id: dansTroisJours.id } });
    expect(apres.status).toBe("PREVU");
  });

  /**
   * BUG CONNU, même origine — le groupe musculaire du `PlanDay` n'est pas
   * confronté à celui de la séance validée. On peut donc solder le jour « dos »
   * en présentant une séance de pectoraux : l'historique et le calendrier
   * racontent alors deux choses différentes.
   */
  it("refuse de solder un jour de plan avec la séance d'un autre groupe", async () => {
    const { user } = await utilisateurAvecSeanceDuJour();
    const jourDos = await prisma.planDay.create({
      data: { userId: user.id, date: jourUTC(), muscleGroup: "dos", status: "PREVU" },
    });

    const resultat = await valider(jourDos.id, tousFaits(12));

    expect(resultat).toHaveProperty("erreur");
  });

  it("rejette un groupe musculaire inconnu", async () => {
    const { planDay } = await utilisateurAvecSeanceDuJour();

    const resultat = await validerSeance({
      planDayId: planDay.id,
      muscleGroup: "mollets",
      isBonus: false,
      statuts: ["fait"],
      ressenti: "juste",
    });

    expect(resultat).toHaveProperty("erreur");
    expect(await prisma.workoutLog.count()).toBe(0);
  });
});

describe("ajusterDifficulte", () => {
  it("durcit le groupe d'un cran", async () => {
    await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });

    const resultat = await ajusterDifficulte(GROUPE, 1);

    expect(resultat).toEqual({ ok: true, levelOffset: 1 });
  });

  it("ne dépasse jamais +1, même en insistant", async () => {
    // Sauter deux paliers de variantes d'un coup est le meilleur moyen de se blesser.
    await creerUtilisateur({ muscleGroups: [{ id: GROUPE, levelOffset: 1 }] });

    const resultat = await ajusterDifficulte(GROUPE, 1);

    expect(resultat).toEqual({ ok: true, levelOffset: 1 });
    const groupe = await prisma.userMuscleGroup.findFirstOrThrow();
    expect(groupe.levelOffset).toBe(1);
  });

  it("ne descend jamais en dessous de -1", async () => {
    await creerUtilisateur({ muscleGroups: [{ id: GROUPE, levelOffset: -1 }] });

    const resultat = await ajusterDifficulte(GROUPE, -1);

    expect(resultat).toEqual({ ok: true, levelOffset: -1 });
  });

  it("refuse un ajustement de plus d'un cran", async () => {
    await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });

    expect(await ajusterDifficulte(GROUPE, 2)).toEqual({ erreur: "Ajustement invalide" });
    expect(await ajusterDifficulte(GROUPE, 0)).toEqual({ erreur: "Ajustement invalide" });
    const groupe = await prisma.userMuscleGroup.findFirstOrThrow();
    expect(groupe.levelOffset).toBe(0);
  });

  it("refuse un groupe que l'utilisateur n'a pas choisi", async () => {
    await creerUtilisateur({ muscleGroups: [{ id: GROUPE }] });

    expect(await ajusterDifficulte("abdos", 1)).toEqual({ erreur: "Groupe introuvable" });
  });
});
