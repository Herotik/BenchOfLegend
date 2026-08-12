import { useEffect, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useSession } from "../src/auth/session";
import { echangerCode } from "../src/auth/relais";
import { Chargement, EcranErreur } from "../src/composants/Etats";
import { useCouleurs } from "../src/theme/theme";

/**
 * Retour du relais navigateur.
 *
 * C'est l'adresse calculée par `Linking.createURL("/auth")` et transmise au
 * serveur en paramètre `retour`. Sur iOS, la session d'authentification capte
 * elle-même la redirection et l'écran de connexion fait tout le travail : cette
 * route ne sert que pour les cas où le lien profond est réellement livré à
 * l'app — Android, ou app relancée depuis le navigateur.
 *
 * L'échange est dédoublonné dans `echangerCode` : le code est à usage unique,
 * le présenter deux fois afficherait une erreur sur une connexion réussie.
 */
export default function RetourAuth() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { etat, adopterEchange } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const c = useCouleurs();

  useEffect(() => {
    if (!code) {
      setFini(true);
      return;
    }

    let vivant = true;

    void (async () => {
      try {
        const echange = await echangerCode(code);
        if (echange && vivant) await adopterEchange(echange);
      } catch (cause) {
        if (vivant) setErreur(cause instanceof Error ? cause.message : "Échange impossible");
      } finally {
        if (vivant) setFini(true);
      }
    })();

    return () => {
      vivant = false;
    };
  }, [code, adopterEchange]);

  if (erreur) {
    return (
      <View style={{ flex: 1, backgroundColor: c.fond }}>
        <EcranErreur message={erreur} />
      </View>
    );
  }

  if (!fini) {
    return (
      <View style={{ flex: 1, backgroundColor: c.fond }}>
        <Chargement message="Ouverture de la session…" />
      </View>
    );
  }

  return <Redirect href={etat === "connecte" ? "/aujourdhui" : "/connexion"} />;
}
