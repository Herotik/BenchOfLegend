"""Insère ou remplace un geste dans `gestes_generes.py`, sans se tromper de bornes.

    python3 scripts/poser-geste.py <fragment.txt> [--avant <geste>]

## Pourquoi un outil pour un copier-coller

Parce que ce n'en est pas un. `gestes_generes.py` fait plus de mille lignes et
les gestes s'y suivent ; repérer les bornes du bon bloc « à l'œil » dans un
script jetable marche deux fois sur trois. La troisième, on coupe au milieu du
geste précédent et l'on obtient une parenthèse non fermée quatre cents lignes
plus haut — ce qui est arrivé, et ce qui coûte plus cher à démêler qu'à
éviter.

Le fragment attendu est la sortie de `scripts/geste-depuis-video.py`, à
laquelle on aura ajouté ce que la vidéo ne peut pas dire : `ancrage`,
`aplomb`, une `hauteur`. Le nom du geste s'y lit tout seul.

Le fichier est **relu et compilé** après écriture : une insertion qui casserait
la syntaxe est annulée plutôt que livrée.
"""
import argparse
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIBLE = os.path.join(RACINE, "scripts", "gestes_generes.py")

#: Début d'un geste : quatre espaces, un nom entre guillemets, une accolade.
DEBUT = re.compile(r'^    "([a-z0-9-]+)": \{$', re.M)
#: Fin d'un geste, à la même indentation. Les accolades intérieures des poses
#: sont plus indentées et ne peuvent pas être confondues avec celle-ci.
FIN = "\n    },\n"


def bornes(source, nom):
    """Début et fin du bloc de `nom`, commentaires de tête compris.

    Les lignes de commentaire qui précèdent immédiatement le geste lui
    appartiennent : elles disent d'où il vient et sur quelles images il a été
    relevé. Les laisser derrière collerait la mémoire d'un geste au suivant.
    """
    for m in DEBUT.finditer(source):
        if m.group(1) != nom:
            continue
        debut = m.start()
        lignes = source[:debut].split("\n")
        while len(lignes) >= 2 and lignes[-2].lstrip().startswith("#"):
            debut -= len(lignes[-2]) + 1
            lignes.pop(-2)
        fin = source.index(FIN, m.end()) + len(FIN)
        return debut, fin
    return None


def main():
    a = argparse.ArgumentParser()
    a.add_argument("fragment")
    a.add_argument("--avant", help="geste devant lequel insérer, si nouveau")
    args = a.parse_args()

    with open(args.fragment, encoding="utf-8") as f:
        fragment = f.read()
    if not fragment.endswith("\n"):
        fragment += "\n"

    noms = DEBUT.findall(fragment)
    if len(noms) != 1:
        sys.exit(f"Le fragment doit décrire un geste et un seul (vu : {noms}).")
    nom = noms[0]

    with open(CIBLE, encoding="utf-8") as f:
        source = f.read()

    place = bornes(source, nom)
    if place:
        debut, fin = place
        neuf = source[:debut] + fragment + source[fin:]
        action = "remplacé"
    elif args.avant:
        voisin = bornes(source, args.avant)
        if not voisin:
            sys.exit(f"Geste introuvable : {args.avant}")
        neuf = source[: voisin[0]] + fragment + "\n" + source[voisin[0]:]
        action = f"inséré avant {args.avant}"
    else:
        sys.exit(
            f"« {nom} » n'existe pas encore : dire devant quel geste l'insérer, "
            f"avec --avant."
        )

    try:
        compile(neuf, CIBLE, "exec")
    except SyntaxError as faute:
        sys.exit(f"Insertion annulée, elle casserait le fichier : {faute}")

    with open(CIBLE, "w", encoding="utf-8") as f:
        f.write(neuf)
    print(f"{nom} {action} ({fragment.count('_pose({')} clés).")


if __name__ == "__main__":
    main()
