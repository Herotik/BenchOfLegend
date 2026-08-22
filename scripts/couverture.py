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
- **suspension** — le corps pend à une barre. Rien ne le tient dans le moteur,
  qui pose toujours le personnage sur le sol.
- **agrès** — un tapis roulant. Le sol défile sous les pieds, et une
  démonstration en boucle de vingt images ne peut pas le dire.

Une corde à sauter, elle, n'en est pas un : le mouvement se **mime** sans
corde, et c'est ainsi qu'il se démontre. La leçon vaut d'être retenue avant de
classer un geste comme impossible — regarder ce que le corps fait, pas ce
qu'il tient.

Les **haltères et les élastiques ne sont pas des obstacles** : le personnage
ferme le poing et ne tient rien de toute façon. Les fentes haltères partagent
déjà la planche des fentes au poids du corps, et personne ne s'en plaint.
"""
import argparse
import collections
import os
import re
import signal

# Sans ça, `couverture.py | head` finit sur une trace d'erreur : Python
# transforme le SIGPIPE en exception au lieu de s'arrêter. Or c'est exactement
# l'usage de cet outil — regarder les premières lignes du décompte.
if hasattr(signal, "SIGPIPE"):
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lire(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return f.read()


#: Ce qui empêche de rendre un geste, quand quelque chose l'empêche. Écrit à la
#: main faute de pouvoir se déduire : le catalogue dit le matériel, pas ce que
#: le moteur sait faire.
OBSTACLES = {
    # L'obstacle « tronc » a été **retiré**, et c'est la plus utile des
    # corrections apportées à cette table.
    #
    # Sept gestes y étaient rangés — relevé en V, pont fessier, russian twist,
    # dead bug, tenue en creux, relevés de jambes, crunchs à genoux — au motif
    # que la colonne, exprimée dans le repère du corps, gardait l'inclinaison
    # de l'assise d'un bout à l'autre du geste. C'était faux. Les os se visent
    # dans le **monde** : `Spine` peut pointer où l'on veut, quelle que soit
    # l'assise, et un corps peut donc passer de couché à plié en V.
    #
    # Ce qui était vrai, c'est que `geste-depuis-video.py` écrit toujours
    # `Spine` sur l'axe « haut » de l'assise — il exprime la pose dans le
    # repère du tronc, si bien que l'inclinaison de celui-ci se perd. On avait
    # pris une convention de l'outil de relevé pour une limite du moteur, et
    # onze exercices sont restés bloqués derrière pendant tout ce temps.
    #
    # Le relevé en V et le russian twist sont rendus depuis ; les cinq autres
    # sont désormais rangés sous « rien ».
    # L'obstacle « suspension » a été retiré à son tour, et pour la même raison
    # que « tronc » : il n'avait jamais été essayé.
    #
    # Trois gestes y étaient rangés — traction, suspension, relevés de jambes
    # suspendus — au motif que « rien ne tient un corps qui pend, le moteur
    # pose toujours le personnage au sol ». Or `ancrage: False` le laisse
    # quitter le sol depuis le saut squaté, `bassin` le fait monter d'une clé à
    # l'autre, et la barre était déjà dessinée pour le rowing inversé. Les
    # trois planches ont été écrites en une séance.
    #
    # Deux obstacles supposés, deux fois faux, dix-huit exercices derrière.
    # Ce qui reste sous « agrès » n'a pas été essayé non plus.
    # `corde-a-sauter` n'y figure plus : une vidéo de démonstration l'a montrée
    # **mimée sans corde**, et le personnage n'en tient pas davantage. L'agrès
    # qu'on croyait rédhibitoire ne l'était pas — il suffisait de regarder le
    # mouvement plutôt que l'objet.
    "agrès": (
        "course-tapis", "marche-tapis",
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
    for nom in ("rien", "agrès"):
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
