import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Rect } from "react-native-svg";
import { motifDe, type Charge, type Decor, type Point, type Pose } from "../donnees/motifs";
import { useCouleurs } from "../theme/theme";

/**
 * Le geste d'un exercice, en bonhomme bâton animé.
 *
 * Le dessin se fait à la volée, à partir des sept points du squelette : aucun
 * fichier, aucune vidéo, rien à télécharger — ce qui compte pour une app dont
 * le lieu d'usage est une salle en sous-sol.
 *
 * L'animation est menée par un état React plutôt que par `Animated` : ce ne
 * sont pas des propriétés de style qu'on interpole mais des **coordonnées**,
 * qu'il faut recalculer à chaque image pour en déduire le tracé. `Animated`
 * n'apporterait ici ni pilote natif ni raccourci.
 *
 * Le mouvement s'arrête si le système demande à réduire les animations —
 * la première pose reste affichée, et elle suffit à comprendre la position de
 * départ.
 */

/** Images par seconde. Douze suffisent à lire un geste et ménagent la batterie. */
const CADENCE = 12;

/** Durée d'un aller simple, quand le motif n'en impose pas. */
const DUREE_DEFAUT = 900;

/** Adoucit les extrémités : un mouvement s'amorce et se termine, il ne claque pas. */
const adoucir = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2;

const entre = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

function poseEntre(a: Pose, b: Pose, t: number): Pose {
  return {
    tete: entre(a.tete, b.tete, t),
    cou: entre(a.cou, b.cou, t),
    bassin: entre(a.bassin, b.bassin, t),
    coude: entre(a.coude, b.coude, t),
    poignet: entre(a.poignet, b.poignet, t),
    genou: entre(a.genou, b.genou, t),
    cheville: entre(a.cheville, b.cheville, t),
  };
}

/**
 * Pose du moment.
 *
 * L'aller-retour est obtenu en pliant la progression : de 0 à 1 on parcourt les
 * poses, de 1 à 2 on les remonte. Deux poses suffisent donc à décrire un
 * mouvement complet, ce qu'est presque tout exercice de musculation.
 */
function poseCourante(poses: Pose[], avancement: number): Pose {
  if (poses.length === 1) return poses[0]!;

  const plie = avancement <= 1 ? avancement : 2 - avancement;
  const echelle = plie * (poses.length - 1);
  const index = Math.min(Math.floor(echelle), poses.length - 2);

  return poseEntre(poses[index]!, poses[index + 1]!, adoucir(echelle - index));
}

export function Silhouette({
  motif: slug,
  taille = 150,
}: {
  /** Slug du geste. Un geste inconnu n'affiche rien plutôt qu'un dessin faux. */
  motif: string | null | undefined;
  taille?: number;
}) {
  const c = useCouleurs();
  const motif = motifDe(slug);

  const [avancement, setAvancement] = useState(0);
  const [reduit, setReduit] = useState(false);
  const debut = useRef(0);

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valeur) => vivant && setReduit(valeur))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  const duree = motif?.duree ?? DUREE_DEFAUT;

  useEffect(() => {
    if (!motif || reduit) return;

    debut.current = Date.now();
    const battement = setInterval(() => {
      // Depuis un instant absolu, jamais en accumulant : un intervalle dérive,
      // et le geste finirait décalé de la durée annoncée.
      const ecoule = (Date.now() - debut.current) % (duree * 2);
      setAvancement(ecoule / duree);
    }, 1000 / CADENCE);

    return () => clearInterval(battement);
  }, [motif, reduit, duree]);

  if (!motif) return null;

  const pose = poseCourante(motif.poses, reduit ? 0 : avancement);
  const u = taille / 100;
  const p = (point: Point): { x: number; y: number } => ({ x: point[0] * u, y: point[1] * u });

  const trait = {
    stroke: c.texte2,
    strokeWidth: 3.5 * u * 0.6,
    strokeLinecap: "round" as const,
  };

  const cou = p(pose.cou);
  const bassin = p(pose.bassin);
  const coude = p(pose.coude);
  const poignet = p(pose.poignet);
  const genou = p(pose.genou);
  const cheville = p(pose.cheville);
  const tete = p(pose.tete);

  return (
    <View style={[styles.cadre, { width: taille, height: taille }]}>
      <Svg width={taille} height={taille}>
        <Repere decor={motif.decor ?? null} taille={taille} couleur={c.filet} />

        {/* Membres du fond, décalés et pâlis : sans eux la silhouette paraît
            plate, et l'on ne voit pas que le corps a deux bras. */}
        <G opacity={0.35}>
          <Line x1={cou.x} y1={cou.y} x2={coude.x - 7 * u} y2={coude.y} {...trait} />
          <Line x1={coude.x - 7 * u} y1={coude.y} x2={poignet.x - 7 * u} y2={poignet.y} {...trait} />
          <Line x1={bassin.x} y1={bassin.y} x2={genou.x - 7 * u} y2={genou.y} {...trait} />
          <Line
            x1={genou.x - 7 * u}
            y1={genou.y}
            x2={cheville.x - 7 * u}
            y2={cheville.y}
            {...trait}
          />
        </G>

        {/* Tronc */}
        <Line x1={cou.x} y1={cou.y} x2={bassin.x} y2={bassin.y} {...trait} />

        {/* Bras et jambe de devant */}
        <Line x1={cou.x} y1={cou.y} x2={coude.x} y2={coude.y} {...trait} />
        <Line x1={coude.x} y1={coude.y} x2={poignet.x} y2={poignet.y} {...trait} />
        <Line x1={bassin.x} y1={bassin.y} x2={genou.x} y2={genou.y} {...trait} />
        <Line x1={genou.x} y1={genou.y} x2={cheville.x} y2={cheville.y} {...trait} />

        <Circle cx={tete.x} cy={tete.y} r={7 * u} fill={c.texte2} />

        <ChargeTenue charge={motif.charge ?? null} poignet={poignet} u={u} couleur={c.accent} />
      </Svg>
    </View>
  );
}

/** Sol, mur ou barre : ce qui situe le corps dans l'espace. */
function Repere({ decor, taille, couleur }: { decor: Decor; taille: number; couleur: string }) {
  if (!decor) return null;
  const u = taille / 100;
  const trait = { stroke: couleur, strokeWidth: 2 * u * 0.6, strokeLinecap: "round" as const };

  if (decor === "barre") {
    return <Line x1={16 * u} y1={6 * u} x2={84 * u} y2={6 * u} {...trait} />;
  }
  if (decor === "mur") {
    return <Line x1={8 * u} y1={8 * u} x2={8 * u} y2={96 * u} {...trait} />;
  }
  if (decor === "chaise" || decor === "banc") {
    return (
      <>
        <Line x1={58 * u} y1={70 * u} x2={94 * u} y2={70 * u} {...trait} />
        <Line x1={92 * u} y1={70 * u} x2={92 * u} y2={96 * u} {...trait} />
      </>
    );
  }
  return <Line x1={6 * u} y1={96 * u} x2={94 * u} y2={96 * u} {...trait} />;
}

/** L'objet tenu, à la main. Il dit la charge sans qu'on ait à l'écrire. */
function ChargeTenue({
  charge,
  poignet,
  u,
  couleur,
}: {
  charge: Charge;
  poignet: { x: number; y: number };
  u: number;
  couleur: string;
}) {
  if (!charge) return null;

  if (charge === "barre") {
    return (
      <Line
        x1={poignet.x - 20 * u}
        y1={poignet.y}
        x2={poignet.x + 20 * u}
        y2={poignet.y}
        stroke={couleur}
        strokeWidth={2.5 * u}
        strokeLinecap="round"
      />
    );
  }

  if (charge === "kettlebell") {
    return <Circle cx={poignet.x} cy={poignet.y + 5 * u} r={5 * u} fill={couleur} />;
  }

  if (charge === "corde") {
    return <Circle cx={poignet.x} cy={poignet.y} r={2.5 * u} fill={couleur} />;
  }

  // Haltère : deux masses de part et d'autre du poing.
  return (
    <>
      <Rect
        x={poignet.x - 6 * u}
        y={poignet.y - 3 * u}
        width={4 * u}
        height={6 * u}
        rx={1.2 * u}
        fill={couleur}
      />
      <Rect
        x={poignet.x + 2 * u}
        y={poignet.y - 3 * u}
        width={4 * u}
        height={6 * u}
        rx={1.2 * u}
        fill={couleur}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cadre: { alignItems: "center", justifyContent: "center" },
});
