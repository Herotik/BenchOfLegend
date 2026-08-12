import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { FournisseurSession } from "../src/auth/session";
import { FournisseurReferentiel } from "../src/donnees/referentiel";
import { FournisseurTheme, useTheme } from "../src/theme/theme";
import { usePolices } from "../src/theme/polices";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* Déjà masqué : rien à faire. */
});

/**
 * Racine de l'app.
 *
 * Trois fournisseurs, dans cet ordre : le thème ne dépend de personne et doit
 * envelopper tout le reste, le référentiel non plus (sa route est publique), la
 * session en dépend pour afficher des libellés dès l'écran de connexion.
 *
 * Aucun en-tête natif : les écrans portent leur propre titre, en Cinzel et avec
 * leurs équerres. Une barre de navigation système au milieu casserait le thème.
 */
export default function Racine() {
  return (
    <FournisseurTheme>
      <SafeAreaProvider>
        <FournisseurReferentiel>
          <FournisseurSession>
            <Coquille />
          </FournisseurSession>
        </FournisseurReferentiel>
      </SafeAreaProvider>
    </FournisseurTheme>
  );
}

/**
 * Sous le fournisseur de thème, faute de quoi les couleurs ne pourraient pas
 * être lues ici — et l'écran de lancement resterait affiché tant que les
 * polices ne sont pas prêtes, plutôt que de laisser voir un texte en police
 * système qui sauterait ensuite.
 */
function Coquille() {
  const { couleurs, sombre } = useTheme();
  const polices = usePolices();

  useEffect(() => {
    if (polices) SplashScreen.hideAsync().catch(() => {});
  }, [polices]);

  if (!polices) return null;

  return (
    <>
      <StatusBar style={sombre ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: couleurs.fond },
        }}
      />
    </>
  );
}
