import { describe, expect, it } from "vitest";
import { decalagePropose, RESSENTI_DEPUIS_VALEUR, VALEUR_RESSENTI } from "./difficulte";
import { genererSeance, niveauEffectif } from "./engine/workout";
import type { ExerciceDisponible, ProfilEntrainement } from "./engine";
import { EXERCISES } from "@/prisma/exercises";

const CATALOGUE: ExerciceDisponible[] = EXERCISES.map((e, i) => ({ ...e, id: `exo-${i}` }));

const profil = (offset: number, level: ProfilEntrainement["level"] = "DEBUTANT"): ProfilEntrainement => ({
  level,
  goal: "HYPERTROPHIE",
  daysPerWeek: 3,
  equipments: [],
  muscleGroups: [{ id: "pectoraux", priority: 1, levelOffset: offset }],
});

describe("decalagePropose", () => {
  it("propose de monter après une séance facile", () => {
    expect(decalagePropose("facile", 0)?.delta).toBe(1);
  });

  it("propose de descendre après une séance trop dure", () => {
    expect(decalagePropose("difficile", 0)?.delta).toBe(-1);
  });

  it("ne propose rien quand le ressenti est juste", () => {
    expect(decalagePropose("juste", 0)).toBeNull();
    expect(decalagePropose("juste", 1)).toBeNull();
  });

  it("ne dépasse jamais les bornes", () => {
    // Sauter deux paliers de variantes d'un coup est le meilleur moyen de se
    // blesser : un seul cran, et pas au-delà.
    expect(decalagePropose("facile", 1)).toBeNull();
    expect(decalagePropose("difficile", -1)).toBeNull();
  });
});

describe("ressenti stocké", () => {
  it("fait l'aller-retour avec la valeur en base", () => {
    for (const r of ["facile", "juste", "difficile"] as const) {
      expect(RESSENTI_DEPUIS_VALEUR(VALEUR_RESSENTI[r])).toBe(r);
    }
    expect(RESSENTI_DEPUIS_VALEUR(null)).toBeNull();
  });
});

describe("niveauEffectif", () => {
  it("ajoute le décalage au niveau déclaré", () => {
    expect(niveauEffectif(profil(0), "pectoraux")).toBe(0);
    expect(niveauEffectif(profil(1), "pectoraux")).toBe(1);
    expect(niveauEffectif(profil(-1, "INTERMEDIAIRE"), "pectoraux")).toBe(0);
  });

  it("reste dans les bornes des niveaux existants", () => {
    expect(niveauEffectif(profil(-1), "pectoraux")).toBe(0);
    expect(niveauEffectif(profil(1, "AVANCE"), "pectoraux")).toBe(2);
  });

  it("ignore le décalage d'un groupe hors préférences", () => {
    // Cas d'une séance bonus sur un groupe non sélectionné.
    expect(niveauEffectif(profil(1), "jambes")).toBe(0);
  });
});

describe("effet sur la séance générée", () => {
  it("débloque des variantes plus dures quand le décalage monte", () => {
    const ordre = { DEBUTANT: 0, INTERMEDIAIRE: 1, AVANCE: 2 };
    const niveauMax = (p: ProfilEntrainement) =>
      Math.max(
        ...genererSeance(p, "pectoraux", CATALOGUE).exercices.map(
          (e) => ordre[CATALOGUE.find((c) => c.id === e.exerciceId)!.level],
        ),
      );

    expect(niveauMax(profil(0))).toBe(0);
    expect(niveauMax(profil(1))).toBe(1);
  });

  it("ne change rien sur un groupe sans décalage", () => {
    const a = genererSeance(profil(0), "pectoraux", CATALOGUE).exercices.map((e) => e.nom);
    const b = genererSeance(
      { ...profil(0), muscleGroups: [{ id: "pectoraux", priority: 1 }] },
      "pectoraux",
      CATALOGUE,
    ).exercices.map((e) => e.nom);
    expect(a).toEqual(b);
  });
});
