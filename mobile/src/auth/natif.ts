import Constants from "expo-constants";
import { Platform } from "react-native";
import { appelApi, memoriserJetons } from "../api/client";
import type { ReponseEchange } from "../api/types";

/**
 * Connexions natives — sans passer par le site.
 *
 * Le relais navigateur reste en place et sert de repli : il fonctionne
 * partout, y compris dans Expo Go et dans l'aperçu web, là où les modules
 * natifs n'existent pas. Ce qui suit est le chemin court, quand il est
 * disponible.
 *
 * **Chaque flux s'active seul**, à la présence de son identifiant. Une app
 * construite sans `EXPO_PUBLIC_GOOGLE_ID_IOS` n'affichera pas le bouton Google
 * natif et retombera sur le relais, plutôt que d'ouvrir une feuille qui
 * échouerait.
 *
 * Les modules natifs sont chargés **à l'usage** (`await import`). Importés en
 * tête de fichier, ils casseraient l'aperçu web, où ils n'existent pas — or
 * c'est là que se fait le travail quotidien.
 */

const NATIF = Platform.OS === "ios" || Platform.OS === "android";

/** L'utilisateur a fermé la feuille : ce n'est pas un échec à afficher. */
export class ConnexionAbandonnee extends Error {
  constructor() {
    super("Connexion abandonnée");
    this.name = "ConnexionAbandonnee";
  }
}

const ID_GOOGLE_IOS = process.env.EXPO_PUBLIC_GOOGLE_ID_IOS ?? "";
const ID_GOOGLE_WEB = process.env.EXPO_PUBLIC_GOOGLE_ID ?? "";
const ID_DISCORD = process.env.EXPO_PUBLIC_DISCORD_ID ?? "";

/** Libellé de l'appareil, affiché dans la liste des sessions du compte. */
function nomAppareil(): string {
  const nom = Constants.deviceName;
  return nom ? `${nom} (${Platform.OS})` : `Appareil ${Platform.OS}`;
}

/** Range les jetons rendus par le serveur, comme le fait le relais. */
async function adopter(echange: ReponseEchange): Promise<ReponseEchange> {
  await memoriserJetons({
    accessToken: echange.accessToken,
    refreshToken: echange.refreshToken,
  });
  return echange;
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export const googleDisponible = (): boolean => NATIF && ID_GOOGLE_IOS !== "";

/**
 * Feuille de comptes du système : les comptes Google déjà présents sur le
 * téléphone, un appui, aucun navigateur.
 *
 * Le jeton d'identité obtenu part au serveur, qui le vérifie contre les clés
 * publiques de Google. Rien de ce que l'app annonce n'est cru sur parole.
 */
export async function connecterGoogle(): Promise<ReponseEchange> {
  const { GoogleSignin } = await import("@react-native-google-signin/google-signin");

  GoogleSignin.configure({
    iosClientId: ID_GOOGLE_IOS,
    // Sert à Android et à l'audience du jeton ; sans conséquence sur iOS, où
    // le client iOS suffit. Le serveur accepte les deux audiences.
    ...(ID_GOOGLE_WEB ? { webClientId: ID_GOOGLE_WEB } : {}),
    scopes: ["email", "profile"],
  });

  const resultat = await GoogleSignin.signIn();
  if (resultat.type === "cancelled") throw new ConnexionAbandonnee();

  const idToken = resultat.data.idToken;
  if (!idToken) {
    throw new Error("Google n'a pas fourni de jeton d'identité. Réessaie, ou passe par le site.");
  }

  return adopter(
    await appelApi<ReponseEchange>("/auth/google", {
      methode: "POST",
      publique: true,
      corps: { idToken, appareil: nomAppareil() },
    }),
  );
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

/**
 * Uniquement iOS 13+ — et le module répond lui-même s'il est utilisable, ce
 * qu'on ne peut savoir qu'en le lui demandant.
 */
export async function appleDisponible(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    const Apple = await import("expo-apple-authentication");
    return await Apple.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function connecterApple(): Promise<ReponseEchange> {
  const Apple = await import("expo-apple-authentication");

  let identifiant;
  try {
    identifiant = await Apple.signInAsync({
      requestedScopes: [
        Apple.AppleAuthenticationScope.FULL_NAME,
        Apple.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (cause) {
    // Fermer la feuille lève une erreur portant ce code, comme un échec.
    if ((cause as { code?: string })?.code === "ERR_REQUEST_CANCELED") {
      throw new ConnexionAbandonnee();
    }
    throw cause;
  }

  if (!identifiant.identityToken) {
    throw new Error("Apple n'a pas fourni de jeton d'identité. Réessaie, ou passe par le site.");
  }

  // Apple ne donne le nom qu'à la **première** autorisation, et jamais dans le
  // jeton. Ne pas le transmettre maintenant, c'est ne plus jamais l'avoir.
  const nom = [identifiant.fullName?.givenName, identifiant.fullName?.familyName]
    .filter(Boolean)
    .join(" ");

  return adopter(
    await appelApi<ReponseEchange>("/auth/apple", {
      methode: "POST",
      publique: true,
      corps: {
        identityToken: identifiant.identityToken,
        ...(nom ? { nom } : {}),
        appareil: nomAppareil(),
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------

export const discordDisponible = (): boolean => NATIF && ID_DISCORD !== "";

/**
 * Discord n'a pas de connexion native : son OAuth est exclusivement web.
 *
 * Le plus proche reste la feuille d'authentification **du système**, qui parle
 * directement à `discord.com` et revient dans l'app par son schéma d'URL —
 * sans détour par notre site ni code relais.
 *
 * PKCE, et l'échange du code se fait côté serveur : il réclame le secret du
 * client, qui n'aurait rien à faire dans un binaire distribué, où il se lit au
 * désassemblage.
 */
export async function connecterDiscord(): Promise<ReponseEchange> {
  const AuthSession = await import("expo-auth-session");

  const redirection = AuthSession.makeRedirectUri({ scheme: "frameoflegends", path: "auth" });

  const requete = new AuthSession.AuthRequest({
    clientId: ID_DISCORD,
    scopes: ["identify", "email"],
    redirectUri: redirection,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const resultat = await requete.promptAsync({
    authorizationEndpoint: "https://discord.com/api/oauth2/authorize",
  });

  if (resultat.type === "cancel" || resultat.type === "dismiss") throw new ConnexionAbandonnee();
  if (resultat.type !== "success") {
    throw new Error("Discord a refusé la connexion. Réessaie, ou passe par le site.");
  }

  const code = resultat.params.code;
  if (!code || !requete.codeVerifier) {
    throw new Error("Réponse incomplète de Discord. Réessaie, ou passe par le site.");
  }

  return adopter(
    await appelApi<ReponseEchange>("/auth/discord", {
      methode: "POST",
      publique: true,
      corps: {
        code,
        verificateur: requete.codeVerifier,
        // Discord revérifie l'adresse de retour à l'échange : elle doit être
        // au caractère près celle qui a servi à demander le code.
        redirection,
        appareil: nomAppareil(),
      },
    }),
  );
}
