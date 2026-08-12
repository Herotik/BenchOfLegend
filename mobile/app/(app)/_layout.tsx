import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View, type ColorValue } from "react-native";
import { useSession } from "../../src/auth/session";
import { Chargement } from "../../src/composants/Etats";
import { POLICE_TEXTE, type Couleurs } from "../../src/theme/couleurs";
import { useCouleurs, useStyles } from "../../src/theme/theme";

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
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const { etat, moi } = useSession();

  if (etat === "chargement") {
    return (
      <View style={styles.attente}>
        <Chargement />
      </View>
    );
  }

  if (etat === "deconnecte") return <Redirect href="/connexion" />;

  // Le profil arrive après la session : tant qu'il manque, on attend plutôt
  // que de laisser voir un tableau de bord sans plan ni préférences.
  if (!moi) {
    return (
      <View style={styles.attente}>
        <Chargement message="Chargement du profil…" />
      </View>
    );
  }

  // Sans préférences, il n'y a ni plan à afficher ni séance à proposer :
  // l'onglet « Aujourd'hui » n'aurait rien à montrer.
  if (!moi.utilisateur.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.fond },
        tabBarStyle: styles.barre,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.texte3,
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
        name="calendrier"
        options={{
          title: "Calendrier",
          tabBarIcon: ({ color }) => <Quadrillage couleur={color} />,
        }}
      />
      <Tabs.Screen
        name="progres"
        options={{
          title: "Progrès",
          tabBarIcon: ({ color }) => <Colonnes couleur={color} />,
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
  const styles = useStyles(creerStyles);
  return <View style={[styles.losange, { backgroundColor: couleur }]} />;
}

function Quadrillage({ couleur }: { couleur: ColorValue }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.quadrillage}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.carreau, { backgroundColor: couleur }]} />
      ))}
    </View>
  );
}

function Colonnes({ couleur }: { couleur: ColorValue }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.colonnes}>
      {[8, 14, 11, 18].map((h, i) => (
        <View key={i} style={[styles.colonne, { backgroundColor: couleur, height: h }]} />
      ))}
    </View>
  );
}

function Curseurs({ couleur }: { couleur: ColorValue }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.curseurs}>
      <View style={[styles.curseur, { backgroundColor: couleur, width: 20 }]} />
      <View style={[styles.curseur, { backgroundColor: couleur, width: 13 }]} />
      <View style={[styles.curseur, { backgroundColor: couleur, width: 17 }]} />
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  attente: {
    flex: 1,
    backgroundColor: c.fond,
  },
  barre: {
    backgroundColor: c.fond,
    borderTopColor: c.fond3,
    borderTopWidth: 1,
  },
  etiquette: {
    fontFamily: POLICE_TEXTE,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  losange: {
    width: 15,
    height: 15,
    transform: [{ rotate: "45deg" }],
  },
  quadrillage: {
    width: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  carreau: {
    width: 8,
    height: 8,
  },
  colonnes: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 18,
  },
  colonne: {
    width: 3,
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
