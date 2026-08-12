import { useFonts } from "expo-font";
import { Cinzel_500Medium, Cinzel_600SemiBold } from "@expo-google-fonts/cinzel";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

/**
 * Polices de l'identité, embarquées dans le bundle.
 *
 * Cinzel est une capitale romaine gravée — elle porte les titres et les
 * chiffres de donnée. Manrope tient le texte courant, qui doit rester lisible
 * en petit corps. Cinq graisses en tout : au-delà, on alourdit le bundle sans
 * que personne ne voie la différence.
 *
 * Les noms rendus ici sont exactement ceux des constantes de `couleurs.ts` —
 * `fontFamily` en React Native désigne la police **enregistrée**, pas un nom de
 * famille CSS, et une chaîne inconnue retombe silencieusement sur la police
 * système au lieu de lever une erreur.
 */
export function usePolices(): boolean {
  const [pretes] = useFonts({
    Cinzel_500Medium,
    Cinzel_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });
  return pretes;
}
