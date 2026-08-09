import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
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
    };
  } catch {
    return null;
  }
}
