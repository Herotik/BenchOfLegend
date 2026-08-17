import { describe, expect, it } from "vitest";
import { derniereSeance, genererPlanSemaine, repartirJours } from "./plan";
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

        // Du mardi au dimanche : la veille du lundi n'est pas le dimanche de
        // cette semaine-là — six jours plus tôt — mais celui de la semaine
        // précédente, que `genererPlanSemaine` reçoit à part. Voir le bloc
        // « continuité d'une semaine à l'autre ».
        for (let i = 1; i < 7; i++) {
          const veille = plan[i - 1].groupes;
          for (const g of plan[i].groupes) {
            expect(
              veille.includes(g),
              `${g} enchaîné les jours ${i - 1} et ${i} (jours=${jours}, semaine=${semaine})`,
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

  it("travaille tous les groupes choisis quand la place le permet", () => {
    // Six groupes, trois jours : la capacité est de six créneaux, tout doit
    // tenir. Personne ne doit rester sur le banc une semaine entière.
    const plan = genererPlanSemaine(
      profil({
        daysPerWeek: 3,
        muscleGroups: (
          ["pectoraux", "dos", "epaules", "bras", "jambes", "abdos"] as MuscleGroupId[]
        ).map((id) => ({ id, priority: 1 })),
      }),
    );
    const vus = new Set(plan.flatMap((j) => j.groupes));
    expect(vus.size).toBe(6);
  });

  it("apparie les groupes qui vont ensemble plutôt qu'au hasard", () => {
    // Pectoraux et épaules sollicitent tous deux le deltoïde antérieur : entre
    // ce voisin-là et le dos, l'appariement doit préférer le dos.
    const plan = genererPlanSemaine(
      profil({
        daysPerWeek: 2,
        muscleGroups: [
          { id: "pectoraux", priority: 2 },
          { id: "epaules", priority: 1 },
          { id: "dos", priority: 1 },
        ],
      }),
    );
    const journee = plan.find((j) => j.groupes.includes("pectoraux"));
    expect(journee?.groupes).toContain("dos");
    expect(journee?.groupes).not.toContain("epaules");
  });
});

describe("continuité d'une semaine à l'autre", () => {
  const tousGroupes: MuscleGroupId[] = [
    "pectoraux",
    "dos",
    "epaules",
    "bras",
    "jambes",
    "abdos",
  ];

  const enchainees = (daysPerWeek: number, semaine: number) => {
    const p = profil({
      daysPerWeek,
      muscleGroups: tousGroupes.map((id) => ({ id, priority: 1 })),
    });
    const a = genererPlanSemaine(p, semaine);
    return { a, b: genererPlanSemaine(p, semaine + 1, a) };
  };

  it("ne colle pas le dimanche d'une semaine au lundi de la suivante", () => {
    // Deux jours calendaires consécutifs : c'est la règle des 48 h, franchement
    // violée. Chaque semaine étant engendrée en aveugle, cela arrivait vingt
    // fois sur cent enchaînements.
    for (let jours = 2; jours <= 6; jours++) {
      for (let semaine = 0; semaine < 20; semaine++) {
        const { a, b } = enchainees(jours, semaine);
        for (const g of b[0]!.groupes) {
          expect(
            a[6]!.groupes.includes(g),
            `${g} dimanche puis lundi (jours=${jours}, semaine=${semaine})`,
          ).toBe(false);
        }
      }
    }
  });

  it("n'enchaîne pas deux séances consécutives sur le même groupe", () => {
    // Samedi puis lundi : le dimanche de repos ne suffit pas à en faire deux
    // séances distinctes du point de vue de qui s'entraîne.
    for (let jours = 2; jours <= 6; jours++) {
      for (let semaine = 0; semaine < 20; semaine++) {
        const { a, b } = enchainees(jours, semaine);
        const derniere = derniereSeance(a);
        for (const g of b[0]!.groupes) {
          expect(
            derniere.includes(g),
            `${g} en fin de semaine puis lundi (jours=${jours}, semaine=${semaine})`,
          ).toBe(false);
        }
      }
    }
  });

  it("laisse le cardio enjamber le dimanche", () => {
    // Il ne réclame pas les mêmes 48 h : le lui interdire appauvrirait le plan
    // sans rien protéger.
    const p = profil({ daysPerWeek: 4, muscleGroups: [{ id: "cardio", priority: 1 }] });
    const a = genererPlanSemaine(p, 0);
    const b = genererPlanSemaine(p, 1, a);
    expect(b.filter((j) => j.groupes.length > 0).length).toBeGreaterThan(0);
  });

  it("préfère répéter un groupe plutôt que supprimer une séance", () => {
    // Profil à un seul groupe : la semaine passée s'est forcément terminée
    // dessus, et l'interdire viderait le lundi. Un jour d'entraînement changé
    // en repos serait une régression plus visible qu'une répétition.
    const p = profil({ daysPerWeek: 4, muscleGroups: [{ id: "bras", priority: 1 }] });
    const a = genererPlanSemaine(p, 0);
    const b = genererPlanSemaine(p, 1, a);
    expect(b[0]!.groupes).toEqual(["bras"]);
  });

  it("sans semaine précédente, engendre comme avant", () => {
    const p = profil();
    expect(genererPlanSemaine(p, 3)).toEqual(genererPlanSemaine(p, 3, undefined));
  });
});

describe("derniereSeance", () => {
  it("remonte au-delà d'un dimanche de repos", () => {
    const plan = genererPlanSemaine(
      profil({ daysPerWeek: 3, muscleGroups: [{ id: "bras", priority: 1 }] }),
      0,
    );
    // 3 séances/semaine : lundi, jeudi, samedi. Le dimanche est creux, la
    // dernière séance est donc ailleurs.
    expect(plan[6]!.groupes).toEqual([]);
    expect(derniereSeance(plan).length).toBeGreaterThan(0);
  });

  it("rend une liste vide quand rien n'est travaillé", () => {
    expect(derniereSeance(genererPlanSemaine(profil({ muscleGroups: [] })))).toEqual([]);
  });
});
