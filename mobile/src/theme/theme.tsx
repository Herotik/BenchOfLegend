import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { CLAIR, SOMBRE, type Couleurs } from "./couleurs";

/**
 * Thème clair ou sombre, au choix de l'utilisateur.
 *
 * Le choix est un **réglage**, pas une préférence de compte : il vit sur
 * l'appareil et n'est jamais envoyé au serveur. Quelqu'un qui installe l'app
 * sur un iPhone et un iPad peut vouloir l'un clair et l'autre sombre.
 */

export type ChoixTheme = "systeme" | "clair" | "sombre";

const CLE = "fol.theme";

interface ValeurTheme {
  couleurs: Couleurs;
  /** Vrai si le thème rendu est sombre, quel que soit le chemin qui y mène. */
  sombre: boolean;
  choix: ChoixTheme;
  definirChoix: (choix: ChoixTheme) => void;
}

const Contexte = createContext<ValeurTheme | null>(null);

/**
 * Lecture et écriture du choix, tolérantes à l'échec.
 *
 * `expo-secure-store` n'existe pas sur le web et peut échouer sur un appareil
 * dont le trousseau est verrouillé. Un thème qui ne se souvient pas est un
 * désagrément ; une app qui refuse de démarrer pour cette raison serait une
 * faute. On avale donc l'erreur des deux côtés.
 */
/** Pas de trousseau dans un navigateur — et un thème n'est pas un secret. */
const web = Platform.OS === "web";

async function lireChoix(): Promise<ChoixTheme | null> {
  try {
    const brut = web
      ? globalThis.localStorage?.getItem(CLE)
      : await SecureStore.getItemAsync(CLE);
    return brut === "clair" || brut === "sombre" || brut === "systeme" ? brut : null;
  } catch {
    return null;
  }
}

async function ecrireChoix(choix: ChoixTheme): Promise<void> {
  try {
    if (web) globalThis.localStorage?.setItem(CLE, choix);
    else await SecureStore.setItemAsync(CLE, choix);
  } catch {
    /* Le thème reste appliqué pour la session en cours. */
  }
}

export function FournisseurTheme({ children }: { children: React.ReactNode }) {
  const systeme = useColorScheme();
  const [choix, setChoix] = useState<ChoixTheme>("systeme");

  useEffect(() => {
    let vivant = true;
    lireChoix().then((enregistre) => {
      if (vivant && enregistre) setChoix(enregistre);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const definirChoix = useCallback((suivant: ChoixTheme) => {
    // L'affichage bascule tout de suite ; l'enregistrement suit à son rythme.
    setChoix(suivant);
    void ecrireChoix(suivant);
  }, []);

  const valeur = useMemo<ValeurTheme>(() => {
    const sombre = choix === "systeme" ? systeme === "dark" : choix === "sombre";
    return { couleurs: sombre ? SOMBRE : CLAIR, sombre, choix, definirChoix };
  }, [choix, systeme, definirChoix]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

function useContexteTheme(): ValeurTheme {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error("useTheme hors de FournisseurTheme");
  return valeur;
}

export const useTheme = useContexteTheme;

/** Couleurs du thème actif. C'est le point d'entrée de tous les écrans. */
export const useCouleurs = (): Couleurs => useContexteTheme().couleurs;

/**
 * Feuille de styles dépendant du thème.
 *
 * `StyleSheet.create` étant figé au chargement du module, une feuille écrite au
 * niveau du fichier ne pourrait pas basculer. On la reconstruit donc à chaque
 * changement de thème — et à ce moment-là seulement, grâce au mémo : une
 * feuille recréée à chaque rendu casserait l'égalité référentielle des styles
 * et ferait re-rendre inutilement toute la descendance.
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(
  fabrique: (c: Couleurs) => T,
): T {
  const couleurs = useCouleurs();
  return useMemo(() => fabrique(couleurs), [fabrique, couleurs]);
}
