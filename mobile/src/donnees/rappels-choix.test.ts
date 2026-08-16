import { describe, expect, it } from "vitest";
import { rappelsAPoser, type LignePlan } from "./rappels-choix";

/**
 * Rappels de séance : lesquels poser, et lequel dire.
 *
 * Trois défauts s'y sont succédé sans que rien ne les attrape, et aucun ne
 * lève d'exception : ils se découvrent le soir, sur le téléphone de quelqu'un
 * qui a déjà fait sa séance.
 */

const ligne = (date: string, groupe: string, statut: string): LignePlan => ({
  date,
  groupe,
  statut,
});

/** Jeudi 18 h. Toutes les dates du fichier tournent autour de ce repère. */
const midi = new Date(2026, 7, 13, 12, 0, 0).getTime();

const poser = (jours: LignePlan[], maintenant = midi) =>
  rappelsAPoser(jours, {
    heure: 18,
    aujourdhui: "2026-08-13",
    maintenant,
    maximum: 20,
  });

describe("ce qui mérite un rappel", () => {
  it("pose un rappel pour une séance prévue à venir", () => {
    const poses = poser([ligne("2026-08-13", "bras", "PREVU")]);
    expect(poses).toHaveLength(1);
    expect(poses[0]!.genre).toBe("rappel");
  });

  it("félicite quand la journée est déjà bouclée", () => {
    // Le cas rapporté : séance faite à 16 h, rappel réglé à 18 h. Le téléphone
    // réclamait quand même.
    const poses = poser([ligne("2026-08-13", "bras", "FAIT")]);
    expect(poses).toHaveLength(1);
    expect(poses[0]!.genre).toBe("felicitations");
  });

  it("ne dit rien d'une journée manquée", () => {
    // La spec interdit de culpabiliser : la sanction est l'absence de gain.
    expect(poser([ligne("2026-08-13", "bras", "MANQUE")])).toHaveLength(0);
  });

  it("ignore les jours de repos", () => {
    expect(poser([ligne("2026-08-13", "repos", "REPOS")])).toHaveLength(0);
  });
});

describe("une journée, deux groupes", () => {
  it("ne pose qu'une notification, pas une par groupe", () => {
    // Le plan rend une ligne par groupe. Sans regroupement, deux notifications
    // identiques partaient au même instant.
    const poses = poser([
      ligne("2026-08-13", "bras", "PREVU"),
      ligne("2026-08-13", "abdos", "PREVU"),
    ]);
    expect(poses).toHaveLength(1);
  });

  it("rappelle encore si un seul des deux groupes est fait", () => {
    // Bras validés, abdos non : la journée n'est pas finie, et féliciter
    // reviendrait à dire que le travail est terminé alors qu'il en reste.
    const poses = poser([
      ligne("2026-08-13", "bras", "FAIT"),
      ligne("2026-08-13", "abdos", "PREVU"),
    ]);
    expect(poses).toHaveLength(1);
    expect(poses[0]!.genre).toBe("rappel");
  });

  it("félicite quand les deux sont faits", () => {
    const poses = poser([
      ligne("2026-08-13", "bras", "FAIT"),
      ligne("2026-08-13", "abdos", "FAIT"),
    ]);
    expect(poses).toHaveLength(1);
    expect(poses[0]!.genre).toBe("felicitations");
  });
});

describe("bornes de temps", () => {
  it("ne programme rien dont l'heure est passée", () => {
    // 19 h : les 18 h du jour sont derrière nous. Programmer ferait sonner le
    // téléphone immédiatement.
    const soir = new Date(2026, 7, 13, 19, 0, 0).getTime();
    expect(poser([ligne("2026-08-13", "bras", "PREVU")], soir)).toHaveLength(0);
  });

  it("laisse le passé tranquille", () => {
    expect(poser([ligne("2026-08-12", "bras", "PREVU")])).toHaveLength(0);
  });

  it("garde les jours à venir, dans l'ordre", () => {
    const poses = poser([
      ligne("2026-08-15", "dos", "PREVU"),
      ligne("2026-08-14", "bras", "PREVU"),
    ]);
    expect(poses.map((p) => p.date)).toEqual(["2026-08-14", "2026-08-15"]);
  });

  it("s'arrête au plafond, iOS n'acceptant que 64 notifications en attente", () => {
    const jours = Array.from({ length: 40 }, (_, i) =>
      ligne(`2026-09-${String(i + 1).padStart(2, "0")}`, "bras", "PREVU"),
    );
    expect(poser(jours)).toHaveLength(20);
  });

  it("calcule l'heure en local, non en UTC", () => {
    const [poses] = poser([ligne("2026-08-14", "bras", "PREVU")]);
    // 18 h du fuseau de l'appareil : un `new Date("…T18:00:00Z")` désignerait
    // 20 h en France.
    expect(poses!.quand.getHours()).toBe(18);
    expect(poses!.quand.getDate()).toBe(14);
  });
});
