import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Relais navigateur → app mobile.
 *
 * La connexion Google native suppose que l'app enregistre son propre schéma
 * d'URL (`com.googleusercontent.apps.…`). Expo Go ne le peut pas : il porte
 * son propre identifiant de bundle. Pendant le développement, l'app ouvre
 * donc le navigateur, qui mène le flux web déjà en place, puis lui renvoie un
 * code éphémère échangé contre les vrais jetons.
 *
 * Le code passe par une URL — potentiellement journalisée, gardée dans un
 * historique — d'où les trois précautions : très courte durée de vie, usage
 * unique, et stockage haché.
 */

/** Deux minutes : le temps d'un aller-retour navigateur, pas davantage. */
const DUREE_SECONDES = 120;

const hacher = (valeur: string) => createHash("sha256").update(valeur).digest("hex");

export async function creerCodeRelais(userId: string): Promise<string> {
  const code = randomBytes(32).toString("base64url");

  await prisma.apiHandoffCode.create({
    data: {
      userId,
      codeHash: hacher(code),
      expiresAt: new Date(Date.now() + DUREE_SECONDES * 1000),
    },
  });

  return code;
}

/** Consomme le code et rend l'utilisateur, ou `null` s'il ne vaut rien. */
export async function consommerCodeRelais(code: string): Promise<string | null> {
  const enBase = await prisma.apiHandoffCode.findUnique({ where: { codeHash: hacher(code) } });

  if (!enBase || enBase.usedAt || enBase.expiresAt < new Date()) return null;

  // `updateMany` avec la condition `usedAt: null` : deux échanges simultanés
  // du même code n'en verront qu'un aboutir, la base arbitrant l'égalité.
  const marque = await prisma.apiHandoffCode.updateMany({
    where: { id: enBase.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  return marque.count === 1 ? enBase.userId : null;
}

/**
 * N'accepte que les schémas d'application, jamais `http(s)`.
 *
 * L'adresse de retour vient de la requête : sans ce filtre, on disposerait
 * d'une redirection ouverte capable d'expédier un code d'authentification à
 * n'importe quel domaine.
 */
export function retourAutorise(url: string): boolean {
  try {
    const schema = new URL(url).protocol.replace(":", "").toLowerCase();
    return ["exp", "exps", "com.frameoflegends.app", "frameoflegends"].includes(schema);
  } catch {
    return false;
  }
}
