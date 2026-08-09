import { StyleSheet, Text, View } from "react-native";
import { COULEURS } from "../theme/couleurs";

/**
 * Barre d'avancement dans la division.
 *
 * `part` vient du serveur (`rang.progression`, entre 0 et 1) : l'app ne
 * recalcule rien, elle borne seulement au cas où — une barre qui déborde de sa
 * gouttière est plus laide qu'un arrondi perdu.
 */
export function BarreProgression({
  part,
  gauche,
  droite,
  couleur = COULEURS.or500,
}: {
  part: number;
  gauche?: string;
  droite?: string;
  couleur?: string;
}) {
  const pourcentage = `${Math.round(Math.min(Math.max(part, 0), 1) * 100)}%` as const;

  return (
    <View style={styles.bloc}>
      <View
        style={styles.gouttiere}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: Math.round(part * 100), min: 0, max: 100 }}
      >
        <View style={[styles.remplissage, { width: pourcentage, backgroundColor: couleur }]} />
      </View>
      {gauche || droite ? (
        <View style={styles.legende}>
          <Text style={styles.texte}>{gauche ?? ""}</Text>
          <Text style={styles.texte}>{droite ?? ""}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    gap: 6,
  },
  gouttiere: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COULEURS.nuit700,
    overflow: "hidden",
  },
  remplissage: {
    height: "100%",
    borderRadius: 4,
  },
  legende: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  texte: {
    color: COULEURS.brume,
    fontSize: 12,
  },
});
