import { describe, expect, it } from "vitest";
import { genererSeance } from "./workout";
import { PRESCRIPTIONS, VOLUME_SEANCE } from "./prescription";
import type { ExerciceDisponible, ProfilEntrainement } from "./types";
import { EXERCISES } from "@/prisma/exercises";
import { MUSCLE_GROUPS, parseEquipment, type Goal, type Level } from "@/lib/referentiel";

// On teste contre le vrai catalogue : une séance qui marche sur des exercices
// inventés ne prouve rien sur celui que l'app sert réellement.
const CATALOGUE: ExerciceDisponible[] = EXERCISES.map((e, i) => ({ ...e, id: `exo-${i}` }));

const profil = (over: Partial<ProfilEntrainement> = {}): ProfilEntrainement => ({
  level: "DEBUTANT",
  goal: "HYPERTROPHIE",
  daysPerWeek: 4,
  equipments: [],
  muscleGroups: [],
  ...over,
});

const GROUPES = MUSCLE_GROUPS.map((g) => g.id);
const NIVEAUX: Level[] = ["DEBUTANT", "INTERMEDIAIRE", "AVANCE"];
const OBJECTIFS: Goal[] = ["HYPERTROPHIE", "FORCE", "ENDURANCE", "PERTE_DE_POIDS"];

describe("genererSeance — matériel", () => {
  it("ne propose que du poids de corps à qui n'a rien", () => {
    for (const groupe of GROUPES) {
      const seance = genererSeance(profil(), groupe, CATALOGUE);
      for (const exo of seance.exercices) {
        const source = CATALOGUE.find((c) => c.id === exo.exerciceId)!;
        expect(source.equipment, `${exo.nom} exige du matériel`).toBe("aucun");
      }
    }
  });

  it("remplit une séance complète pour chaque groupe sans aucun matériel", () => {
    for (const groupe of GROUPES) {
      const seance = genererSeance(profil(), groupe, CATALOGUE);
      expect(seance.exercices.length, `groupe ${groupe}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("n'utilise que le matériel possédé", () => {
    const equipments = ["halteres", "banc"];
    for (const groupe of GROUPES) {
      const seance = genererSeance(profil({ equipments }), groupe, CATALOGUE);
      for (const exo of seance.exercices) {
        const source = CATALOGUE.find((c) => c.id === exo.exerciceId)!;
        for (const slug of parseEquipment(source.equipment)) {
          expect(equipments, `${exo.nom} exige ${slug}`).toContain(slug);
        }
      }
    }
  });

  it("fait apparaître le développé couché haltères avec « haltères + banc »", () => {
    // Critère d'acceptation explicite de la spec.
    const noms = new Set<string>();
    for (let graine = 0; graine < 12; graine++) {
      const seance = genererSeance(
        profil({ equipments: ["halteres", "banc"] }),
        "pectoraux",
        CATALOGUE,
        graine,
      );
      seance.exercices.forEach((e) => noms.add(e.nom));
    }
    expect([...noms].some((n) => /développé couché haltères/i.test(n))).toBe(true);
  });
});

describe("genererSeance — niveau", () => {
  it("ne dépasse jamais le niveau de l'utilisateur", () => {
    const ordre = { DEBUTANT: 0, INTERMEDIAIRE: 1, AVANCE: 2 };
    for (const level of NIVEAUX) {
      for (const groupe of GROUPES) {
        const seance = genererSeance(profil({ level }), groupe, CATALOGUE);
        for (const exo of seance.exercices) {
          const source = CATALOGUE.find((c) => c.id === exo.exerciceId)!;
          expect(ordre[source.level], `${exo.nom} pour un ${level}`).toBeLessThanOrEqual(
            ordre[level],
          );
        }
      }
    }
  });

  it("inclut au moins un exercice au niveau exact de l'utilisateur", () => {
    for (const level of NIVEAUX) {
      for (const groupe of GROUPES) {
        const seance = genererSeance(profil({ level }), groupe, CATALOGUE);
        const sources = seance.exercices.map(
          (e) => CATALOGUE.find((c) => c.id === e.exerciceId)!,
        );
        expect(
          sources.some((s) => s.level === level),
          `aucun exercice ${level} dans la séance ${groupe}`,
        ).toBe(true);
      }
    }
  });
});

describe("genererSeance — structure", () => {
  it("compte 4 à 6 exercices", () => {
    for (const groupe of GROUPES) {
      for (const level of NIVEAUX) {
        const seance = genererSeance(profil({ level }), groupe, CATALOGUE);
        expect(seance.exercices.length).toBeGreaterThanOrEqual(4);
        expect(seance.exercices.length).toBeLessThanOrEqual(6);
      }
    }
  });

  it("place les polyarticulaires avant l'isolation", () => {
    for (const groupe of GROUPES) {
      const seance = genererSeance(profil(), groupe, CATALOGUE);
      const rang = { POLYARTICULAIRE: 0, ISOLATION: 1, CARDIO: 2 };
      const rangs = seance.exercices.map((e) => rang[e.type]);
      expect(rangs).toEqual([...rangs].sort((a, b) => a - b));
    }
  });

  it("commence par un échauffement citant le premier mouvement", () => {
    const seance = genererSeance(profil(), "pectoraux", CATALOGUE);
    expect(seance.echauffement).toHaveLength(2);
    expect(seance.echauffement[1]).toContain(seance.exercices[0].nom);
  });

  it("évite d'empiler plusieurs maillons d'une même chaîne de progression", () => {
    // Reconstruit les chaînes comme le moteur, pour vérifier qu'une séance ne
    // sert pas « pompes genoux + pompes inclinées + pompes classiques ».
    const parNom = new Map(CATALOGUE.map((e) => [e.name, e]));
    const racine = (nom: string): string => {
      const vus = new Set<string>();
      let courant = nom;
      while (!vus.has(courant)) {
        vus.add(courant);
        const suivant = parNom.get(courant)?.progression;
        if (!suivant || !parNom.has(suivant)) return courant;
        courant = suivant;
      }
      return courant;
    };

    // Sur les sept groupes, au poids de corps et à tous les niveaux : le
    // catalogue doit toujours offrir assez de familles distinctes pour
    // remplir une séance sans se répéter.
    for (const groupe of GROUPES) {
      for (const level of NIVEAUX) {
        for (let graine = 0; graine < 4; graine++) {
          const seance = genererSeance(profil({ level }), groupe, CATALOGUE, graine);
          const chaines = seance.exercices.map((e) => racine(e.nom));
          expect(
            new Set(chaines).size,
            `${groupe} / ${level} / graine ${graine} : ${seance.exercices.map((e) => e.nom).join(", ")}`,
          ).toBe(chaines.length);
        }
      }
    }
  });

  it("sert le maillon le plus dur que l'utilisateur assume, pas une régression", () => {
    // Un intermédiaire ne doit pas recevoir « pompes sur les genoux » alors
    // que « pompes classiques » est à sa portée.
    const seance = genererSeance(profil({ level: "INTERMEDIAIRE" }), "pectoraux", CATALOGUE);
    const noms = seance.exercices.map((e) => e.nom);
    if (noms.includes("Pompes déclinées") || noms.includes("Pompes en déficit")) {
      expect(noms).not.toContain("Pompes sur les genoux");
      expect(noms).not.toContain("Pompes contre un mur");
    }
  });

  it("varie la sélection d'une semaine à l'autre", () => {
    const s0 = genererSeance(profil(), "jambes", CATALOGUE, 0).exercices.map((e) => e.nom);
    const s1 = genererSeance(profil(), "jambes", CATALOGUE, 1).exercices.map((e) => e.nom);
    expect(s0).not.toEqual(s1);
  });

  it("rend une séance vide plutôt que de planter sur un groupe inconnu", () => {
    const seance = genererSeance(profil(), "inexistant", CATALOGUE);
    expect(seance.exercices).toEqual([]);
    expect(seance.seriesTotal).toBe(0);
  });
});

describe("genererSeance — prescription", () => {
  it("respecte les fourchettes de reps et de repos de chaque objectif", () => {
    for (const goal of OBJECTIFS) {
      const p = PRESCRIPTIONS[goal];
      for (const groupe of GROUPES.filter((g) => g !== "cardio")) {
        const seance = genererSeance(profil({ goal }), groupe, CATALOGUE);
        for (const exo of seance.exercices) {
          expect(exo.reps, `${exo.nom} sans fourchette de reps`).toEqual(p.reps);
          expect(exo.restSec).toBe(
            exo.type === "POLYARTICULAIRE" ? p.restPolyarticulaire : p.restIsolation,
          );
          expect(exo.series).toBeGreaterThanOrEqual(p.series[0]);
          expect(exo.series).toBeLessThanOrEqual(p.series[1]);
        }
      }
    }
  });

  it("tient le volume de 10 à 16 séries de travail", () => {
    for (const goal of OBJECTIFS) {
      for (const groupe of GROUPES.filter((g) => g !== "cardio")) {
        const seance = genererSeance(profil({ goal }), groupe, CATALOGUE);
        expect(seance.seriesTotal, `${goal} / ${groupe}`).toBeGreaterThanOrEqual(
          VOLUME_SEANCE.min,
        );
        expect(seance.seriesTotal, `${goal} / ${groupe}`).toBeLessThanOrEqual(VOLUME_SEANCE.max);
      }
    }
  });

  it("prescrit le cardio en durée, pas en répétitions", () => {
    for (const goal of OBJECTIFS) {
      const seance = genererSeance(profil({ goal }), "cardio", CATALOGUE);
      expect(seance.exercices.length).toBeGreaterThan(0);
      for (const exo of seance.exercices) {
        expect(exo.duree, `${exo.nom} sans consigne de durée`).toBeTruthy();
        expect(exo.reps).toBeUndefined();
      }
    }
  });

  it("reporte la variante de progression de chaque exercice", () => {
    const seance = genererSeance(profil(), "pectoraux", CATALOGUE);
    for (const exo of seance.exercices) {
      const source = CATALOGUE.find((c) => c.id === exo.exerciceId)!;
      expect(exo.progression).toBe(source.progression);
    }
  });
});
