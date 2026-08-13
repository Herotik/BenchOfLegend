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

export type FournisseurNatif = "google" | "apple" | "discord";

/**
 * Ce que la feuille système rapporte, avant tout usage.
 *
 * Copie exacte de `schemaPreuve` (`lib/api/preuves.ts`) : deux routes la
 * reçoivent — `/auth/<fournisseur>` pour se connecter, `/me/connexions` pour
 * rattacher une porte d'entrée de plus à un compte déjà ouvert. Obtenir la
 * preuve et s'en servir sont donc deux gestes distincts.
 */
export type Preuve =
  | { fournisseur: "google"; idToken: string }
  | { fournisseur: "apple"; identityToken: string; nom?: string }
  | { fournisseur: "discord"; code: string; verificateur: string; redirection: string };

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
// Disponibilité
// ---------------------------------------------------------------------------

export const googleDisponible = (): boolean => NATIF && ID_GOOGLE_IOS !== "";

export const discordDisponible = (): boolean => NATIF && ID_DISCORD !== "";

/**
 * Apple est le seul dont la disponibilité se demande au système : elle dépend
 * de la version d'iOS, pas d'une variable de compilation.
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

// ---------------------------------------------------------------------------
// Obtention de la preuve
// ---------------------------------------------------------------------------

/**
 * Feuille de comptes du système : les comptes Google déjà présents sur le
 * téléphone, un appui, aucun navigateur.
 */
async function preuveGoogle(): Promise<Preuve> {
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

  return { fournisseur: "google", idToken };
}

async function preuveApple(): Promise<Preuve> {
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

  return {
    fournisseur: "apple",
    identityToken: identifiant.identityToken,
    ...(nom ? { nom } : {}),
  };
}

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
async function preuveDiscord(): Promise<Preuve> {
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

  return {
    fournisseur: "discord",
    code,
    verificateur: requete.codeVerifier,
    // Discord revérifie l'adresse de retour à l'échange : elle doit être au
    // caractère près celle qui a servi à demander le code.
    redirection,
  };
}

/** Ouvre la feuille du fournisseur et rend la preuve qu'elle rapporte. */
export function preuvePour(fournisseur: FournisseurNatif): Promise<Preuve> {
  switch (fournisseur) {
    case "google":
      return preuveGoogle();
    case "apple":
      return preuveApple();
    case "discord":
      return preuveDiscord();
  }
}

// ---------------------------------------------------------------------------
// Usages
// ---------------------------------------------------------------------------

/**
 * Se connecter : la preuve part sur `/auth/<fournisseur>`, qui retrouve le
 * compte — ou le crée — et rend un couple de jetons.
 */
export async function connecter(fournisseur: FournisseurNatif): Promise<ReponseEchange> {
  const preuve = await preuvePour(fournisseur);

  return adopter(
    await appelApi<ReponseEchange>(`/auth/${fournisseur}`, {
      methode: "POST",
      publique: true,
      // Le fournisseur est déjà dans le chemin : ces routes ne l'attendent pas
      // dans le corps, contrairement à `/me/connexions` qui sert les trois.
      corps: { ...sansFournisseur(preuve), appareil: nomAppareil() },
    }),
  );
}

/** La preuve sans son étiquette de fournisseur. */
function sansFournisseur(preuve: Preuve): Record<string, unknown> {
  const copie: Record<string, unknown> = { ...preuve };
  delete copie.fournisseur;
  return copie;
}

/**
 * Rattacher une porte d'entrée de plus au compte **déjà connecté**.
 *
 * Rien à voir avec la connexion : ici l'identité est prouvée par la session en
 * cours, et l'adresse e-mail n'arbitre plus rien. C'est ce qui permet de
 * réunir un identifiant Apple et un compte Google qui ne portent pas la même —
 * l'iCloud et le Gmail d'une même personne n'ayant aucune raison de coïncider.
 */
export async function rattacher(fournisseur: FournisseurNatif): Promise<string[]> {
  const preuve = await preuvePour(fournisseur);

  const { connexions } = await appelApi<{ connexions: string[] }>("/me/connexions", {
    methode: "POST",
    corps: preuve,
  });

  return connexions;
}
