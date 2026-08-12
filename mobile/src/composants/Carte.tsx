import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { POLICE_TEXTE_GRAS, POLICE_TITRE, type Couleurs } from "../theme/couleurs";
import { useStyles } from "../theme/theme";

/**
 * Surface de contenu, équivalent natif de l'utilitaire `surface` du web
 * (`app/globals.css`) : fond nuit translucide, liseré discret, coins arrondis.
 */
export function Carte({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(creerStyles);
  return <View style={[styles.carte, style]}>{children}</View>;
}

/** Intitulé de section : petites capitales espacées, filet doré. */
export function TitreSection({ children }: { children: string }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.titreLigne}>
      <Text style={styles.titreTexte}>{children.toUpperCase()}</Text>
      <View style={styles.filet} />
    </View>
  );
}

/** Grand titre en sérif, comme les h1/h2 du web. */
export function Titre({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={style}>
      <Text style={styles.grandTitre}>{children}</Text>
    </View>
  );
}

/**
 * Ornement grec : un filet doré interrompu par un losange.
 * Sert à séparer les grands moments — bilan de séance, écran de connexion.
 */
export function Ornement({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={[styles.ornement, style]}>
      <View style={styles.ornementTrait} />
      <View style={styles.ornementLosange} />
      <View style={styles.ornementTrait} />
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  carte: {
    backgroundColor: c.fond2,
    borderColor: c.fond3,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  titreLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  titreTexte: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.accent,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  filet: {
    flex: 1,
    height: 1,
    backgroundColor: c.fond3,
  },
  grandTitre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    letterSpacing: 1,
  },
  ornement: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ornementTrait: {
    height: 1,
    width: 48,
    backgroundColor: c.accent,
    opacity: 0.7,
  },
  ornementLosange: {
    width: 8,
    height: 8,
    backgroundColor: c.accent,
    transform: [{ rotate: "45deg" }],
  },
});
