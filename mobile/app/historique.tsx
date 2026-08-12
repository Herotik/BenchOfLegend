import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chargerHistorique } from "../src/api/routes";
import type { SeancePassee } from "../src/api/types";
import { useReferentiel } from "../src/donnees/referentiel";
import { Bouton } from "../src/composants/Bouton";
import { Carte } from "../src/composants/Carte";
import { Chargement, EcranErreur, Vide } from "../src/composants/Etats";
import { jourEnFrancais } from "../src/outils/dates";
import { revenir } from "../src/outils/navigation";
import { POLICE_TEXTE, POLICE_TEXTE_MOYEN, POLICE_TITRE, type Couleurs } from "../src/theme/couleurs";
import { useStyles } from "../src/theme/theme";

/**
 * Historique des séances validées.
 *
 * Paginé par curseur plutôt que par numéro de page : une séance validée
 * pendant la consultation décalerait toutes les pages suivantes et ferait
 * réapparaître une ligne déjà vue.
 *
 * L'instantané des exercices est enregistré à la validation et n'est pas
 * relu ici : le détail d'une séance passée appartient à un écran de séance,
 * pas à une liste qu'on parcourt.
 */

const PAR_PAGE = 20;

export default function Historique() {
  const styles = useStyles(creerStyles);
  const { libelleGroupe } = useReferentiel();
  const marges = useSafeAreaInsets();

  const [seances, setSeances] = useState<SeancePassee[]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const [premierChargement, setPremierChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(
    async (avant?: string) => {
      setErreur(null);
      setEnCours(true);
      try {
        const page = await chargerHistorique(PAR_PAGE, avant);
        // Concaténer plutôt que remplacer : on ajoute une page, on ne
        // recharge pas la liste.
        setSeances((precedentes) => (avant ? [...precedentes, ...page.seances] : page.seances));
        setCurseur(page.suivant);
        setFini(page.suivant === null);
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Chargement impossible");
      } finally {
        setEnCours(false);
        setPremierChargement(false);
      }
    },
    [],
  );

  useEffect(() => {
    void charger();
  }, [charger]);

  if (premierChargement) return <Chargement message="Chargement de l'historique…" />;
  if (erreur && seances.length === 0) {
    return <EcranErreur message={erreur} onReessayer={() => void charger()} />;
  }

  return (
    <View style={styles.page}>
      <View style={[styles.entete, { paddingTop: marges.top + 16 }]}>
        <Text style={styles.titre}>Historique</Text>
        <Text style={styles.compte}>
          {seances.length} séance{seances.length > 1 ? "s" : ""}
          {fini ? "" : " et plus"}
        </Text>
      </View>

      <FlatList
        data={seances}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.liste, { paddingBottom: marges.bottom + 90 }]}
        ListEmptyComponent={
          <Vide message="Aucune séance validée pour l'instant. La première apparaîtra ici." />
        }
        renderItem={({ item }) => (
          <Ligne seance={item} libelleGroupe={libelleGroupe} />
        )}
        ListFooterComponent={
          curseur && !fini ? (
            <Bouton
              titre="Charger plus"
              intention="sombre"
              enCours={enCours}
              onPress={() => void charger(curseur)}
            />
          ) : null
        }
      />

      <View style={[styles.pied, { paddingBottom: marges.bottom + 16 }]}>
        <Bouton titre="Retour" intention="discret" onPress={() => revenir("/progres")} />
      </View>
    </View>
  );
}

function Ligne({
  seance,
  libelleGroupe,
}: {
  seance: SeancePassee;
  libelleGroupe: (id: string) => string;
}) {
  const styles = useStyles(creerStyles);
  return (
    <Carte style={styles.carte}>
      <View style={styles.ligneHaut}>
        <Text style={styles.groupe}>
          {libelleGroupe(seance.groupe)}
          {seance.bonus ? " · bonus" : ""}
        </Text>
        <Text style={styles.gain}>+{seance.lpGagnes} Δ</Text>
      </View>
      <Text style={styles.date}>{jourEnFrancais(seance.date.slice(0, 10))}</Text>
      <View style={styles.details}>
        {seance.dureeMin !== null ? (
          <Text style={styles.detail}>{seance.dureeMin} min</Text>
        ) : null}
        {seance.ressenti ? (
          <Text style={styles.detail}>ressenti : {libelleRessenti(seance.ressenti)}</Text>
        ) : null}
      </View>
    </Carte>
  );
}

const libelleRessenti = (r: string): string =>
  ({ FACILE: "facile", JUSTE: "juste", DIFFICILE: "difficile" })[r] ?? r;

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  entete: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  titre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
  },
  compte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12,
    marginTop: 2,
  },
  liste: {
    paddingHorizontal: 18,
    gap: 8,
  },
  carte: {
    gap: 4,
  },
  ligneHaut: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  groupe: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  gain: {
    fontFamily: POLICE_TITRE,
    color: c.accent,
    fontSize: 15,
  },
  date: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12.5,
  },
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 2,
  },
  detail: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 11.5,
  },
  pied: {
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.filet,
    backgroundColor: c.fond,
  },
});
