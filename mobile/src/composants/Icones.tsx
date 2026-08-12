import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { ColorValue } from "react-native";

/**
 * Pictogrammes de la barre d'onglets.
 *
 * Tracés au trait, jamais en aplat : l'identité ne connaît que des lignes —
 * les équerres, les filets, l'ornement en losange. Une icône pleine y ferait
 * tache, et les formes géométriques bricolées en `View` que ces icônes
 * remplacent n'avaient ni régularité ni finesse.
 *
 * Toutes sont dessinées sur une grille de 24, avec la même épaisseur de trait
 * et les mêmes extrémités arrondies : c'est ce qui les fait lire comme une
 * famille plutôt que comme quatre dessins voisins.
 */

const COTE = 23;
const TRAIT = 1.6;

interface Props {
  couleur: ColorValue;
}

const commun = {
  width: COTE,
  height: COTE,
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: TRAIT,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Aujourd'hui : le losange de l'ornement, ouvert et centré d'un point. */
export function IconeAujourdhui({ couleur }: Props) {
  return (
    <Svg {...commun} stroke={couleur as string}>
      <Path d="M12 3.2 20.8 12 12 20.8 3.2 12Z" />
      <Circle cx="12" cy="12" r="2.1" fill={couleur as string} stroke="none" />
    </Svg>
  );
}

/** Calendrier : la page et ses deux anneaux, une semaine soulignée. */
export function IconeCalendrier({ couleur }: Props) {
  return (
    <Svg {...commun} stroke={couleur as string}>
      <Rect x="3.2" y="5" width="17.6" height="15.8" rx="2" />
      <Line x1="3.2" y1="9.6" x2="20.8" y2="9.6" />
      <Line x1="8" y1="3.2" x2="8" y2="6.4" />
      <Line x1="16" y1="3.2" x2="16" y2="6.4" />
      <Line x1="7.4" y1="14.4" x2="11" y2="14.4" />
      <Line x1="13.6" y1="14.4" x2="16.6" y2="14.4" />
    </Svg>
  );
}

/** Progrès : la ligne qui monte, posée sur son axe. */
export function IconeProgres({ couleur }: Props) {
  return (
    <Svg {...commun} stroke={couleur as string}>
      <Path d="M3.6 20.4V3.8" />
      <Path d="M3.6 20.4h16.8" />
      <Path d="m7 15.6 3.6-4.4 3 2.6 4.6-6" />
      <Circle cx="18.2" cy="7.8" r="1.7" fill={couleur as string} stroke="none" />
    </Svg>
  );
}

/** Réglages : trois curseurs, chacun à sa position. */
export function IconeReglages({ couleur }: Props) {
  return (
    <Svg {...commun} stroke={couleur as string}>
      <Line x1="3.4" y1="7" x2="20.6" y2="7" />
      <Line x1="3.4" y1="12" x2="20.6" y2="12" />
      <Line x1="3.4" y1="17" x2="20.6" y2="17" />
      <Circle cx="8.4" cy="7" r="2.3" fill="none" />
      <Circle cx="15.4" cy="12" r="2.3" fill="none" />
      <Circle cx="10.6" cy="17" r="2.3" fill="none" />
    </Svg>
  );
}

/** Aide : la clé de voûte, et le point d'interrogation qu'on vient poser. */
export function IconeAide({ couleur }: Props) {
  return (
    <Svg {...commun} stroke={couleur as string}>
      <Circle cx="12" cy="12" r="8.8" />
      <Path d="M9.5 9.4a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.7-.9 1.3v.7" />
      <Circle cx="12" cy="16.8" r="1.05" fill={couleur as string} stroke="none" />
    </Svg>
  );
}
