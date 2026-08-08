import { describe, expect, it } from "vitest";
import { genererPlanSemaine, repartirJours } from "./plan";
import type { ProfilEntrainement } from "./types";
import type { MuscleGroupId } from "@/lib/referentiel";

const profil = (over: Partial<ProfilEntrainement> = {}): ProfilEntrainement => ({
  level: "DEBUTANT",
  goal: "HYPERTROPHIE",
  daysPerWeek: 4,
  equipments: [],
  muscleGroups: [
    { id: "pectoraux", priority: 1 },
    { id: "dos", priority: 1 },
    { id: "jambes", priority: 1 },
  ],
  ...over,
});

describe("repartirJours", () => {
  it("rend exactement le nombre de jours demandé", () => {
    for (let n = 2; n <= 6; n++) {
      expect(repartirJours(n)).toHaveLength(n);
    }
  });

  it("borne les valeurs hors de 2-6", () => {
    expect(repartirJours(0)).toHaveLength(2);
    expect(repartirJours(9)).toHaveLength(6);
  });

  it("étale les séances au lieu de les empiler en début de semaine", () => {
    // La spec interdit « 4 séances d'affilée puis 3 jours off ».
    for (let n = 2; n <= 5; n++) {
      const jours = repartirJours(n);
      let consecutifs = 1;
      let maxConsecutifs = 1;
      for (let i = 1; i < jours.length; i++) {
        consecutifs = jours[i] === jours[i - 1] + 1 ? consecutifs + 1 : 1;
        maxConsecutifs = Math.max(maxConsecutifs, consecutifs);
      }
      expect(maxConsecutifs).toBeLessThanOrEqual(3);
    }
  });

  it("place 4 séances un jour sur deux", () => {
    expect(repartirJours(4)).toEqual([0, 2, 4, 6]);
  });
});

describe("genererPlanSemaine", () => {
  it("n'entraîne que sur le nombre de jours demandé", () => {
    const plan = genererPlanSemaine(profil({ daysPerWeek: 3 }));
    const joursActifs = plan.filter((j) => j.groupes.length > 0);
    expect(joursActifs.length).toBeLessThanOrEqual(3);
  });

  it("rend toujours les sept jours, les jours creux étant du repos", () => {
    const plan = genererPlanSemaine(profil());
    expect(plan).toHaveLength(7);
    expect(plan.map((j) => j.jour)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("ne travaille jamais le même groupe deux jours consécutifs", () => {
    // Balayage large : toutes les combinaisons de jours et de semaines.
    const tousGroupes: MuscleGroupId[] = [
      "pectoraux",
      "dos",
      "epaules",
      "bras",
      "jambes",
      "abdos",
    ];

    for (let jours = 2; jours <= 6; jours++) {
      for (let semaine = 0; semaine < 8; semaine++) {
        const plan = genererPlanSemaine(
          profil({
            daysPerWeek: jours,
            muscleGroups: tousGroupes.map((id) => ({ id, priority: 1 })),
          }),
          semaine,
        );

        for (let i = 0; i < 7; i++) {
          const veille = plan[(i + 6) % 7].groupes;
          for (const g of plan[i].groupes) {
            expect(
              veille.includes(g),
              `${g} enchaîné les jours ${(i + 6) % 7} et ${i} (jours=${jours}, semaine=${semaine})`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("ne dépasse jamais deux fois le même groupe dans la semaine", () => {
    const plan = genererPlanSemaine(
      profil({
        daysPerWeek: 6,
        muscleGroups: [
          { id: "pectoraux", priority: 1 },
          { id: "dos", priority: 1 },
        ],
      }),
    );
    const compte = new Map<string, number>();
    for (const jour of plan) {
      for (const g of jour.groupes) compte.set(g, (compte.get(g) ?? 0) + 1);
    }
    for (const n of compte.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it("sert chaque groupe une fois avant d'en resservir un deuxième", () => {
    // 4 jours = 8 créneaux, 6 groupes : tout le monde doit passer.
    const groupes: MuscleGroupId[] = ["pectoraux", "dos", "epaules", "bras", "jambes", "abdos"];
    const plan = genererPlanSemaine(
      profil({ daysPerWeek: 4, muscleGroups: groupes.map((id) => ({ id, priority: 1 })) }),
    );
    const vus = new Set(plan.flatMap((j) => j.groupes));
    expect(vus.size).toBe(groupes.length);
  });

  it("fait tourner la couverture quand la capacité manque", () => {
    // 2 jours = 4 créneaux pour 6 groupes : deux groupes sautent leur tour.
    const groupes: MuscleGroupId[] = ["pectoraux", "dos", "epaules", "bras", "jambes", "abdos"];
    const p = profil({ daysPerWeek: 2, muscleGroups: groupes.map((id) => ({ id, priority: 1 })) });

    const s0 = new Set(genererPlanSemaine(p, 0).flatMap((j) => j.groupes));
    const s1 = new Set(genererPlanSemaine(p, 1).flatMap((j) => j.groupes));

    expect(s0.size).toBeLessThan(groupes.length);
    expect([...s1].some((g) => !s0.has(g))).toBe(true);
  });

  it("fait passer les points forts devant", () => {
    const plan = genererPlanSemaine(
      profil({
        daysPerWeek: 2,
        muscleGroups: [
          { id: "pectoraux", priority: 1 },
          { id: "dos", priority: 1 },
          { id: "epaules", priority: 1 },
          { id: "jambes", priority: 2 },
        ],
      }),
    );
    expect(plan.flatMap((j) => j.groupes)).toContain("jambes");
  });

  it("autorise le cardio deux jours de suite", () => {
    const plan = genererPlanSemaine(
      profil({ daysPerWeek: 6, muscleGroups: [{ id: "cardio", priority: 1 }] }),
    );
    expect(plan.flatMap((j) => j.groupes).filter((g) => g === "cardio").length).toBeGreaterThan(0);
  });

  it("rend une semaine vide si aucun groupe n'est choisi", () => {
    const plan = genererPlanSemaine(profil({ muscleGroups: [] }));
    expect(plan.every((j) => j.groupes.length === 0)).toBe(true);
  });
});
