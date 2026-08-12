import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Rangement des jetons.
 *
 * Trousseau iOS / Keystore Android via `expo-secure-store`, jamais
 * AsyncStorage : celui-ci écrit en clair dans le bac à sable de l'app, lisible
 * par une sauvegarde iTunes ou par n'importe quel outil sur un appareil
 * débridé. Un jeton de rafraîchissement vaut soixante jours d'accès au compte.
 */

const CLE_ACCES = "fol.jeton_acces";
const CLE_RAFRAICHISSEMENT = "fol.jeton_rafraichissement";

/**
 * `AFTER_FIRST_UNLOCK` plutôt que `WHEN_UNLOCKED` : les jetons doivent rester
 * lisibles après un redémarrage, sinon la première ouverture de l'app avant
 * déverrouillage échouerait et déconnecterait l'utilisateur.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Sur le web, `expo-secure-store` n'existe pas — il n'y a pas de trousseau
 * dans un navigateur. On retombe sur `localStorage`, en sachant ce que cela
 * vaut : le stockage est lisible par tout script de la page.
 *
 * Cette branche ne sert qu'à **prévisualiser les écrans** dans un navigateur
 * pendant le développement ; les cibles de l'app sont iOS et Android, où le
 * trousseau s'applique. Si le web devenait un jour une cible réelle, il
 * faudrait des cookies `HttpOnly` posés par le serveur, pas ce repli.
 */
const web = Platform.OS === "web";

async function lire(cle: string): Promise<string | null> {
  if (web) return globalThis.localStorage?.getItem(cle) ?? null;
  return SecureStore.getItemAsync(cle, OPTIONS);
}

async function ecrire(cle: string, valeur: string): Promise<void> {
  if (web) {
    globalThis.localStorage?.setItem(cle, valeur);
    return;
  }
  await SecureStore.setItemAsync(cle, valeur, OPTIONS);
}

async function effacer(cle: string): Promise<void> {
  if (web) {
    globalThis.localStorage?.removeItem(cle);
    return;
  }
  await SecureStore.deleteItemAsync(cle, OPTIONS);
}

export interface Jetons {
  accessToken: string;
  refreshToken: string;
}

export async function lireJetons(): Promise<Jetons | null> {
  const [accessToken, refreshToken] = await Promise.all([
    lire(CLE_ACCES),
    lire(CLE_RAFRAICHISSEMENT),
  ]);

  // Les deux ou rien : un jeton d'accès seul expire en quinze minutes et
  // laisserait l'app dans un état « connectée » qui ne survivrait pas à
  // l'écran suivant.
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function ecrireJetons(jetons: Jetons): Promise<void> {
  await Promise.all([
    ecrire(CLE_ACCES, jetons.accessToken),
    ecrire(CLE_RAFRAICHISSEMENT, jetons.refreshToken),
  ]);
}

export async function effacerJetons(): Promise<void> {
  await Promise.all([effacer(CLE_ACCES), effacer(CLE_RAFRAICHISSEMENT)]);
}
