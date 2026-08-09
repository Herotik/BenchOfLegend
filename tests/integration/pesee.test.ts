import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { enregistrerPesee } from "@/app/actions/pesee";
import { jourUTC } from "@/lib/dates";
import { BAREME } from "@/lib/lp";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

const MERCREDI = new Date(2026, 7, 12, 8, 30, 0);
const MERCREDI_SOIR = new Date(2026, 7, 12, 21, 45, 0);
const JEUDI = new Date(2026, 7, 13, 8, 30, 0);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => vi.setSystemTime(MERCREDI));
afterAll(() => vi.useRealTimers());
afterEach(nettoyerBase);

describe("enregistrerPesee", () => {
  it("crédite 2 LP à la première pesée du jour", async () => {
    const user = await creerUtilisateur({ lp: 10 });

    const resultat = await enregistrerPesee(78.4);

    expect(resultat).toMatchObject({ lpGagnes: BAREME.pesee });
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(12);

    const pesees = await prisma.weighIn.findMany({ where: { userId: user.id } });
    expect(pesees).toHaveLength(1);
    expect(pesees[0].kg).toBe(78.4);
    expect(pesees[0].date).toEqual(jourUTC());
  });

  it("corrige le poids du jour sans recréditer de LP", async () => {
    // Se peser deux fois pour ajuster la valeur ne doit pas payer double :
    // les LP récompensent le suivi, pas le nombre d'allers-retours.
    const user = await creerUtilisateur({ lp: 0 });
    await enregistrerPesee(78.4);

    vi.setSystemTime(MERCREDI_SOIR);
    const resultat = await enregistrerPesee(77.9);

    expect(resultat).toMatchObject({ lpGagnes: 0, promoted: false });
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(BAREME.pesee);

    const pesees = await prisma.weighIn.findMany({ where: { userId: user.id } });
    expect(pesees).toHaveLength(1);
    expect(pesees[0].kg).toBe(77.9);
  });

  it("crédite à nouveau le lendemain", async () => {
    // Le plafond porte sur la journée, pas sur la vie du compte.
    const user = await creerUtilisateur({ lp: 0 });
    await enregistrerPesee(78.4);

    vi.setSystemTime(JEUDI);
    const resultat = await enregistrerPesee(78.1);

    expect(resultat).toMatchObject({ lpGagnes: BAREME.pesee });
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(2 * BAREME.pesee);
    expect(await prisma.weighIn.count({ where: { userId: user.id } })).toBe(2);
  });

  it("annonce la promotion quand les 2 LP font changer de division", async () => {
    await creerUtilisateur({ lp: 99 });

    const resultat = await enregistrerPesee(70);

    expect(resultat).toMatchObject({ promoted: true, newRank: "Hoplite III" });
  });

  it("refuse un poids aberrant", async () => {
    const user = await creerUtilisateur({ lp: 5 });

    expect(await enregistrerPesee(500)).toEqual({ erreur: "Poids invalide" });
    expect(await enregistrerPesee(12)).toEqual({ erreur: "Poids invalide" });

    expect(await prisma.weighIn.count()).toBe(0);
    const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(apres.lp).toBe(5);
  });
});
