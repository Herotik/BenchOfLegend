import { useCallback, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { terminerOnboarding } from "../src/api/routes";
import type { CorpsOnboarding, Niveau, Objectif } from "../src/api/types";
import { useSession } from "../src/auth/session";
import { useReferentiel } from "../src/donnees/referentiel";
import { BarreProgression } from "../src/composants/BarreProgression";
import { Bouton } from "../src/composants/Bouton";
import { Carte } from "../src/composants/Carte";
import { Chargement, EcranErreur } from "../src/composants/Etats";
import {
  POLICE_TEXTE,
  POLICE_TEXTE_MOYEN,
  POLICE_TITRE,
  type Couleurs,
} from "../src/theme/couleurs";
import { useCouleurs, useStyles } from "../src/theme/theme";

/**
 * Questionnaire d'entrée.
 *
 * Une question par écran, comme la séance guidée : c'est la seule mise en
 * forme qui tienne sur un téléphone, où un formulaire de sept champs oblige à
 * remonter sans cesse pour vérifier ce qu'on a répondu.
 *
 * **Rien n'est recopié en dur** : niveaux, objectifs, groupes et matériel
 * viennent tous de `GET /referentiel`. Ajouter un groupe côté serveur le fait
 * apparaître ici sans toucher à cette page.
 *
 * L'envoi est unique et final — `POST /me/onboarding` refuse d'être rejoué —
 * d'où le récapitulatif implicite de la dernière étape et l'absence
 * d'enregistrement intermédiaire.
 */

const JOURS_POSSIBLES = [2, 3, 4, 5, 6];

/** Bornes du serveur, reprises pour refuser sur place plutôt qu'en 400. */
const TAILLE_MIN = 120;
const TAILLE_MAX = 230;
const POIDS_MIN = 30;
const POIDS_MAX = 300;

interface Brouillon {
  niveau: Niveau | null;
  objectif: Objectif | null;
  joursParSemaine: number | null;
  groupesMusculaires: string[];
  pointsForts: string[];
  materiel: string[];
  tailleCm: string;
  poidsKg: string;
}

const VIDE: Brouillon = {
  niveau: null,
  objectif: null,
  joursParSemaine: null,
  groupesMusculaires: [],
  pointsForts: [],
  materiel: [],
  tailleCm: "",
  poidsKg: "",
};

/** Accepte la virgule : c'est ce que propose le clavier décimal français. */
function nombreOuNull(valeur: string): number | null {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function Onboarding() {
  const styles = useStyles(creerStyles);
  const { moi, rafraichirProfil } = useSession();
  const { referentiel, chargement, erreur: erreurReferentiel } = useReferentiel();
  const marges = useSafeAreaInsets();

  const [etape, setEtape] = useState(0);
  const [d, setD] = useState<Brouillon>(VIDE);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const modifier = useCallback(
    <C extends keyof Brouillon>(champ: C, valeur: Brouillon[C]) =>
      setD((precedent) => ({ ...precedent, [champ]: valeur })),
    [],
  );

  /** Coche ou décoche dans une liste à choix multiples. */
  const basculer = useCallback(
    (champ: "groupesMusculaires" | "pointsForts" | "materiel", id: string) =>
      setD((p) => {
        const dedans = p[champ].includes(id);
        const suivant = dedans ? p[champ].filter((x) => x !== id) : [...p[champ], id];
        // Un point fort sur un groupe qu'on vient de retirer n'aurait plus de
        // sens : le serveur le filtrerait en silence, autant le faire ici.
        if (champ === "groupesMusculaires") {
          return { ...p, groupesMusculaires: suivant, pointsForts: p.pointsForts.filter((g) => suivant.includes(g)) };
        }
        return { ...p, [champ]: suivant };
      }),
    [],
  );

  const taille = nombreOuNull(d.tailleCm);
  const poids = nombreOuNull(d.poidsKg);

  const etapes = useMemo(
    () => [
      {
        titre: "Où en es-tu ?",
        aide: "Le niveau fixe le point de départ. Il s'ajustera tout seul, séance après séance, selon ce que tu déclareras ressentir.",
        valide: d.niveau !== null,
        rendu: (
          <>
            {referentiel?.niveaux.map((n) => (
              <Option
                key={n.id}
                titre={n.label}
                aide={n.aide}
                actif={d.niveau === n.id}
                onPress={() => modifier("niveau", n.id as Niveau)}
              />
            ))}
          </>
        ),
      },
      {
        titre: "Que cherches-tu ?",
        aide: "L'objectif oriente le nombre de séries et de répétitions, pas les exercices eux-mêmes.",
        valide: d.objectif !== null,
        rendu: (
          <>
            {referentiel?.objectifs.map((o) => (
              <Option
                key={o.id}
                titre={o.label}
                actif={d.objectif === o.id}
                onPress={() => modifier("objectif", o.id as Objectif)}
              />
            ))}
          </>
        ),
      },
      {
        titre: "Combien de séances par semaine ?",
        aide: "Choisis ce que tu tiendras vraiment. Une semaine manquée ne retire jamais de Δ — mais elle n'en rapporte pas.",
        valide: d.joursParSemaine !== null,
        rendu: (
          <View style={styles.jours}>
            {JOURS_POSSIBLES.map((n) => (
              <Pressable
                key={n}
                onPress={() => modifier("joursParSemaine", n)}
                accessibilityRole="radio"
                accessibilityState={{ selected: d.joursParSemaine === n }}
                style={[styles.jour, d.joursParSemaine === n && styles.jourActif]}
              >
                <Text style={[styles.jourChiffre, d.joursParSemaine === n && styles.jourChiffreActif]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
        ),
      },
      {
        titre: "Que veux-tu travailler ?",
        aide: "Au moins un groupe. Le plan les répartira sur la semaine.",
        valide: d.groupesMusculaires.length > 0,
        rendu: (
          <>
            {referentiel?.groupesMusculaires.map((g) => (
              <Option
                key={g.id}
                titre={g.label}
                actif={d.groupesMusculaires.includes(g.id)}
                multiple
                onPress={() => basculer("groupesMusculaires", g.id)}
              />
            ))}
          </>
        ),
      },
      {
        titre: "Une priorité ?",
        aide: "Les groupes marqués passent en premier quand la semaine compte moins de créneaux que de groupes. Tu peux n'en marquer aucun.",
        valide: true,
        rendu: (
          <>
            {d.groupesMusculaires.map((id) => (
              <Option
                key={id}
                titre={libelleDe(referentiel?.groupesMusculaires, id)}
                actif={d.pointsForts.includes(id)}
                multiple
                onPress={() => basculer("pointsForts", id)}
              />
            ))}
          </>
        ),
      },
      {
        titre: "De quoi disposes-tu ?",
        aide: "Rien de coché est une réponse valable : le plan se fera au poids de corps.",
        valide: true,
        rendu: (
          <>
            {referentiel?.materiel.map((m) => (
              <Option
                key={m.id}
                titre={m.label}
                actif={d.materiel.includes(m.id)}
                multiple
                onPress={() => basculer("materiel", m.id)}
              />
            ))}
          </>
        ),
      },
      {
        titre: "Taille et poids",
        aide: "Le poids d'aujourd'hui devient le premier point de ta courbe. Tu pourras te peser chaque jour depuis l'accueil.",
        valide:
          taille !== null &&
          taille >= TAILLE_MIN &&
          taille <= TAILLE_MAX &&
          poids !== null &&
          poids >= POIDS_MIN &&
          poids <= POIDS_MAX,
        rendu: (
          <View style={styles.mesures}>
            <Mesure
              etiquette="Taille"
              unite="cm"
              valeur={d.tailleCm}
              onChange={(v) => modifier("tailleCm", v)}
              exemple="178"
            />
            <Mesure
              etiquette="Poids"
              unite="kg"
              valeur={d.poidsKg}
              onChange={(v) => modifier("poidsKg", v)}
              exemple="74,5"
            />
          </View>
        ),
      },
    ],
    [d, referentiel, styles, modifier, basculer, taille, poids],
  );

  const derniere = etape === etapes.length - 1;
  // `etapes` est construit ici même et `etape` borné par les deux boutons :
  // l'index est toujours bon, mais le repli évite d'imposer un `!` au reste.
  const courante = etapes[etape] ?? etapes[0]!;

  const envoyer = useCallback(() => {
    if (taille === null || poids === null || !d.niveau || !d.objectif || !d.joursParSemaine) return;
    setErreur(null);
    setEnCours(true);

    const corps: CorpsOnboarding = {
      tailleCm: Math.round(taille),
      niveau: d.niveau,
      materiel: d.materiel,
      groupesMusculaires: d.groupesMusculaires,
      pointsForts: d.pointsForts,
      objectif: d.objectif,
      joursParSemaine: d.joursParSemaine,
      poidsKg: poids,
    };

    void (async () => {
      try {
        await terminerOnboarding(corps);
        // Le profil porte `onboarded` : sans relecture, la garde du groupe
        // d'onglets renverrait aussitôt ici.
        await rafraichirProfil();
        router.replace("/aujourdhui");
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Envoi impossible");
        setEnCours(false);
      }
    })();
  }, [d, taille, poids, rafraichirProfil]);

  if (moi?.utilisateur.onboarded) return <Redirect href="/aujourdhui" />;
  if (chargement || !referentiel) {
    return erreurReferentiel ? (
      <EcranErreur message={erreurReferentiel} />
    ) : (
      <Chargement message="Préparation du questionnaire…" />
    );
  }

  return (
    <View style={[styles.page, { paddingTop: marges.top + 12 }]}>
      <View style={styles.entete}>
        <BarreProgression
          part={(etape + 1) / etapes.length}
          gauche={`Étape ${etape + 1} / ${etapes.length}`}
        />
      </View>

      <ScrollView
        style={styles.defilement}
        contentContainerStyle={styles.contenu}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titre}>{courante.titre}</Text>
        <Text style={styles.aide}>{courante.aide}</Text>
        <View style={styles.champs}>{courante.rendu}</View>

        {erreur ? (
          <Carte style={styles.erreur}>
            <Text style={styles.erreurTitre}>L&apos;envoi a échoué</Text>
            <Text style={styles.erreurTexte}>{erreur}</Text>
          </Carte>
        ) : null}
      </ScrollView>

      <View style={[styles.pied, { paddingBottom: marges.bottom + 16 }]}>
        <Bouton
          titre={derniere ? "Commencer" : "Continuer"}
          onPress={derniere ? envoyer : () => setEtape((e) => e + 1)}
          desactive={!courante.valide}
          enCours={enCours}
        />
        {etape > 0 ? (
          <Bouton
            titre="Retour"
            intention="discret"
            onPress={() => setEtape((e) => e - 1)}
          />
        ) : null}
      </View>
    </View>
  );
}

const libelleDe = (liste: { id: string; label: string }[] | undefined, id: string) =>
  liste?.find((x) => x.id === id)?.label ?? id;

/**
 * Une réponse possible.
 *
 * `multiple` ne change que le rôle d'accessibilité et la forme de la marque —
 * carré pour un choix cumulable, rond pour un choix exclusif. C'est la seule
 * indication qu'on peut en cocher plusieurs, et elle doit être lisible avant
 * d'avoir essayé.
 */
function Option({
  titre,
  aide,
  actif,
  multiple = false,
  onPress,
}: {
  titre: string;
  aide?: string;
  actif: boolean;
  multiple?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(creerStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: actif, selected: actif }}
      style={[styles.option, actif && styles.optionActive]}
    >
      <View
        style={[
          styles.marque,
          multiple ? styles.marqueCarree : styles.marqueRonde,
          actif && styles.marqueActive,
        ]}
      />
      <View style={styles.optionTexte}>
        <Text style={[styles.optionTitre, actif && styles.optionTitreActif]}>{titre}</Text>
        {aide ? <Text style={styles.optionAide}>{aide}</Text> : null}
      </View>
    </Pressable>
  );
}

function Mesure({
  etiquette,
  unite,
  valeur,
  onChange,
  exemple,
}: {
  etiquette: string;
  unite: string;
  valeur: string;
  onChange: (v: string) => void;
  exemple: string;
}) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  return (
    <View style={styles.mesure}>
      <Text style={styles.mesureEtiquette}>{etiquette}</Text>
      <View style={styles.mesureLigne}>
        <TextInput
          value={valeur}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={exemple}
          // Sans cela, l'indication reste au gris du système et disparaît
          // dans le fond en thème sombre.
          placeholderTextColor={c.texte3}
          style={styles.mesureChamp}
          accessibilityLabel={`${etiquette} en ${unite}`}
        />
        <Text style={styles.mesureUnite}>{unite}</Text>
      </View>
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  entete: {
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  defilement: {
    flex: 1,
  },
  contenu: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 10,
  },
  titre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 27,
    lineHeight: 34,
  },
  aide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  champs: {
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.filet,
    backgroundColor: c.fond2,
  },
  // L'état choisi se marque au filet, jamais à un aplat d'accent : le
  // porphyre ne porte que l'identité.
  optionActive: {
    borderColor: c.filetFort,
    backgroundColor: c.fond3,
  },
  marque: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: c.texte3,
  },
  marqueRonde: {
    borderRadius: 9,
  },
  marqueCarree: {
    borderRadius: 3,
  },
  marqueActive: {
    borderColor: c.accent,
    backgroundColor: c.accent,
  },
  optionTexte: {
    flex: 1,
    gap: 3,
  },
  optionTitre: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 15,
  },
  optionTitreActif: {
    fontFamily: POLICE_TEXTE_MOYEN,
    fontWeight: "600",
  },
  optionAide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12.5,
    lineHeight: 18,
  },
  jours: {
    flexDirection: "row",
    gap: 8,
  },
  jour: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.filet,
    backgroundColor: c.fond2,
  },
  jourActif: {
    borderColor: c.filetFort,
    backgroundColor: c.fond3,
  },
  jourChiffre: {
    fontFamily: POLICE_TITRE,
    color: c.texte2,
    fontSize: 22,
  },
  jourChiffreActif: {
    color: c.accent,
  },
  mesures: {
    gap: 14,
  },
  mesure: {
    gap: 6,
  },
  mesureEtiquette: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
  },
  mesureLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mesureChamp: {
    fontFamily: POLICE_TEXTE,
    flex: 1,
    minWidth: 0,
    color: c.texte,
    backgroundColor: c.fond2,
    borderColor: c.filet,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
  },
  mesureUnite: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 15,
    width: 24,
  },
  pied: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: c.filet,
    backgroundColor: c.fond,
  },
  erreur: {
    borderColor: c.negatif,
    gap: 6,
    marginTop: 12,
  },
  erreurTitre: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 15,
    fontWeight: "600",
  },
  erreurTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
});
