import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { POLICE_TEXTE_GRAS, POLICE_TEXTE, type Couleurs } from "../theme/couleurs";
import { useCouleurs, useStyles } from "../theme/theme";
import { chronoEnTexte } from "../outils/dates";
import { BarreProgression } from "./BarreProgression";

/**
 * Chronomètre de repos entre séries.
 *
 * Le décompte se calcule à partir d'une **échéance absolue**, jamais en
 * retranchant une seconde par battement : les minuteurs JavaScript dérivent, et
 * ils sont suspendus quand l'app passe en arrière-plan — ce qui arrive à chaque
 * fois qu'on repose le téléphone pendant le repos. Au retour, l'échéance donne
 * le temps réellement écoulé.
 *
 * **L'appelant doit remonter ce composant à chaque exercice** — une `key` sur
 * lui ou sur son parent. Il ne surveille pas `secondes` pour se réinitialiser,
 * et c'est délibéré : il l'a fait, et cela paraissait suffire jusqu'à ce qu'on
 * remarque que deux exercices consécutifs ont presque toujours le même repos.
 * La valeur ne changeant pas, la réinitialisation ne partait jamais et le
 * décompte lancé sur un exercice se terminait sur le suivant. Une durée
 * identique n'est pas un repos identique ; seule l'identité de l'exercice l'est,
 * et elle n'est connue que du parent.
 */
export function ChronoRepos({ secondes }: { secondes: number }) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const [restant, setRestant] = useState(secondes);
  const [enMarche, setEnMarche] = useState(false);
  const echeance = useRef<number | null>(null);

  useEffect(() => {
    if (!enMarche) return;

    const battement = setInterval(() => {
      const fin = echeance.current;
      if (fin === null) return;

      const reste = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
      setRestant(reste);
      if (reste === 0) {
        setEnMarche(false);
        echeance.current = null;
      }
    }, 250);

    return () => clearInterval(battement);
  }, [enMarche]);

  const basculer = useCallback(() => {
    if (enMarche) {
      setEnMarche(false);
      echeance.current = null;
      setRestant(secondes);
      return;
    }
    echeance.current = Date.now() + secondes * 1000;
    setRestant(secondes);
    setEnMarche(true);
  }, [enMarche, secondes]);

  const termine = !enMarche && restant === 0;

  return (
    <Pressable onPress={basculer} accessibilityRole="button" style={styles.bloc}>
      <View style={styles.ligne}>
        <Text style={styles.etiquette}>Repos</Text>
        <Text style={[styles.valeur, enMarche && styles.valeurActive]}>
          {chronoEnTexte(restant)}
        </Text>
      </View>
      <BarreProgression
        part={secondes > 0 ? 1 - restant / secondes : 1}
        couleur={c.accent}
      />
      <Text style={styles.aide}>
        {enMarche ? "Touche pour arrêter" : termine ? "Repos terminé" : "Touche pour lancer"}
      </Text>
    </Pressable>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  bloc: {
    backgroundColor: c.fond,
    borderColor: c.fond3,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  etiquette: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.texte2,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  valeur: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 26,
    fontVariant: ["tabular-nums"],
  },
  valeurActive: {
    color: c.accent,
  },
  aide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12,
  },
});
