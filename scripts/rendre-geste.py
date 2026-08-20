"""Rend un geste animé en images, depuis un FBX Mixamo. À lancer par Blender.

    blender -b -noaudio -P scripts/rendre-geste.py -- <fichier.fbx> <dossier-sortie> [options]

Options (après le `--`) :
  --images 20        Nombre d'images rendues sur la boucle.
  --taille 512       Côté de l'image rendue, en pixels.
  --vue profil       `profil` (tourné vers la droite), `face`, ou
                     `trois-quarts` pour les gestes qui plient le buste, que
                     ni l'une ni l'autre ne montre correctement.
  --geste <nom>      **Ignore l'animation du FBX** et joue à la place un geste
                     écrit dans `gestes_generes.py`. Le FBX ne fournit alors
                     que le corps — squelette, maillage et matières. C'est ce
                     qui permet d'animer les exercices qu'aucune bibliothèque
                     de captation ne propose (élévations latérales, kickback
                     triceps, oiseau) sans attendre qu'on les capte. `--vue`
                     vient du geste, sauf si on la donne à la main.
                     `--geste liste` énumère ce qui existe.
                     Le FBX doit être un personnage **debout** : c'est sa pose
                     de repos qui sert d'assise, et un modèle exporté à plat
                     ventre resterait couché.
  --echelle 2.6      Hauteur de champ de la caméra, en mètres. **À fixer une
                     fois pour toutes** et à garder identique sur tous les
                     gestes : c'est ce qui fait que le personnage a la même
                     taille d'un exercice à l'autre. Sans elle, le cadrage
                     s'ajuste à chaque geste et un corps allongé pour des
                     pompes paraît plus petit qu'un corps debout.
  --essai            Rend une forme d'essai au lieu d'importer un FBX, pour
                     éprouver le cadrage et l'éclairage sans avoir de modèle.

La sortie se passe ensuite dans `scripts/planche-geste.py`, qui en fait la
planche que l'app lit.

## Ce qu'il faut installer

    apt-get install blender libegl1 libgl1-mesa-dri libglx-mesa0 python3-numpy

Blender refuse de démarrer sans pile OpenGL même en mode sans interface, et son
importateur FBX réclame numpy — absent du paquet Ubuntu, ce qui fait échouer
l'import avec un `ModuleNotFoundError` peu parlant. Les erreurs `EGL Error`
affichées ensuite sont sans conséquence : le rendu aboutit.

## Ce que Mixamo exporte

Vérifié sur le personnage X Bot : verticale en Z, profondeur en Y, largeur en X.
`--vue profil` regarde donc selon X, `--vue face` selon Y — ce que le script
suppose. Le FBX ne contient **aucune image** : les mannequins Mixamo portent
des matériaux unis, ce qui suffit à une démonstration d'exercice et évite tout
fichier de texture à côté.

## Ce dont le script s'occupe, et pourquoi

**Le cadrage.** C'est le point qui rate quand on le fait à la main : deux gestes
cadrés différemment font sauter le personnage d'un exercice à l'autre. La
caméra est donc orthographique et son échelle est calculée sur l'encombrement
du corps **sur toute la durée du geste**, bras levés compris — sinon le curl
sortirait du cadre à mi-course. Une marge fixe garde la même respiration
partout.

**Le fond.** `film_transparent` : un fond opaque, même blanc, se verrait comme
un rectangle sur le thème sombre de l'app.

**L'éclairage.** Trois sources — principale, adoucissante, et contre-jour. La
dernière détache la silhouette du fond, ce qui compte d'autant plus qu'il est
transparent et que l'app l'affiche sur des teintes variables.
"""
import bpy
import sys
import os
import math
from mathutils import Vector

# Blender ne met pas le script lancé sur le chemin d'import : sans cette ligne,
# `import gestes_generes` échouerait alors que le fichier est juste à côté.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gestes_generes  # noqa: E402


def arguments():
    """Ce qui suit `--` sur la ligne de commande ; Blender ignore le reste."""
    argv = sys.argv
    apres = argv[argv.index("--") + 1 :] if "--" in argv else []

    if "liste" in apres and "--geste" in apres and apres[apres.index("--geste") + 1] == "liste":
        print("\nGestes écrits dans gestes_generes.py :")
        for nom in sorted(gestes_generes.GESTES):
            g = gestes_generes.GESTES[nom]
            print(f"  {nom:24s} vue {g['vue']:6s} {g['duree']} ms")
        sys.exit(0)

    if len(apres) < 2:
        sys.exit(
            "Usage : ... -- <fichier.fbx> <dossier-sortie> [--images N] "
            "[--taille N] [--vue profil|face] [--essai] [--sol]"
        )

    def valeur(nom, defaut):
        return apres[apres.index(nom) + 1] if nom in apres else defaut

    return {
        "fbx": apres[0],
        "sortie": apres[1],
        "images": int(valeur("--images", 20)),
        "taille": int(valeur("--taille", 512)),
        # `None` et non « profil » : un geste écrit porte sa propre vue, et il
        # faut savoir distinguer « non précisé » de « profil demandé ».
        "vue": valeur("--vue", None),
        "echelle": float(valeur("--echelle", 0)) or None,
        "geste": valeur("--geste", None),
        "essai": "--essai" in apres,
        # Le sol ne part **pas** dans l'app : la vignette y est détourée et un
        # plancher la fermerait. Il sert à juger un geste au sol, où l'œil n'a
        # sinon aucun repère — une main posée et une main flottant à trois
        # centimètres sont indiscernables sur fond blanc.
        "sol": "--sol" in apres,
    }


def scene_vierge():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def importer(chemin, essai):
    """Charge le modèle animé, ou pose une forme d'essai."""
    if essai:
        # Deux volumes qui bougent : de quoi éprouver cadrage et éclairage sans
        # modèle sous la main.
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=1.6, location=(0, 0, 1.0))
        corps = bpy.context.object
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=(0, 0, 2.0))
        tete = bpy.context.object
        for objet, depart, arrivee in ((tete, 2.0, 2.25), (corps, 1.0, 1.15)):
            objet.location.z = depart
            objet.keyframe_insert("location", frame=1)
            objet.location.z = arrivee
            objet.keyframe_insert("location", frame=20)
            objet.location.z = depart
            objet.keyframe_insert("location", frame=40)
        bpy.context.scene.frame_start = 1
        bpy.context.scene.frame_end = 40
        return

    if not os.path.isfile(chemin):
        sys.exit(f"Fichier introuvable : {chemin}")

    bpy.ops.import_scene.fbx(filepath=chemin)

    # Mixamo exporte l'animation sur l'armature ; la plage de la scène ne suit
    # pas toujours. On la recale sur ce que l'action contient réellement.
    debut, fin = None, None
    for objet in bpy.data.objects:
        action = getattr(getattr(objet, "animation_data", None), "action", None)
        if action:
            a, b = action.frame_range
            debut = a if debut is None else min(debut, a)
            fin = b if fin is None else max(fin, b)

    if debut is not None:
        bpy.context.scene.frame_start = int(debut)
        bpy.context.scene.frame_end = int(fin)


def encombrement(images):
    """Boîte englobant le corps **sur toute la durée** du geste.

    Prendre la seule première image ferait sortir du cadre tout ce qui monte
    ensuite — un curl, un développé militaire, une traction.
    """
    scene = bpy.context.scene
    mini = Vector((1e9, 1e9, 1e9))
    maxi = Vector((-1e9, -1e9, -1e9))
    vus = 0

    for numero in images:
        scene.frame_set(numero)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for objet in scene.objects:
            if objet.type != "MESH":
                continue
            evalue = objet.evaluated_get(depsgraph)
            for coin in evalue.bound_box:
                p = evalue.matrix_world @ Vector(coin)
                mini = Vector((min(mini[i], p[i]) for i in range(3)))
                maxi = Vector((max(maxi[i], p[i]) for i in range(3)))
                vus += 1

    if vus == 0:
        sys.exit("Aucun maillage trouvé : le FBX a-t-il bien été exporté avec le personnage ?")
    return mini, maxi


def direction_de_vue(vue):
    """Où se tient la caméra par rapport au sujet, et comment elle est tournée.

    Sortie en commun pour le cadrage et pour l'éclairage de contrôle : une
    ombre ne se voit que si elle tombe **du côté de la caméra**, ce qui demande
    de savoir de quel côté elle est.
    """
    # Z est la verticale dans Blender ; Mixamo exporte le personnage face à -Y.
    if vue == "face":
        return Vector((0, -1, 0)), (math.radians(90), 0, 0)
    if vue == "trois-quarts":
        # Pour les gestes qui plient le buste. De face, un corps penché est
        # tellement raccourci qu'un oiseau ne se distingue plus d'une élévation
        # latérale ; de profil, l'écartement des bras disparaît dans l'axe de
        # la caméra. Le trois-quarts montre les deux.
        oblique = math.sqrt(0.5)
        return Vector((-oblique, -oblique, 0)), (math.radians(90), 0, math.radians(-45))
    # De profil, tourné vers la droite de l'image — même convention que les
    # motifs vectoriels, pour qu'un exercice ne change pas d'orientation selon
    # qu'il est rendu ou dessiné.
    return Vector((-1, 0, 0)), (math.radians(90), 0, math.radians(-90))


def placer_camera(mini, maxi, vue, echelle, plongee=0.0):
    """Caméra orthographique.

    Avec `echelle`, le champ est imposé et **identique pour tous les gestes** :
    un corps allongé pour des pompes garde alors la taille qu'il a debout. Sans
    elle, on s'ajuste à l'encombrement du geste, ce qui remplit mieux le cadre
    mais fait changer le personnage de taille d'un exercice à l'autre.
    """
    centre = (mini + maxi) / 2
    taille = maxi - mini

    direction, rotation = direction_de_vue(vue)
    if vue == "face":
        largeur = taille.x
    elif vue == "trois-quarts":
        largeur = (taille.x + taille.y) * 0.5
    else:
        largeur = taille.y

    recul = max(taille) * 3 + 5
    # Une caméra strictement horizontale voit le sol **par la tranche** : le
    # plancher devient une ligne d'un pixel, invisible, et l'on n'a rien gagné
    # à le poser. Quelques degrés de plongée suffisent à l'étaler sous le
    # personnage. Réservé au contrôle : les vignettes de l'app gardent leur
    # cadrage de face, qui ne doit pas changer d'un geste à l'autre.
    if plongee:
        angle = math.radians(plongee)
        direction = direction * math.cos(angle) + Vector((0, 0, 1)) * math.sin(angle)
        rotation = (rotation[0] - angle, rotation[1], rotation[2])

    bpy.ops.object.camera_add(location=centre + direction * recul, rotation=rotation)
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    # 15 % de marge : le personnage respire sans flotter dans le vide.
    camera.data.ortho_scale = echelle if echelle else max(largeur, taille.z) * 1.15
    bpy.context.scene.camera = camera


def eclairer(mini, maxi, sol=False, vue="profil"):
    """Trois soleils : principale, adoucissante, contre-jour.

    Des soleils et non des sources d'aire : leur intensité est une irradiance,
    indépendante de la distance. Une source d'aire demande d'accorder sa
    puissance au recul de la caméra, qui varie avec la taille du personnage —
    le premier essai rendait un sujet entièrement noir pour cette raison.
    """
    centre = (mini + maxi) / 2
    portee = max(maxi - mini) + 2

    if sol:
        # Éclairage de contrôle, pas de vignette. Les trois sources d'usage
        # viennent de côté et se remplissent mutuellement les ombres : sur un
        # plancher, elles ne montrent rien.
        #
        # Une seule source ici, placée **à l'opposé de la caméra** : l'ombre
        # tombe alors du côté de l'objectif, en avant du corps, où on la voit.
        # Posée à la verticale elle se cachait sous les mains, et le plancher
        # n'apprenait pas davantage qu'un fond blanc.
        vers_camera, _ = direction_de_vue(vue)
        sources = [
            (-vers_camera * 0.75 + Vector((0, 0, 1.0)), 3.2),
            (vers_camera * 0.9 + Vector((0, 0, 0.3)), 0.9),
        ]
    else:
        sources = [
            (Vector((-1.0, -1.0, 1.2)), 4.0),
            (Vector((1.2, -0.8, 0.2)), 1.6),
            (Vector((0.4, 1.4, 0.8)), 2.2),
        ]
    for decalage, energie in sources:
        bpy.ops.object.light_add(type="SUN", location=centre + decalage * portee)
        lampe = bpy.context.object
        lampe.data.energy = energie
        # Un soleil éclaire selon son orientation, jamais selon sa position.
        direction = (centre - lampe.location).normalized()
        lampe.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        if sol:
            # Une ombre de soleil est projetée dans une carte étalée par défaut
            # sur deux cents mètres. À cette échelle, un personnage d'un mètre
            # quatre-vingt tient dans neuf pixels, et l'ombre d'une main dans
            # moins d'un : elle disparaît purement et simplement. Ramener la
            # portée à celle du sujet la fait apparaître.
            lampe.data.shadow_cascade_max_distance = portee * 2
            lampe.data.shadow_buffer_bias = 0.005

    # Un fond de ciel discret : sans lui, tout ce que les trois sources ne
    # touchent pas tombe au noir pur, ce qui creuse les plis d'un vêtement.
    monde = bpy.data.worlds.new("Monde")
    monde.use_nodes = True
    # Un ciel plus sombre quand on veut voir le contact : c'est lui qui
    # remplit les ombres, et une ombre remplie ne dit plus rien.
    monde.node_tree.nodes["Background"].inputs[1].default_value = 0.12 if sol else 0.35
    bpy.context.scene.world = monde


def poser_le_sol(mini, maxi):
    """Un plancher à hauteur zéro, pour vérifier ce qui touche vraiment.

    Sans lui, un geste au sol se juge sans repère : le personnage flotte sur du
    blanc, et l'on ne distingue pas une paume posée d'une paume à trois
    centimètres. C'est ce qui a laissé passer, coup sur coup, des chevilles en
    l'air puis des mains enfoncées dans le plancher.

    Il ne reçoit **que** l'ombre : la surface reste claire et discrète, pour
    qu'on regarde le personnage et non le décor.
    """
    largeur = max(maxi - mini) * 4 + 4
    centre = (mini + maxi) / 2
    bpy.ops.mesh.primitive_plane_add(size=largeur, location=(centre.x, centre.y, 0))
    sol = bpy.context.object
    matiere = bpy.data.materials.new("Sol")
    matiere.use_nodes = True
    principe = matiere.node_tree.nodes["Principled BSDF"]
    # Un gris moyen, pas un blanc : sous quatre soleils, un sol clair sature
    # et l'ombre portée disparaît dans le blanc au lieu de s'y détacher.
    principe.inputs["Base Color"].default_value = (0.34, 0.34, 0.37, 1)
    principe.inputs["Roughness"].default_value = 0.9
    sol.data.materials.append(matiere)

    # Sans ombre portée, un plancher ne prouve rien : le personnage se
    # superpose au sol sans qu'on sache s'il le touche. C'est l'ombre au pied
    # de la main qui répond, et l'occlusion ambiante qui la creuse au contact.
    scene = bpy.context.scene
    scene.eevee.use_shadows = True
    scene.eevee.use_soft_shadows = True
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 0.2
    scene.eevee.shadow_cascade_size = "4096"
    return sol


def configurer_rendu(taille, sortie):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    # Fond transparent : voir l'en-tête.
    scene.render.film_transparent = True
    scene.render.resolution_x = taille
    scene.render.resolution_y = taille
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    os.makedirs(sortie, exist_ok=True)


def generer(nom, images):
    """Remplace l'animation du FBX par un geste écrit dans `gestes_generes.py`.

    L'animation importée est effacée d'abord : les images clés de la captation
    et celles qu'on pose se disputeraient sinon les mêmes os, et le résultat
    tiendrait de l'une comme de l'autre.
    """
    for objet in bpy.data.objects:
        objet.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not armatures:
        sys.exit("Aucun squelette dans ce FBX : impossible d'y poser un geste.")

    numeros = gestes_generes.appliquer(armatures[0], nom, images, bpy.context)
    bpy.context.scene.frame_start = numeros[0]
    bpy.context.scene.frame_end = numeros[-1]
    return numeros


def main():
    o = arguments()
    scene_vierge()
    importer(o["fbx"], o["essai"])

    scene = bpy.context.scene

    if o["geste"]:
        numeros = generer(o["geste"], o["images"])
        vue = o["vue"] or gestes_generes.GESTES[o["geste"]]["vue"]
    else:
        debut, fin = scene.frame_start, scene.frame_end
        # La dernière image est **exclue** : sur un geste bouclé elle répète la
        # première, et la planche marquerait un temps mort à chaque tour.
        pas = max(1, (fin - debut)) / o["images"]
        numeros = [int(debut + round(i * pas)) for i in range(o["images"])]
        vue = o["vue"] or "profil"

    debut, fin = numeros[0], numeros[-1]

    mini, maxi = encombrement(numeros)
    # **Avant** la caméra et l'éclairage, et après l'encombrement : le sol ne
    # doit pas entrer dans le cadrage, qui se règle sur le personnage seul.
    if o["sol"]:
        poser_le_sol(mini, maxi)
    placer_camera(mini, maxi, vue, o["echelle"], plongee=14 if o["sol"] else 0)
    eclairer(mini, maxi, sol=o["sol"], vue=vue)
    configurer_rendu(o["taille"], o["sortie"])

    for rang, numero in enumerate(numeros):
        scene.frame_set(numero)
        scene.render.filepath = os.path.join(o["sortie"], f"geste_{rang:04d}.png")
        bpy.ops.render.render(write_still=True)

    print(f"\n{len(numeros)} images rendues dans {o['sortie']}")
    origine = f"geste écrit « {o['geste']} »" if o["geste"] else "animation du FBX"
    print(f"Images {debut} à {fin} — {origine}, vue « {vue} ».")
    if o["echelle"]:
        print(f"Champ imposé à {o['echelle']} m — garde la même valeur sur tous les gestes.")
    else:
        print(f"Champ ajusté à ce geste ({max(maxi - mini):.2f} m). Pour que le personnage")
        print("garde la même taille partout, relance tous les gestes avec --echelle 2.6.")
    print("\nEnsuite :")
    print(f"  python scripts/planche-geste.py {o['sortie']} <slug-du-geste>")


if __name__ == "__main__":
    main()
