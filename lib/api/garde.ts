import "server-only";
import { prisma } from "@/lib/prisma";
import { verifierJetonAcces } from "./jetons";

/**
 * Authentification des routes `/api/v1/*`.
 *
 * L'app web passe par `requireUser()` et un cookie ; l'API mobile par un jeton
 * porteur. Les deux aboutissent au même utilisateur, et surtout à la même
 * logique métier — les routes ne font qu'envelopper les modules de `lib/`.
 */

export interface UtilisateurApi {
  id: string;
  email: string | null;
  name: string | null;
  onboarded: boolean;
  lp: number;
}

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; reponse: Response };

export const erreur = (message: string, statut: number, code?: string) =>
  Response.json(
    { error: message, code },
    // Un échec authentifié — 404 sur la ressource d'autrui, 409 métier — reste
    // une réponse propre à un compte : aucun intermédiaire ne doit la garder.
    { status: statut, headers: { "Cache-Control": "no-store" } },
  );

/** 401 : le jeton manque, a expiré, ou ne correspond à personne. */
export async function authentifier(requete: Request): Promise<Resultat<UtilisateurApi>> {
  const entete = requete.headers.get("authorization") ?? "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";

  if (!jeton) {
    return { ok: false, reponse: erreur("Jeton d'accès requis", 401, "jeton_absent") };
  }

  const userId = await verifierJetonAcces(jeton);
  if (!userId) {
    // Code distinct : c'est ce qui dit au client de tenter un rafraîchissement
    // plutôt que de renvoyer l'utilisateur à l'écran de connexion.
    return { ok: false, reponse: erreur("Jeton expiré ou invalide", 401, "jeton_invalide") };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, onboarded: true, lp: true },
  });

  if (!user) {
    return { ok: false, reponse: erreur("Compte introuvable", 401, "compte_absent") };
  }

  return { ok: true, valeur: user };
}

/** Comme `authentifier`, mais exige un profil complet (409 sinon). */
export async function authentifierOnboarde(
  requete: Request,
): Promise<Resultat<UtilisateurApi>> {
  const r = await authentifier(requete);
  if (!r.ok) return r;

  if (!r.valeur.onboarded) {
    // 409 et non 403 : rien n'est interdit, il manque une étape. Le client sait
    // alors qu'il doit afficher l'onboarding.
    return {
      ok: false,
      reponse: erreur("Profil à compléter", 409, "onboarding_requis"),
    };
  }

  return r;
}

/** Lit et valide le corps JSON d'une requête. */
export async function corpsJson<T>(requete: Request): Promise<Resultat<T>> {
  try {
    return { ok: true, valeur: (await requete.json()) as T };
  } catch {
    return { ok: false, reponse: erreur("Corps JSON invalide", 400, "json_invalide") };
  }
}
