import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { chargerReferentiel } from "../api/routes";
import type { Referentiel } from "../api/types";

/**
 * Référentiels servis par `GET /api/v1/referentiel`.
 *
 * **Rien n'est recopié en dur dans l'app** : noms de rangs, seuils de Δ,
 * libellés de matériel, d'objectifs et de ressentis viennent tous du serveur.
 * C'est la règle qui évite le bug qu'avait connu l'aperçu web, lequel annonçait
 * 20 Δ sur une séance bonus qui en rapporte 8.
 *
 * La route est publique et déclarée cachable une heure : un seul chargement au
 * démarrage suffit.
 */

interface ValeurReferentiel {
  referentiel: Referentiel | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
  libelleGroupe: (id: string) => string;
  libelleMateriel: (id: string) => string;
  libelleObjectif: (id: string) => string;
  libelleNiveau: (id: string) => string;
}

const ContexteReferentiel = createContext<ValeurReferentiel | null>(null);

export function FournisseurReferentiel({ children }: { children: ReactNode }) {
  const [referentiel, setReferentiel] = useState<Referentiel | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    let vivant = true;
    setChargement(true);

    chargerReferentiel()
      .then((valeur) => {
        if (!vivant) return;
        setReferentiel(valeur);
        setErreur(null);
      })
      .catch((cause: unknown) => {
        if (!vivant) return;
        setErreur(cause instanceof Error ? cause.message : "Référentiel indisponible");
      })
      .finally(() => {
        if (vivant) setChargement(false);
      });

    return () => {
      vivant = false;
    };
  }, [tentative]);

  const recharger = useCallback(() => setTentative((n) => n + 1), []);

  const valeur = useMemo<ValeurReferentiel>(() => {
    // Repli sur l'identifiant brut : un libellé manquant ne doit jamais vider
    // un écran. « pectoraux » reste lisible, un blanc non.
    const libelle = (liste: { id: string; label: string }[] | undefined, id: string) =>
      liste?.find((e) => e.id === id)?.label ?? id;

    return {
      referentiel,
      chargement,
      erreur,
      recharger,
      libelleGroupe: (id) => libelle(referentiel?.groupesMusculaires, id),
      libelleMateriel: (id) => libelle(referentiel?.materiel, id),
      libelleObjectif: (id) => libelle(referentiel?.objectifs, id),
      libelleNiveau: (id) => libelle(referentiel?.niveaux, id),
    };
  }, [referentiel, chargement, erreur, recharger]);

  return (
    <ContexteReferentiel.Provider value={valeur}>{children}</ContexteReferentiel.Provider>
  );
}

export function useReferentiel(): ValeurReferentiel {
  const valeur = useContext(ContexteReferentiel);
  if (!valeur) {
    throw new Error("useReferentiel doit être utilisé dans <FournisseurReferentiel>.");
  }
  return valeur;
}
