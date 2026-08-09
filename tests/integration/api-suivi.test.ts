import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postPesee } from "@/app/api/v1/pesee/route";
import { GET as getStats } from "@/app/api/v1/stats/route";
import { GET as getHistorique } from "@/app/api/v1/historique/route";
import { jourUTC } from "@/lib/dates";
import { BAREME } from "@/lib/lp";
import { creerUtilisateur, nettoyerBase, prisma, reponseJson, requeteApi } from "./aide";

const MERCREDI = new Date(2026, 7, 12, 8, 30, 0);
const MERCREDI_SOIR = new Date(2026, 7, 12, 21, 45, 0);
const JEUDI = new Date(2026, 7, 13, 8, 30, 0);

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"] }));
beforeEach(() => vi.setSystemTime(MERCREDI));
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

describe("POST /api/v1/pesee", () => {
  const peser = async (userId: string | undefined, kg: unknown) =>
    reponseJson(await postPesee(await requeteApi("/api/v1/pesee", { userId, corps: { kg } })));

  it("refuse une requête sans jeton", async () => {
    const { statut } = await peser(undefined, 78.4);

    expect(statut).toBe(401);
    expect(await prisma.weighIn.count()).toBe(0);
  });

  it("refuse un profil non onboardé", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    const { statut, corps } = await peser(user.id, 78.4);

    expect(statut).toBe(409);
    expect(corps.code).toBe("onboarding_requis");
    expect(await prisma.weighIn.count()).toBe(0);
  });

  it("crédite 2 LP à la première pesée du jour", async () => {
    const user = await creerUtilisateur({ lp: 10 });

    const { statut, corps, cache } = await peser(user.id, 78.4);

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    expect(corps).toMatchObject({
      date: "2026-08-12",
      kg: 78.4,
      lpGagnes: BAREME.pesee,
      lpTotal: 12,
      promotion: false,
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).lp).toBe(12);
  });

  it("corrige le poids du jour sans recréditer de LP", async () => {
    const user = await creerUtilisateur({ lp: 0 });
    await peser(user.id, 78.4);

    vi.setSystemTime(MERCREDI_SOIR);
    const { corps } = await peser(user.id, 77.9);

    expect(corps.lpGagnes).toBe(0);
    const pesees = await prisma.weighIn.findMany({ where: { userId: user.id } });
    expect(pesees).toHaveLength(1);
    expect(pesees[0].kg).toBe(77.9);
  });

  it("crédite à nouveau le lendemain", async () => {
    const user = await creerUtilisateur({ lp: 0 });
    await peser(user.id, 78.4);

    vi.setSystemTime(JEUDI);
    const { corps } = await peser(user.id, 78.1);

    expect(corps).toMatchObject({ date: "2026-08-13", lpGagnes: BAREME.pesee });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).lp).toBe(
      2 * BAREME.pesee,
    );
  });

  it("annonce la promotion quand les 2 LP font changer de division", async () => {
    const user = await creerUtilisateur({ lp: 99 });

    const { corps } = await peser(user.id, 70);

    expect(corps).toMatchObject({ promotion: true, rang: "Hoplite III" });
  });

  it("refuse un poids aberrant sans rien enregistrer", async () => {
    const user = await creerUtilisateur({ lp: 5 });

    expect((await peser(user.id, 500)).statut).toBe(400);
    expect((await peser(user.id, 12)).corps.error).toBe("Poids invalide");
    expect((await peser(user.id, "78")).statut).toBe(400);

    expect(await prisma.weighIn.count()).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).lp).toBe(5);
  });

  it("n'écrit la pesée que sur le compte du porteur du jeton", async () => {
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();

    await peser(a.id, 80);

    expect(await prisma.weighIn.count({ where: { userId: a.id } })).toBe(1);
    expect(await prisma.weighIn.count({ where: { userId: b.id } })).toBe(0);
  });
});

describe("GET /api/v1/stats", () => {
  const stats = async (userId: string | undefined) =>
    reponseJson(await getStats(await requeteApi("/api/v1/stats", { userId })));

  it("refuse une requête sans jeton", async () => {
    expect((await stats(undefined)).statut).toBe(401);
  });

  it("refuse un profil non onboardé", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    expect((await stats(user.id)).statut).toBe(409);
  });

  it("rend les agrégats des graphiques", async () => {
    const user = await creerUtilisateur();
    await prisma.weighIn.create({ data: { userId: user.id, date: jourUTC(), kg: 80 } });
    await prisma.workoutLog.create({
      data: {
        userId: user.id,
        date: jourUTC(),
        muscleGroup: "dos",
        lpEarned: 20,
        exercises: [{ name: "Tractions", sets: 4, statut: "fait" }],
      },
    });

    const { statut, corps, cache } = await stats(user.id);

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    expect(corps.poids).toEqual([{ date: "2026-08-12", kg: 80, tendance: null }]);
    expect(corps.lp).toEqual([{ date: "2026-08-12", lp: 20 }]);
    expect(corps.groupesUtilises).toEqual(["dos"]);
    expect((corps.semaines as { volumeTotal: number }[])[0].volumeTotal).toBe(4);
  });

  it("ne mélange pas les données de deux comptes", async () => {
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    await prisma.weighIn.create({ data: { userId: b.id, date: jourUTC(), kg: 95 } });
    await prisma.workoutLog.create({
      data: { userId: b.id, date: jourUTC(), muscleGroup: "bras", lpEarned: 20, exercises: [] },
    });

    const { corps } = await stats(a.id);

    expect(corps.poids).toEqual([]);
    expect(corps.lp).toEqual([]);
    expect(corps.groupesUtilises).toEqual([]);
  });
});

describe("GET /api/v1/historique", () => {
  const historique = async (userId: string | undefined, requete = "") =>
    reponseJson(await getHistorique(await requeteApi(`/api/v1/historique?${requete}`, { userId })));

  /** `nb` séances, une par jour, de la plus ancienne à la plus récente. */
  async function garnir(userId: string, nb: number) {
    const ids: string[] = [];
    for (let i = nb - 1; i >= 0; i--) {
      const s = await prisma.workoutLog.create({
        data: {
          userId,
          date: new Date(jourUTC().getTime() - i * 86_400_000),
          muscleGroup: i % 2 === 0 ? "dos" : "pectoraux",
          isBonus: i === 0,
          lpEarned: 20,
          durationMin: 45,
          feeling: 4,
          exercises: [{ name: "Tractions", sets: 4, statut: "fait" }],
        },
      });
      ids.push(s.id);
    }
    return ids;
  }

  it("refuse une requête sans jeton", async () => {
    expect((await historique(undefined)).statut).toBe(401);
  });

  it("refuse un profil non onboardé", async () => {
    const user = await creerUtilisateur({ onboarded: false });

    expect((await historique(user.id)).statut).toBe(409);
  });

  it("rend les séances de la plus récente à la plus ancienne", async () => {
    const user = await creerUtilisateur();
    await garnir(user.id, 3);

    const { statut, corps, cache } = await historique(user.id);

    expect(statut).toBe(200);
    expect(cache).toBe("no-store");
    const seances = corps.seances as { date: string; ressenti: string; bonus: boolean }[];
    expect(seances.map((s) => s.date)).toEqual(["2026-08-12", "2026-08-11", "2026-08-10"]);
    // Le modèle stocke une échelle 1-5 ; l'app reçoit le ressenti qu'elle propose.
    expect(seances[0].ressenti).toBe("facile");
    expect(seances[0].bonus).toBe(true);
    expect(corps.suivant).toBeNull();
  });

  it("pagine par curseur, sans jamais sauter ni répéter une séance", async () => {
    const user = await creerUtilisateur();
    await garnir(user.id, 5);

    const page1 = await historique(user.id, "limite=2");
    const seances1 = page1.corps.seances as { id: string }[];
    expect(seances1).toHaveLength(2);
    expect(page1.corps.suivant).toBe(seances1[1].id);

    const page2 = await historique(user.id, `limite=2&avant=${page1.corps.suivant}`);
    const seances2 = page2.corps.seances as { id: string }[];
    expect(seances2).toHaveLength(2);

    const page3 = await historique(user.id, `limite=2&avant=${page2.corps.suivant}`);
    const seances3 = page3.corps.seances as { id: string }[];
    expect(seances3).toHaveLength(1);
    // Fin de l'historique : plus de curseur.
    expect(page3.corps.suivant).toBeNull();

    const tous = [...seances1, ...seances2, ...seances3].map((s) => s.id);
    expect(new Set(tous).size).toBe(5);
  });

  it("départage deux séances du même jour", async () => {
    // La planifiée et la bonus tombent à la même date : un curseur sur la
    // seule date en perdrait une.
    const user = await creerUtilisateur();
    for (const groupe of ["dos", "pectoraux", "jambes"]) {
      await prisma.workoutLog.create({
        data: { userId: user.id, date: jourUTC(), muscleGroup: groupe, lpEarned: 8, exercises: [] },
      });
    }

    const page1 = await historique(user.id, "limite=2");
    const page2 = await historique(user.id, `limite=2&avant=${page1.corps.suivant}`);

    const ids = [
      ...(page1.corps.seances as { id: string }[]),
      ...(page2.corps.seances as { id: string }[]),
    ].map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("refuse un curseur qui n'est pas une séance de l'appelant", async () => {
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    const [seanceDeB] = await garnir(b.id, 1);

    const { statut, corps } = await historique(a.id, `avant=${seanceDeB}`);

    // Même réponse qu'un identifiant inexistant : l'API ne confirme pas que
    // la séance d'un autre compte existe.
    expect(statut).toBe(400);
    expect(corps.code).toBe("curseur_invalide");
    expect((await historique(a.id, "avant=inexistant")).corps.code).toBe("curseur_invalide");
  });

  it("ne rend que les séances du porteur du jeton", async () => {
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    await garnir(a.id, 2);
    const idsDeB = await garnir(b.id, 3);

    const { corps } = await historique(a.id);

    const seances = corps.seances as { id: string }[];
    expect(seances).toHaveLength(2);
    expect(seances.some((s) => idsDeB.includes(s.id))).toBe(false);
  });

  it("refuse une limite hors bornes", async () => {
    const user = await creerUtilisateur();

    expect((await historique(user.id, "limite=0")).statut).toBe(400);
    expect((await historique(user.id, "limite=500")).statut).toBe(400);
    expect((await historique(user.id, "limite=beaucoup")).statut).toBe(400);
  });

  it("rend une liste vide, jamais une erreur, quand rien n'a été validé", async () => {
    const user = await creerUtilisateur();

    const { statut, corps } = await historique(user.id);

    expect(statut).toBe(200);
    expect(corps.seances).toEqual([]);
    expect(corps.suivant).toBeNull();
  });
});
