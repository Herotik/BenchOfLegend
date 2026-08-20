"""Mesure une pose, pour la comparer à une forme de référence.

    blender -b -noaudio -P scripts/mesurer-geste.py -- <corps.fbx> <geste>

## Pourquoi mesurer plutôt que regarder

Juger une posture à l'œil sur une planche de contact est lent et faux : on voit
qu'« il y a quelque chose qui cloche » sans pouvoir dire quoi, et il faut dix
minutes de rendu pour chaque essai. Les positions d'articulations, elles, se
comparent à une consigne écrite — « mains directement sous les épaules »,
« ligne droite de la tête aux talons », « bassin de niveau ». Quarante secondes,
et un verdict qui ne se discute pas.

C'est ce qui a débloqué le mountain climber après six tours de tâtonnement.
Deux bugs que l'œil ne pouvait pas nommer sont sortis en une mesure : un bassin
resté à 1,17 m alors qu'il était déclaré à 0,50, puis, une fois corrigé, un
corps qui partait de côté au lieu de descendre — la hauteur était ajoutée sur
l'axe Z de l'armature, qui n'est pas celui du monde.

## La marche à suivre pour un geste au sol

1. Chercher la forme de référence et en tirer des critères chiffrables.
2. Mesurer, corriger, remesurer — c'est rapide.
3. Rendre seulement quand les chiffres sont bons.
"""
import bpy, sys, os, importlib.util

RACINE = "/home/user/FrameOfLegend"
spec = importlib.util.spec_from_file_location(
    "gg", os.path.join(RACINE, "scripts", "gestes_generes.py")
)
gg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gg)

apres = sys.argv[sys.argv.index("--") + 1 :]
chemin, geste = apres[0], apres[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=chemin)
for o in bpy.data.objects:
    o.animation_data_clear()
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

numeros = gg.appliquer(arm, geste, 8, bpy.context)

POINTS = {
    "tête": ("mixamorig:Head", "queue"),
    "épaule G": ("mixamorig:LeftArm", "tête"),
    "main G": ("mixamorig:LeftHand", "tête"),
    "bassin": ("mixamorig:Hips", "tête"),
    "genou G": ("mixamorig:LeftLeg", "tête"),
    "cheville G": ("mixamorig:LeftFoot", "tête"),
    "cheville D": ("mixamorig:RightFoot", "tête"),
    "coude G": ("mixamorig:LeftForeArm", "tête"),
}

for numero in (numeros[0], numeros[len(numeros) // 2]):
    bpy.context.scene.frame_set(numero)
    bpy.context.view_layer.update()
    print(f"\n=== {geste}, image {numero} ===")
    p = {}
    for nom, (os_nom, bout) in POINTS.items():
        pb = arm.pose.bones[os_nom]
        v = arm.matrix_world @ (pb.head if bout == "tête" else pb.tail)
        p[nom] = v
        print(f"  {nom:11s} x={v.x:+.2f}  y={v.y:+.2f}  z={v.z:+.2f}")

    # Où regarde-t-il vraiment ? L'axe local Z de la tête suit le regard sur ce
    # squelette (mesuré au repos). C'est le contrôle qui départage une planche
    # d'un corps couché sur le dos, que l'image seule laisse ambigus.
    tete_os = arm.pose.bones["mixamorig:Head"]
    regard = (arm.matrix_world.to_3x3() @ tete_os.matrix.to_3x3().col[2].to_3d())
    regard.normalize()
    print("  --- contrôles de forme ---")
    print(f"  regard : {tuple(round(c, 2) for c in regard)}  "
          f"({'vers le sol' if regard.z < -0.3 else 'vers le ciel' if regard.z > 0.3 else 'horizontal'})")
    ecart = abs(p["main G"].y - p["épaule G"].y)
    print(f"  main sous l'épaule : écart {ecart * 100:.0f} cm (doit être < 10)")
    print(
        f"  ligne tête-talon : tête z={p['tête'].z:.2f}, bassin z={p['bassin'].z:.2f}, "
        f"cheville z={p['cheville D'].z:.2f}"
    )
    # Mesuré entre **épaule** et cheville, pas entre tête et cheville : la tête
    # se relève exprès sur une planche, et l'inclure faussait le verdict.
    t = (p["épaule G"].y - p["bassin"].y) / (p["épaule G"].y - p["cheville D"].y)
    sur_la_ligne = p["épaule G"].z + t * (p["cheville D"].z - p["épaule G"].z)
    creux = p["bassin"].z - sur_la_ligne
    print(f"  bassin / ligne épaules-chevilles : {creux * 100:+.0f} cm (0 = droit)")
    print(f"  main au sol : z={p['main G'].z:+.2f} (doit être ~0)")
