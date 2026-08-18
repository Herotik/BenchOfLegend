import { describe, expect, it } from "vitest";
import { assiduiteDe, type JourPlanifie } from "./assiduite";

/**
 * L'assiduité décide de trois affichages — la tuile du tableau de bord, le
 * graphe des progrès, le classement de la phalange — et se lit comme un
 * jugement. Se tromper de sens y coûte plus cher qu'ailleurs.
 */

/** Jeudi. Les jours antérieurs sont écoulés, les postérieurs à venir. */
const AUJOURDHUI = new Date(Date.UTC(2026, 7, 13));
const jourDe = (decalage: number) => new Date(AUJOURDHUI.getTime() + decalage * 86_400_000);

const jour = (decalage: number, status: string): JourPlanifie => ({
  date: jourDe(decalage),
  status,
});

const mesure = (jours: JourPlanifie[]) => assiduiteDe(jours, AUJOURDHUI);

describe("la semaine qui commence", () => {
  it("part de 100 %, non de zéro", () => {
    // Lundi matin, quatre séances devant soi : rien n'a encore été manqué.
    // Le calcul rendait 0 %, la séance du jour comptant déjà pour ratée.
    const semaine = mesure([jour(0, "PREVU"), jour(1, "PREVU"), jour(2, "PREVU")]);
    expect(semaine.assiduite).toBe(100);
  });

  it("compte les séances à venir dans les prévues", () => {
    // La tuile annonce « 0/4 séances cette semaine » : ce qui reste à faire
    // fait partie de ce qui est prévu.
    const semaine = mesure([jour(0, "PREVU"), jour(1, "PREVU"), jour(2, "PREVU")]);
    expect(semaine).toMatchObject({ prevues: 3, faites: 0 });
  });

  it("ne juge pas la séance du jour tant qu'elle n'est pas passée", () => {
    // Lundi fait, mardi fait, aujourd'hui pas encore : ce n'est pas 66 %.
    const semaine = mesure([jour(-2, "FAIT"), jour(-1, "FAIT"), jour(0, "PREVU")]);
    expect(semaine.assiduite).toBe(100);
  });

  it("compte la séance du jour dès qu'elle est validée", () => {
    const semaine = mesure([jour(-1, "MANQUE"), jour(0, "FAIT")]);
    expect(semaine).toMatchObject({ faites: 1, assiduite: 50 });
  });
});

describe("ce qui fait vraiment perdre des points", () => {
  it("retire une part par journée écoulée sans séance", () => {
    // Lundi manqué, mardi fait : la journée d'hier est derrière nous, elle
    // compte. Celle d'aujourd'hui non.
    expect(mesure([jour(-2, "MANQUE"), jour(-1, "FAIT"), jour(0, "PREVU")]).assiduite).toBe(50);
  });

  it("tombe à 0 % quand rien n'a été fait de la semaine écoulée", () => {
    expect(mesure([jour(-3, "MANQUE"), jour(-2, "MANQUE")]).assiduite).toBe(0);
  });

  it("ne se laisse pas relever par une séance à venir", () => {
    // Deux jours manqués, deux encore à venir : c'est bien 0 % pour l'instant.
    const semaine = mesure([
      jour(-2, "MANQUE"),
      jour(-1, "MANQUE"),
      jour(1, "PREVU"),
      jour(2, "PREVU"),
    ]);
    expect(semaine).toMatchObject({ prevues: 4, faites: 0, assiduite: 0 });
  });

  it("juge une semaine entièrement passée sur la totalité de ses jours", () => {
    // Semaine révolue : plus rien n'attend son heure.
    expect(mesure([jour(-5, "FAIT"), jour(-4, "MANQUE"), jour(-3, "FAIT")]).assiduite).toBe(67);
  });
});

describe("les deux zéros", () => {
  it("rend null quand la semaine ne prévoit rien", () => {
    // L'absence de mesure n'est pas un zéro : rendre 0 % ferait passer pour
    // paresseux quelqu'un qui n'avait rien à faire.
    expect(mesure([]).assiduite).toBeNull();
  });

  it("distingue « rien de prévu » de « rien de fait »", () => {
    expect(mesure([]).assiduite).toBeNull();
    expect(mesure([jour(-1, "MANQUE")]).assiduite).toBe(0);
  });
});
