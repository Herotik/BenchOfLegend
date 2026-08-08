import { describe, expect, it } from "vitest";
import { BAREME, calculerLp, ratioComplete, type EntreeLp } from "./lp";

const base = (over: Partial<EntreeLp> = {}): EntreeLp => ({
  ratioComplete: 1,
  isBonus: false,
  finisherComplete: false,
  seancesSur7Jours: 0,
  bonusDejaCompteAujourdhui: false,
  ...over,
});

describe("calculerLp", () => {
  it("accorde 20 LP à une séance complète", () => {
    expect(calculerLp(base()).total).toBe(BAREME.seanceComplete);
  });

  it("accorde 20 LP dès 80 % des exercices cochés", () => {
    expect(calculerLp(base({ ratioComplete: 0.8 })).total).toBe(BAREME.seanceComplete);
  });

  it("accorde 12 LP entre 50 et 79 %", () => {
    expect(calculerLp(base({ ratioComplete: 0.5 })).total).toBe(BAREME.seancePartielle);
    expect(calculerLp(base({ ratioComplete: 0.79 })).total).toBe(BAREME.seancePartielle);
  });

  it("n'accorde rien sous 50 %", () => {
    expect(calculerLp(base({ ratioComplete: 0.49 })).total).toBe(0);
    expect(calculerLp(base({ ratioComplete: 0 })).total).toBe(0);
  });

  it("ne cumule ni finisher ni régularité sur une séance sous le seuil", () => {
    // Sinon cocher un seul exercice et son finisher rapporterait des LP.
    const r = calculerLp(base({ ratioComplete: 0.2, finisherComplete: true, seancesSur7Jours: 5 }));
    expect(r.total).toBe(0);
    expect(r.details).toHaveLength(0);
  });

  it("ajoute le finisher à une séance validée", () => {
    expect(calculerLp(base({ finisherComplete: true })).total).toBe(
      BAREME.seanceComplete + BAREME.finisher,
    );
  });

  it("paie la régularité à partir de la 3e séance sur 7 jours glissants", () => {
    expect(calculerLp(base({ seancesSur7Jours: 1 })).total).toBe(BAREME.seanceComplete);
    expect(calculerLp(base({ seancesSur7Jours: 2 })).total).toBe(
      BAREME.seanceComplete + BAREME.regularite,
    );
  });

  it("accorde 8 LP à une séance bonus", () => {
    expect(calculerLp(base({ isBonus: true })).total).toBe(BAREME.seanceBonus);
  });

  it("plafonne les bonus à un par jour", () => {
    const r = calculerLp(base({ isBonus: true, bonusDejaCompteAujourdhui: true }));
    expect(r.total).toBe(0);
  });

  it("ne rend jamais de total négatif", () => {
    for (const ratio of [-1, 0, 0.3, 0.5, 0.8, 1, 2]) {
      expect(calculerLp(base({ ratioComplete: ratio })).total).toBeGreaterThanOrEqual(0);
    }
  });

  it("détaille les LP pour pouvoir les afficher", () => {
    const r = calculerLp(base({ finisherComplete: true, seancesSur7Jours: 3 }));
    expect(r.details.map((d) => d.libelle)).toEqual([
      "Séance du jour validée",
      "Finisher complété",
      "Régularité",
    ]);
    expect(r.total).toBe(r.details.reduce((s, d) => s + d.lp, 0));
  });
});

describe("ratioComplete", () => {
  it("compte la part d'exercices cochés", () => {
    expect(ratioComplete([{ done: true }, { done: false }])).toBe(0.5);
    expect(ratioComplete([{ done: true }, { done: true }])).toBe(1);
  });

  it("rend 0 sur une séance vide plutôt que NaN", () => {
    expect(ratioComplete([])).toBe(0);
  });
});
