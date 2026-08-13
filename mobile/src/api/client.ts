import { ecrireJetons, effacerJetons, lireJetons, type Jetons } from "../auth/jetons";
import type { CoupleJetons } from "./types";

/**
 * Client HTTP de `/api/v1`.
 *
 * Il porte trois responsabilités que personne d'autre ne doit reprendre :
 * l'en-tête `Authorization`, le rafraîchissement du jeton d'accès, et la
 * traduction des erreurs du serveur en `ErreurApi` exploitables par l'écran.
 */

const RACINE = process.env.EXPO_PUBLIC_API_URL ?? "";

/** Base de l'API, sans barre oblique finale parasite. */
export const BASE_API = `${RACINE.replace(/\/+$/, "")}/api/v1`;

/**
 * Au-delà, ce n'est plus une requête lente mais une adresse injoignable :
 * mauvaise IP dans `.env`, serveur non démarré, pare-feu. `fetch` n'a aucun
 * délai par défaut et laisserait l'écran tourner indéfiniment.
 */
const DELAI_MS = 15_000;

export class ErreurApi extends Error {
  readonly statut: number;
  /** Code stable du serveur (`lib/erreurs.ts`), ex. « onboarding_requis ». */
  readonly code: string | null;

  constructor(message: string, statut: number, code: string | null) {
    super(message);
    this.name = "ErreurApi";
    this.statut = statut;
    this.code = code;
  }
}

/** Panne réseau : l'adresse est fausse, ou le serveur n'écoute pas. */
export class ErreurReseau extends Error {
  constructor(cause?: unknown) {
    super(
      `Serveur injoignable à ${RACINE || "(EXPO_PUBLIC_API_URL non défini)"}. ` +
        "Vérifie que le backend tourne, que le téléphone est sur le même Wi-Fi, " +
        "et l'adresse dans mobile/.env.",
    );
    this.name = "ErreurReseau";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// État des jetons
// ---------------------------------------------------------------------------

let jetonsCourants: Jetons | null = null;

/**
 * Rafraîchissement en cours, partagé.
 *
 * **C'est la pièce critique** : le jeton de rafraîchissement tourne à chaque
 * usage, et représenter un jeton déjà consommé est interprété côté serveur
 * comme un vol — il révoque alors toute la famille et déconnecte tous les
 * appareils. Or l'écran « Aujourd'hui » lance quatre requêtes de front : sans
 * cette promesse partagée, un jeton d'accès expiré déclencherait quatre
 * rafraîchissements concurrents, dont trois avec un jeton périmé.
 */
let rafraichissementEnCours: Promise<Jetons> | null = null;

let surDeconnexion: (() => void) | null = null;

/** Prévient la session que les jetons ne valent plus rien. */
export function ecouterDeconnexion(rappel: (() => void) | null): void {
  surDeconnexion = rappel;
}

export function jetonsEnMemoire(): Jetons | null {
  return jetonsCourants;
}

/** Charge les jetons du trousseau au démarrage de l'app. */
export async function restaurerJetons(): Promise<Jetons | null> {
  jetonsCourants = await lireJetons();
  return jetonsCourants;
}

/** Enregistre un couple neuf, en mémoire et dans le trousseau. */
export async function memoriserJetons(jetons: Jetons): Promise<void> {
  jetonsCourants = jetons;
  await ecrireJetons(jetons);
}

export async function oublierJetons(): Promise<void> {
  jetonsCourants = null;
  rafraichissementEnCours = null;
  await effacerJetons();
}

// ---------------------------------------------------------------------------
// Requêtes
// ---------------------------------------------------------------------------

type Methode = "GET" | "POST" | "PUT" | "DELETE";

interface Options {
  methode?: Methode;
  corps?: unknown;
  /** Requête publique : ni en-tête `Authorization`, ni rafraîchissement. */
  publique?: boolean;
  parametres?: Record<string, string | number | undefined>;
}

function construireUrl(chemin: string, parametres?: Options["parametres"]): string {
  const url = `${BASE_API}${chemin}`;
  if (!parametres) return url;

  // Construction manuelle plutôt que `URLSearchParams` : son implémentation
  // varie d'un moteur JS à l'autre côté natif, et l'encodage doit être exact —
  // c'est lui qui porte les dates du plan et l'adresse de retour du relais.
  const paires = Object.entries(parametres)
    .filter((entree): entree is [string, string | number] => entree[1] !== undefined)
    .map(([cle, valeur]) => `${encodeURIComponent(cle)}=${encodeURIComponent(String(valeur))}`);

  return paires.length > 0 ? `${url}?${paires.join("&")}` : url;
}

async function envoyer(chemin: string, options: Options, jeton: string | null): Promise<Response> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS);

  const entetes: Record<string, string> = { Accept: "application/json" };
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (options.corps !== undefined) entetes["Content-Type"] = "application/json";

  try {
    return await fetch(construireUrl(chemin, options.parametres), {
      method: options.methode ?? "GET",
      headers: entetes,
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      signal: controleur.signal,
    });
  } catch (cause) {
    throw new ErreurReseau(cause);
  } finally {
    clearTimeout(minuterie);
  }
}

/** Corps d'erreur de l'API : `{ error, code }` (voir `lib/api/garde.ts`). */
async function lireErreur(reponse: Response): Promise<ErreurApi> {
  let message = `Erreur ${reponse.status}`;
  let code: string | null = null;

  try {
    const corps: unknown = await reponse.json();
    if (corps !== null && typeof corps === "object") {
      const objet = corps as { error?: unknown; code?: unknown };
      if (typeof objet.error === "string") message = objet.error;
      if (typeof objet.code === "string") code = objet.code;
    }
  } catch {
    // Réponse non JSON — un proxy ou une page d'erreur. Le statut suffit.
  }

  return new ErreurApi(message, reponse.status, code);
}

async function lireCorps<T>(reponse: Response): Promise<T> {
  // 204 sur la déconnexion : rien à décoder.
  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

/**
 * Échange le jeton de rafraîchissement contre un couple neuf.
 *
 * Un seul appel en vol à la fois — voir `rafraichissementEnCours`. Le nouveau
 * jeton de rafraîchissement est **toujours** stocké : l'ancien vient d'être
 * révoqué par le serveur, le garder condamnerait la prochaine tentative.
 */
async function rafraichir(): Promise<Jetons> {
  if (rafraichissementEnCours) return rafraichissementEnCours;

  const jetonRafraichissement = jetonsCourants?.refreshToken;
  if (!jetonRafraichissement) {
    throw new ErreurApi("Session expirée", 401, "rafraichissement_absent");
  }

  rafraichissementEnCours = (async () => {
    const reponse = await envoyer(
      "/auth/refresh",
      { methode: "POST", corps: { refreshToken: jetonRafraichissement } },
      null,
    );

    if (!reponse.ok) throw await lireErreur(reponse);

    const couple = await lireCorps<CoupleJetons>(reponse);
    const neufs: Jetons = {
      accessToken: couple.accessToken,
      refreshToken: couple.refreshToken,
    };
    await memoriserJetons(neufs);
    return neufs;
  })();

  try {
    return await rafraichissementEnCours;
  } finally {
    rafraichissementEnCours = null;
  }
}

/**
 * Appelle une route de l'API.
 *
 * Sur un 401 de code `jeton_invalide`, le jeton d'accès est renouvelé et la
 * requête rejouée **une seule fois** : un second échec vient d'ailleurs que de
 * l'expiration, et réessayer en boucle ne ferait que multiplier les rotations.
 */
export async function appelApi<T>(chemin: string, options: Options = {}): Promise<T> {
  if (!RACINE) {
    throw new ErreurApi(
      "EXPO_PUBLIC_API_URL n'est pas défini. Renseigne mobile/.env puis relance avec --clear.",
      0,
      "config_absente",
    );
  }

  if (options.publique) {
    const reponse = await envoyer(chemin, options, null);
    if (!reponse.ok) throw await lireErreur(reponse);
    return lireCorps<T>(reponse);
  }

  const jeton = jetonsCourants?.accessToken ?? null;
  if (!jeton) throw new ErreurApi("Non connecté", 401, "jeton_absent");

  let reponse = await envoyer(chemin, options, jeton);

  if (reponse.status === 401) {
    const echec = await lireErreur(reponse);

    // Seul `jeton_invalide` signale une expiration ; `compte_absent` ou
    // `jeton_absent` ne se résolvent pas par un rafraîchissement.
    if (echec.code !== "jeton_invalide") {
      await deconnecter();
      throw echec;
    }

    let neufs: Jetons;
    try {
      neufs = await rafraichir();
    } catch (cause) {
      // Le rafraîchissement a échoué : les jetons ne valent plus rien, et le
      // serveur a peut-être déjà révoqué toute la famille. Retour à l'écran de
      // connexion, c'est le seul état honnête.
      await deconnecter();
      throw cause instanceof Error
        ? cause
        : new ErreurApi("Session expirée", 401, "rafraichissement_invalide");
    }

    reponse = await envoyer(chemin, options, neufs.accessToken);
  }

  if (!reponse.ok) throw await lireErreur(reponse);
  return lireCorps<T>(reponse);
}

/** Efface les jetons et prévient la session. */
export async function deconnecter(): Promise<void> {
  await oublierJetons();
  surDeconnexion?.();
}
