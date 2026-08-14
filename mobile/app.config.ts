import type { ExpoConfig } from "expo/config";
import app from "./app.json";

const base = app.expo;

/**
 * Configuration Expo, calculée.
 *
 * **Le partage est net** : `app.json` porte tout ce qui est fixe — identifiant
 * de bundle, capacité « Sign in with Apple », conformité au chiffrement. Ce
 * fichier ne porte que ce qui se **calcule** : le schéma d'URL de Google, dérivé
 * de son identifiant client, et l'adresse des mises à jour, dérivée du
 * `projectId`. Rien n'est déclaré aux deux endroits, faute de quoi les deux
 * finiraient par diverger — `expo install` avait justement écrit dans
 * `app.json` un `runtimeVersion` concurrent de celui-ci.
 *
 * Le module natif de Google exige de déclarer dans `Info.plist` le schéma d'URL
 * **inversé** de son client iOS — une valeur qui dépend du compte Google et
 * n'a donc rien à faire, figée, dans le dépôt.
 *
 * Absente, le module n'est pas branché du tout : la build reste valide et
 * l'app retombe sur le relais navigateur. Un identifiant manquant ne doit pas
 * casser une compilation, seulement retirer un bouton.
 *
 * `EXPO_PUBLIC_GOOGLE_ID_IOS` sert deux fois : ici pour le schéma d'URL, et
 * dans `src/auth/natif.ts` pour configurer le SDK. Un identifiant OAuth n'est
 * pas un secret — il voyage dans chaque requête d'autorisation.
 */
const idGoogleIos = process.env.EXPO_PUBLIC_GOOGLE_ID_IOS ?? "";

/** `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`. */
function schemaInverse(clientId: string): string | null {
  const suffixe = ".apps.googleusercontent.com";
  if (!clientId.endsWith(suffixe)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffixe.length)}`;
}

type Greffons = NonNullable<ExpoConfig["plugins"]>;

const configuration = (): ExpoConfig => {
  const schema = schemaInverse(idGoogleIos);

  // Le typage vient d'`app.json`, que TypeScript lit comme un tableau de
  // chaînes et d'objets quelconques là où Expo attend des couples. On l'affirme
  // ici, une fois, plutôt qu'à chaque entrée.
  const greffons: Greffons = [...(base.plugins as Greffons), "expo-apple-authentication"];

  if (schema) {
    greffons.push(["@react-native-google-signin/google-signin", { iosUrlScheme: schema }]);
  }

  return {
    ...(base as unknown as ExpoConfig),
    plugins: greffons,

    // Mises à jour à distance. L'adresse est dérivée du `projectId` plutôt que
    // recopiée : deux exemplaires d'un même identifiant finissent par diverger.
    updates: { url: `https://u.expo.dev/${base.extra.eas.projectId}` },

    /**
     * `fingerprint` : la version d'exécution est l'empreinte du projet natif.
     *
     * Une mise à jour ne descend alors que sur les builds dont le natif
     * correspond exactement. C'est ce qui empêche d'envoyer un JavaScript qui
     * appelle un module natif absent du binaire installé — l'app se fermerait
     * au lancement, et il faudrait la réinstaller pour la rattraper.
     *
     * `appVersion` aurait laissé passer ce cas : ajouter une dépendance native
     * ne change pas le numéro de version.
     */
    runtimeVersion: { policy: "fingerprint" },
  };
};

export default configuration;
