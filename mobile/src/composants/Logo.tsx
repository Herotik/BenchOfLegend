import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { POLICE_TITRE, type Couleurs } from "../theme/couleurs";
import { useStyles } from "../theme/theme";

/**
 * La marque : le Δ gravé, tenu par quatre équerres.
 *
 * Les équerres ne se rejoignent jamais et sont toujours quatre — c'est ce qui
 * les distingue d'un cadre, lequel enfermerait la marque au lieu de la
 * désigner. Aucun halo, aucune ombre : l'identité ne connaît que des traits.
 *
 * Un seul composant pour l'écran de connexion, l'animation d'ouverture, l'aide
 * et les réglages : quatre dessins séparés auraient fini par diverger d'un
 * demi-point d'épaisseur, ce qui se voit.
 */
export function Marque({
  taille = 120,
  style,
}: {
  taille?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(creerStyles);

  // Tout est proportionnel au côté : la marque doit tenir aussi bien en 48 px
  // dans un pied de page qu'en 160 px sur l'écran d'ouverture.
  const branche = taille * 0.185;
  const trait = Math.max(1.2, taille * 0.017);

  const equerre = (
    haut: boolean,
    gauche: boolean,
  ): StyleProp<ViewStyle> => ({
    position: "absolute",
    width: branche,
    height: branche,
    [haut ? "top" : "bottom"]: 0,
    [gauche ? "left" : "right"]: 0,
    [haut ? "borderTopWidth" : "borderBottomWidth"]: trait,
    [gauche ? "borderLeftWidth" : "borderRightWidth"]: trait,
  });

  return (
    <View style={[{ width: taille, height: taille }, styles.cadre, style]}>
      <View style={[styles.equerre, equerre(true, true)]} />
      <View style={[styles.equerre, equerre(true, false)]} />
      <View style={[styles.equerre, equerre(false, true)]} />
      <View style={[styles.equerre, equerre(false, false)]} />
      <Text
        style={[
          styles.delta,
          { fontSize: taille * 0.52, lineHeight: taille * 0.62 },
        ]}
      >
        Δ
      </Text>
    </View>
  );
}

/** La marque et le nom, empilés. */
export function Logotype({
  taille = 120,
  style,
}: {
  taille?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(creerStyles);
  return (
    <View style={[styles.logotype, style]}>
      <Marque taille={taille} />
      <Text
        style={[
          styles.nom,
          { fontSize: taille * 0.2, letterSpacing: taille * 0.028 },
        ]}
      >
        FRAME OF LEGENDS
      </Text>
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  cadre: {
    alignItems: "center",
    justifyContent: "center",
  },
  equerre: {
    borderColor: c.accent,
  },
  delta: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
  },
  logotype: {
    alignItems: "center",
    gap: 14,
  },
  nom: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    textAlign: "center",
  },
});
