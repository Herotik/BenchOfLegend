import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deconnecter as effacerSession,
  ecouterDeconnexion,
  jetonsEnMemoire,
  restaurerJetons,
} from "../api/client";
import { chargerMoi, revoquerSession } from "../api/routes";
import type { ReponseEchange, ReponseMoi } from "../api/types";
import { connecterApple, connecterDiscord, connecterGoogle } from "./natif";
import { connecterParNavigateur } from "./relais";

/** Les fournisseurs joignables sans passer par le site. */
export type FournisseurNatif = "google" | "apple" | "discord";

/**
 * État de connexion, partagé par toute l'app.
 *
 * Le profil (`moi`) vit ici plutôt que dans chaque écran : le rang et les Δ
 * changent à chaque validation de séance et à chaque pesée, et deux écrans qui
 * les rechargeraient chacun de leur côté finiraient par afficher deux totaux
 * différents.
 */

type Etat = "chargement" | "connecte" | "deconnecte";

interface ValeurSession {
  etat: Etat;
  moi: ReponseMoi | null;
  /** Échec du chargement du profil — réseau, serveur éteint. */
  erreurProfil: string | null;
  /** Relais navigateur : marche partout, y compris sans module natif. */
  seConnecter: () => Promise<void>;
  /** Connexion native, sans passer par le site. Voir `auth/natif.ts`. */
  seConnecterNatif: (fournisseur: FournisseurNatif) => Promise<void>;
  seDeconnecter: () => Promise<void>;
  rafraichirProfil: () => Promise<void>;
  /** Adopte un échange déjà réalisé (retour du relais par lien profond). */
  adopterEchange: (echange: ReponseEchange) => Promise<void>;
}

const ContexteSession = createContext<ValeurSession | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [moi, setMoi] = useState<ReponseMoi | null>(null);
  const [erreurProfil, setErreurProfil] = useState<string | null>(null);

  // Le composant peut être démonté pendant une requête en vol — au
  // rechargement à chaud, par exemple. Écrire dans son état après coup ne sert
  // qu'à produire un avertissement.
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const relireProfil = useCallback(async () => {
    try {
      const profil = await chargerMoi();
      if (!monte.current) return;
      setMoi(profil);
      setErreurProfil(null);
    } catch (cause) {
      if (!monte.current) return;
      // Un 401 non rattrapable a déjà déclenché `ecouterDeconnexion` : inutile
      // d'y ajouter un message, l'écran de connexion est déjà en route.
      setErreurProfil(cause instanceof Error ? cause.message : "Profil indisponible");
    }
  }, []);

  useEffect(() => {
    ecouterDeconnexion(() => {
      if (!monte.current) return;
      setMoi(null);
      setErreurProfil(null);
      setEtat("deconnecte");
    });

    void (async () => {
      const jetons = await restaurerJetons();
      if (!monte.current) return;

      if (!jetons) {
        setEtat("deconnecte");
        return;
      }

      // Les jetons suffisent à considérer la session ouverte : si le profil ne
      // se charge pas parce que le Wi-Fi est coupé, renvoyer à l'écran de
      // connexion serait mensonger — et une nouvelle connexion n'y changerait
      // rien.
      setEtat("connecte");
      await relireProfil();
    })();

    return () => ecouterDeconnexion(null);
  }, [relireProfil]);

  const adopterEchange = useCallback(
    async (echange: ReponseEchange) => {
      // Les jetons sont déjà rangés par `echangerCode`. On relit le profil
      // complet plutôt que d'utiliser `echange.utilisateur` : celui-ci ne
      // porte ni le rang, ni la progression, ni les préférences.
      void echange;
      setEtat("connecte");
      await relireProfil();
    },
    [relireProfil],
  );

  const seConnecter = useCallback(async () => {
    const echange = await connecterParNavigateur();
    await adopterEchange(echange);
  }, [adopterEchange]);

  const seConnecterNatif = useCallback(
    async (fournisseur: FournisseurNatif) => {
      const connecter = {
        google: connecterGoogle,
        apple: connecterApple,
        discord: connecterDiscord,
      }[fournisseur];

      await adopterEchange(await connecter());
    },
    [adopterEchange],
  );

  const seDeconnecter = useCallback(async () => {
    const jetons = jetonsEnMemoire();
    if (jetons) {
      try {
        // Révocation côté serveur : sans elle, le jeton de rafraîchissement
        // resterait valable soixante jours sur un téléphone qu'on vient de
        // quitter.
        await revoquerSession(jetons.refreshToken);
      } catch {
        // Hors ligne, ou jeton déjà révoqué : la déconnexion locale prime.
      }
    }
    await effacerSession();
  }, []);

  const valeur = useMemo<ValeurSession>(
    () => ({
      etat,
      moi,
      erreurProfil,
      seConnecter,
      seConnecterNatif,
      seDeconnecter,
      rafraichirProfil: relireProfil,
      adopterEchange,
    }),
    [
      etat,
      moi,
      erreurProfil,
      seConnecter,
      seConnecterNatif,
      seDeconnecter,
      relireProfil,
      adopterEchange,
    ],
  );

  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>;
}

export function useSession(): ValeurSession {
  const valeur = useContext(ContexteSession);
  if (!valeur) {
    throw new Error("useSession doit être utilisé dans <FournisseurSession>.");
  }
  return valeur;
}
