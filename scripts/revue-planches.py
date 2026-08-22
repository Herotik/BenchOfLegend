"""Une page de revue de toutes les démonstrations 3D, à valider avant publication.

    python3 scripts/revue-planches.py [--sortie revue.html]

## Pourquoi

Une planche se juge en mouvement. Ouverte image par image dans une visionneuse,
elle a l'air correcte ; jouée à sa vitesse, on voit tout de suite qu'un genou
plie à l'envers, qu'une boucle saute, ou qu'un rebond ne se voit pas. C'est
d'ailleurs comme ça que les fautes livrées ont fini par être vues, et jamais
autrement.

Cette page rejoue donc chaque planche **au cadrage et à la vitesse de l'app** —
la même fenêtre glissante, le même `duree` que `planches.ts` déclare — et donne
à côté ce qu'on ne peut pas voir : d'où vient le geste, sous quel angle il est
rendu, quels exercices il sert, et deux mesures qui attrapent les défauts
discrets.

Elle a d'abord été écrite à la main, une fois. Un script parce qu'il y en aura
d'autres : les planches changent, et une page de revue périmée est pire que pas
de page du tout — elle fait valider ce qui n'est plus là.

## Les deux mesures

- **Amplitude** — de combien l'image change au long du geste, en niveaux de
  gris moyens. Elle se compare d'un geste à l'autre : une valeur basse signale
  une démonstration qui ne bouge pas assez pour se lire. C'est elle qui a
  attrapé une corde à sauter dont le rebond était écrasé par l'ancrage au sol.

- **Saut de boucle** — l'écart entre la dernière image et la première, en part
  de l'amplitude. Sous 10 %, la boucle est invisible ; au-delà, le geste
  ressaute à chaque tour.

## Ce que la page ne dit pas

Si le geste est **juste**. Aucune mesure ne remplace un œil qui connaît
l'exercice, et c'est précisément pourquoi la page existe : elle sert à
regarder, pas à conclure.
"""
import argparse
import base64
import collections
import json
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RACINE, "mobile", "assets", "gestes")

#: Où ranger chaque geste dans la page. L'ordre est celui du catalogue, pour
#: qu'on retrouve les démonstrations là où on retrouve les exercices.
GROUPES = ("cardio", "abdos", "jambes", "pectoraux", "dos", "epaules", "bras")

TITRES = {
    "cardio": "Cardio", "abdos": "Abdos", "jambes": "Jambes",
    "pectoraux": "Pectoraux", "dos": "Dos", "epaules": "Épaules",
    "bras": "Bras", "?": "Sans groupe",
}


def lire(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return f.read()


def planches():
    """Ce que `planches.ts` déclare : slug → images, colonnes, durée."""
    texte = lire("mobile/src/donnees/planches.ts")
    sortie = {}
    for bloc in re.finditer(
        r'^  "?([a-z0-9-]+)"?: \{\n(.*?)^  \},', texte, re.M | re.S
    ):
        slug, corps = bloc.group(1), bloc.group(2)
        def champ(nom, defaut):
            trouve = re.search(rf"{nom}: (\d+)", corps)
            return int(trouve.group(1)) if trouve else defaut
        # `partage` : le fichier n'est pas toujours celui du slug. Deux
        # exercices qui ne diffèrent que par le tempo se rendraient en deux
        # images identiques au pixel près, et la seconde pointe donc la
        # première.
        partage = re.search(r'partage: "([a-z0-9-]+)"', corps)
        sortie[slug] = {
            "images": champ("images", 20),
            "colonnes": champ("colonnes", 4),
            "duree": champ("duree", 1400),
            "fichier": partage.group(1) if partage else slug,
        }
    return sortie


def exercices_par_geste():
    """Slug → noms d'exercices, et nom d'exercice → groupe musculaire."""
    paires = re.findall(
        r'^  "([^"]+)": "([a-z0-9-]+)",', lire("mobile/src/donnees/gestes.ts"), re.M
    )
    groupes = dict(
        re.findall(
            r'name: "([^"]+)",\s*\n\s*muscleGroup: "([a-z]+)"',
            lire("prisma/exercises.ts"),
        )
    )
    par_geste = collections.defaultdict(list)
    for nom, slug in paires:
        par_geste[slug].append(nom)
    return par_geste, groupes


def gestes_ecrits():
    """Les slugs que `gestes_generes.py` pose lui-même, avec leur vue.

    Le reste vient d'une captation, et la distinction se voit sur la page : ce
    sont deux façons très différentes d'obtenir une animation, et elles n'ont
    pas les mêmes défauts.
    """
    texte = lire("scripts/gestes_generes.py")
    sortie = {}
    for bloc in re.finditer(
        r'^    "([a-z0-9-]+)": \{\n(.*?)^        "cles"', texte, re.M | re.S
    ):
        vue = re.search(r'"vue": "([a-z-]+)"', bloc.group(2))
        sortie[bloc.group(1)] = vue.group(1) if vue else "—"
    return sortie


def mesures(chemin, images, colonnes):
    """Amplitude du geste et saut de boucle, en niveaux de gris moyens."""
    try:
        from PIL import Image
    except ImportError:
        return None, None

    planche = Image.open(chemin).convert("LA")
    largeur = planche.width // colonnes
    lignes = -(-images // colonnes)
    hauteur = planche.height // lignes

    vignettes = []
    for k in range(images):
        c, l = k % colonnes, k // colonnes
        v = planche.crop((c * largeur, l * hauteur,
                          (c + 1) * largeur, (l + 1) * hauteur))
        # Sur le canal alpha : le fond est transparent, et un pixel vide ne
        # doit pas compter comme du noir — sans quoi tous les gestes auraient
        # la même amplitude, celle de leur silhouette.
        gris, alpha = v.split()
        vignettes.append([
            p * a / 255 for p, a in zip(gris.tobytes(), alpha.tobytes())
        ])

    def distance(a, b):
        return sum(abs(x - y) for x, y in zip(a, b)) / len(a)

    ecarts = [
        distance(vignettes[k], vignettes[k + 1]) for k in range(images - 1)
    ]
    amplitude = max(
        distance(vignettes[0], vignettes[k]) for k in range(1, images)
    )
    saut = distance(vignettes[-1], vignettes[0])
    moyen = sum(ecarts) / len(ecarts) if ecarts else 0.0
    # Rapporté au **pas moyen** et non à l'amplitude : ce qu'on veut savoir est
    # si le retour au départ se voit davantage qu'un pas ordinaire du geste.
    return amplitude, (saut / moyen if moyen > 1e-6 else 0.0), moyen


def allegee(chemin):
    """La planche ré-encodée en palette, pour tenir dans une page web.

    Les vingt-sept planches pèsent neuf mégaoctets ; en base64 dans une page,
    onze et demi — sous la limite d'un artefact, mais lourd à charger pour ce
    qui est un fond de vignette de 128 pixels. Or ces rendus sont **une seule
    teinte de chair sur du transparent** : deux cent cinquante-six couleurs
    suffisent à les rendre à l'identique, et divisent le poids par trois.

    Les fichiers du dépôt, eux, ne sont pas touchés : c'est la page qui est
    allégée, pas la livraison.
    """
    from PIL import Image
    import io

    image = Image.open(chemin).convert("RGBA")
    # `method=2` conserve l'alpha, ce que la quantification médiane par défaut
    # ne fait pas : sans lui le fond transparent devient noir et chaque
    # vignette se retrouve dans un rectangle.
    reduite = image.quantize(colors=256, method=2)
    tampon = io.BytesIO()
    reduite.save(tampon, format="PNG", optimize=True)
    petit = tampon.getvalue()
    with open(chemin, "rb") as f:
        gros = f.read()
    return petit if len(petit) < len(gros) else gros


def carte(slug, planche, exos, vue, origine, mesure, orphelin):
    amplitude, saut, pas = mesure
    source = os.path.join(ASSETS, f"{planche['fichier']}.png")
    donnee = base64.b64encode(allegee(source)).decode("ascii")

    colonnes, images = planche["colonnes"], planche["images"]
    lignes = -(-images // colonnes)
    # La fenêtre glisse colonne par colonne, puis ligne par ligne. Les deux
    # animations doivent avancer **du même pas**, faute de quoi elles dérivent
    # l'une par rapport à l'autre et la planche joue ses images dans le
    # désordre : certaines deux fois, d'autres jamais. C'est ce qui donnait un
    # personnage montant deux fois le genou gauche puis deux fois le droit.
    #
    # Une image dure `duree / images`. Les colonnes font donc un tour en
    # `duree × colonnes / images` — et non `duree / colonnes`, qui est la même
    # chose seulement quand la planche est carrée. Sur une grille de quatre
    # colonnes et vingt images, l'écart est de 25 %.
    pas_colonne = max(1, round(planche["duree"] * colonnes / images))
    # Le tour se déduit du pas, et **jamais l'inverse**.
    #
    # Une durée CSS s'écrit en millisecondes entières : `round` est donc
    # inévitable sur le pas des colonnes, et dès qu'il arrondit, `pas × lignes`
    # ne retombe plus sur la durée déclarée. Les deux animations ont alors des
    # périodes légèrement différentes — 94 ms contre 93,875 pour une montée de
    # genoux — et rien ne les remet en phase : elles dérivent d'un tour à
    # l'autre jusqu'à ce que la fenêtre change de colonne au milieu d'une
    # rangée. La planche joue alors ses images dans le désordre.
    #
    # C'est exactement ce qui se voyait : « la montée de genoux fonctionne bien
    # au début, mais finit par saccader ». Sur les vingt-huit planches, quatre
    # seulement ne tombaient pas juste — la fente (+1 ms par tour), le saut
    # squaté (-4), la montée de genoux (+1) et la corde à sauter (-1) — et ce
    # sont précisément celles qu'on a signalées.
    #
    # En prenant le pas comme référence, les deux animations sont en phase par
    # construction et le restent indéfiniment. Le tour s'écarte au pire de
    # quelques millisecondes de la durée déclarée, ce qui ne se voit pas.
    tour = pas_colonne * lignes
    cote = 128
    liste = "".join(f"<li>{nom}</li>" for nom in sorted(exos)) or (
        '<li class="orphelin">aucun exercice ne l\'utilise</li>'
    )
    faits = [
        ("origine", origine),
        ("vue", vue),
        ("durée", f"{planche['duree']} ms · {images} img"),
        ("amplitude", "—" if amplitude is None else f"{amplitude:.1f}"),
        # Au-delà de 4, le corps traverse trop de chemin entre deux images et
        # le geste saccade : il lui faut davantage d'images. C'est la mesure
        # qui a fait passer six planches de vingt à trente-deux.
        ("saut par image", "—" if pas is None else f"{pas:.1f}"),
        ("saut de boucle", "—" if saut is None else f"{saut:.0%}"),
    ]
    return f"""
      <article class="carte" data-slug="{slug}" data-verdict=""{
        ' data-orphelin="oui"' if orphelin else ''}>
        <div class="scene">
          <div class="figure" style="
              background-image:url(data:image/png;base64,{donnee});
              background-size:{cote * colonnes}px {cote * lignes}px;
              --fx:-{cote * colonnes}px; --fy:-{cote * lignes}px;
              animation:colonnes {pas_colonne}ms steps({colonnes}) infinite,
                        rangees {tour}ms steps({lignes}) infinite;"></div>
        </div>
        <div class="corps">
          <h3>{slug}</h3>
          <dl class="faits">{''.join(
              f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in faits)}</dl>
          <ul class="exos">{liste}</ul>
          <div class="verdict" role="group" aria-label="Verdict pour {slug}">
            <button type="button" data-choix="garde">Je garde</button>
            <button type="button" data-choix="reprendre">À reprendre</button>
          </div>
        </div>
      </article>"""


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--sortie", default="revue.html")
    a.add_argument("--gabarit", default=None,
                   help="dossier contenant tete.html et pied.html ; par défaut "
                        "ceux qui accompagnent ce script")
    args = a.parse_args()

    gabarit = args.gabarit or os.path.join(RACINE, "scripts", "revue")
    try:
        tete = open(os.path.join(gabarit, "tete.html"), encoding="utf-8").read()
        pied = open(os.path.join(gabarit, "pied.html"), encoding="utf-8").read()
        script = open(os.path.join(gabarit, "script.html"), encoding="utf-8").read()
    except FileNotFoundError as e:
        sys.exit(f"Gabarit introuvable : {e.filename}")

    registre = planches()
    par_geste, groupes = exercices_par_geste()
    ecrits = gestes_ecrits()

    manquantes = [
        s for s, p in registre.items()
        if not os.path.isfile(os.path.join(ASSETS, f"{p['fichier']}.png"))
    ]
    if manquantes:
        sys.exit(
            f"{len(manquantes)} planches déclarées sans image : "
            + ", ".join(sorted(manquantes))
        )

    def groupe_de(slug):
        # Le groupe du premier exercice servi. Un geste sans exercice n'en a
        # pas, et c'est justement ce qu'il faut voir.
        for nom in sorted(par_geste.get(slug, [])):
            if nom in groupes:
                return groupes[nom]
        return "?"

    par_groupe = collections.defaultdict(list)
    for slug in registre:
        par_groupe[groupe_de(slug)].append(slug)

    sections, total_exos = [], 0
    for groupe in list(GROUPES) + ["?"]:
        slugs = sorted(par_groupe.get(groupe, []))
        if not slugs:
            continue
        exos = sum(len(par_geste.get(s, [])) for s in slugs)
        total_exos += exos
        cartes = "".join(
            carte(
                slug, registre[slug], par_geste.get(slug, []),
                ecrits.get(slug, "—"),
                "écrit ici" if slug in ecrits else "captation",
                mesures(os.path.join(ASSETS, f"{registre[slug]['fichier']}.png"),
                        registre[slug]["images"], registre[slug]["colonnes"]),
                not par_geste.get(slug),
            )
            for slug in slugs
        )
        sections.append(
            f'<section class="groupe"><header class="tete-groupe">'
            f'<h2>{TITRES.get(groupe, groupe)}</h2>'
            f'<p>{len(slugs)} démonstration{"s" if len(slugs) > 1 else ""} · '
            f'{exos} exercice{"s" if exos > 1 else ""}</p></header>'
            f'<div class="grille">{cartes}</div></section>'
        )

    tete = tete.replace("{{PLANCHES}}", str(len(registre)))
    tete = tete.replace("{{EXERCICES}}", str(total_exos))

    chemin = args.sortie if os.path.isabs(args.sortie) else os.path.join(
        os.getcwd(), args.sortie)
    with open(chemin, "w", encoding="utf-8") as f:
        f.write(tete + "".join(sections) + pied + script)

    poids = os.path.getsize(chemin) / 1e6
    print(f"{chemin}\n  {len(registre)} planches, {total_exos} exercices, "
          f"{poids:.1f} Mo")
    orphelines = sorted(s for s in registre if not par_geste.get(s))
    if orphelines:
        print("  planches qu'aucun exercice n'utilise : "
              + ", ".join(orphelines))


if __name__ == "__main__":
    main()
