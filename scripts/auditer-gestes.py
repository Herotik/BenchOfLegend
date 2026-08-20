"""Passe tous les gestes au crible du sol, en une fois.

    blender -b -noaudio -P scripts/auditer-gestes.py -- <corps.fbx> [geste…]

## Pourquoi un audit, en plus de `verifier-gestes.py`

`verifier-gestes.py` lit les postures **écrites** : il attrape un genou plié à
l'envers ou une asymétrie non déclarée sans rien calculer. Il ne peut rien dire
de ce qui ne se voit qu'une fois le corps posé — un pied qui flotte de trois
centimètres, une paume tournée sur le chant, un buste enfoncé dans le plancher.
Ceux-là demandent la cinématique complète, donc Blender.

`mesurer-geste.py` la fait, mais pour **un** geste, et il détaille. Cet audit-ci
fait l'inverse : une ligne par geste, sur tout le catalogue, pour répondre à la
seule question qui se pose après avoir changé le moteur — *qu'est-ce que ça a
cassé, et qu'est-ce que ça n'a pas encore réparé ?*

C'est né d'un constat : les gestes au sol écrits avant que le moteur sache
poser une main l'ont gardée telle quelle, doigts pendants ou paume sur le
chant. Rien ne le signalait, parce que rien ne regardait.

## Ce qu'il mesure

- **Le plus bas du maillage.** Zéro, sauf pour les gestes qui déclarent
  `ancrage: False` — un saut quitte le sol pour de bon. Négatif, le corps est
  dans le plancher ; franchement positif, il lévite.
- **Chaque appui déclaré**, sur la chair et non sur l'os : c'est la paume qui
  touche, pas le poignet.
- **L'orientation des paumes**, quand la main porte. Une main posée à plat et
  une main posée sur le chant ont la même direction et ne diffèrent que par le
  roulis ; c'est exactement la faute qui est passée deux fois.

Un appui qui **décolle** n'est pas une faute : sur une planche jambes
alternées, chaque pied se lève à son tour, et c'est le geste. Ce qui serait
fautif, c'est un membre déclaré porteur qui ne touche jamais.
"""
import importlib.util
import os
import sys

import bpy

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "gg", os.path.join(RACINE, "scripts", "gestes_generes.py")
)
gg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gg)

#: Assez d'images pour attraper une faute qui n'apparaît qu'au milieu du geste,
#: assez peu pour que l'audit complet tienne en quelques minutes.
IMAGES = 7


def charger(chemin):
    """Importe le corps. **Une seule fois** pour tout l'audit.

    Réimporter le FBX à chaque geste faisait mourir Blender sans un mot après
    le treizième — et un outil de contrôle qui s'arrête au milieu de sa liste
    est pire que pas d'outil du tout : il déclare bon ce qu'il n'a pas
    regardé. Purger les données orphelines n'y changeait rien, c'est l'import
    lui-même qui ne tient pas.

    Rien n'obligeait d'ailleurs à recharger : il suffit de remettre le
    squelette au repos entre deux gestes, ce que fait `remettre_au_repos`.
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=chemin)
    return next(o for o in bpy.data.objects if o.type == "ARMATURE")


def remettre_au_repos(armature):
    """Efface la pose et l'animation, pour repartir du modèle tel qu'importé.

    `appliquer` lit les directions de repos sur la pose courante : la laisser
    telle que le geste précédent l'a posée les fausserait toutes.
    """
    armature.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for os_pose in armature.pose.bones:
        os_pose.matrix_basis.identity()
    bpy.context.view_layer.update()


def plus_bas(contexte):
    depsgraph = contexte.evaluated_depsgraph_get()
    bas = None
    for objet in contexte.scene.objects:
        if objet.type != "MESH":
            continue
        evalue = objet.evaluated_get(depsgraph)
        monde = evalue.matrix_world
        for v in evalue.data.vertices:
            z = (monde @ v.co).z
            bas = z if bas is None else min(bas, z)
    return bas


def paume(armature, cote):
    """Direction vers laquelle la paume regarde, tranchée par le pouce.

    Main droite à plat sur une table, doigts vers le nord : le pouce pointe à
    l'ouest. D'où `pouce × doigts` à droite, `doigts × pouce` à gauche. Prendre
    ce signe au jugé retourne les deux mains — c'est arrivé.
    """
    monde = armature.matrix_world
    main = armature.pose.bones[f"mixamorig:{cote}Hand"]
    pouce = armature.pose.bones[f"mixamorig:{cote}HandThumb1"]
    doigts = ((monde @ main.tail) - (monde @ main.head)).normalized()
    vers = (monde @ pouce.tail) - (monde @ main.head)
    vers = (vers - doigts * vers.dot(doigts)).normalized()
    return doigts.cross(vers) if cote == "Left" else vers.cross(doigts)


def auditer(armature, nom):
    geste = gg.GESTES[nom]
    numeros = gg.appliquer(armature, nom, IMAGES, bpy.context)
    ancrage = geste.get("ancrage", True)
    nomme = ancrage if isinstance(ancrage, (list, tuple)) else ()

    bas, appuis, paumes = [], {n: [] for n in nomme}, {"Left": [], "Right": []}
    for numero in numeros:
        bpy.context.scene.frame_set(numero)
        bpy.context.view_layer.update()
        bas.append(plus_bas(bpy.context))
        for n, p in gg.contacts(bpy.context, armature, nomme).items():
            appuis[n].append(p.z)
        for cote in paumes:
            paumes[cote].append(paume(armature, cote).z)

    fautes = []
    if ancrage is not False:
        if min(bas) < -0.01:
            fautes.append(f"corps dans le sol ({min(bas) * 100:.0f} cm)")
        if min(bas) > 0.01:
            fautes.append(f"corps en l'air ({min(bas) * 100:+.0f} cm)")
    # Un appui qui décolle n'est pas une faute : sur une planche jambes
    # alternées, chaque pied se lève à son tour, et c'est le geste. Ce qui
    # serait fautif, c'est un membre déclaré porteur qui ne touche **jamais** —
    # celui-là ne porte rien et son nom ment.
    for n, hauteurs in appuis.items():
        if min(hauteurs) > 0.03:
            fautes.append(f"{n} ne touche jamais ({min(hauteurs) * 100:+.0f} cm)")
    # La paume ne se juge que si la main **porte**. Ailleurs, elle est libre.
    for cote, court in (("Left", "G"), ("Right", "D")):
        if f"{cote}Hand" not in nomme:
            continue
        if min(paumes[cote]) > -0.5:
            fautes.append(
                f"paume {court} à {max(paumes[cote]):+.2f} — elle ne regarde "
                f"pas le sol"
            )

    etat = "ok" if not fautes else "; ".join(fautes)
    print(f"  {nom:26s} sol {min(bas) * 100:+5.1f} cm   {etat}")
    return not fautes


def main():
    apres = sys.argv[sys.argv.index("--") + 1 :]
    if not apres:
        sys.exit("Usage : ... -- <corps.fbx> [geste…]")
    chemin, demandes = apres[0], apres[1:]
    noms = demandes or sorted(gg.GESTES)

    print(f"\n=== audit du sol, {len(noms)} gestes ===")
    armature = charger(chemin)
    fautifs = []
    for nom in noms:
        remettre_au_repos(armature)
        if not auditer(armature, nom):
            fautifs.append(nom)

    if fautifs:
        print(f"\n{len(fautifs)} geste(s) à reprendre : {', '.join(fautifs)}")
    else:
        print(f"\n{len(noms)} gestes : tous posés proprement.")


main()
