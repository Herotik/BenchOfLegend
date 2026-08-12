import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { appelApi, BASE_API, memoriserJetons } from "../api/client";
import type { ReponseEchange } from "../api/types";

/**
 * Connexion par relais navigateur.
 *
 * La connexion Google native suppose que l'app enregistre le schéma d'URL de
 * son client OAuth iOS. Expo Go ne le peut pas : il porte son propre
 * identifiant de bundle. On délègue donc le flux au navigateur, qui rejoue la
 * connexion web déjà en place, puis nous renvoie un code éphémère — usage
 * unique, deux minutes de validité — échangé contre les vrais jetons.
 */

/** Erreur de connexion, avec un message déjà destiné à l'utilisateur. */
export class ErreurConnexion extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurConnexion";
  }
}

/** L'utilisateur a fermé le navigateur : ce n'est pas un échec à afficher. */
export class ConnexionAnnulee extends Error {
  constructor() {
    super("Connexion annulée");
    this.name = "ConnexionAnnulee";
  }
}

/**
 * Codes déjà présentés au serveur.
 *
 * Le code est à usage unique. Selon la plateforme, le retour peut arriver deux
 * fois — par le résultat de la session d'authentification **et** par le lien
 * profond livré à l'app. Le second échange se verrait refuser en
 * `code_invalide` et afficherait une erreur sur une connexion pourtant réussie.
 */
const codesTraites = new Set<string>();

/** Libellé de l'appareil, affiché dans la liste des sessions du compte. */
function nomAppareil(): string {
  const nom = Constants.deviceName;
  return nom ? `${nom} (${Platform.OS})` : `Appareil ${Platform.OS}`;
}

/**
 * Adresse de retour de l'app.
 *
 * En développement sous Expo Go : `exp://192.168.x.y:8081/--/auth`.
 * En build autonome : `frameoflegends://auth`.
 *
 * Les deux schémas figurent dans la liste blanche de `retourAutorise`
 * (`lib/api/relais.ts`) — sans quoi le serveur refuse en `retour_invalide`,
 * précisément pour ne pas devenir une redirection ouverte.
 */
export const adresseDeRetour = (): string => Linking.createURL("/auth");

/** Extrait le paramètre `code` d'une URL de retour. */
export function codeDepuisUrl(url: string): string | null {
  // `Linking.parse` plutôt que `new URL` : le schéma `exp://` n'est pas un
  // schéma « spécial » et l'implémentation d'`URL` côté natif ne garantit pas
  // `searchParams`.
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code === "string" && code.length > 0) return code;
  return null;
}

/**
 * Échange le code contre un couple de jetons, puis les range dans le trousseau.
 *
 * Rend `null` si le code a déjà été traité — voir `codesTraites`.
 */
export async function echangerCode(code: string): Promise<ReponseEchange | null> {
  if (codesTraites.has(code)) return null;
  codesTraites.add(code);

  const reponse = await appelApi<ReponseEchange>("/auth/mobile/echanger", {
    methode: "POST",
    corps: { code, appareil: nomAppareil() },
    publique: true,
  });

  await memoriserJetons({
    accessToken: reponse.accessToken,
    refreshToken: reponse.refreshToken,
  });

  return reponse;
}

/**
 * Ouvre le navigateur, attend le retour, et échange le code.
 *
 * `openAuthSessionAsync` utilise `ASWebAuthenticationSession` sur iOS : la
 * session capte elle-même la redirection vers le schéma de l'app, referme le
 * navigateur, et nous rend l'URL.
 */
export async function connecterParNavigateur(): Promise<ReponseEchange> {
  const retour = adresseDeRetour();
  const depart = `${BASE_API}/auth/mobile/demarrer?retour=${encodeURIComponent(retour)}`;

  const resultat = await WebBrowser.openAuthSessionAsync(depart, retour);

  if (resultat.type === "cancel" || resultat.type === "dismiss") {
    throw new ConnexionAnnulee();
  }
  if (resultat.type !== "success") {
    throw new ErreurConnexion("La connexion n'a pas abouti. Réessaie.");
  }

  const code = codeDepuisUrl(resultat.url);
  if (!code) {
    throw new ErreurConnexion("Le serveur n'a pas renvoyé de code de connexion.");
  }

  const echange = await echangerCode(code);
  if (!echange) {
    throw new ErreurConnexion("Ce code de connexion a déjà été utilisé. Réessaie.");
  }

  return echange;
}
