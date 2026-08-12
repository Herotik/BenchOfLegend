import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { POLICE_TEXTE_MOYEN, POLICE_TEXTE, OPACITE_INACTIF, type Couleurs } from "../theme/couleurs";
import { useCouleurs, useStyles } from "../theme/theme";

/**
 * Bouton unique de l'app, décliné en trois intentions.
 *
 * `or` porte l'action principale de l'écran, `sombre` les actions
 * secondaires, `discret` ce qui doit rester accessible sans attirer l'œil —
 * passer un exercice, refuser une proposition.
 */
export type IntentionBouton = "or" | "sombre" | "discret";

interface Props {
  titre: string;
  onPress: () => void;
  intention?: IntentionBouton;
  /** Ligne d'appoint sous le titre, ex. « Il te restait de la marge ». */
  aide?: string;
  enCours?: boolean;
  desactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Bouton({
  titre,
  onPress,
  intention = "or",
  aide,
  enCours = false,
  desactive = false,
  style,
}: Props) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const inactif = desactive || enCours;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif, busy: enCours }}
      onPress={onPress}
      disabled={inactif}
      style={({ pressed }) => [
        styles.base,
        styles[intention],
        // Retour tactile immédiat : sur un téléphone posé au sol entre deux
        // séries, l'appui doit se voir sans qu'on ait à regarder de près.
        pressed && styles.appuye,
        inactif && { opacity: OPACITE_INACTIF },
        style,
      ]}
    >
      <View style={styles.contenu}>
        {enCours ? (
          <ActivityIndicator
            color={intention === "or" ? c.fond : c.accent}
            size="small"
          />
        ) : (
          <>
            <Text style={[styles.titre, intention === "or" && styles.titreOr]}>{titre}</Text>
            {aide ? <Text style={styles.aide}>{aide}</Text> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  base: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 52,
    justifyContent: "center",
  },
  or: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  sombre: {
    backgroundColor: c.fond2,
    borderColor: c.filet,
  },
  discret: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    minHeight: 44,
    paddingVertical: 10,
  },
  appuye: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  contenu: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  titre: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  titreOr: {
    color: c.fond,
  },
  aide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12,
    textAlign: "center",
  },
});
