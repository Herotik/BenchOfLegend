import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Stockage local, en JSON.
 *
 * **AsyncStorage** plutôt qu'`expo-file-system` : celui-ci prévient qu'il
 * « n'est pas supporté sur le web » et rend des méthodes vides, or l'aperçu
 * navigateur est la boucle de développement quotidienne. Plutôt
 * qu'`expo-secure-store` : le trousseau est fait pour des secrets courts —
 * Android avertit au-delà de 2 048 octets — et une séance prescrite en pèse
 * plusieurs milliers. Rien de ce qui passe ici n'est un secret ; les jetons
 * restent dans `auth/jetons.ts`, au trousseau.
 *
 * Les clés portent un numéro de version : changer la forme d'une valeur revient
 * à changer de clé, et l'ancienne finit ignorée plutôt que mal relue.
 *
 * **Aucune fonction d'ici ne lève.** Ce qu'on y range est un confort — une
 * séance sous la main, une file d'attente — jamais une condition de
 * fonctionnement. Un disque plein ne doit pas faire échouer une séance.
 */

export async function lire<T>(cle: string): Promise<T | null> {
  let brut: string | null;
  try {
    brut = await AsyncStorage.getItem(cle);
  } catch {
    return null;
  }
  if (brut === null) return null;

  try {
    return JSON.parse(brut) as T;
  } catch {
    // Valeur illisible : écriture interrompue, ou format d'une version
    // antérieure resté sous la même clé. On l'efface plutôt que de la relire à
    // chaque démarrage.
    await effacer(cle);
    return null;
  }
}

export async function ecrire(cle: string, valeur: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* Disque plein, stockage indisponible : tant pis pour le cache. */
  }
}

export async function effacer(cle: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cle);
  } catch {
    /* Idem : l'appelant n'a rien à rattraper. */
  }
}

/**
 * Efface toutes les clés commençant par `prefixe`.
 *
 * Nécessaire pour les familles de clés dont on ne connaît pas les membres à
 * l'avance — les séances en cache portent le nom de leur groupe musculaire, et
 * rien ne dit lesquels ont été visités.
 */
export async function effacerPrefixe(prefixe: string): Promise<void> {
  try {
    const toutes = await AsyncStorage.getAllKeys();
    const visees = toutes.filter((c) => c.startsWith(prefixe));
    if (visees.length > 0) await AsyncStorage.multiRemove(visees);
  } catch {
    /* Idem. */
  }
}
