import { appelApi } from "./client";
import type {
  CorpsOnboarding,
  CorpsPreferences,
  CorpsValidation,
  PageHistorique,
  PreferencesApi,
  Referentiel,
  ReponseDifficulte,
  ReponseMoi,
  ReponseOnboarding,
  ReponsePesee,
  ReponsePlan,
  ReponseSeance,
  ReponseValidation,
  Stats,
} from "./types";

/**
 * Une fonction par route de `/api/v1`.
 *
 * Les écrans n'écrivent jamais un chemin à la main : c'est ici, et nulle part
 * ailleurs, que le contrat de l'API est transcrit.
 */

/** Publique : l'app en a besoin avant même d'avoir un compte. */
export const chargerReferentiel = () =>
  appelApi<Referentiel>("/referentiel", { publique: true });

export const chargerMoi = () => appelApi<ReponseMoi>("/me");

/**
 * Termine l'onboarding. Refusé en 409 si le profil est déjà rempli — le
 * rejouer écraserait des préférences choisies et la pesée du jour.
 */
export const terminerOnboarding = (corps: CorpsOnboarding) =>
  appelApi<ReponseOnboarding>("/me/onboarding", { methode: "POST", corps });

/**
 * Remplace les préférences. Le serveur attend le bloc **entier** : il ne
 * fusionne pas, un envoi partiel effacerait des groupes sans le dire. Le plan
 * à venir est régénéré, le passé jamais.
 */
export const modifierPreferences = (corps: CorpsPreferences) =>
  appelApi<{ preferences: PreferencesApi }>("/me/preferences", { methode: "PUT", corps });

export const chargerPlan = (debut: string, fin: string) =>
  appelApi<ReponsePlan>("/plan", { parametres: { debut, fin } });

export const chargerSeance = (groupe: string) =>
  appelApi<ReponseSeance>("/seance", { parametres: { groupe } });

export const validerSeance = (corps: CorpsValidation) =>
  appelApi<ReponseValidation>("/seance/valider", { methode: "POST", corps });

export const ajusterDifficulte = (groupe: string, delta: 1 | -1) =>
  appelApi<ReponseDifficulte>("/difficulte", { methode: "POST", corps: { groupe, delta } });

export const enregistrerPesee = (kg: number) =>
  appelApi<ReponsePesee>("/pesee", { methode: "POST", corps: { kg } });

export const chargerStats = () => appelApi<Stats>("/stats");

/**
 * Façons de se connecter rattachées au compte.
 *
 * L'ajout ne passe pas par ici : il réclame une preuve d'identité fraîche, donc
 * l'ouverture d'une feuille système — voir `rattacher` dans `auth/natif.ts`.
 */
export const chargerConnexions = () =>
  appelApi<{ connexions: string[] }>("/me/connexions");

/** Retire une façon de se connecter. Le serveur refuse la dernière. */
export const detacherConnexion = (fournisseur: string) =>
  appelApi<{ connexions: string[] }>(`/me/connexions/${fournisseur}`, { methode: "DELETE" });

export const chargerHistorique = (limite?: number, avant?: string) =>
  appelApi<PageHistorique>("/historique", { parametres: { limite, avant } });

/**
 * Déconnexion côté serveur : le jeton de rafraîchissement est révoqué.
 *
 * Le jeton d'accès, lui, reste techniquement valide jusqu'à son expiration —
 * c'est le prix d'un JWT non consulté en base. Quinze minutes au plus.
 */
export const revoquerSession = (refreshToken: string) =>
  appelApi<void>("/auth/logout", { methode: "POST", corps: { refreshToken } });
