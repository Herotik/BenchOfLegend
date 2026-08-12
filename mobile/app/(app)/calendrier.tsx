import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chargerPlan } from "../../src/api/routes";
import type { JourPlan, StatutPlan } from "../../src/api/types";
import { useReferentiel } from "../../src/donnees/referentiel";
import { TitreSection } from "../../src/composants/Carte";
import { Chargement, EcranErreur, Vide } from "../../src/composants/Etats";
import { jourCivilISO, lundiCivilISO } from "../../src/outils/dates";
import { POLICE_TEXTE, POLICE_TEXTE_MOYEN, POLICE_TITRE, type Couleurs } from "../../src/theme/couleurs";
import { useCouleurs, useStyles } from "../../src/theme/theme";

/**
 * Le plan, semaine par semaine.
 *
 * Six semaines : deux derrière, quatre devant. Regarder loin en arrière n'a
 * pas d'intérêt — l'historique le fait mieux, séance par séance — et le plan
 * au-delà d'un mois serait de la fiction, puisqu'il se régénère à chaque
 * changement de préférences.
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
      contentContainerStyle={[styles.contenu, { paddingTop: marges.top + 16, paddingBottom: 32 }]}
      refreshControl={
        <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={c.texte2} />
      }
    >
      <Text style={styles.titre}>Calendrier</Text>

      <View style={styles.enteteJours}>
        {JOURS_COURTS.map((j, i) => (
          <Text key={i} style={styles.enteteJour}>
            {j}
          </Text>
        ))}
      </View>

      {semaines.map((semaine, index) => {
        // Une semaine antérieure à l'inscription n'a aucun jour de plan : le
        // serveur n'en génère pas. Afficher sept numéros sans cases donnait
        // une rangée orpheline qui ressemblait à un défaut d'affichage.
        if (index < SEMAINES_AVANT && semaine.every((d) => !parDate.has(d))) return null;
        return (
        <View key={semaine[0]} style={styles.semaine}>
          <TitreSection>{titreSemaine(index)}</TitreSection>
          <View style={styles.grille}>
            {semaine.map((date) => (
              <Case
                key={date}
                date={date}
                lignes={parDate.get(date) ?? []}
                aujourdhui={date === aujourdhui}
                libelleGroupe={libelleGroupe}
              />
            ))}
          </View>
        </View>
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

/**
 * Une journée.
 *
 * Le statut se lit au filet et à la teinte du fond, jamais à un aplat de
 * couleur vive : une semaine manquée est une information, pas une faute. La
 * spec interdit de culpabiliser, et un calendrier rouge le ferait à chaque
 * ouverture.
 */
function Case({
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
  const numero = date.slice(8, 10);
  const premiere = lignes[0];
  const repos = premiere?.groupe === "repos";

  // Une journée hybride est faite dès que **toutes** ses lignes le sont : la
  // pastille ne doit pas récompenser une moitié de séance.
  const faite = lignes.length > 0 && lignes.every((l) => l.statut === "FAIT");

  return (
    <View
      style={[
        styles.case,
        premiere ? styles[statutStyle(faite ? "FAIT" : premiere.statut)] : styles.caseAbsente,
        aujourdhui && styles.caseAujourdhui,
      ]}
    >
      <Text style={[styles.caseNumero, aujourdhui && styles.caseNumeroAujourdhui]}>{numero}</Text>
      {repos ? (
        <Text style={styles.caseGroupe}>repos</Text>
      ) : (
        lignes.map((l) => (
          <Text
            key={l.id}
            style={styles.caseGroupe}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {libelleGroupe(l.groupe)}
          </Text>
        ))
      )}
      {faite ? <View style={styles.pastille} /> : null}
    </View>
  );
}

const STYLE_PAR_STATUT = {
  FAIT: "caseFaite",
  MANQUE: "caseManquee",
  REPOS: "caseRepos",
  PREVU: "casePrevue",
} as const;

const statutStyle = (statut: StatutPlan) => STYLE_PAR_STATUT[statut];

function Legende() {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.legende}>
      {[
        ["caseFaite", "faite"],
        ["casePrevue", "prévue"],
        ["caseManquee", "manquée"],
        ["caseRepos", "repos"],
      ].map(([style, texte]) => (
        <View key={texte} style={styles.legendeItem}>
          <View style={[styles.legendeCarre, styles[style as "caseFaite"]]}>
            {style === "caseFaite" ? <View style={styles.pastilleLegende} /> : null}
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
    paddingHorizontal: 14,
    gap: 6,
  },
  titre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    marginLeft: 4,
    marginBottom: 6,
  },
  enteteJours: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 2,
  },
  enteteJour: {
    fontFamily: POLICE_TEXTE,
    flex: 1,
    textAlign: "center",
    color: c.texte3,
    fontSize: 11,
    letterSpacing: 1,
  },
  semaine: {
    gap: 4,
    marginBottom: 6,
  },
  grille: {
    flexDirection: "row",
    gap: 4,
  },
  case: {
    flex: 1,
    aspectRatio: 0.68,
    borderWidth: 1,
    paddingTop: 4,
    // Marge réduite au minimum : « Pectoraux » doit tenir sur une ligne, faute
    // de quoi il se coupe en « Pectorau / x », qui ne se lit plus.
    paddingHorizontal: 1,
    alignItems: "center",
    gap: 2,
  },
  caseAbsente: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  casePrevue: {
    borderColor: c.filet,
    backgroundColor: c.fond2,
  },
  caseFaite: {
    borderColor: c.filetFort,
    backgroundColor: c.fond3,
  },
  // Ni rouge ni croix : l'absence de gain est déjà la sanction.
  caseManquee: {
    borderColor: c.filet,
    backgroundColor: "transparent",
  },
  caseRepos: {
    borderColor: "transparent",
    backgroundColor: c.fond2,
  },
  caseAujourdhui: {
    borderColor: c.accent,
    borderWidth: 1.5,
  },
  caseNumero: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte2,
    fontSize: 12,
    fontWeight: "600",
  },
  caseNumeroAujourdhui: {
    color: c.accent,
  },
  caseGroupe: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 7.5,
    lineHeight: 10,
    textAlign: "center",
  },
  pastille: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: c.positif,
    marginTop: 1,
  },
  legende: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 14,
    marginLeft: 4,
  },
  legendeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendeCarre: {
    width: 12,
    height: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pastilleLegende: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.positif,
  },
  legendeTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 11.5,
  },
});
