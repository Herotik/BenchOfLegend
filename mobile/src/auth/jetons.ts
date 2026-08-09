import * as SecureStore from "expo-secure-store";

/**
 * Rangement des jetons.
 *
 * Trousseau iOS / Keystore Android via `expo-secure-store`, jamais
 * AsyncStorage : celui-ci écrit en clair dans le bac à sable de l'app, lisible
 * par une sauvegarde iTunes ou par n'importe quel outil sur un appareil
 * débridé. Un jeton de rafraîchissement vaut soixante jours d'accès au compte.
 */

const CLE_ACCES = "lafaille.jeton_acces";
const CLE_RAFRAICHISSEMENT = "lafaille.jeton_rafraichissement";

/**
 * `AFTER_FIRST_UNLOCK` plutôt que `WHEN_UNLOCKED` : les jetons doivent rester
 * lisibles après un redémarrage, sinon la première ouverture de l'app avant
 * déverrouillage échouerait et déconnecterait l'utilisateur.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export interface Jetons {
  accessToken: string;
  refreshToken: string;
}

export async function lireJetons(): Promise<Jetons | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(CLE_ACCES, OPTIONS),
    SecureStore.getItemAsync(CLE_RAFRAICHISSEMENT, OPTIONS),
  ]);

  // Les deux ou rien : un jeton d'accès seul expire en quinze minutes et
  // laisserait l'app dans un état « connectée » qui ne survivrait pas à
  // l'écran suivant.
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function ecrireJetons(jetons: Jetons): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(CLE_ACCES, jetons.accessToken, OPTIONS),
    SecureStore.setItemAsync(CLE_RAFRAICHISSEMENT, jetons.refreshToken, OPTIONS),
  ]);
}

export async function effacerJetons(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CLE_ACCES, OPTIONS),
    SecureStore.deleteItemAsync(CLE_RAFRAICHISSEMENT, OPTIONS),
  ]);
}
