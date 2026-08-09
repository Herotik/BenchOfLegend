import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FournisseurSession } from "../src/auth/session";
import { FournisseurReferentiel } from "../src/donnees/referentiel";
import { COULEURS } from "../src/theme/couleurs";

/**
 * Racine de l'app.
 *
 * Deux fournisseurs, dans cet ordre : le référentiel ne dépend de personne (sa
 * route est publique), la session en dépend pour afficher des libellés dès
 * l'écran de connexion.
 *
 * Aucun en-tête natif : les écrans portent leur propre titre, en sérif et avec
 * leurs ornements. Une barre de navigation système au milieu casserait le
 * thème.
 */
export default function Racine() {
  return (
    <SafeAreaProvider>
      <FournisseurReferentiel>
        <FournisseurSession>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COULEURS.nuit950 },
            }}
          />
        </FournisseurSession>
      </FournisseurReferentiel>
    </SafeAreaProvider>
  );
}
