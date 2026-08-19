import Svg, { Circle, G, Path, Polygon } from "react-native-svg";
import { membresDuFond, type Point, type Pose } from "../../donnees/motifs";

/**
 * Mannequin hoplite.
 *
 * ## Un skin n'est qu'un second rendu
 *
 * Le mouvement ne change pas d'un mannequin à l'autre : il vit dans
 * `donnees/motifs.ts`, en positions d'articulations. Ce fichier ne fait que
 * **dessiner** une pose qu'on lui donne — le bonhomme bâton en dessine la même,
 * autrement. Ajouter un mannequin ne demande donc aucune retouche aux gestes,
 * et un geste nouveau profite à tous les mannequins d'un coup.
 *
 * ## Pourquoi des formes et non des images
 *
 * Un membre est un quadrilatère effilé calculé à partir de ses deux
 * articulations, pas une image tournée. Une image devrait être découpée par
 * segment, pesée dans le paquet, et se déformerait aux angles vifs — le coude
 * d'un curl replié à fond. Des formes calculées suivent n'importe quelle pose,
 * pèsent quelques lignes, et se reteintent pour un autre rang sans qu'on
 * redessine quoi que ce soit.
 *
 * ## Le domaine public, et pourquoi il compte
 *
 * L'hoplite, le casque corinthien et le lambda spartiate n'appartiennent à
 * personne. Un personnage de manga, si — l'embarquer sans licence exposerait
 * l'app à un retrait, et la revue de l'App Store le relève. La mythologie n'est
 * pas un pis-aller : elle est déjà l'identité de l'app, et un mannequin par
 * rang fait du skin une récompense plutôt qu'un habillage.
 */

/** Bronze patiné, rouge de Sparte, cuir. Fixes : un personnage n'est pas un thème. */
const BRONZE = "#B08A3E";
const BRONZE_SOMBRE = "#7C5F26";
const ROUGE = "#9E3226";
const CUIR = "#8A6A4A";
const CHAIR = "#C8A07C";

type XY = { x: number; y: number };

/** Quadrilatère effilé d'une articulation à l'autre : c'est ce qui donne du volume. */
function membre(a: XY, b: XY, largeurA: number, largeurB: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const longueur = Math.hypot(dx, dy) || 1;
  // Normale au segment : c'est elle qui donne l'épaisseur.
  const nx = -dy / longueur;
  const ny = dx / longueur;

  const p = (c: XY, n: number) => `${c.x + nx * n},${c.y + ny * n}`;
  return [
    p(a, largeurA / 2),
    p(b, largeurB / 2),
    p(b, -largeurB / 2),
    p(a, -largeurA / 2),
  ].join(" ");
}

export function Hoplite({ pose, taille }: { pose: Pose; taille: number }) {
  const u = taille / 100;
  const p = (point: Point): XY => ({ x: point[0] * u, y: point[1] * u });

  const tete = p(pose.tete);
  const cou = p(pose.cou);
  const bassin = p(pose.bassin);
  const coude = p(pose.coude);
  const poignet = p(pose.poignet);
  const genou = p(pose.genou);
  const cheville = p(pose.cheville);

  const fond = membresDuFond(pose, 7);
  const coudeF = p(fond.coude);
  const poignetF = p(fond.poignet);
  const genouF = p(fond.genou);
  const chevilleF = p(fond.cheville);

  // Le casque suit l'axe cou → tête : penché en pompes, droit debout.
  const angle = (Math.atan2(tete.x - cou.x, cou.y - tete.y) * 180) / Math.PI;

  const bras = (c: XY, poig: XY, teinte: string) => (
    <>
      <Polygon points={membre(cou, c, 7 * u, 5 * u)} fill={teinte} />
      <Polygon points={membre(c, poig, 5 * u, 3.8 * u)} fill={teinte} />
      <Circle cx={c.x} cy={c.y} r={2.4 * u} fill={teinte} />
    </>
  );

  const jambe = (g: XY, chev: XY, teinte: string) => (
    <>
      <Polygon points={membre(bassin, g, 8.5 * u, 6 * u)} fill={teinte} />
      <Polygon points={membre(g, chev, 6 * u, 4.2 * u)} fill={teinte} />
      <Circle cx={g.x} cy={g.y} r={2.8 * u} fill={teinte} />
      {/* Cnémide : la jambière de bronze, sur le tibia seulement. */}
      <Polygon points={membre(g, chev, 6.4 * u, 4.6 * u)} fill={BRONZE_SOMBRE} opacity={0.5} />
    </>
  );

  // Direction du corps, pour accrocher la cape du bon côté quel que soit le geste.
  const dx = bassin.x - cou.x;
  const dy = bassin.y - cou.y;
  const norme = Math.hypot(dx, dy) || 1;
  const perpX = -dy / norme;
  const perpY = dx / norme;

  return (
    <>
      {/* Cape, tout au fond : accrochée aux épaules, elle traîne derrière le
          corps. Dessinée avant tout le reste, elle ne recouvre plus les bras. */}
      <Path
        d={`M ${cou.x + perpX * 7 * u} ${cou.y + perpY * 7 * u}
            Q ${cou.x + perpX * 20 * u + dx * 0.5} ${cou.y + perpY * 20 * u + dy * 0.5}
              ${bassin.x + perpX * 13 * u} ${bassin.y + perpY * 13 * u}
            L ${bassin.x} ${bassin.y}
            L ${cou.x} ${cou.y} Z`}
        fill={ROUGE}
        opacity={0.75}
      />

      {/* Membres du fond, assombris : c'est ce qui donne la profondeur. */}
      <G opacity={0.5}>
        {jambe(genouF, chevilleF, CUIR)}
        {bras(coudeF, poignetF, CHAIR)}
      </G>

      {/* Pagne de cuir : court, il ne descend qu'au haut des cuisses. */}
      <Polygon points={membre(cou, bassin, 3 * u, 15 * u)} fill={CUIR} />

      {/* Cuirasse : large aux épaules, resserrée à la taille. */}
      <Polygon points={membre(cou, bassin, 16 * u, 11 * u)} fill={BRONZE} />
      <Polygon points={membre(cou, bassin, 16 * u, 11 * u)} fill={BRONZE_SOMBRE} opacity={0.22} />

      {jambe(genou, cheville, CUIR)}
      {bras(coude, poignet, CHAIR)}

      {/* Casque corinthien. Le cimier est une crête posée sur la calotte, et
          non un panneau derrière la tête : c'est lui qui signe l'hoplite. */}
      <G transform={`rotate(${angle} ${tete.x} ${tete.y})`}>
        <Path
          d={`M ${tete.x - 7 * u} ${tete.y - 6 * u}
              Q ${tete.x} ${tete.y - 15 * u} ${tete.x + 6 * u} ${tete.y - 5 * u}
              Q ${tete.x} ${tete.y - 9 * u} ${tete.x - 7 * u} ${tete.y - 6 * u} Z`}
          fill={ROUGE}
        />
        <Circle cx={tete.x} cy={tete.y} r={7 * u} fill={BRONZE} />
        {/* Ouverture en T : deux fentes pour les yeux, une pour le nez. */}
        <Path
          d={`M ${tete.x + 1.5 * u} ${tete.y - 2.5 * u} h ${5 * u} v ${2 * u} h -${5 * u} Z`}
          fill={BRONZE_SOMBRE}
        />
        <Path
          d={`M ${tete.x + 0.5 * u} ${tete.y - 1.5 * u} h ${1.8 * u} v ${7 * u} h -${1.8 * u} Z`}
          fill={BRONZE_SOMBRE}
        />
      </G>
    </>
  );
}

/** Rendu autonome, pour l'aperçu. Dans l'app, `Silhouette` choisit le mannequin. */
export function ApercuHoplite({ pose, taille }: { pose: Pose; taille: number }) {
  return (
    <Svg width={taille} height={taille}>
      <Hoplite pose={pose} taille={taille} />
    </Svg>
  );
}
