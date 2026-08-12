import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { abonnerFile, envoyerLaFile, fileEnAttente, type BilanEnvoi } from "./file-attente";

/**
 * Quand la file d'attente repart.
 *
 * Deux moments, et pas un de plus : l'app s'ouvre, l'app revient au premier
 * plan. C'est exactement le geste de quelqu'un qui sort de la salle et rouvre
 * l'app — et c'est le seul instant où l'on peut savoir que le réseau est
 * revenu sans écouter l'état du lien.
 *
 * Pas de `@react-native-community/netinfo` : une dépendance native de plus pour
 * gagner quelques minutes sur un envoi qui n'est pas pressé. Une séance qui
 * part à la prochaine ouverture arrive largement à temps — le serveur accepte
 * jusqu'au lendemain.
 */

/** Nombre de séances en attente, tenu à jour au fil des envois. */
export function useFileEnAttente(): number {
  const [restantes, setRestantes] = useState(0);

  useEffect(() => {
    let vivant = true;
    void fileEnAttente().then((file) => {
      if (vivant) setRestantes(file.length);
    });

    const desabonner = abonnerFile((n) => {
      if (vivant) setRestantes(n);
    });

    return () => {
      vivant = false;
      desabonner();
    };
  }, []);

  return restantes;
}

/**
 * Vide la file au démarrage et à chaque retour au premier plan.
 *
 * À monter **une seule fois**, dans la coquille de l'app. `envoyerLaFile()` se
 * protège des appels concurrents, mais multiplier les écouteurs d'`AppState`
 * multiplierait les tentatives sans rien accélérer.
 *
 * `actif` attend que la session soit ouverte : sans jetons, chaque envoi
 * échouerait en 401 et repartirait en file, pour rien.
 */
export function useEnvoiAutomatique(actif: boolean, apresEnvoi?: () => void): void {
  const envoyer = useCallback(() => {
    void envoyerLaFile().then((bilan: BilanEnvoi) => {
      // Le rang et les Δ viennent de bouger : ce qui est affiché date d'avant
      // la séance envoyée.
      if (bilan.envoyees.length > 0) apresEnvoi?.();
    });
  }, [apresEnvoi]);

  useEffect(() => {
    if (!actif) return;

    envoyer();

    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") envoyer();
    });

    return () => abonnement.remove();
  }, [actif, envoyer]);
}
