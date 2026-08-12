import { StyleSheet, Text, View } from "react-native";
import { POLICE_TEXTE, type Couleurs } from "../theme/couleurs";
import { useCouleurs, useStyles } from "../theme/theme";

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
  couleur,
}: {
  part: number;
  gauche?: string;
  droite?: string;
  /** Par défaut l'accent du thème — un rang passe la sienne. */
  couleur?: string;
}) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const pourcentage = `${Math.round(Math.min(Math.max(part, 0), 1) * 100)}%` as const;

  return (
    <View style={styles.bloc}>
      <View
        style={styles.gouttiere}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: Math.round(part * 100), min: 0, max: 100 }}
      >
        <View
          style={[styles.remplissage, { width: pourcentage, backgroundColor: couleur ?? c.accent }]}
        />
      </View>
      {gauche || droite ? (
        <View style={styles.legende}>
          <Text style={[styles.texte, styles.texteGauche]}>{gauche ?? ""}</Text>
          <Text style={[styles.texte, styles.texteDroite]}>{droite ?? ""}</Text>
        </View>
      ) : null}
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  bloc: {
    gap: 6,
    // Sans cela, la barre se réduit à la largeur de ses légendes dès qu'un
    // parent centre ses enfants — et les deux légendes se rejoignent au
    // milieu au lieu de tenir chacune son bord.
    alignSelf: "stretch",
  },
  gouttiere: {
    height: 8,
    borderRadius: 4,
    backgroundColor: c.fond3,
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
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12,
    flex: 1,
  },
  texteGauche: {
    textAlign: "left",
  },
  texteDroite: {
    textAlign: "right",
  },
});
