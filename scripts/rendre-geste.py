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
  --corps <fbx>      Rejoue l'animation du FBX sur **ce** personnage-ci. Les
                     captations Mixamo arrivent chacune avec son propre
                     modèle habillé ; l'app en mélangeait deux. Les squelettes
                     étant identiques d'un personnage Mixamo à l'autre, une
                     action se transfère sans rien perdre du mouvement.

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
import re
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
        # Le corps sur lequel jouer l'animation, quand ce n'est pas celui du
        # FBX importé. Voir `transferer_sur_le_corps`.
        "corps": valeur("--corps", None),
        # Le sol ne part **pas** dans l'app : la vignette y est détourée et un
        # plancher la fermerait. Il sert à juger un geste au sol, où l'œil n'a
        # sinon aucun repère — une main posée et une main flottant à trois
        # centimètres sont indiscernables sur fond blanc.
        "sol": "--sol" in apres,
        # Le tapis, lui, part dans l'app. C'est une dalle **mince** vue par la
        # tranche : la caméra reste horizontale, le fond reste détouré, et le
        # personnage garde le cadrage qu'il a partout ailleurs. Il ne sert pas
        # à contrôler mais à **lire** — sans repère fixe, un corps qui avance
        # de soixante centimètres semble faire du surplace.
        "tapis": "--tapis" in apres,
    }


def os_anime(chemin_de_donnee):
    """Le nom de l'os qu'une courbe d'animation fait bouger, s'il y en a un.

    Une action range ses courbes sous `pose.bones["mixamorig:Hips"].rotation_quaternion`.
    Les courbes qui ne visent pas un os — la position de l'objet, une forme
    clé — n'ont pas de nom à rendre.
    """
    trouve = re.match(r'pose\.bones\["([^"]+)"\]', chemin_de_donnee)
    return trouve.group(1) if trouve else None


def transferer_sur_le_corps(chemin_corps):
    """Rejoue l'animation du FBX importé sur **un autre** personnage.

    ## Pourquoi

    Les premières planches venaient de captations Mixamo, et chaque captation
    arrive avec son propre personnage — en l'occurrence un hoplite en robe
    rouge. Les gestes écrits, eux, se posent sur le mannequin nu. L'app en est
    venue à mélanger les deux : un chevalier pour les pompes, un mannequin pour
    les planches, côte à côte dans la même séance.

    Refaire les captations à la main coûterait le mouvement, qui est bon. Or il
    n'y a rien à refaire : **les squelettes sont les mêmes.** Mixamo nomme ses
    os `mixamorig:` sur tous ses personnages, et une action ne stocke que des
    rotations d'os nommés. L'assigner au mannequin la rejoue telle quelle.

    On importe donc l'animation, on lui prend son action, on importe le corps
    voulu, on lui donne l'action, et l'on jette le personnage d'origine.
    """
    animees = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not animees:
        sys.exit("Aucun squelette animé à transférer.")
    source = animees[0]
    action = getattr(getattr(source, "animation_data", None), "action", None)
    if action is None:
        sys.exit("Le FBX importé ne porte aucune animation à transférer.")

    avant = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=chemin_corps)
    nouveaux = [o for o in bpy.data.objects if o not in avant]
    corps = next((o for o in nouveaux if o.type == "ARMATURE"), None)
    if corps is None:
        sys.exit(f"Aucun squelette dans le corps demandé : {chemin_corps}")

    # On compare les os **que l'action fait bouger**, et non tous ceux du
    # squelette d'origine. Les personnages Mixamo ne portent pas exactement le
    # même gréement — celui de la pompe a des os d'yeux que le mannequin n'a
    # pas — et refuser le transfert pour un `RightEye` qui ne tourne jamais
    # reviendrait à jeter une captation valable pour un détail que la
    # démonstration ne montre pas.
    manquants = sorted(
        {
            nom for nom in (os_anime(courbe.data_path) for courbe in action.fcurves)
            if nom and nom not in corps.pose.bones
        }
    )
    if manquants:
        sys.exit(
            f"{len(manquants)} os animés manquent au corps "
            f"({', '.join(manquants[:3])}) : les deux squelettes diffèrent."
        )

    corps.animation_data_create()
    corps.animation_data.action = action

    # Le personnage d'origine s'en va — maillage compris, sans quoi il
    # resterait planté au milieu du cadre, immobile.
    for objet in list(bpy.data.objects):
        if objet not in nouveaux and objet.type in {"ARMATURE", "MESH"}:
            bpy.data.objects.remove(objet, do_unlink=True)
    bpy.context.view_layer.update()


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


def placer_camera(mini, maxi, vue, echelle, plongee=0.0, perspective=False):
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
    #
    # Il en faut une trentaine, pas dix : à quatorze degrés le damier du sol
    # s'écrase au quart et se lit comme un mur derrière le personnage au lieu
    # d'un plancher sous lui.
    if plongee:
        angle = math.radians(plongee)
        direction = direction * math.cos(angle) + Vector((0, 0, 1)) * math.sin(angle)
        rotation = (rotation[0] - angle, rotation[1], rotation[2])

    champ = echelle if echelle else max(largeur, taille.z) * 1.15

    if perspective:
        # Une caméra orthographique ne fait pas **converger** les fuyantes : un
        # damier au sol y garde des cases identiques d'un bout à l'autre et se
        # lit comme un mur derrière le personnage. C'est précisément le repère
        # qu'on cherchait, et l'orthographique le refuse par construction.
        #
        # La perspective est donc réservée au contrôle. Les vignettes de l'app
        # gardent l'orthographique, qui seule garantit qu'un personnage a la
        # même taille d'un exercice à l'autre.
        focale = 50.0
        capteur = 36.0
        recul = champ / (2 * math.tan(math.atan(capteur / (2 * focale))))

    bpy.ops.object.camera_add(location=centre + direction * recul, rotation=rotation)
    camera = bpy.context.object
    if perspective:
        camera.data.type = "PERSP"
        camera.data.lens = focale
    else:
        camera.data.type = "ORTHO"
        # 15 % de marge : le personnage respire sans flotter dans le vide.
        camera.data.ortho_scale = champ
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


def poser_le_tapis(mini, maxi):
    """Une dalle mince au sol, qui part dans l'app.

    Épaisse d'un centimètre et demie : à l'échelle des vignettes, trois pixels.
    Assez pour se voir, assez peu pour ne pas devenir un décor. Elle est plus
    longue que le geste, de sorte qu'un personnage qui se déplace ne sorte
    jamais de son tapis.

    Un gris moyen, opaque : il se détache sur le thème clair comme sur le
    sombre, ce qu'un blanc ou un noir ne feraient pas.
    """
    epaisseur = 0.015
    taille = maxi - mini
    centre = (mini + maxi) / 2
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=(centre.x, centre.y, -epaisseur / 2)
    )
    tapis = bpy.context.object
    tapis.scale = (max(taille.x, 0.8) + 1.2, max(taille.y, 0.8) + 1.2, epaisseur)

    matiere = bpy.data.materials.new("Tapis")
    matiere.use_nodes = True
    principe = matiere.node_tree.nodes["Principled BSDF"]
    principe.inputs["Base Color"].default_value = (0.42, 0.43, 0.47, 1)
    principe.inputs["Roughness"].default_value = 0.95
    tapis.data.materials.append(matiere)
    return tapis


def poser_le_banc(hauteur, mini, maxi):
    """Un banc sous le corps, qui part dans l'app.

    ## Pourquoi il en faut un

    Un développé couché se démontre allongé. Sans rien dessous, le personnage
    flotte sur du vide et, pire, le moteur cherche à le poser : le point le
    plus bas du maillage devient le **coude**, qui passe sous le dos à chaque
    descente, et le corps entier remonte au rythme des bras. Une planche qui
    monte et descend alors que seul le coude bouge.

    Le geste déclare donc `ancrage: False` et sa hauteur de bassin ; il ne
    reste qu'à dessiner ce sur quoi il repose, faute de quoi on montre un corps
    en lévitation à cinquante centimètres du sol.

    Le banc s'arrête aux épaules et sous le bassin, comme un vrai : ni les
    bras ni les pieds ne portent dessus, et c'est ce qui fait comprendre
    l'exercice.
    """
    # Le banc se place sur le **tronc**, et non sur l'encombrement du geste :
    # celui-ci comprend les bras levés et les jambes qui descendent chercher le
    # sol, si bien que son centre tombe vers les pieds et que la tête finit
    # dans le vide, au bout du banc. Un banc dont la tête dépasse donne un
    # corps qui glisse, ce qui est exactement la faute qu'on corrige ailleurs.
    tete, bassin = None, None
    for objet in bpy.data.objects:
        if objet.type == "ARMATURE" and "mixamorig:Head" in objet.pose.bones:
            tete = objet.matrix_world @ objet.pose.bones["mixamorig:Head"].tail
            bassin = objet.matrix_world @ objet.pose.bones["mixamorig:Hips"].head
            break

    taille = maxi - mini
    epaisseur = 0.08
    if tete is not None:
        # Du sommet du crâne au bassin, plus une marge : c'est la portion du
        # corps qu'un banc porte.
        longueur = abs(tete.y - bassin.y) * 2.0 + 0.20
        milieu_y = (tete.y + bassin.y) / 2 + (bassin.y - tete.y) * 0.25
        centre_x = bassin.x
    else:
        longueur = max(taille.y, 0.9) * 0.75
        milieu_y = (mini.y + maxi.y) / 2
        centre_x = (mini.x + maxi.x) / 2

    bpy.ops.mesh.primitive_cube_add(
        size=1, location=(centre_x, milieu_y, hauteur - epaisseur / 2)
    )
    banc = bpy.context.object
    # Moins large que les bras écartés : c'est cette proportion-là qu'on
    # reconnaît comme un banc plutôt que comme une table.
    banc.scale = (max(taille.x, 0.6) * 0.45, longueur, epaisseur)

    matiere = bpy.data.materials.new("Banc")
    matiere.use_nodes = True
    principe = matiere.node_tree.nodes["Principled BSDF"]
    principe.inputs["Base Color"].default_value = (0.36, 0.37, 0.41, 1)
    principe.inputs["Roughness"].default_value = 0.9
    banc.data.materials.append(matiere)

    # Les deux pieds du banc, qui le posent au sol : sans eux la dalle flotte
    # et l'on ne sait plus à quelle hauteur le corps se trouve.
    for cote in (-1, +1):
        bpy.ops.mesh.primitive_cube_add(
            size=1,
            location=(centre.x, centre.y + cote * banc.scale.y * 0.35,
                      (hauteur - epaisseur) / 2),
        )
        pied = bpy.context.object
        pied.scale = (banc.scale.x * 0.30, 0.06, hauteur - epaisseur)
        pied.data.materials.append(matiere)
    return banc


def poser_le_sol(mini, maxi):
    """Un plancher à hauteur zéro, pour vérifier ce qui touche vraiment.

    Sans lui, un geste au sol se juge sans repère : le personnage flotte sur du
    blanc, et l'on ne distingue pas une paume posée d'une paume à trois
    centimètres. C'est ce qui a laissé passer, coup sur coup, des chevilles en
    l'air puis des mains enfoncées dans le plancher.

    Le sol est un **damier au décimètre**, et pas un aplat. Un aplat de couleur
    unie ne donne aucun repère : rien n'y indique où passe le plan, et une main
    posée s'y confond avec une main qui lévite — c'est ce qui restait illisible
    après même qu'on eut posé le plancher. Un damier, lui, apporte trois
    choses : une échelle, une perspective qui dit où est le plan sous le corps,
    et un contraste sur lequel l'ombre se détache.

    Dix centimètres par case, ce qui donne une main sur une case et demie.
    """
    largeur = max(maxi - mini) * 4 + 4
    centre = (mini + maxi) / 2
    bpy.ops.mesh.primitive_plane_add(size=largeur, location=(centre.x, centre.y, 0))
    sol = bpy.context.object
    matiere = bpy.data.materials.new("Sol")
    matiere.use_nodes = True
    noeuds = matiere.node_tree.nodes
    liens = matiere.node_tree.links

    principe = noeuds["Principled BSDF"]
    # Mat, sans reflet : un sol brillant renverrait le personnage et
    # brouillerait justement la zone qu'on cherche à lire, celle du contact.
    principe.inputs["Roughness"].default_value = 0.95
    principe.inputs["Specular IOR Level" if "Specular IOR Level"
                    in principe.inputs else "Specular"].default_value = 0.05

    damier = noeuds.new("ShaderNodeTexChecker")
    # Deux gris moyens : assez contrastés pour se compter, assez sombres pour
    # que l'ombre s'y voie encore. Sous quatre soleils, un damier blanc et noir
    # saturerait d'un côté et avalerait l'ombre de l'autre.
    damier.inputs["Color1"].default_value = (0.52, 0.52, 0.55, 1)
    damier.inputs["Color2"].default_value = (0.30, 0.30, 0.33, 1)
    damier.inputs["Scale"].default_value = 10.0

    reperes = noeuds.new("ShaderNodeTexCoord")
    # Coordonnées **objet** : elles sont en mètres et centrées sur le plan, ce
    # qui rend la taille des cases indépendante de celle du plancher — lequel
    # s'agrandit avec l'encombrement du geste.
    liens.new(reperes.outputs["Object"], damier.inputs["Vector"])
    liens.new(damier.outputs["Color"], principe.inputs["Base Color"])
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
    if o["corps"]:
        transferer_sur_le_corps(o["corps"])

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
    if o["tapis"]:
        poser_le_tapis(mini, maxi)
    # Le banc se déclare dans le geste et non sur la ligne de commande : c'est
    # une propriété de l'exercice — un développé couché se fait sur un banc —
    # et non un choix de rendu, contrairement au sol de contrôle.
    banc = (
        gestes_generes.GESTES[o["geste"]].get("banc") if o["geste"] else None
    )
    if banc:
        poser_le_banc(banc, mini, maxi)
    if o["sol"]:
        poser_le_sol(mini, maxi)
    placer_camera(
        mini, maxi, vue, o["echelle"],
        plongee=32 if o["sol"] else 0,
        perspective=o["sol"],
    )
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
