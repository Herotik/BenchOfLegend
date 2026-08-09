import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View, type ColorValue } from "react-native";
import { useSession } from "../../src/auth/session";
import { Chargement } from "../../src/composants/Etats";
import { COULEURS } from "../../src/theme/couleurs";

/**
 * Navigation par onglets, et garde d'accès.
 *
 * `Tabs` vient de `expo-router/js-tabs` : l'export homonyme de `expo-router`
 * est déprécié dans cette version.
 *
 * La garde est ici plutôt que dans chaque écran — un onglet ajouté demain
 * hériterait sinon d'un accès non contrôlé.
 */
export default function DispositionOnglets() {
  const { etat } = useSession();

  if (etat === "chargement") {
    return (
      <View style={styles.attente}>
        <Chargement />
      </View>
    );
  }

  if (etat === "deconnecte") return <Redirect href="/connexion" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: COULEURS.nuit950 },
        tabBarStyle: styles.barre,
        tabBarActiveTintColor: COULEURS.or500,
        tabBarInactiveTintColor: COULEURS.cendre,
        tabBarLabelStyle: styles.etiquette,
      }}
    >
      <Tabs.Screen
        name="aujourdhui"
        options={{
          title: "Aujourd'hui",
          tabBarIcon: ({ color }) => <Losange couleur={color} />,
        }}
      />
      <Tabs.Screen
        name="reglages"
        options={{
          title: "Réglages",
          tabBarIcon: ({ color }) => <Curseurs couleur={color} />,
        }}
      />
    </Tabs>
  );
}

/**
 * Icônes dessinées à la main.
 *
 * `@expo/vector-icons` n'est pas une dépendance de ce projet, et l'ajouter pour
 * deux pictogrammes reviendrait à embarquer plusieurs polices d'icônes. Deux
 * formes géométriques suffisent, et le losange reprend l'ornement du thème.
 */
function Losange({ couleur }: { couleur: ColorValue }) {
  return <View style={[styles.losange, { backgroundColor: couleur }]} />;
}

function Curseurs({ couleur }: { couleur: ColorValue }) {
  return (
    <View style={styles.curseurs}>
      <View style={[styles.curseur, { backgroundColor: couleur, width: 20 }]} />
      <View style={[styles.curseur, { backgroundColor: couleur, width: 13 }]} />
      <View style={[styles.curseur, { backgroundColor: couleur, width: 17 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  attente: {
    flex: 1,
    backgroundColor: COULEURS.nuit950,
  },
  barre: {
    backgroundColor: COULEURS.nuit900,
    borderTopColor: COULEURS.nuit700,
    borderTopWidth: 1,
  },
  etiquette: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  losange: {
    width: 15,
    height: 15,
    transform: [{ rotate: "45deg" }],
  },
  curseurs: {
    gap: 3,
    alignItems: "flex-start",
    width: 20,
  },
  curseur: {
    height: 2.5,
    borderRadius: 2,
  },
});
