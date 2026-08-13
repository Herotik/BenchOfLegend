import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { FournisseurSession, useSession } from "../src/auth/session";
import { useEnvoiAutomatique } from "../src/donnees/envoi-differe";
import { useRappels } from "../src/donnees/rappels";
import { FournisseurReferentiel } from "../src/donnees/referentiel";
import { FournisseurTheme, useTheme } from "../src/theme/theme";
import { usePolices } from "../src/theme/polices";
import { Ouverture } from "../src/composants/Ouverture";

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
  const { etat, rafraichirProfil } = useSession();
  const [ouvert, setOuvert] = useState(false);
  const finirOuverture = useCallback(() => setOuvert(true), []);

  // Séances terminées hors ligne : elles repartent d'ici, une fois pour toute
  // l'app. Le faire dans un écran les laisserait en plan tant qu'on n'y passe
  // pas — or on rouvre souvent l'app ailleurs qu'à l'endroit qu'on a quitté.
  const rattraper = useCallback(() => void rafraichirProfil(), [rafraichirProfil]);
  useEnvoiAutomatique(etat === "connecte", rattraper);

  // Rappels de séance : replanifiés au même rythme, et pour la même raison —
  // le plan a pu changer pendant qu'on ne regardait pas.
  useRappels(etat === "connecte");

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
      {/* Posée par-dessus plutôt qu'à la place : l'app se monte et charge son
          profil pendant l'animation, si bien qu'au lever du voile l'écran est
          déjà prêt. La remplacer ferait payer les deux temps l'un après
          l'autre. */}
      {ouvert ? null : <Ouverture onFini={finirOuverture} />}
    </>
  );
}
