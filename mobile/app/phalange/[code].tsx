import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Cible du lien profond `frameoflegends://phalange/ABCD-2345`.
 *
 * L'écran ne fait que transmettre le code : il ne l'envoie pas. Ouvrir un lien
 * reçu par message ne doit pas suffire à se lier à son expéditeur — le code
 * arrive pré-rempli, le geste reste volontaire.
 */
export default function LienPhalange() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: "/phalange", params: { code } }} />;
}
