import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getReferentiel } from "@/app/api/v1/referentiel/route";
import { GET as getMe } from "@/app/api/v1/me/route";
import { PUT as putPreferences } from "@/app/api/v1/me/preferences/route";
import { POST as postOnboarding } from "@/app/api/v1/me/onboarding/route";
import { assurerPlans } from "@/lib/plan-hebdo";
import { creerJetonAcces } from "@/lib/api/jetons";
import { BAREME } from "@/lib/lp";
import { creerUtilisateur, nettoyerBase, prisma, reponseJson, requeteApi } from "./aide";

/** Mercredi 12 août 2026, midi — même horloge gelée que les autres suites. */
const MERCREDI = new Date(2026, 7, 12, 12, 0, 0);
const AUJOURDHUI = new Date(Date.UTC(2026, 7, 12));

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MERCREDI);
});
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

/** Corps accepté par `PUT /api/v1/me/preferences`, clés en français. */
const preferencesApi = (over: Record<string, unknown> = {}) => ({
  tailleCm: 165,
  niveau: "AVANCE",
  materiel: ["kettlebell"],
  groupesMusculaires: ["abdos", "cardio"],
  pointsForts: ["cardio"],
  objectif: "PERTE_DE_POIDS",
  joursParSemaine: 3,
  ...over,
});

describe("GET /api/v1/referentiel", () => {
  it("répond sans aucun jeton : l'app en a besoin avant la connexion", async () => {
    const { statut, corps } = await reponseJson(
      await getReferentiel(),
    );

    expect(statut).toBe(200);
    expect(corps.materiel).toContainEqual({ id: "halteres", label: "Haltères" });
    expect(corps.groupesMusculaires).toContainEqual({ id: "pectoraux", label: "Pectoraux" });
    expect(corps.objectifs).toContainEqual({ id: "FORCE", label: "Force" });
    expect((corps.niveaux as { id: string }[]).map((n) => n.id)).toEqual([
      "DEBUTANT",
      "INTERMEDIAIRE",
      "AVANCE",
    ]);
    expect((corps.rangs as { slug: string }[])[0]).toMatchObject({ slug: "hoplite", minLp: 0 });
    expect((corps.rangs as unknown[]).length).toBe(8);
  });

  it("publie le barème plutôt que de laisser l'app le coder en dur", async () => {
    // Une valeur recopiée dans l'app finirait par annoncer 20 LP sur une
    // séance bonus qui en rapporte 8 — le bug déjà vu sur l'aperçu web.
    const { corps } = await reponseJson(await getReferentiel());

    expect((corps.lp as { bareme: typeof BAREME }).bareme).toEqual(BAREME);
  });

  it("s'autorise un cache : rien ici n'est personnel", async () => {
    const reponse = await getReferentiel();

    expect(reponse.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });
});

describe("GET /api/v1/me", () => {
  it("refuse une requête sans jeton", async () => {
    const { statut, corps } = await reponseJson(await getMe(await requeteApi("/api/v1/me")));

    expect(statut).toBe(401);
    expect(corps.code).toBe("jeton_absent");
  });

  it("distingue un jeton invalide d'un jeton absent", async () => {
    // Le code dit au client de tenter un rafraîchissement plutôt que de
    // renvoyer l'utilisateur à l'écran de connexion.
    const { statut, corps } = await reponseJson(
      await getMe(await requeteApi("/api/v1/me", { jeton: "pas-un-jwt" })),
    );

    expect(statut).toBe(401);
    expect(corps.code).toBe("jeton_invalide");
  });

  it("rend le profil, les préférences et le rang", async () => {
    const user = await creerUtilisateur({
      lp: 95,
      equipments: ["halteres"],
      muscleGroups: [{ id: "pectoraux", priority: 2, levelOffset: 1 }, { id: "dos" }],
    });

    const { statut, corps, cache } = await reponseJson(
      await getMe(await requeteApi("/api/v1/me", { userId: user.id })),
    );

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    expect(corps.utilisateur).toMatchObject({ id: user.id, email: user.email, onboarded: true });
    expect(corps.lp).toBe(95);
    expect(corps.rang).toMatchObject({ slug: "hoplite", division: 4, libelle: "Hoplite IV" });
    expect(corps.preferences).toMatchObject({
      tailleCm: 172,
      niveau: "DEBUTANT",
      materiel: ["halteres"],
    });
    expect((corps.preferences as { groupesMusculaires: unknown[] }).groupesMusculaires).toEqual([
      { groupe: "dos", priorite: 1, decalageNiveau: 0 },
      { groupe: "pectoraux", priorite: 2, decalageNiveau: 1 },
    ]);
  });

  it("répond aussi à un profil non onboardé, c'est tout son intérêt", async () => {
    // C'est cette réponse qui dit à l'app d'afficher l'onboarding : la refuser
    // par un 409 la laisserait sans rien à montrer.
    const user = await creerUtilisateur({ onboarded: false });

    const { statut, corps } = await reponseJson(
      await getMe(await requeteApi("/api/v1/me", { userId: user.id })),
    );

    expect(statut).toBe(200);
    expect((corps.utilisateur as { onboarded: boolean }).onboarded).toBe(false);
    expect(corps.preferences).toBeNull();
  });

  it("ne rend jamais le profil d'un autre compte", async () => {
    const a = await creerUtilisateur({ lp: 10 });
    const b = await creerUtilisateur({ lp: 3000 });

    const { corps } = await reponseJson(
      await getMe(await requeteApi("/api/v1/me", { userId: a.id })),
    );

    expect((corps.utilisateur as { id: string }).id).toBe(a.id);
    expect(corps.lp).toBe(10);
    expect(JSON.stringify(corps)).not.toContain(b.id);
  });
});

describe("PUT /api/v1/me/preferences", () => {
  it("refuse sans jeton", async () => {
    const { statut } = await reponseJson(
      await putPreferences(
        await requeteApi("/api/v1/me/preferences", { methode: "PUT", corps: preferencesApi() }),
      ),
    );

    expect(statut).toBe(401);
  });

  it("refuse tant que l'onboarding n'est pas fait", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    const { statut, corps } = await reponseJson(
      await putPreferences(
        await requeteApi("/api/v1/me/preferences", {
          userId: user.id,
          methode: "PUT",
          corps: preferencesApi(),
        }),
      ),
    );

    expect(statut).toBe(409);
    expect(corps.code).toBe("onboarding_requis");
  });

  it("remplace profil, matériel et groupes, et rend l'état relu", async () => {
    const user = await creerUtilisateur({
      level: "DEBUTANT",
      equipments: ["halteres", "banc"],
      muscleGroups: [{ id: "pectoraux" }, { id: "dos" }],
    });

    const { statut, corps, cache } = await reponseJson(
      await putPreferences(
        await requeteApi("/api/v1/me/preferences", {
          userId: user.id,
          methode: "PUT",
          corps: preferencesApi(),
        }),
      ),
    );

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    expect(corps.preferences).toMatchObject({
      tailleCm: 165,
      niveau: "AVANCE",
      objectif: "PERTE_DE_POIDS",
      joursParSemaine: 3,
      materiel: ["kettlebell"],
    });

    const apres = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { muscleGroups: true },
    });
    expect(apres.heightCm).toBe(165);
    expect(apres.muscleGroups.map((g) => g.groupId).sort()).toEqual(["abdos", "cardio"]);
  });

  it("efface le plan à venir sans toucher au passé ni aux séances validées", async () => {
    const user = await creerUtilisateur({ createdAt: new Date(2026, 0, 15) });
    await assurerPlans(user.id);
    const duJour = await prisma.planDay.findFirstOrThrow({
      where: { userId: user.id, date: AUJOURDHUI, status: "PREVU" },
    });
    await prisma.planDay.update({ where: { id: duJour.id }, data: { status: "FAIT" } });

    await putPreferences(
      await requeteApi("/api/v1/me/preferences", {
        userId: user.id,
        methode: "PUT",
        corps: preferencesApi(),
      }),
    );

    const restants = await prisma.planDay.findMany({ where: { userId: user.id } });
    expect(restants.some((j) => j.id === duJour.id)).toBe(true);
    expect(restants.every((j) => j.date < AUJOURDHUI || j.status === "FAIT")).toBe(true);
  });

  it("refuse des préférences invalides sans rien modifier", async () => {
    const user = await creerUtilisateur({ heightCm: 172, daysPerWeek: 4 });

    const { statut, corps } = await reponseJson(
      await putPreferences(
        await requeteApi("/api/v1/me/preferences", {
          userId: user.id,
          methode: "PUT",
          corps: preferencesApi({ joursParSemaine: 9 }),
        }),
      ),
    );

    expect(statut).toBe(400);
    expect(corps.code).toBe("requete_invalide");
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.daysPerWeek).toBe(4);
    expect(apres.heightCm).toBe(172);
  });

  it("refuse un corps qui n'est pas du JSON", async () => {
    const user = await creerUtilisateur();
    const requete = new Request("https://la-faille.test/api/v1/me/preferences", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await creerJetonAcces(user.id)}`,
        "Content-Type": "application/json",
      },
      body: "{pas du json",
    });

    const { statut, corps } = await reponseJson(await putPreferences(requete));

    expect(statut).toBe(400);
    expect(corps.code).toBe("json_invalide");
  });

  it("n'écrit que sur le compte du porteur du jeton", async () => {
    const a = await creerUtilisateur({ heightCm: 180 });
    const b = await creerUtilisateur({ heightCm: 160 });

    await putPreferences(
      await requeteApi("/api/v1/me/preferences", {
        userId: a.id,
        methode: "PUT",
        corps: preferencesApi({ tailleCm: 190 }),
      }),
    );

    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).heightCm).toBe(190);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).heightCm).toBe(160);
  });
});

describe("POST /api/v1/me/onboarding", () => {
  const onboardingApi = (over: Record<string, unknown> = {}) => ({
    ...preferencesApi({ groupesMusculaires: ["pectoraux", "dos", "jambes"], pointsForts: ["dos"] }),
    poidsKg: 74.5,
    ...over,
  });

  it("refuse sans jeton", async () => {
    const { statut } = await reponseJson(
      await postOnboarding(await requeteApi("/api/v1/me/onboarding", { corps: onboardingApi() })),
    );

    expect(statut).toBe(401);
  });

  it("complète le profil et ouvre la courbe de poids", async () => {
    const user = await creerUtilisateur({ onboarded: false, heightCm: null, muscleGroups: [] });

    const { statut, corps } = await reponseJson(
      await postOnboarding(
        await requeteApi("/api/v1/me/onboarding", { userId: user.id, corps: onboardingApi() }),
      ),
    );

    expect(statut).toBe(201);
    expect(corps.onboarded).toBe(true);

    const apres = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { muscleGroups: true },
    });
    expect(apres.onboarded).toBe(true);
    expect(apres.heightCm).toBe(165);
    expect(apres.muscleGroups.map((g) => g.groupId).sort()).toEqual(["dos", "jambes", "pectoraux"]);

    const pesees = await prisma.weighIn.findMany({ where: { userId: user.id } });
    expect(pesees).toHaveLength(1);
    expect(pesees[0].kg).toBe(74.5);
    expect(pesees[0].date).toEqual(AUJOURDHUI);
  });

  it("refuse de recommencer un onboarding déjà terminé", async () => {
    // Le repasser écraserait des préférences choisies et la pesée du jour.
    const user = await creerUtilisateur({ onboarded: true, heightCm: 180 });

    const { statut, corps } = await reponseJson(
      await postOnboarding(
        await requeteApi("/api/v1/me/onboarding", { userId: user.id, corps: onboardingApi() }),
      ),
    );

    expect(statut).toBe(409);
    expect(corps.code).toBe("deja_onboarde");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).heightCm).toBe(180);
  });

  it("refuse un poids aberrant sans rien enregistrer", async () => {
    const user = await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    const { statut, corps } = await reponseJson(
      await postOnboarding(
        await requeteApi("/api/v1/me/onboarding", {
          userId: user.id,
          corps: onboardingApi({ poidsKg: 12 }),
        }),
      ),
    );

    expect(statut).toBe(400);
    expect(corps.error).toBe("Poids invalide");
    expect(await prisma.weighIn.count()).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).onboarded).toBe(false);
  });

  it("exige au moins un groupe musculaire", async () => {
    const user = await creerUtilisateur({ onboarded: false, muscleGroups: [] });

    const { statut, corps } = await reponseJson(
      await postOnboarding(
        await requeteApi("/api/v1/me/onboarding", {
          userId: user.id,
          corps: onboardingApi({ groupesMusculaires: [] }),
        }),
      ),
    );

    expect(statut).toBe(400);
    expect(corps.error).toBe("Choisis au moins un groupe musculaire");
  });
});
