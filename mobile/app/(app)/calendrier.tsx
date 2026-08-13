import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chargerPlan } from "../../src/api/routes";
import type { JourPlan, StatutPlan } from "../../src/api/types";
import { useReferentiel } from "../../src/donnees/referentiel";
import { Carte } from "../../src/composants/Carte";
import { Chargement, EcranErreur, Vide } from "../../src/composants/Etats";
import {
  jourCivilISO,
  jourCourtEnFrancais,
  lundiCivilISO,
  plageEnFrancais,
} from "../../src/outils/dates";
import {
  LETTRAGE_TITRE,
  POLICE_TEXTE,
  POLICE_TEXTE_MOYEN,
  POLICE_TITRE,
  type Couleurs,
} from "../../src/theme/couleurs";
import { useCouleurs, useStyles } from "../../src/theme/theme";

/**
 * Le plan, semaine par semaine.
 *
 * Six semaines : deux derrière, quatre devant. Regarder loin en arrière n'a
 * pas d'intérêt — l'historique le fait mieux, séance par séance — et le plan
 * au-delà d'un mois serait de la fiction, puisqu'il se régénère à chaque
 * changement de préférences.
 *
 * **Deux lectures par semaine, et c'est délibéré.** La bande de sept jours
 * donne le rythme d'un coup d'œil ; les lignes en dessous nomment les groupes.
 * La version précédente voulait tout mettre dans la grille : les noms y étaient
 * rendus en 7,5 points, illisibles, et « Pectoraux » s'y coupait en deux. Une
 * case ne porte donc plus que son numéro et une marque d'état — ce qu'on peut
 * lire sans s'arrêter.
 *
 * L'app ne calcule rien : les jours, leurs groupes et leurs statuts viennent
 * tous de `GET /plan`.
 */

const SEMAINES_AVANT = 2;
const SEMAINES_APRES = 4;
const JOUR_MS = 86_400_000;

const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

/** Décale une date ISO d'un nombre de jours, en restant sur le jour civil. */
function decaler(iso: string, jours: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + jours * JOUR_MS)
    .toISOString()
    .slice(0, 10);
}

export default function Calendrier() {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const { libelleGroupe } = useReferentiel();
  const marges = useSafeAreaInsets();

  const [jours, setJours] = useState<JourPlan[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const aujourdhui = jourCivilISO();
  const debut = useMemo(() => decaler(lundiCivilISO(), -7 * SEMAINES_AVANT), []);
  const fin = useMemo(() => decaler(debut, 7 * (SEMAINES_AVANT + SEMAINES_APRES) - 1), [debut]);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const reponse = await chargerPlan(debut, fin);
      setJours(reponse.jours);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Chargement impossible");
    }
  }, [debut, fin]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const rafraichir = useCallback(() => {
    setRafraichit(true);
    void charger().finally(() => setRafraichit(false));
  }, [charger]);

  // Une journée porte **plusieurs lignes** quand la séance est hybride : le
  // plan réunit volontiers deux groupes le même jour. Les indexer un par un
  // écraserait le second, et l'utilisateur croirait ses groupes oubliés.
  //
  // Un jour peut aussi manquer — le serveur ne génère que ce qu'il a déjà
  // calculé. La grille reste complète, les cases absentes restent vides.
  const parDate = useMemo(() => {
    const index = new Map<string, JourPlan[]>();
    for (const j of jours ?? []) index.set(j.date, [...(index.get(j.date) ?? []), j]);
    return index;
  }, [jours]);

  const semaines = useMemo(
    () =>
      Array.from({ length: SEMAINES_AVANT + SEMAINES_APRES }, (_, s) =>
        Array.from({ length: 7 }, (_, j) => decaler(debut, s * 7 + j)),
      ),
    [debut],
  );

  if (erreur && !jours) return <EcranErreur message={erreur} onReessayer={charger} />;
  if (!jours) return <Chargement message="Chargement du plan…" />;
  if (jours.length === 0) {
    return <Vide message="Aucun jour de plan pour l'instant. Ouvre l'accueil pour le générer." />;
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.contenu, { paddingTop: marges.top + 16, paddingBottom: 36 }]}
      refreshControl={
        <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={c.texte2} />
      }
    >
      <Text style={styles.titre}>Calendrier</Text>

      {semaines.map((semaine, index) => {
        // Une semaine antérieure à l'inscription n'a aucun jour de plan : le
        // serveur n'en génère pas. Afficher sept numéros sans cases donnait
        // une rangée orpheline qui ressemblait à un défaut d'affichage.
        if (index < SEMAINES_AVANT && semaine.every((d) => !parDate.has(d))) return null;

        return (
          <Semaine
            key={semaine[0]}
            dates={semaine}
            titre={titreSemaine(index)}
            courante={index === SEMAINES_AVANT}
            parDate={parDate}
            aujourdhui={aujourdhui}
            libelleGroupe={libelleGroupe}
          />
        );
      })}

      <Legende />
    </ScrollView>
  );
}

const titreSemaine = (index: number): string => {
  const relatif = index - SEMAINES_AVANT;
  if (relatif === 0) return "Cette semaine";
  if (relatif === -1) return "Semaine dernière";
  if (relatif === 1) return "Semaine prochaine";
  return relatif < 0 ? `Il y a ${-relatif} semaines` : `Dans ${relatif} semaines`;
};

// ---------------------------------------------------------------------------
// Une semaine
// ---------------------------------------------------------------------------

function Semaine({
  dates,
  titre,
  courante,
  parDate,
  aujourdhui,
  libelleGroupe,
}: {
  dates: string[];
  titre: string;
  courante: boolean;
  parDate: Map<string, JourPlan[]>;
  aujourdhui: string;
  libelleGroupe: (id: string) => string;
}) {
  const styles = useStyles(creerStyles);

  // Seuls les jours d'entraînement sont détaillés : lister les repos allongerait
  // la carte pour ne rien apprendre, la bande les montre déjà.
  const seances = dates
    .map((date) => ({ date, lignes: parDate.get(date) ?? [] }))
    .filter((j) => j.lignes.length > 0 && j.lignes[0]!.groupe !== "repos");

  return (
    <Carte style={[styles.semaine, courante && styles.semaineCourante]}>
      <View style={styles.entete}>
        <Text style={[styles.enteteTitre, courante && styles.enteteTitreCourant]}>
          {titre.toUpperCase()}
        </Text>
        <Text style={styles.enteteDates}>{plageEnFrancais(dates[0]!, dates[6]!)}</Text>
      </View>

      <View style={styles.grille}>
        {dates.map((date, i) => (
          <Case
            key={date}
            date={date}
            lettre={JOURS_COURTS[i]!}
            lignes={parDate.get(date) ?? []}
            aujourdhui={date === aujourdhui}
          />
        ))}
      </View>

      {seances.length > 0 ? (
        <View style={styles.liste}>
          {seances.map(({ date, lignes }) => (
            <LigneSeance
              key={date}
              date={date}
              lignes={lignes}
              aujourdhui={date === aujourdhui}
              libelleGroupe={libelleGroupe}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.semaineVide}>Aucune séance prévue cette semaine.</Text>
      )}
    </Carte>
  );
}

// ---------------------------------------------------------------------------
// Une journée, dans la bande
// ---------------------------------------------------------------------------

/**
 * Le statut se lit à une marque sous le numéro, jamais à un aplat de couleur
 * vive : une semaine manquée est une information, pas une faute. La spec
 * interdit de culpabiliser, et un calendrier rouge le ferait à chaque ouverture.
 */
function Case({
  date,
  lettre,
  lignes,
  aujourdhui,
}: {
  date: string;
  lettre: string;
  lignes: JourPlan[];
  aujourdhui: boolean;
}) {
  const styles = useStyles(creerStyles);
  const numero = String(Number(date.slice(8, 10)));
  const premiere = lignes[0];
  const repos = premiere?.groupe === "repos";

  // Une journée hybride est faite dès que **toutes** ses lignes le sont : la
  // marque ne doit pas récompenser une moitié de séance.
  const statut: StatutPlan | null = !premiere
    ? null
    : lignes.every((l) => l.statut === "FAIT")
      ? "FAIT"
      : premiere.statut;

  return (
    <View style={styles.colonne}>
      <Text style={[styles.lettre, aujourdhui && styles.lettreAujourdhui]}>{lettre}</Text>
      <View style={[styles.case, aujourdhui && styles.caseAujourdhui]}>
        <Text style={[styles.numero, aujourdhui && styles.numeroAujourdhui]}>{numero}</Text>
        <Marque statut={statut} repos={repos} />
      </View>
    </View>
  );
}

/** Marque d'état : disque plein, anneau, tiret, ou rien. */
function Marque({ statut, repos }: { statut: StatutPlan | null; repos: boolean }) {
  const styles = useStyles(creerStyles);

  if (repos || statut === "REPOS") return <View style={styles.marqueRepos} />;
  if (statut === "FAIT") return <View style={styles.marqueFaite} />;
  if (statut === "PREVU") return <View style={styles.marquePrevue} />;
  // Manquée, ou jour sans plan : un simple trait gris, sans croix ni rouge.
  if (statut === "MANQUE") return <View style={styles.marqueManquee} />;
  return <View style={styles.marqueVide} />;
}

// ---------------------------------------------------------------------------
// Une séance, dans la liste
// ---------------------------------------------------------------------------

function LigneSeance({
  date,
  lignes,
  aujourdhui,
  libelleGroupe,
}: {
  date: string;
  lignes: JourPlan[];
  aujourdhui: boolean;
  libelleGroupe: (id: string) => string;
}) {
  const styles = useStyles(creerStyles);

  const faite = lignes.every((l) => l.statut === "FAIT");
  const manquee = lignes.every((l) => l.statut === "MANQUE");
  const groupes = lignes.map((l) => libelleGroupe(l.groupe)).join(" + ");

  return (
    <View style={styles.ligne}>
      <Text style={[styles.ligneJour, aujourdhui && styles.ligneJourAujourdhui]}>
        {jourCourtEnFrancais(date)}
      </Text>
      <Text style={[styles.ligneGroupes, manquee && styles.ligneGroupesManquee]} numberOfLines={1}>
        {groupes}
      </Text>
      <Text style={[styles.ligneStatut, faite && styles.ligneStatutFaite]}>
        {faite ? "faite" : manquee ? "manquée" : "prévue"}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Légende
// ---------------------------------------------------------------------------

function Legende() {
  const styles = useStyles(creerStyles);

  return (
    <View style={styles.legende}>
      {(
        [
          ["marqueFaite", "faite"],
          ["marquePrevue", "prévue"],
          ["marqueManquee", "manquée"],
          ["marqueRepos", "repos"],
        ] as const
      ).map(([marque, texte]) => (
        <View key={texte} style={styles.legendeItem}>
          <View style={styles.legendeMarque}>
            <View style={styles[marque]} />
          </View>
          <Text style={styles.legendeTexte}>{texte}</Text>
        </View>
      ))}
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  contenu: {
    paddingHorizontal: 16,
    gap: 12,
  },
  titre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    marginBottom: 2,
  },

  // --- La carte d'une semaine ---
  semaine: {
    gap: 12,
  },
  semaineCourante: {
    borderColor: c.accent,
  },
  entete: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  enteteTitre: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte2,
    fontSize: 11,
    letterSpacing: LETTRAGE_TITRE,
    fontWeight: "600",
  },
  enteteTitreCourant: {
    color: c.accent,
  },
  enteteDates: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12,
  },

  // --- La bande de sept jours ---
  grille: {
    flexDirection: "row",
    gap: 5,
  },
  colonne: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  lettre: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 10.5,
    letterSpacing: 1,
  },
  lettreAujourdhui: {
    color: c.accent,
  },
  case: {
    width: "100%",
    // Assez haut pour que le chiffre respire et que la marque ait sa place,
    // là où la version précédente entassait quatre informations dans 48 points.
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.filet,
    backgroundColor: c.fond3,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  caseAujourdhui: {
    borderColor: c.accent,
    borderWidth: 1.5,
  },
  numero: {
    fontFamily: POLICE_TITRE,
    color: c.texte,
    fontSize: 16,
  },
  numeroAujourdhui: {
    color: c.accent,
  },
  marqueFaite: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.positif,
  },
  marquePrevue: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: c.accent,
  },
  marqueManquee: {
    width: 9,
    height: 1.5,
    backgroundColor: c.texte3,
  },
  marqueRepos: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.filetFort,
  },
  marqueVide: {
    width: 7,
    height: 7,
  },

  // --- Les séances de la semaine ---
  liste: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: c.filet,
    paddingTop: 10,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    paddingVertical: 4,
  },
  ligneJour: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte2,
    fontSize: 13,
    // Largeur fixe : les jours s'alignent en colonne, « ven. 15 » comme
    // « mer. 3 ». Sans elle, les noms de groupes dansaient d'une ligne à
    // l'autre.
    width: 62,
  },
  ligneJourAujourdhui: {
    color: c.accent,
  },
  ligneGroupes: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 14,
    flex: 1,
  },
  ligneGroupesManquee: {
    color: c.texte3,
  },
  ligneStatut: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 11.5,
  },
  ligneStatutFaite: {
    color: c.positif,
  },
  semaineVide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12.5,
    borderTopWidth: 1,
    borderTopColor: c.filet,
    paddingTop: 10,
  },

  // --- Légende ---
  legende: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  legendeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendeMarque: {
    width: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  legendeTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12,
  },
});
