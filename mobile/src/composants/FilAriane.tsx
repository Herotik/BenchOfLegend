import { StyleSheet, Text, View } from "react-native";
import { COULEURS } from "../theme/couleurs";
import type { StatutExercice } from "../api/types";

/**
 * Fil d'Ariane de la séance guidée.
 *
 * Un segment par exercice, l'exercice courant plus large. C'est la seule
 * indication de position : l'écran ne montre qu'un exercice à la fois, sans ce
 * fil on ne saurait ni où l'on en est, ni combien il reste.
 */
export function FilAriane({
  total,
  courant,
  statuts,
}: {
  total: number;
  /** Index de l'exercice affiché, ou `total` sur les étapes de fin. */
  courant: number;
  statuts: (StatutExercice | undefined)[];
}) {
  return (
    <View style={styles.bloc}>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              index === courant && styles.segmentCourant,
              { backgroundColor: couleurSegment(statuts[index], index === courant) },
            ]}
          />
        ))}
      </View>
      <Text style={styles.compteur}>
        {courant >= total ? `${total} / ${total}` : `Exercice ${courant + 1} / ${total}`}
      </Text>
    </View>
  );
}

/**
 * Le rouge est proscrit : la spec interdit de culpabiliser. Un exercice non
 * fait reste neutre, un exercice entamé sans être bouclé prend l'or terni.
 */
function couleurSegment(statut: StatutExercice | undefined, courant: boolean): string {
  if (statut === "fait") return COULEURS.succes;
  if (statut === "partiel") return COULEURS.or600;
  if (statut === "non_fait") return COULEURS.nuit600;
  return courant ? COULEURS.or500 : COULEURS.nuit700;
}

const styles = StyleSheet.create({
  bloc: {
    gap: 8,
  },
  segments: {
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  segmentCourant: {
    height: 6,
    borderRadius: 3,
  },
  compteur: {
    color: COULEURS.brume,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
});
