import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ecussonDuRang } from "../donnees/ecussons";
import { POLICE_TEXTE, POLICE_TITRE, type Couleurs } from "../theme/couleurs";
import { useStyles } from "../theme/theme";

/**
 * Écusson agrandi tant que le doigt reste posé.
 *
 * Les médaillons sont gravés au détail près et l'app les montre entre 80 et
 * 172 points : la moitié du travail ne se voit jamais. Un appui maintenu les
 * ouvre en grand, un relâchement les referme — on regarde, on ne navigue pas.
 *
 * **L'agrandissement ne capte aucun toucher** (`pointerEvents="none"`). C'est
 * la condition pour que le doigt reste en contact avec le bouton d'origine :
 * si le voile prenait la main, le geste serait interrompu et le relâchement
 * jamais détecté — l'écusson resterait ouvert.
 *
 * D'où la vitrine posée à la racine de l'app plutôt qu'un `Modal` : une fenêtre
 * modale présente une vue par-dessus la hiérarchie et peut terminer le geste en
 * cours, ce qui refermerait l'écusson à l'instant même où il s'ouvre.
 */

interface Montre {
  slug: string;
  couleur: string;
  titre: string;
  sousTitre?: string;
}

interface ValeurVitrine {
  montrer: (quoi: Montre) => void;
  cacher: () => void;
}

const ContexteVitrine = createContext<ValeurVitrine | null>(null);

const OUVERTURE = 180;
const FERMETURE = 140;

export function FournisseurVitrine({ children }: { children: ReactNode }) {
  const styles = useStyles(creerStyles);
  const { width, height } = useWindowDimensions();
  const [montre, setMontre] = useState<Montre | null>(null);
  const [reduit, setReduit] = useState(false);

  // `useState` avec initialisateur paresseux plutôt qu'une `ref` : la valeur
  // n'est construite qu'une fois, sans être lue pendant le rendu — ce que
  // `useRef(...).current` fait, et que la règle des Hooks proscrit.
  const [progression] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valeur) => vivant && setReduit(valeur))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  const montrer = useCallback(
    (quoi: Montre) => {
      setMontre(quoi);
      Animated.timing(progression, {
        toValue: 1,
        duration: reduit ? 0 : OUVERTURE,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [progression, reduit],
  );

  const cacher = useCallback(() => {
    Animated.timing(progression, {
      toValue: 0,
      duration: reduit ? 0 : FERMETURE,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
      // Démonté seulement une fois la sortie finie : le retirer tout de suite
      // ferait disparaître l'écusson d'un coup, sans fondu.
    }).start(({ finished }) => {
      if (finished) setMontre(null);
    });
  }, [progression, reduit]);

  const valeur = useMemo<ValeurVitrine>(() => ({ montrer, cacher }), [montrer, cacher]);

  // Assez grand pour qu'on distingue la gravure, assez petit pour que le nom
  // et le pouce qui maintient l'appui gardent leur place.
  const taille = Math.min(width * 0.78, height * 0.46);
  const source = montre ? ecussonDuRang(montre.slug) : null;

  return (
    <ContexteVitrine.Provider value={valeur}>
      {children}

      {montre ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.voile, { opacity: progression }]}
        >
          <Animated.View
            style={{
              transform: [
                {
                  scale: progression.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.86, 1],
                  }),
                },
              ],
              alignItems: "center",
            }}
          >
            <View style={[styles.cadre, { width: taille, height: taille }]}>
              <View
                style={[
                  styles.halo,
                  {
                    width: taille,
                    height: taille,
                    borderRadius: taille / 2,
                    backgroundColor: montre.couleur,
                  },
                ]}
              />
              {source ? (
                <Image
                  source={source}
                  alt={`Écusson du rang ${montre.titre}`}
                  style={{ width: taille * 0.92, height: taille * 0.92 }}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <Text style={[styles.nom, { color: montre.couleur }]}>{montre.titre}</Text>
            {montre.sousTitre ? <Text style={styles.sous}>{montre.sousTitre}</Text> : null}
          </Animated.View>
        </Animated.View>
      ) : null}
    </ContexteVitrine.Provider>
  );
}

function useVitrine(): ValeurVitrine {
  const valeur = useContext(ContexteVitrine);
  if (!valeur) throw new Error("useVitrine doit être utilisé dans <FournisseurVitrine>.");
  return valeur;
}

/**
 * Rend un écusson admirable : appui maintenu pour l'ouvrir, relâchement pour
 * le refermer. `children` reste ce que l'écran affichait déjà.
 */
export function EcussonAdmirable({
  slug,
  couleur,
  titre,
  sousTitre,
  children,
}: Montre & { children: ReactNode }) {
  const { montrer, cacher } = useVitrine();

  return (
    <Pressable
      // 200 ms : assez pour ne pas déclencher sur un effleurement, assez peu
      // pour que le geste paraisse immédiat.
      delayLongPress={200}
      onLongPress={() => montrer({ slug, couleur, titre, sousTitre })}
      // Couvre le relâchement **et** l'interruption du geste — un appel
      // entrant, un glissement hors du bouton. Sans quoi l'écusson resterait
      // ouvert sans plus rien pour le fermer.
      onPressOut={cacher}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Écusson ${titre}`}
      accessibilityHint="Maintiens l'appui pour l'agrandir"
    >
      {children}
    </Pressable>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  voile: {
    // Le fond de l'app, à peine transparent : on éteint l'écran autour de
    // l'écusson sans le noircir, l'identité n'ayant pas de noir pur.
    backgroundColor: c.fond,
    opacity: 0.97,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cadre: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    opacity: 0.2,
  },
  nom: {
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    letterSpacing: 1,
    marginTop: 22,
    textAlign: "center",
  },
  sous: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 14,
    marginTop: 2,
  },
});
