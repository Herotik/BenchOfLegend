import { importPKCS8, SignJWT } from "jose";
import type { Provider } from "next-auth/providers";
import Apple from "next-auth/providers/apple";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";

/**
 * Fournisseurs d'identité proposés à la connexion.
 *
 * Chacun s'active seul, à la présence de ses variables d'environnement : une
 * installation qui n'a que Google ne montre que Google, et rien ne casse quand
 * il en manque un. Auth.js lèverait une erreur de configuration si on lui
 * passait un fournisseur sans identifiants — d'où le filtrage en amont plutôt
 * qu'une liste figée.
 *
 * L'app n'a pas de mot de passe : ces trois-là sont les seules portes d'entrée.
 */

export interface FournisseurActif {
  /** Identifiant Auth.js, tel qu'attendu par `signIn()`. */
  id: string;
  nom: string;
}

const renseigne = (...cles: (string | undefined)[]) => cles.every((v) => Boolean(v));

export const googleConfigure = () =>
  renseigne(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET);

export const discordConfigure = () =>
  renseigne(process.env.AUTH_DISCORD_ID, process.env.AUTH_DISCORD_SECRET);

/**
 * Apple demande quatre valeurs là où les autres en demandent deux : son
 * « secret » n'est pas une chaîne délivrée une fois pour toutes, mais un jeton
 * signé qu'il faut fabriquer — voir `secretApple`.
 */
export const appleConfigure = () =>
  renseigne(
    process.env.AUTH_APPLE_ID,
    process.env.AUTH_APPLE_TEAM_ID,
    process.env.AUTH_APPLE_KEY_ID,
    process.env.AUTH_APPLE_PRIVATE_KEY,
  );

/**
 * Fournisseurs utilisables, dans l'ordre d'affichage.
 *
 * Synchrone et sans effet de bord : la landing s'en sert pour dessiner ses
 * boutons, et le relais mobile pour savoir s'il y a un choix à proposer.
 */
export function fournisseursActifs(): FournisseurActif[] {
  return [
    googleConfigure() ? { id: "google", nom: "Google" } : null,
    appleConfigure() ? { id: "apple", nom: "Apple" } : null,
    discordConfigure() ? { id: "discord", nom: "Discord" } : null,
  ].filter((f): f is FournisseurActif => f !== null);
}

// ---------------------------------------------------------------------------
// Le secret d'Apple
// ---------------------------------------------------------------------------

/**
 * Apple plafonne la durée de vie du secret à six mois. On reste en deçà : un
 * secret qui expire, c'est une connexion qui tombe un matin sans que rien
 * n'ait changé dans le code.
 */
const DUREE_SECRET_S = 60 * 60 * 24 * 150;

/** Renouvelé une journée avant terme, pour ne jamais présenter un jeton mort. */
const MARGE_S = 60 * 60 * 24;

let secretEnCache: { valeur: string; expireA: number } | null = null;

/**
 * Fabrique le « client secret » d'Apple : un JWT ES256 signé avec la clé `.p8`.
 *
 * Les autres fournisseurs délivrent une chaîne qu'on colle dans une variable
 * d'environnement. Apple, non : il faut signer soi-même, et le jeton expire —
 * six mois au plus. Le générer ici plutôt que de le coller à la main évite de
 * découvrir la panne le jour de l'expiration, six mois après y avoir pensé.
 *
 * Le résultat est gardé en mémoire : signer coûte peu, mais le faire à chaque
 * requête ne rapporte rien.
 */
export async function secretApple(): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  if (secretEnCache && secretEnCache.expireA - MARGE_S > maintenant) {
    return secretEnCache.valeur;
  }

  const equipe = process.env.AUTH_APPLE_TEAM_ID!;
  const cle = process.env.AUTH_APPLE_KEY_ID!;
  const services = process.env.AUTH_APPLE_ID!;
  const expireA = maintenant + DUREE_SECRET_S;

  const valeur = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: cle })
    // `iss` est l'équipe Apple, `sub` l'identifiant de service — c'est le seul
    // fournisseur où les deux diffèrent, et les intervertir donne un
    // `invalid_client` que rien n'explique.
    .setIssuer(equipe)
    .setSubject(services)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(maintenant)
    .setExpirationTime(expireA)
    .sign(await clePrivee());

  secretEnCache = { valeur, expireA };
  return valeur;
}

/**
 * La clé `.p8` telle qu'Apple la délivre, lue depuis l'environnement.
 *
 * Les sauts de ligne d'un PEM ne survivent pas à tous les moyens de saisir une
 * variable d'environnement : certains les rendent littéralement `\n`. On
 * accepte les deux formes plutôt que d'imposer la bonne façon de coller.
 */
function clePrivee(): Promise<CryptoKey> {
  const pem = process.env.AUTH_APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n").trim();
  return importPKCS8(pem, "ES256") as Promise<CryptoKey>;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * Fournisseurs prêts pour Auth.js.
 *
 * `allowDangerousEmailAccountLinking` rattache au même compte deux connexions
 * portant la même adresse. Sans lui, quelqu'un qui s'est inscrit avec Google
 * puis revient par Apple se voit refuser l'entrée (`OAuthAccountNotLinked`)
 * sans comprendre pourquoi — il n'y a pas de mot de passe pour s'en sortir.
 *
 * Le danger que le nom annonce est réel mais borné : il n'existe que si un
 * fournisseur laisse déclarer une adresse qu'il n'a pas vérifiée. C'est
 * exactement ce que refuse `emailVerifie`, appelé à chaque connexion.
 */
export async function construireFournisseurs(): Promise<Provider[]> {
  const fournisseurs: Provider[] = [];

  if (googleConfigure()) {
    fournisseurs.push(Google({ allowDangerousEmailAccountLinking: true }));
  }

  if (appleConfigure()) {
    fournisseurs.push(
      Apple({
        clientId: process.env.AUTH_APPLE_ID,
        clientSecret: await secretApple(),
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (discordConfigure()) {
    fournisseurs.push(Discord({ allowDangerousEmailAccountLinking: true }));
  }

  return fournisseurs;
}

/**
 * L'adresse annoncée par le fournisseur a-t-elle été vérifiée par lui ?
 *
 * C'est la condition qui rend le rattachement de comptes sûr. Une adresse non
 * vérifiée peut être celle de quelqu'un d'autre : la déclarer suffirait à
 * entrer dans son compte, sans jamais avoir eu accès à sa boîte.
 *
 * Les fournisseurs disent la même chose sous des noms différents, et le
 * booléen arrive parfois sous forme de chaîne — Apple répond « true ».
 *
 * **Refus par défaut** : un fournisseur ajouté ici sans être déclaré là
 * bloquera ses connexions plutôt que de les laisser passer sans contrôle.
 */
export function emailVerifie(fournisseur: string, profil: unknown): boolean {
  if (profil === null || typeof profil !== "object") return false;
  const p = profil as Record<string, unknown>;

  const vrai = (valeur: unknown) => valeur === true || valeur === "true";

  switch (fournisseur) {
    case "google":
      return vrai(p.email_verified);
    case "apple":
      // Apple ne délivre que deux sortes d'adresses : celle de l'identifiant
      // Apple, vérifiée à la création du compte, ou un relais privé qu'il
      // possède lui-même. Aucune n'est déclarative, si bien qu'un jeton sans
      // `email_verified` reste digne de foi — refuser l'absence de la mention
      // fermerait la porte sans rien protéger.
      return p.email_verified === undefined || vrai(p.email_verified);
    case "discord":
      return vrai(p.verified);
    default:
      return false;
  }
}
