import { appelApi } from "./client";
import type {
  CorpsValidation,
  PageHistorique,
  Referentiel,
  ReponseDifficulte,
  ReponseMoi,
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
