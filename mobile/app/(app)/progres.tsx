import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
 * Les tracés sont en barres, dessinées avec des vues plutôt qu'en SVG. Une
 * dépendance graphique se justifierait pour des courbes lissées et des axes ;
 * ici quatre séries suffisent, et chacune se lit mieux en barres qu'en
 * courbe sur trois centimètres de large.
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

/**
 * Poids : barres mises à l'échelle **entre le minimum et le maximum**, non à
 * partir de zéro. Un écart de deux kilos sur soixante-dix serait invisible sur
 * une échelle absolue, et c'est pourtant tout ce qu'on vient regarder.
 */
function CourbePoids({ points }: { points: PointPoids[] }) {
  const styles = useStyles(creerStyles);
  const kgs = points.map((p) => p.kg);
  const bas = Math.min(...kgs);
  const haut = Math.max(...kgs);
  const amplitude = haut - bas || 1;

  const dernier = points[points.length - 1]!;
  const premier = points[0]!;
  const delta = Math.round((dernier.kg - premier.kg) * 10) / 10;

  return (
    <View>
      <View style={styles.entetePoids}>
        <Text style={styles.poidsActuel}>{dernier.kg} kg</Text>
        <Text style={[styles.poidsDelta, delta === 0 && styles.poidsDeltaNul]}>
          {delta > 0 ? "+" : ""}
          {delta} kg sur la période
        </Text>
      </View>
      <View style={styles.graphe}>
        {points.map((p, i) => (
          <View key={i} style={styles.colonne}>
            <View style={styles.gouttiere}>
              <View
                style={[styles.barre, { height: `${12 + ((p.kg - bas) / amplitude) * 88}%` }]}
              />
            </View>
            <Text style={styles.abscisse}>{p.date.slice(8, 10)}</Text>
          </View>
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
