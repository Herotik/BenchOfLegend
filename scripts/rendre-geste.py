"""Rend un geste animé en images, depuis un FBX Mixamo. À lancer par Blender.

    blender -b -noaudio -P scripts/rendre-geste.py -- <fichier.fbx> <dossier-sortie> [options]

Options (après le `--`) :
  --images 20        Nombre d'images rendues sur la boucle.
  --taille 512       Côté de l'image rendue, en pixels.
  --vue profil       `profil` (tourné vers la droite) ou `face`.
  --essai            Rend une forme d'essai au lieu d'importer un FBX, pour
                     éprouver le cadrage et l'éclairage sans avoir de modèle.

La sortie se passe ensuite dans `scripts/planche-geste.py`, qui en fait la
planche que l'app lit.

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


def arguments():
    """Ce qui suit `--` sur la ligne de commande ; Blender ignore le reste."""
    argv = sys.argv
    apres = argv[argv.index("--") + 1 :] if "--" in argv else []

    if len(apres) < 2:
        sys.exit("Usage : ... -- <fichier.fbx> <dossier-sortie> [--images N] [--taille N] [--vue profil|face] [--essai]")

    def valeur(nom, defaut):
        return apres[apres.index(nom) + 1] if nom in apres else defaut

    return {
        "fbx": apres[0],
        "sortie": apres[1],
        "images": int(valeur("--images", 20)),
        "taille": int(valeur("--taille", 512)),
        "vue": valeur("--vue", "profil"),
        "essai": "--essai" in apres,
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


def placer_camera(mini, maxi, vue):
    """Caméra orthographique, cadrée sur l'encombrement avec une marge fixe."""
    centre = (mini + maxi) / 2
    taille = maxi - mini

    # Z est la verticale dans Blender ; Mixamo exporte le personnage face à -Y.
    if vue == "face":
        direction = Vector((0, -1, 0))
        rotation = (math.radians(90), 0, 0)
        largeur = taille.x
    else:
        # De profil, tourné vers la droite de l'image — même convention que les
        # motifs vectoriels, pour qu'un exercice ne change pas d'orientation
        # selon qu'il est rendu ou dessiné.
        direction = Vector((-1, 0, 0))
        rotation = (math.radians(90), 0, math.radians(-90))
        largeur = taille.y

    recul = max(taille) * 3 + 5
    bpy.ops.object.camera_add(location=centre + direction * recul, rotation=rotation)
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    # 15 % de marge : le personnage respire sans flotter dans le vide.
    camera.data.ortho_scale = max(largeur, taille.z) * 1.15
    bpy.context.scene.camera = camera


def eclairer(mini, maxi):
    """Trois soleils : principale, adoucissante, contre-jour.

    Des soleils et non des sources d'aire : leur intensité est une irradiance,
    indépendante de la distance. Une source d'aire demande d'accorder sa
    puissance au recul de la caméra, qui varie avec la taille du personnage —
    le premier essai rendait un sujet entièrement noir pour cette raison.
    """
    centre = (mini + maxi) / 2
    portee = max(maxi - mini) + 2

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

    # Un fond de ciel discret : sans lui, tout ce que les trois sources ne
    # touchent pas tombe au noir pur, ce qui creuse les plis d'un vêtement.
    monde = bpy.data.worlds.new("Monde")
    monde.use_nodes = True
    monde.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    bpy.context.scene.world = monde


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


def main():
    o = arguments()
    scene_vierge()
    importer(o["fbx"], o["essai"])

    scene = bpy.context.scene
    debut, fin = scene.frame_start, scene.frame_end

    # La dernière image est **exclue** : sur un geste bouclé elle répète la
    # première, et la planche marquerait un temps mort à chaque tour.
    pas = max(1, (fin - debut)) / o["images"]
    numeros = [int(debut + round(i * pas)) for i in range(o["images"])]

    mini, maxi = encombrement(numeros)
    placer_camera(mini, maxi, o["vue"])
    eclairer(mini, maxi)
    configurer_rendu(o["taille"], o["sortie"])

    for rang, numero in enumerate(numeros):
        scene.frame_set(numero)
        scene.render.filepath = os.path.join(o["sortie"], f"geste_{rang:04d}.png")
        bpy.ops.render.render(write_still=True)

    print(f"\n{len(numeros)} images rendues dans {o['sortie']}")
    print(f"Images {debut} à {fin} de l'animation, vue « {o['vue'] } ».")
    print("\nEnsuite :")
    print(f"  python scripts/planche-geste.py {o['sortie']} <slug-du-geste>")


if __name__ == "__main__":
    main()
