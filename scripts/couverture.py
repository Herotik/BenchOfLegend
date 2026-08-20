"""Quels exercices ont une démonstration 3D, et que manque-t-il pour les autres.

    python3 scripts/couverture.py [--manquants]

## Pourquoi un script plutôt qu'un décompte à la main

Parce que la réponse change à chaque planche livrée, et qu'un décompte fait à
la main vieillit en silence. Trois fichiers doivent concorder pour qu'un
exercice soit couvert — le catalogue le nomme, `gestes.ts` l'associe à un
geste, `planches.ts` dit si ce geste a un rendu — et c'est justement le genre
d'accord qu'on croit avoir sans l'avoir.

Le repli est voulu : un exercice sans planche tombe sur le bonhomme vectoriel,
qui est juste. « Manquant » veut donc dire « montré en dessin », jamais « sans
démonstration ».

## Ce que veulent dire les obstacles

Chaque geste encore à faire est rangé sous ce qui l'empêche, et la nuance
compte pour décider par quoi continuer :

- **rien** — faisable avec le moteur d'aujourd'hui. C'est là qu'il faut aller.
- **tronc** — le mouvement *est* le décollement du buste : relevé en V, pont
  fessier, crunch inversé. Les directions étant exprimées dans le repère du
  corps, la colonne garde l'inclinaison de l'assise d'un bout à l'autre du
  geste. Il y faudra une assise par pose clé.
- **suspension** — le corps pend à une barre. Rien ne le tient dans le moteur,
  qui pose toujours le personnage sur le sol.
- **agrès** — un tapis roulant, une corde. L'objet fait le mouvement autant que
  le corps, et il n'est pas modélisé.

Les **haltères et les élastiques ne sont pas des obstacles** : le personnage
ferme le poing et ne tient rien de toute façon. Les fentes haltères partagent
déjà la planche des fentes au poids du corps, et personne ne s'en plaint.
"""
import argparse
import collections
import os
import re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lire(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return f.read()


#: Ce qui empêche de rendre un geste, quand quelque chose l'empêche. Écrit à la
#: main faute de pouvoir se déduire : le catalogue dit le matériel, pas ce que
#: le moteur sait faire.
OBSTACLES = {
    "tronc": (
        "releve-en-v", "releve-jambes", "pont-fessier", "russian-twist",
        "crunch-genoux", "tenue-creux", "dead-bug",
    ),
    "suspension": (
        "traction", "suspension", "releve-jambes-suspendu",
    ),
    "agrès": (
        "corde-a-sauter", "course-tapis", "marche-tapis",
    ),
}


def obstacle(slug):
    for nom, gestes in OBSTACLES.items():
        if slug in gestes:
            return nom
    return "rien"


def etat():
    planches = set(
        re.findall(r'^  "?([a-z0-9-]+)"?: \{\n\s+source:', lire("mobile/src/donnees/planches.ts"), re.M)
    )
    paires = re.findall(
        r'^  "([^"]+)": "([a-z0-9-]+)",', lire("mobile/src/donnees/gestes.ts"), re.M
    )
    groupes = dict(
        re.findall(
            r'name: "([^"]+)",\s*\n\s*muscleGroup: "([a-z]+)"', lire("prisma/exercises.ts")
        )
    )
    return planches, paires, groupes


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--manquants", action="store_true",
                   help="détaille geste par geste ce qui reste à rendre")
    args = a.parse_args()

    planches, paires, groupes = etat()
    couverts = [(n, s) for n, s in paires if s in planches]
    manquants = [(n, s) for n, s in paires if s not in planches]

    print(f"\n{len(paires)} exercices — {len(couverts)} en 3D "
          f"({100 * len(couverts) // len(paires)} %), "
          f"{len(manquants)} au bonhomme vectoriel")
    print(f"{len(planches)} planches rendues, "
          f"{len({s for _, s in manquants})} gestes restants\n")

    total = collections.Counter(groupes.get(n, "?") for n, _ in paires)
    faits = collections.Counter(groupes.get(n, "?") for n, _ in couverts)
    for groupe in sorted(total, key=lambda k: -faits[k] / total[k]):
        part = faits[groupe] / total[groupe]
        barre = "█" * round(12 * part) + "·" * (12 - round(12 * part))
        print(f"  {groupe:10s} {barre} {faits[groupe]:2d}/{total[groupe]:<2d}")

    par_slug = collections.defaultdict(list)
    for nom, slug in manquants:
        par_slug[slug].append(nom)

    print("\nCe qui reste, par obstacle :")
    for nom in ("rien", "tronc", "suspension", "agrès"):
        concernes = {s: l for s, l in par_slug.items() if obstacle(s) == nom}
        exercices = sum(len(l) for l in concernes.values())
        etiquette = "faisable aujourd'hui" if nom == "rien" else nom
        print(f"  {etiquette:22s} {len(concernes):2d} gestes, {exercices:2d} exercices")

    if not args.manquants:
        return

    print("\n--- détail ---")
    for slug, l in sorted(par_slug.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        print(f"\n{slug}  ({len(l)} exercice{'s' if len(l) > 1 else ''}, "
              f"obstacle : {obstacle(slug)})")
        for nom in l:
            print(f"    {nom}")


if __name__ == "__main__":
    main()
