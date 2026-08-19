// Les types Node ne sont pas chargés pour l'app — elle tourne sur un téléphone
// et n'a rien à faire du système de fichiers. Ce test, lui, s'exécute sous
// Node : on les fait venir ici seulement, plutôt que d'ouvrir `process` et
// `Buffer` à tout le code de l'app.
/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXERCISES } from "../../../prisma/exercises";
import { GESTE_PAR_EXERCICE, gesteDe } from "./gestes";
import { MOTIFS } from "./motifs";

/**
 * La table associe des **noms d'exercices** à des gestes, et rien ne relie les
 * deux à la compilation : le catalogue vit côté serveur, la table côté app.
 * Une faute de frappe ou un exercice renommé ferait donc disparaître une
 * démonstration en silence, sans erreur nulle part.
 *
 * D'où ces tests. Ils ne vérifient pas que l'association est *pertinente* — ça,
 * seul l'œil le dit — mais qu'elle est *branchée*.
 */

const ICI = dirname(fileURLToPath(import.meta.url));

/**
 * Planches déclarées, lues dans la **source**.
 *
 * `planches.ts` ne s'importe pas ici : il charge ses images par `require`, que
 * seul le bundler React Native sait résoudre. On lit donc le fichier, ce qui a
 * l'avantage de vérifier au passage que le nom de la planche et celui du
 * fichier coïncident — une divergence que `require` ne signalerait qu'au
 * moment de fabriquer l'app.
 */
function planchesDeclarees(): { slugs: Set<string>; fichiers: string[] } {
  const source = readFileSync(join(ICI, "planches.ts"), "utf8");
  const slugs = new Set<string>();
  const fichiers: string[] = [];

  for (const [, slug = "", fichier = ""] of source.matchAll(
    /^ {2}"?([\w-]+)"?: \{\n\s*source: require\("\.\.\/\.\.\/assets\/gestes\/([\w-]+)\.png"\)/gm,
  )) {
    expect(fichier, `la planche « ${slug} » pointe vers ${fichier}.png`).toBe(slug);
    slugs.add(slug);
    fichiers.push(join(ICI, "..", "..", "assets", "gestes", `${fichier}.png`));
  }
  return { slugs, fichiers };
}

describe("table des gestes", () => {
  it("ne vise que des exercices qui existent au catalogue", () => {
    const catalogue = new Set(EXERCISES.map((e) => e.name));
    const inconnus = Object.keys(GESTE_PAR_EXERCICE).filter((nom) => !catalogue.has(nom));
    expect(inconnus).toEqual([]);
  });

  it("ne vise que des gestes qui existent", () => {
    const { slugs } = planchesDeclarees();
    const orphelins = Object.entries(GESTE_PAR_EXERCICE)
      .filter(([, geste]) => !slugs.has(geste) && !(geste in MOTIFS))
      .map(([nom, geste]) => `${nom} → ${geste}`);
    expect(orphelins).toEqual([]);
  });

  it("ne déclare pas de planche dont l'image manque", () => {
    const { fichiers } = planchesDeclarees();
    expect(fichiers.length).toBeGreaterThan(0);
    expect(fichiers.filter((f) => !existsSync(f))).toEqual([]);
  });

  it("rend null pour un exercice sans geste, sans lever", () => {
    expect(gesteDe("Marche rapide sur tapis")).toBeNull();
    expect(gesteDe(null)).toBeNull();
    expect(gesteDe(undefined)).toBeNull();
    expect(gesteDe("")).toBeNull();
  });

  it("associe le même geste aux variantes qui ne diffèrent que par le matériel", () => {
    // C'est le principe de la table, et il mérite d'être ancré : le personnage
    // ferme le poing, ni barre ni haltère n'apparaît, donc rien ne distingue
    // les deux démonstrations.
    expect(gesteDe("Développé militaire haltères")).toBe(
      gesteDe("Développé militaire barre"),
    );
    expect(gesteDe("Curl biceps haltères")).toBe(gesteDe("Curl barre"));
  });
});
