import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { chargerStats } from "../../src/api/routes";
import type { PointPoids, Stats } from "../../src/api/types";
import { useSession } from "../../src/auth/session";
import { Carte, Ornement, TitreSection } from "../../src/composants/Carte";
import { Chargement, EcranErreur, Vide } from "../../src/composants/Etats";
import { POLICE_TEXTE, POLICE_TEXTE_MOYEN, POLICE_TITRE, type Couleurs } from "../../src/theme/couleurs";
import { useCouleurs, useStyles } from "../../src/theme/theme";

/**
 * Progrès : poids, assiduité, volume, Δ.
 *
 * Les agrégats viennent tous de `GET /stats`, calculés côté serveur — moyenne
 * glissante comprise. L'app ne fait que les mettre en forme.
 *
 * Le poids se lit en **courbe**, le reste en barres, et la différence n'est pas
 * décorative : une barre représente une quantité produite sur un intervalle —
 * des séries faites dans la semaine, des Δ gagnés — quand le poids est un
 * niveau relevé à un instant. Ce qui compte alors est la pente entre deux
 * relevés, que des colonnes juxtaposées obligent l'œil à reconstituer.
 *
 * Les barres restent dessinées avec des vues ; la courbe passe par SVG, déjà
 * embarqué pour les icônes d'onglets (`composants/Icones.tsx`) — aucune
 * dépendance nouvelle, et le changement reste livrable par `eas update`.
 */

/** Nombre de points affichés : au-delà, les barres deviennent illisibles. */
const FENETRE = 14;

export default function Progres() {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const { moi } = useSession();
  const marges = useSafeAreaInsets();

  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      setStats(await chargerStats());
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Chargement impossible");
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const rafraichir = useCallback(() => {
    setRafraichit(true);
    void charger().finally(() => setRafraichit(false));
  }, [charger]);

  if (erreur && !stats) return <EcranErreur message={erreur} onReessayer={() => void charger()} />;
  if (!stats) return <Chargement message="Calcul des statistiques…" />;

  const pesees = stats.poids.slice(-FENETRE);
  const semaines = stats.semaines.slice(-FENETRE);
  const rien = pesees.length === 0 && semaines.length === 0;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.contenu, { paddingTop: marges.top + 16, paddingBottom: 32 }]}
      refreshControl={
        <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={c.texte2} />
      }
    >
      <Text style={styles.titre}>Progrès</Text>

      {rien ? (
        <Vide message="Rien à tracer pour l'instant. Valide une séance ou pèse-toi, et les courbes apparaîtront." />
      ) : null}

      {pesees.length > 0 ? (
        <>
          <TitreSection>Poids</TitreSection>
          <Carte style={styles.carte}>
            <CourbePoids points={pesees} />
          </Carte>
        </>
      ) : null}

      {semaines.length > 0 ? (
        <>
          <TitreSection>Assiduité</TitreSection>
          <Carte style={styles.carte}>
            <Barres
              valeurs={semaines.map((s) => s.assiduite ?? 0)}
              etiquettes={semaines.map((s) => s.semaine.slice(8, 10))}
              maximum={100}
              suffixe=" %"
              vide="Aucune séance encore prévue."
            />
            <Text style={styles.legende}>
              Part des séances prévues qui ont été validées, semaine par semaine.
            </Text>
          </Carte>

          <TitreSection>Volume</TitreSection>
          <Carte style={styles.carte}>
            <Barres
              valeurs={semaines.map((s) => s.volumeTotal)}
              etiquettes={semaines.map((s) => s.semaine.slice(8, 10))}
              suffixe=" séries"
              vide="Aucune série enregistrée."
            />
            <Text style={styles.legende}>
              Séries effectuées par semaine. Une série entamée sans être bouclée compte pour
              moitié.
            </Text>
          </Carte>
        </>
      ) : null}

      {stats.lp.length > 0 ? (
        <>
          <TitreSection>Δ cumulés</TitreSection>
          <Carte style={styles.carte}>
            <Barres
              valeurs={stats.lp.slice(-FENETRE).map((p) => p.lp)}
              etiquettes={stats.lp.slice(-FENETRE).map((p) => p.date.slice(8, 10))}
              suffixe=" Δ"
              vide=""
            />
            <Text style={styles.legende}>
              Total après chaque séance. La courbe ne redescend jamais : aucune perte de Δ,
              jamais.
            </Text>
          </Carte>
        </>
      ) : null}

      <Ornement style={styles.ornement} />

      <Link href="/historique" asChild>
        <Text style={styles.lien}>Voir l&apos;historique des séances →</Text>
      </Link>

      {moi ? <Text style={styles.total}>{moi.lp} Δ au total</Text> : null}
    </ScrollView>
  );
}

/**
 * Barres verticales, mises à l'échelle du plus grand point.
 *
 * `maximum` fige l'échelle quand la grandeur en a une — un pourcentage se lit
 * sur 100, pas sur le meilleur résultat obtenu, sinon une semaine à 40 %
 * paraîtrait pleine dès qu'elle est la meilleure.
 */
function Barres({
  valeurs,
  etiquettes,
  maximum,
  suffixe,
  vide,
}: {
  valeurs: number[];
  etiquettes: string[];
  maximum?: number;
  suffixe: string;
  vide: string;
}) {
  const styles = useStyles(creerStyles);
  const plafond = maximum ?? Math.max(...valeurs, 1);

  if (valeurs.every((v) => v === 0) && vide) {
    return <Text style={styles.videTexte}>{vide}</Text>;
  }

  return (
    <View>
      <View style={styles.graphe}>
        {valeurs.map((v, i) => (
          <View key={i} style={styles.colonne}>
            <View style={styles.gouttiere}>
              <View
                style={[
                  styles.barre,
                  // Un minimum visible : une valeur nulle doit se distinguer
                  // d'une absence de donnée, qui ne dessine rien du tout.
                  { height: `${Math.max((v / plafond) * 100, v > 0 ? 4 : 0)}%` },
                ]}
              />
            </View>
            <Text style={styles.abscisse}>{etiquettes[i]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.sommet}>
        max {Math.round(plafond * 10) / 10}
        {suffixe}
      </Text>
    </View>
  );
}

/** Hauteur du tracé, alignée sur celle des barres pour que la page reste régulière. */
const HAUTEUR_COURBE = 132;

/** Marge intérieure : sans elle, les pastilles des extrêmes seraient rognées. */
const MARGE = 10;

/**
 * Tension du lissage.
 *
 * Catmull-Rom classique vaut 1 et dépasse les points qu'il relie : la courbe
 * descendrait sous le poids le plus bas, affichant un kilo qui n'a jamais été
 * relevé. 0,8 arrondit l'angle sans inventer de minimum.
 */
const TENSION = 0.8;

interface Point2D {
  x: number;
  y: number;
}

/**
 * Chemin SVG lissé passant par tous les points, en Bézier cubiques dont les
 * tangentes suivent la pente locale (Catmull-Rom).
 */
function cheminLisse(pts: Point2D[]): string {
  const [premier] = pts;
  if (!premier) return "";
  if (pts.length === 1) return `M ${premier.x} ${premier.y}`;

  let d = `M ${premier.x} ${premier.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    // Bornes garanties par la condition de boucle.
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    // Aux extrémités, le point manquant est remplacé par son voisin : la
    // tangente y devient celle du premier segment, plutôt que de partir de
    // travers faute de repère.
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;

    const c1x = p1.x + ((p2.x - p0.x) / 6) * TENSION;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * TENSION;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * TENSION;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * TENSION;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Poids : courbe mise à l'échelle **entre le minimum et le maximum**, non à
 * partir de zéro. Un écart de deux kilos sur soixante-dix serait invisible sur
 * une échelle absolue, et c'est pourtant tout ce qu'on vient regarder.
 *
 * Trois couches, du fond vers l'avant : l'aire dégradée qui donne du poids au
 * tracé, la moyenne glissante en pointillés — celle que le serveur calcule sur
 * sept jours, et la seule qui dise quelque chose d'une prise ou d'une perte —
 * puis la courbe des relevés, ponctuée d'une pastille par pesée. Ces pastilles
 * ne sont pas un ornement : le lissage dessine entre les points des valeurs qui
 * n'ont jamais été mesurées, et elles rappellent où sont les mesures.
 */
function CourbePoids({ points }: { points: PointPoids[] }) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();

  // La largeur n'est connue qu'après la mise en page : le SVG a besoin d'un
  // nombre, là où les vues se contentaient de pourcentages.
  const [largeur, setLargeur] = useState(0);

  const kgs = points.map((p) => p.kg);
  const bas = Math.min(...kgs);
  const haut = Math.max(...kgs);
  const amplitude = haut - bas || 1;

  const dernier = points[points.length - 1]!;
  const premier = points[0]!;
  const delta = Math.round((dernier.kg - premier.kg) * 10) / 10;

  // Centre de la i-ème colonne : les étiquettes restent des vues en `flex: 1`,
  // et le tracé se cale sur elles plutôt que l'inverse.
  const pas = largeur / points.length;
  const abscisse = (i: number) => (i + 0.5) * pas;
  const ordonnee = (kg: number) =>
    // Une seule pesée, ou plusieurs identiques : il n'y a pas d'échelle à
    // établir. On centre plutôt que de laisser la formule coller le tracé au
    // bas de la carte, où il se lirait comme un poids au plus bas.
    haut === bas
      ? HAUTEUR_COURBE / 2
      : MARGE + (1 - (kg - bas) / amplitude) * (HAUTEUR_COURBE - 2 * MARGE);

  const releves = points.map((p, i) => ({ x: abscisse(i), y: ordonnee(p.kg) }));

  // La tendance manque sous trois pesées : le serveur préfère ne rien dire
  // plutôt qu'une moyenne sur deux points. On ne trace alors que les relevés.
  const tendances = points
    .map((p, i) => (p.tendance === null ? null : { x: abscisse(i), y: ordonnee(p.tendance) }))
    .filter((p): p is Point2D => p !== null);

  return (
    <View>
      <View style={styles.entetePoids}>
        <Text style={styles.poidsActuel}>{dernier.kg} kg</Text>
        <Text style={[styles.poidsDelta, delta === 0 && styles.poidsDeltaNul]}>
          {delta > 0 ? "+" : ""}
          {delta} kg sur la période
        </Text>
      </View>

      <View
        style={styles.courbe}
        onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={
          `Courbe de poids : de ${bas} à ${haut} kilos, ` +
          `${delta >= 0 ? "+" : ""}${delta} kilo sur la période.`
        }
      >
        {largeur > 0 ? (
          <Svg width={largeur} height={HAUTEUR_COURBE}>
            <Defs>
              <LinearGradient id="airePoids" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.accent} stopOpacity={0.22} />
                <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {releves.length > 1 ? (
              <Path
                d={`${cheminLisse(releves)} L ${releves[releves.length - 1]!.x} ${HAUTEUR_COURBE} L ${releves[0]!.x} ${HAUTEUR_COURBE} Z`}
                fill="url(#airePoids)"
              />
            ) : null}

            {tendances.length > 1 ? (
              <Path
                d={cheminLisse(tendances)}
                stroke={c.texte3}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
              />
            ) : null}

            <Path
              d={cheminLisse(releves)}
              stroke={c.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {releves.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                // La dernière pesée est celle qu'on vient chercher : elle est
                // marquée plus franchement que les précédentes.
                r={i === releves.length - 1 ? 4.5 : 2.5}
                fill={i === releves.length - 1 ? c.accent : c.fond}
                stroke={c.accent}
                strokeWidth={1.5}
              />
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={styles.abscisses}>
        {points.map((p, i) => (
          <Text key={i} style={[styles.abscisse, styles.abscisseCellule]}>
            {p.date.slice(8, 10)}
          </Text>
        ))}
      </View>

      <Text style={styles.sommet}>
        de {bas} à {haut} kg
        {dernier.tendance !== null ? ` · tendance ${dernier.tendance} kg` : ""}
      </Text>
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  contenu: {
    paddingHorizontal: 18,
    gap: 8,
  },
  titre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    marginBottom: 6,
  },
  carte: {
    gap: 10,
  },
  graphe: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 132,
  },
  colonne: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  gouttiere: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "flex-end",
    backgroundColor: c.fond3,
  },
  barre: {
    backgroundColor: c.accent,
    width: "100%",
  },
  abscisse: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 9,
  },
  courbe: {
    height: HAUTEUR_COURBE,
  },
  // Mêmes cellules que les colonnes des barres — c'est ce qui permet à la
  // courbe de se caler sur le centre de chacune.
  abscisses: {
    flexDirection: "row",
    marginTop: 4,
  },
  abscisseCellule: {
    flex: 1,
    textAlign: "center",
  },
  sommet: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 11,
    marginTop: 8,
  },
  legende: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12,
    lineHeight: 18,
  },
  videTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
  },
  entetePoids: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  poidsActuel: {
    fontFamily: POLICE_TITRE,
    color: c.texte,
    fontSize: 26,
  },
  poidsDelta: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12.5,
  },
  poidsDeltaNul: {
    color: c.texte3,
  },
  ornement: {
    marginVertical: 14,
  },
  lien: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.accent,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 10,
  },
  total: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});
