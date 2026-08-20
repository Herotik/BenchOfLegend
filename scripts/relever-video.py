"""Relève les articulations d'une vidéo, **sur ta machine**, pour me les envoyer.

    python3 scripts/relever-video.py <video.mp4> <slug> [--dossier releves]

## Pourquoi ce script existe

La session qui écrit les animations tourne derrière un proxy en liste blanche.
GitHub passe, PyPI passe, `storage.googleapis.com` passe. Aucun hébergeur
vidéo ne passe — ni YouTube, ni Vimeo, ni archive.org, ni même Wikipédia. Ce
n'est pas contournable de l'intérieur, et il ne sert à rien de le regretter.

Mais l'animation n'a jamais eu besoin de la vidéo. Elle a besoin des
**positions d'articulations** — trente-trois points par image, des faits
anatomiques. C'est ce que ce script produit, et c'est tout ce qu'il faut
transmettre.

Le gain n'est pas le poids : deux minutes de vidéo donnent un relevé de 2,4 Mo
là où le film en fait 5,6. Le gain est qu'un relevé **peut arriver ici**,
quelle que soit l'origine de la vidéo, et qu'il ne contient que des mesures —
le film, lui, reste chez toi.

## Ce qu'il sort

Deux fichiers, tous deux petits :

- `<slug>.npz` — les articulations, image par image. C'est la matière.
- `<slug>-planche.jpg` — une planche de vignettes numérotées. Elle sert à
  **choisir les images** : une vidéo de démonstration passe la moitié de son
  temps sur des plans de coupe et des postures de transition, et le choix des
  poses clés est la décision qui compte le plus. Sans la planche, il faudrait
  la deviner.

## Ce qu'il faut installer

    pip install opencv-python-headless mediapipe
    curl -o pose_landmarker.task https://storage.googleapis.com/mediapipe-models/\\
pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task

Le modèle se cherche à côté du script, ou à l'endroit que `MODELE_POSE`
indique.

## Ce qui fait une vidéo exploitable

Le sujet **entier dans le cadre**, vu sous un angle où les membres ne se
cachent pas, et une caméra qui ne bouge pas. Un plan serré sur le buste ne
donne rien : l'estimateur a besoin des hanches et des chevilles pour
reconstruire le repère du corps.

Une leçon de la première vidéo, qui vaut d'être connue avant d'en choisir
d'autres : **un corps écrasé au sol est le pire cas.** À plat ventre, la
profondeur est presque entièrement devinée et les membres se cachent
mutuellement ; l'estimateur y plaçait un coude cinquante centimètres au-dessus
de l'épaule. Préférer les vidéos où l'exercice se démontre depuis une position
ouverte — debout, à quatre pattes, assis.
"""
import argparse
import os
import sys

import numpy as np

RACINE = os.path.dirname(os.path.abspath(__file__))
MODELE = os.environ.get(
    "MODELE_POSE", os.path.join(RACINE, "pose_landmarker.task")
)

#: Une vignette toutes les deux secondes environ. Assez pour repérer les temps
#: forts d'une démonstration sans faire une planche illisible.
PAS_VIGNETTES = 48
#: Largeur d'une vignette, et nombre par ligne. Six colonnes de 284 px donnent
#: une planche d'environ 1700 px de large : lisible, et légère en JPEG.
LARGEUR, COLONNES = 284, 6


def relever(video):
    """Articulations de toutes les images, plus les vignettes de repérage."""
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    if not os.path.isfile(MODELE):
        sys.exit(f"Modèle introuvable : {MODELE} (voir l'en-tête du script)")

    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=MODELE),
        running_mode=vision.RunningMode.VIDEO,
    )
    flux = cv2.VideoCapture(video)
    if not flux.isOpened():
        sys.exit(f"Vidéo illisible : {video}")
    fps = flux.get(cv2.CAP_PROP_FPS) or 25.0

    monde, image, visibilite, vignettes = [], [], [], []
    with vision.PoseLandmarker.create_from_options(options) as estimateur:
        numero = 0
        while True:
            ok, cadre = flux.read()
            if not ok:
                break
            rgb = cv2.cvtColor(cadre, cv2.COLOR_BGR2RGB)
            # Toutes les images passent par l'estimateur : en mode vidéo il
            # suit le sujet d'une image à l'autre, et sauter des images lui
            # ferait perdre ce suivi.
            resultat = estimateur.detect_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb),
                int(numero / fps * 1000),
            )
            if resultat.pose_world_landmarks:
                monde.append(
                    [[p.x, p.y, p.z] for p in resultat.pose_world_landmarks[0]]
                )
                image.append([[p.x, p.y, p.z] for p in resultat.pose_landmarks[0]])
                visibilite.append([p.visibility for p in resultat.pose_landmarks[0]])
            else:
                # Un plan de coupe, un carton de titre : la place est gardée
                # pour que les numéros d'images restent ceux de la vidéo.
                monde.append(np.full((33, 3), np.nan))
                image.append(np.full((33, 3), np.nan))
                visibilite.append(np.zeros(33))

            if numero % PAS_VIGNETTES == 0:
                vignettes.append((numero, rgb))
            numero += 1
            if numero % 200 == 0:
                print(f"  {numero} images", flush=True)
    flux.release()

    if not monde:
        sys.exit("Aucune image lue.")
    return np.array(monde), np.array(image), np.array(visibilite), fps, vignettes


def planche_de_reperage(vignettes, chemin):
    """Assemble les vignettes numérotées qui serviront à choisir les images."""
    from PIL import Image, ImageDraw

    hauteur = round(LARGEUR * vignettes[0][1].shape[0] / vignettes[0][1].shape[1])
    lignes = -(-len(vignettes) // COLONNES)
    planche = Image.new("RGB", (COLONNES * LARGEUR, lignes * hauteur), (255,) * 3)
    for rang, (numero, rgb) in enumerate(vignettes):
        vignette = Image.fromarray(rgb).resize((LARGEUR, hauteur))
        # Le numéro **dans** la vignette : c'est lui qu'on citera pour choisir
        # les poses clés, et une planche sans numéros ne sert à rien.
        ImageDraw.Draw(vignette).text((4, 4), str(numero), fill=(255, 0, 0))
        planche.paste(vignette, ((rang % COLONNES) * LARGEUR,
                                 (rang // COLONNES) * hauteur))
    planche.save(chemin, quality=72, optimize=True)
    return planche.size


def main():
    a = argparse.ArgumentParser()
    a.add_argument("video")
    a.add_argument("slug", help="nom court de l'exercice, sans espaces")
    a.add_argument("--dossier", default="releves")
    args = a.parse_args()

    os.makedirs(args.dossier, exist_ok=True)
    monde, image, visibilite, fps, vignettes = relever(args.video)

    npz = os.path.join(args.dossier, f"{args.slug}.npz")
    # En simple précision : une articulation se repère au millimètre, et le
    # double coûte deux fois la taille pour des décimales que rien ne lit.
    np.savez_compressed(
        npz,
        monde=monde.astype(np.float32),
        image=image.astype(np.float32),
        vis=visibilite.astype(np.float32),
        fps=fps,
    )

    jpg = os.path.join(args.dossier, f"{args.slug}-planche.jpg")
    taille = planche_de_reperage(vignettes, jpg)

    vus = int((visibilite.mean(axis=1) > 0.5).sum())
    print(f"\n{len(monde)} images à {fps:.2f} i/s, "
          f"{vus} avec un sujet détecté ({100 * vus / len(monde):.0f} %).")
    print(f"  {npz}  ({os.path.getsize(npz) / 1e3:.0f} Ko)")
    print(f"  {jpg}  ({os.path.getsize(jpg) / 1e3:.0f} Ko, {taille[0]}×{taille[1]})")
    print("\nCe sont ces deux fichiers-là qu'il faut transmettre, pas la vidéo.")


if __name__ == "__main__":
    main()
