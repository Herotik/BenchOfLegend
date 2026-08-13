import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet, decodeJwt } from "jose";
import { prisma } from "@/lib/prisma";

/**
 * Jetons de l'API mobile.
 *
 * L'app web utilise des sessions par cookie ; une app native ne le peut pas.
 * Elle porte donc un **jeton d'accès** court en en-tête `Authorization`, et le
 * renouvelle avec un **jeton de rafraîchissement** long.
 *
 * Le jeton d'accès est un JWT signé : le vérifier ne coûte aucune requête, ce
 * qui compte quand chaque écran de l'app en fait plusieurs. Le jeton de
 * rafraîchissement, lui, est opaque et stocké **haché** : une fuite de la base
 * ne rend aucun jeton utilisable, et on peut le révoquer — un JWT, non.
 */

const ISSUER = "la-faille";
const AUDIENCE = "la-faille-mobile";

/** Court exprès : un jeton volé n'ouvre qu'une fenêtre de quinze minutes. */
export const DUREE_ACCES_SECONDES = 15 * 60;
/** Assez long pour qu'on ne se reconnecte pas tous les quatre matins. */
export const DUREE_RAFRAICHISSEMENT_JOURS = 60;

function cleSignature(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant : impossible de signer les jetons.");
  return new TextEncoder().encode(secret);
}

const hacher = (valeur: string) => createHash("sha256").update(valeur).digest("hex");

// ---------------------------------------------------------------------------
// Jeton d'accès
// ---------------------------------------------------------------------------

export async function creerJetonAcces(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${DUREE_ACCES_SECONDES}s`)
    .sign(cleSignature());
}

/** Identifiant de l'utilisateur, ou `null` si le jeton est invalide ou expiré. */
export async function verifierJetonAcces(jeton: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(jeton, cleSignature(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Jeton de rafraîchissement
// ---------------------------------------------------------------------------

export async function creerJetonRafraichissement(
  userId: string,
  appareil?: string,
): Promise<string> {
  const jeton = randomBytes(48).toString("base64url");

  await prisma.apiRefreshToken.create({
    data: {
      userId,
      tokenHash: hacher(jeton),
      appareil: appareil?.slice(0, 120) ?? null,
      expiresAt: new Date(Date.now() + DUREE_RAFRAICHISSEMENT_JOURS * 86_400_000),
    },
  });

  return jeton;
}

export interface CoupleJetons {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function creerCouple(userId: string, appareil?: string): Promise<CoupleJetons> {
  return {
    accessToken: await creerJetonAcces(userId),
    refreshToken: await creerJetonRafraichissement(userId, appareil),
    expiresIn: DUREE_ACCES_SECONDES,
  };
}

/**
 * Échange un jeton de rafraîchissement contre un couple neuf, **en le faisant
 * tourner** : l'ancien est révoqué au passage.
 *
 * La rotation permet de détecter un vol. Si un jeton déjà révoqué est
 * représenté, c'est que deux porteurs l'utilisent — le légitime et un autre.
 * On révoque alors toute la famille de l'utilisateur plutôt que d'arbitrer.
 */
export async function faireTournerJeton(
  jeton: string,
  appareil?: string,
): Promise<CoupleJetons | null> {
  const enBase = await prisma.apiRefreshToken.findUnique({
    where: { tokenHash: hacher(jeton) },
  });

  if (!enBase) return null;

  if (enBase.revokedAt) {
    await revoquerTout(enBase.userId);
    return null;
  }

  if (enBase.expiresAt < new Date()) return null;

  await prisma.apiRefreshToken.update({
    where: { id: enBase.id },
    data: { revokedAt: new Date() },
  });

  return creerCouple(enBase.userId, appareil ?? enBase.appareil ?? undefined);
}

export async function revoquer(jeton: string): Promise<void> {
  await prisma.apiRefreshToken.updateMany({
    where: { tokenHash: hacher(jeton), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Déconnecte tous les appareils — vol présumé, ou action volontaire. */
export async function revoquerTout(userId: string): Promise<void> {
  await prisma.apiRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Vérification de l'identité Google
// ---------------------------------------------------------------------------

const JWKS_GOOGLE = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface IdentiteGoogle {
  sub: string;
  email: string | null;
  nom: string | null;
  image: string | null;
  /** Google ne renvoie que des adresses vérifiées, mais le dit explicitement. */
  emailVerifie: boolean;
}

/**
 * Vérifie l'`id_token` produit par la connexion Google native.
 *
 * L'app fait le flux OAuth elle-même — c'est ce qu'exige iOS — et nous
 * transmet le jeton d'identité obtenu. On le valide contre les clés publiques
 * de Google : signature, émetteur, et **audience**, faute de quoi n'importe
 * quel jeton Google émis pour une autre application ferait l'affaire.
 */
export async function verifierIdentiteGoogle(idToken: string): Promise<IdentiteGoogle | null> {
  const audiences = [process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_ID_IOS].filter(
    (v): v is string => Boolean(v),
  );
  if (audiences.length === 0) return null;

  try {
    const { payload } = await jwtVerify(idToken, JWKS_GOOGLE, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: audiences,
    });

    if (typeof payload.sub !== "string") return null;

    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      nom: typeof payload.name === "string" ? payload.name : null,
      image: typeof payload.picture === "string" ? payload.picture : null,
      emailVerifie: payload.email_verified === true || payload.email_verified === "true",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Vérification de l'identité Apple
// ---------------------------------------------------------------------------

const JWKS_APPLE = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export interface IdentiteApple {
  sub: string;
  email: string | null;
  emailVerifie: boolean;
}

/**
 * Vérifie l'`identityToken` produit par « Sign in with Apple » natif.
 *
 * **L'audience n'est pas celle du web.** Le flux natif est émis pour
 * l'identifiant de bundle de l'app (`com.frameoflegends.app`), là où le flux
 * navigateur l'est pour l'identifiant de service. Les deux sont acceptés ici,
 * mais aucun ne l'est implicitement : sans audience déclarée, n'importe quel
 * jeton Apple émis pour une autre application ouvrirait la porte.
 *
 * Apple ne renvoie **le nom qu'à la première autorisation**, et jamais dans ce
 * jeton : c'est l'app qui le transmet à part, la première fois.
 */
export const audiencesApple = (): string[] =>
  [process.env.AUTH_APPLE_ID_IOS, process.env.AUTH_APPLE_ID].filter((v): v is string =>
    Boolean(v),
  );

export async function verifierIdentiteApple(identityToken: string): Promise<IdentiteApple | null> {
  const audiences = audiencesApple();
  if (audiences.length === 0) return null;

  try {
    const { payload } = await jwtVerify(identityToken, JWKS_APPLE, {
      issuer: "https://appleid.apple.com",
      audience: audiences,
    });

    if (typeof payload.sub !== "string") return null;

    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      // Apple ne délivre que des adresses qu'il a vérifiées ou qu'il possède
      // (le relais privé). Il ne joint pourtant pas toujours la mention.
      emailVerifie: payload.email_verified === undefined
        ? true
        : payload.email_verified === true || payload.email_verified === "true",
    };
  } catch (cause) {
    // Le refus le plus courant est une audience qui ne correspond pas — et il
    // est indiscernable d'une signature invalide vu du téléphone. On note donc
    // les deux valeurs dans les journaux du serveur : elles n'ont rien de
    // secret (un identifiant de bundle est public) et elles tranchent en une
    // ligne un diagnostic qui, sans elles, se fait à l'aveugle.
    console.warn("[auth/apple] jeton refusé", {
      audiencesAttendues: audiences,
      audienceRecue: audienceAnnoncee(identityToken),
      raison: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}

/**
 * Audience qu'un JWT **prétend** avoir, sans vérifier sa signature.
 *
 * À n'utiliser que pour un message de diagnostic : la valeur vient du client
 * et ne prouve rien.
 */
function audienceAnnoncee(jeton: string): string | null {
  try {
    const aud = decodeJwt(jeton).aud;
    return Array.isArray(aud) ? aud.join(", ") : (aud ?? null);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Vérification de l'identité Discord
// ---------------------------------------------------------------------------

export interface IdentiteDiscord {
  sub: string;
  email: string | null;
  emailVerifie: boolean;
  nom: string | null;
  image: string | null;
}

/**
 * Échange le code d'autorisation Discord obtenu par l'app, puis lit l'identité.
 *
 * Discord n'a pas de connexion native : l'app ouvre une feuille système sur
 * `discord.com`, en PKCE, et n'en rapporte qu'un **code**. L'échange se fait
 * ici plutôt que dans l'app, parce qu'il demande le secret du client — qui
 * n'aurait rien à faire dans un binaire distribué, où il se lit au désassemblage.
 *
 * Le `code_verifier` de PKCE reste, lui, indispensable : il prouve que le code
 * est présenté par celui-là même qui l'a demandé.
 */
export async function verifierIdentiteDiscord(
  code: string,
  verificateur: string,
  redirection: string,
): Promise<IdentiteDiscord | null> {
  const id = process.env.AUTH_DISCORD_ID;
  const secret = process.env.AUTH_DISCORD_SECRET;
  if (!id || !secret) return null;

  try {
    const jeton = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirection,
        code_verifier: verificateur,
      }),
    });
    if (!jeton.ok) return null;

    const { access_token } = (await jeton.json()) as { access_token?: string };
    if (!access_token) return null;

    const moi = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!moi.ok) return null;

    const profil = (await moi.json()) as {
      id?: string;
      email?: string | null;
      verified?: boolean;
      global_name?: string | null;
      username?: string;
      avatar?: string | null;
    };
    if (typeof profil.id !== "string") return null;

    return {
      sub: profil.id,
      email: profil.email ?? null,
      // Discord laisse exister des comptes dont l'adresse n'est pas vérifiée.
      // C'est le seul des trois dans ce cas, et c'est ce qui interdit de
      // rattacher aveuglément par adresse.
      emailVerifie: profil.verified === true,
      nom: profil.global_name ?? profil.username ?? null,
      image: profil.avatar
        ? `https://cdn.discordapp.com/avatars/${profil.id}/${profil.avatar}.png`
        : null,
    };
  } catch {
    return null;
  }
}
