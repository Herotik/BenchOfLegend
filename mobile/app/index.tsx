import { Redirect } from "expo-router";
import { View } from "react-native";
import { useSession } from "../src/auth/session";
import { Chargement } from "../src/composants/Etats";
import { COULEURS } from "../src/theme/couleurs";

/**
 * Aiguillage d'entrée.
 *
 * Le trousseau se lit de façon asynchrone : tant qu'on ne sait pas, on
 * n'affiche ni l'un ni l'autre. Rediriger vers la connexion « en attendant »
 * ferait clignoter cet écran à chaque ouverture pour un utilisateur pourtant
 * connecté.
 */
export default function Aiguillage() {
  const { etat } = useSession();

  if (etat === "chargement") {
    return (
      <View style={{ flex: 1, backgroundColor: COULEURS.nuit950 }}>
        <Chargement message="Ouverture de la Faille…" />
      </View>
    );
  }

  return <Redirect href={etat === "connecte" ? "/aujourdhui" : "/connexion"} />;
}
