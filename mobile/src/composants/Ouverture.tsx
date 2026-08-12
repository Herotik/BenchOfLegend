import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Marque } from "./Logo";
import { POLICE_TITRE, type Couleurs } from "../theme/couleurs";
import { useCouleurs, useStyles } from "../theme/theme";

/**
 * Animation d'ouverture.
 *
 * L'écran de lancement natif montre la marque figée le temps du démarrage ;
 * celui-ci prend le relais et la met en mouvement avant de s'effacer. Le
 * raccord est invisible parce que les deux dessinent la même chose sur le même
 * fond — c'est la seule raison pour laquelle une animation d'ouverture ne
 * ressemble pas à un écran de plus.
 *
 * Le mouvement s'en tient au vocabulaire de l'identité : apparition, montée,
 * et l'agrandissement des équerres. Ni lueur, ni rebond, ni rotation — on
 * grave une marque, on ne l'anime pas comme un logo de télévision.
 */

const APPARITION = 560;
const NOM = 420;
const ATTENTE = 380;
const SORTIE = 400;

export function Ouverture({ onFini }: { onFini: () => void }) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();

  const marque = useRef(new Animated.Value(0)).current;
  const nom = useRef(new Animated.Value(0)).current;
  const voile = useRef(new Animated.Value(1)).current;
  const [reduit, setReduit] = useState<boolean | null>(null);

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valeur) => vivant && setReduit(valeur))
      // Sur le web la question n'a pas toujours de réponse : on anime.
      .catch(() => vivant && setReduit(false));
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    if (reduit === null) return;

    // Mouvement réduit demandé : la marque s'affiche, puis s'efface. On ne
    // supprime pas l'écran pour autant — il porte le raccord avec le lancement
    // natif, et le retirer ferait un à-coup pire que l'animation.
    if (reduit) {
      marque.setValue(1);
      nom.setValue(1);
      Animated.sequence([
        Animated.delay(ATTENTE),
        Animated.timing(voile, { toValue: 0, duration: SORTIE, useNativeDriver: true }),
      ]).start(onFini);
      return;
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(marque, {
          toValue: 1,
          duration: APPARITION,
          // Sortie franche puis freinage long : la marque se pose, elle
          // n'arrive pas.
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(nom, {
          toValue: 1,
          duration: NOM,
          delay: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(ATTENTE),
      Animated.timing(voile, {
        toValue: 0,
        duration: SORTIE,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onFini();
    });
  }, [reduit, marque, nom, voile, onFini]);

  if (reduit === null) {
    // Fond seul le temps de connaître la préférence : quelques images, mais
    // toujours la bonne couleur, donc rien de perceptible.
    return <View style={[styles.plein, { backgroundColor: c.fond }]} />;
  }

  return (
    <Animated.View style={[styles.plein, { backgroundColor: c.fond, opacity: voile }]}>
      <Animated.View
        style={{
          opacity: marque,
          transform: [
            {
              scale: marque.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
            },
          ],
        }}
      >
        <Marque taille={148} />
      </Animated.View>

      <Animated.View
        style={{
          opacity: nom,
          transform: [
            { translateY: nom.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        }}
      >
        <Text style={styles.nom}>FRAME OF LEGENDS</Text>
      </Animated.View>
    </Animated.View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  plein: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
    // Au-dessus de tout : l'app se monte derrière pendant l'animation, ce qui
    // évite d'attendre son premier rendu une fois le voile levé.
    zIndex: 10,
  },
  nom: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 26,
    letterSpacing: 4,
    textAlign: "center",
  },
});
