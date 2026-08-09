import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COULEURS } from "../theme/couleurs";
import { Bouton } from "./Bouton";
import { Ornement } from "./Carte";

/**
 * Écrans d'attente et d'échec.
 *
 * Une app de salle de sport se consulte entre deux séries, sur un réseau qui
 * n'est pas toujours là : l'attente et la panne sont des états normaux, pas
 * des exceptions à traiter à la va-vite.
 */

export function Chargement({ message = "Chargement…" }: { message?: string }) {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={COULEURS.or500} size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

export function EcranErreur({
  message,
  titre = "Quelque chose a cédé",
  libelleAction = "Réessayer",
  onReessayer,
}: {
  message: string;
  titre?: string;
  libelleAction?: string;
  onReessayer?: () => void;
}) {
  return (
    <View style={styles.centre}>
      <Ornement />
      <Text style={styles.titre}>{titre}</Text>
      <Text style={styles.message}>{message}</Text>
      {onReessayer ? (
        <Bouton
          titre={libelleAction}
          onPress={onReessayer}
          intention="sombre"
          style={styles.bouton}
        />
      ) : null}
    </View>
  );
}

/** Message calme quand il n'y a rien à montrer — jamais culpabilisant. */
export function Vide({ message }: { message: string }) {
  return (
    <View style={styles.vide}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  vide: {
    paddingVertical: 24,
    alignItems: "center",
  },
  titre: {
    color: COULEURS.ivoire,
    fontSize: 18,
    fontWeight: "600",
  },
  message: {
    color: COULEURS.brume,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  bouton: {
    marginTop: 8,
    minWidth: 180,
  },
});
