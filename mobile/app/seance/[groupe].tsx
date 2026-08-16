import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErreurReseau } from "../../src/api/client";
import { ajusterDifficulte, chargerSeance, validerSeance } from "../../src/api/routes";
import type {
  CorpsValidation,
  ExercicePrescrit,
  ReponseSeance,
  ReponseValidation,
  Ressenti,
  StatutExercice,
} from "../../src/api/types";
import { useSession } from "../../src/auth/session";
import { memoriserSeance, seanceEnCache } from "../../src/donnees/cache";
import { mettreEnFile } from "../../src/donnees/file-attente";
import { useReferentiel } from "../../src/donnees/referentiel";
import { Bouton } from "../../src/composants/Bouton";
import { Carte, Ornement, TitreSection } from "../../src/composants/Carte";
import { ChronoRepos } from "../../src/composants/Chrono";
import { Chargement, EcranErreur } from "../../src/composants/Etats";
import { FilAriane } from "../../src/composants/FilAriane";
import { POLICE_TEXTE_MOYEN, POLICE_TEXTE_GRAS, POLICE_TEXTE, POLICE_TITRE, type Couleurs } from "../../src/theme/couleurs";
import { useCouleurs, useStyles } from "../../src/theme/theme";

/**
 * Séance guidée — l'écran central de l'app.
 *
 * **Un exercice à la fois.** Une liste à cocher se consulte assis ; ici on
 * s'entraîne, le téléphone posé au sol, et il faut pouvoir lire la consigne et
 * répondre d'un appui.
 *
 * Aucune règle métier ici : la séance vient de `GET /seance`, les Δ et le rang
 * de `POST /seance/valider`. L'app n'envoie que trois choses — le statut de
 * chaque exercice, la charge utilisée, et le ressenti final.
 */

type Phase = "exercices" | "ressenti" | "bilan";

/**
 * Bornes de charge acceptées par `schemaValidationSeance` (`lib/seance.ts`).
 *
 * Recopiées ici pour une seule raison : prévenir **avant** l'envoi. Le serveur
 * reste seul juge — mais son refus arrive à la validation, c'est-à-dire après
 * la séance entière, et rejetterait tout le lot pour une virgule mal placée.
 */
const CHARGE_MIN = 0;
const CHARGE_MAX = 500;

export default function SeanceGuidee() {
  const styles = useStyles(creerStyles);
  const { groupe } = useLocalSearchParams<{ groupe: string }>();
  const router = useRouter();
  const marges = useSafeAreaInsets();
  const { libelleGroupe, referentiel } = useReferentiel();
  const { rafraichirProfil } = useSession();

  const [donnees, setDonnees] = useState<ReponseSeance | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("exercices");
  const [index, setIndex] = useState(0);
  const [statuts, setStatuts] = useState<(StatutExercice | undefined)[]>([]);
  const [charges, setCharges] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [bilan, setBilan] = useState<ReponseValidation | null>(null);
  /** Séance ouverte depuis le cache : le serveur n'a pas répondu. */
  const [horsLigne, setHorsLigne] = useState(false);
  /** Séance terminée que le réseau n'a pas laissé partir : elle attend. */
  const [enAttente, setEnAttente] = useState(false);

  /** Début de séance, pour renseigner `dureeMin` à la validation. */
  const depart = useRef(Date.now());

  useEffect(() => {
    if (!groupe) return;
    let vivant = true;

    const installer = (reponse: ReponseSeance, duCache: boolean) => {
      setDonnees(reponse);
      setHorsLigne(duCache);
      setStatuts(new Array<StatutExercice | undefined>(reponse.seance.exercices.length));
      // Charge pré-remplie avec la dernière utilisée : c'est le poids de
      // travail, on ne devrait pas avoir à le rechercher dans son journal.
      setCharges(
        reponse.seance.exercices.map((e) =>
          e.derniereCharge !== null && e.derniereCharge !== undefined
            ? String(e.derniereCharge)
            : "",
        ),
      );
      depart.current = Date.now();
    };

    chargerSeance(groupe)
      .then((reponse) => {
        // Gardée avant tout affichage : c'est le passage suivant, en salle et
        // sans réseau, qui en a besoin.
        void memoriserSeance(reponse);
        if (vivant) installer(reponse, false);
      })
      .catch(async (cause: unknown) => {
        // Repli sur la séance du jour déjà reçue. Elle est identique à ce que
        // le serveur régénérerait — même graine, même jour — donc les statuts
        // cochés ici resteront valables à la validation.
        const gardee = await seanceEnCache(groupe);
        if (!vivant) return;
        if (gardee) {
          installer(gardee, true);
          return;
        }
        setErreur(cause instanceof Error ? cause.message : "Séance indisponible");
      });

    return () => {
      vivant = false;
    };
  }, [groupe]);

  const exercices = donnees?.seance.exercices ?? [];
  const exercice: ExercicePrescrit | undefined = exercices[index];

  /** Séance libre dès que le groupe n'est pas (ou n'est plus) au programme. */
  const bonus = donnees ? donnees.planDayId === null : false;

  const avancer = useCallback(
    (statut: StatutExercice) => {
      setStatuts((precedent) => {
        const suivant = [...precedent];
        suivant[index] = statut;
        return suivant;
      });

      if (index + 1 < exercices.length) setIndex(index + 1);
      else setPhase("ressenti");
    },
    [index, exercices.length],
  );

  const changerCharge = useCallback((valeur: string) => {
    setCharges((precedent) => {
      const suivant = [...precedent];
      suivant[index] = valeur;
      return suivant;
    });
  }, [index]);

  const envoyer = useCallback(
    (ressenti: Ressenti) => {
      if (!donnees) return;
      setEnvoi(true);
      setErreur(null);

      const dureeMin = Math.min(
        600,
        Math.max(1, Math.round((Date.now() - depart.current) / 60_000)),
      );

      const corps: CorpsValidation = {
        // Absent en bonus : le serveur refuse un `planDayId` d'un autre jour,
        // et n'en attend aucun pour une séance libre.
        planDayId: bonus ? undefined : (donnees.planDayId ?? undefined),
        groupe: donnees.groupe,
        bonus,
        // Un exercice jamais atteint compte comme non fait : c'est le cas
        // quand on quitte l'écran en cours de route.
        statuts: exercices.map((_, i) => statuts[i] ?? "non_fait"),
        charges: exercices.map((e, i) => (e.chargeRequise ? nombreOuNull(charges[i]) : null)),
        ressenti,
        dureeMin,
        // Le jour de la séance affichée, calculé par le serveur en la servant.
        // Il ne sert que si l'envoi est différé — mais il doit être posé
        // maintenant : demain matin, « aujourd'hui » désignera un autre jour.
        faiteLe: donnees.date,
      };

      void validerSeance(corps)
        .then((resultat) => {
          setBilan(resultat);
          setPhase("bilan");
          // Le rang et les Δ viennent de changer : l'onglet « Aujourd'hui »
          // doit repartir du nouveau total, pas de celui d'avant la séance.
          void rafraichirProfil();
        })
        .catch(async (cause: unknown) => {
          // Un refus du serveur se corrige — l'écran le montre et laisse
          // recommencer. Une absence de réseau, non : la séance est faite, et
          // la redemander serait absurde. Elle part en file d'attente.
          if (!(cause instanceof ErreurReseau)) {
            setErreur(cause instanceof Error ? cause.message : "Validation impossible");
            setPhase("ressenti");
            return;
          }

          await mettreEnFile(corps);
          setEnAttente(true);
          setPhase("bilan");
        })
        .finally(() => setEnvoi(false));
    },
    [donnees, bonus, exercices, statuts, charges, rafraichirProfil],
  );

  const quitter = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/aujourdhui");
  }, [router]);

  const apercuLp = useMemo(() => {
    if (!donnees || !referentiel) return null;
    const bareme = referentiel.lp.bareme;

    if (bonus && donnees.bonusDejaCompte) {
      return "Un bonus a déjà été compté aujourd'hui : celle-ci ne rapportera pas de Δ.";
    }

    const base = bonus
      ? `Séance bonus · +${bareme.seanceBonus} Δ`
      : `Séance du jour · jusqu'à +${bareme.seanceComplete} Δ`;

    const regularite =
      donnees.seancesSur7Jours >= referentiel.lp.seancesAvantRegularite
        ? ` · +${bareme.regularite} Δ de régularité`
        : "";

    return `${base}${regularite}`;
  }, [donnees, referentiel, bonus]);

  if (erreur && !donnees) {
    return <EcranErreur message={erreur} libelleAction="Revenir" onReessayer={quitter} />;
  }
  if (!donnees) {
    return <Chargement message="Préparation de la séance…" />;
  }

  if (exercices.length === 0) {
    return (
      <EcranErreur
        titre="Séance vide"
        message={`Aucun exercice disponible pour ${libelleGroupe(
          donnees.groupe,
        )} avec le matériel déclaré dans ton profil.`}
        libelleAction="Revenir"
        onReessayer={quitter}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.entete, { paddingTop: marges.top + 12 }]}>
        <View style={styles.enteteLigne}>
          <Pressable onPress={quitter} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.retour}>‹ Quitter</Text>
          </Pressable>
          <Text style={styles.groupe}>{libelleGroupe(donnees.groupe)}</Text>
        </View>
        <FilAriane
          total={exercices.length}
          courant={phase === "exercices" ? index : exercices.length}
          statuts={statuts}
        />
        {/* Visible d'un bout à l'autre de la séance, et non sur le seul premier
            exercice : c'est en la terminant qu'on a besoin de savoir que le
            téléphone travaille sans réseau. */}
        {horsLigne ? (
          <Text style={styles.horsLigne}>
            Hors ligne · séance en mémoire, l&apos;envoi se fera au retour du réseau
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingBottom: marges.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
      >
        {phase === "exercices" && exercice ? (
          <EtapeExercice
            // Remonte l'étape à chaque exercice, et c'est **nécessaire** : le
            // chrono de repos ne se réinitialisait que lorsque `restSec`
            // changeait de valeur. Deux exercices consécutifs partageant la
            // même durée de repos — le cas courant dans une séance — le
            // laissaient tourner d'un exercice à l'autre, si bien qu'un repos
            // lancé sur le précédent finissait sur le suivant.
            //
            // `EtapeExercice` ne porte aucun état propre : la charge saisie
            // vit dans le parent, rien n'est perdu au remontage.
            key={index}
            exercice={exercice}
            premier={index === 0}
            echauffement={donnees.seance.echauffement}
            avertissement={donnees.avertissement}
            apercuLp={apercuLp}
            dejaValidee={donnees.dejaValidee}
            charge={charges[index] ?? ""}
            onCharge={changerCharge}
            onTerminee={() => avancer("fait")}
            onInachevee={() => avancer("partiel")}
            onPassee={() => avancer("non_fait")}
          />
        ) : null}

        {phase === "ressenti" ? (
          <EtapeRessenti erreur={erreur} envoi={envoi} onChoisir={envoyer} />
        ) : null}

        {phase === "bilan" && bilan ? (
          <EtapeBilan bilan={bilan} onFini={quitter} />
        ) : null}

        {phase === "bilan" && !bilan && enAttente ? (
          <EtapeEnAttente onFini={quitter} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Étape : un exercice
// ---------------------------------------------------------------------------

function EtapeExercice({
  exercice,
  premier,
  echauffement,
  avertissement,
  apercuLp,
  dejaValidee,
  charge,
  onCharge,
  onTerminee,
  onInachevee,
  onPassee,
}: {
  exercice: ExercicePrescrit;
  premier: boolean;
  echauffement: string[];
  avertissement: string | null;
  apercuLp: string | null;
  dejaValidee: boolean;
  charge: string;
  onCharge: (valeur: string) => void;
  onTerminee: () => void;
  onInachevee: () => void;
  onPassee: () => void;
}) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  return (
    <>
      {premier ? (
        <>
          {avertissement ? (
            <Carte style={styles.carteAlerte}>
              <Text style={styles.alerteTexte}>{avertissement}</Text>
            </Carte>
          ) : null}
          {dejaValidee ? (
            <Carte style={styles.carteAlerte}>
              <Text style={styles.alerteTexte}>
                La séance du jour sur ce groupe est déjà validée. Celle-ci comptera en bonus.
              </Text>
            </Carte>
          ) : null}
          {apercuLp ? <Text style={styles.apercu}>{apercuLp}</Text> : null}

          {echauffement.length > 0 ? (
            <Carte style={styles.echauffement}>
              <Text style={styles.echauffementTitre}>Échauffement</Text>
              {echauffement.map((ligne) => (
                <Text key={ligne} style={styles.echauffementLigne}>
                  · {ligne}
                </Text>
              ))}
            </Carte>
          ) : null}
        </>
      ) : null}

      <Text style={styles.nom}>{exercice.nom}</Text>
      <Text style={styles.prescription}>
        {exercice.reps !== undefined
          ? `${exercice.series} séries × ${exercice.reps} répétitions`
          : `${exercice.series} séries · ${exercice.duree ?? "à l'effort"}`}
      </Text>

      {exercice.finisher ? <Text style={styles.finisher}>Finisher</Text> : null}

      <Carte style={styles.consigne}>
        <Text style={styles.consigneTexte}>{exercice.description}</Text>
        {exercice.progression ? (
          <Text style={styles.progression}>Variante plus dure : {exercice.progression}</Text>
        ) : null}
      </Carte>

      {exercice.chargeRequise ? (
        <Carte style={styles.charge}>
          <Text style={styles.chargeTitre}>Charge</Text>
          <View style={styles.chargeLigne}>
            <TextInput
              value={charge}
              onChangeText={onCharge}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={c.texte3}
              style={styles.champ}
              accessibilityLabel={`Charge utilisée sur ${exercice.nom}, en kilos`}
              returnKeyType="done"
            />
            <Text style={styles.unite}>kg</Text>
          </View>
          <Text style={styles.chargeAide}>
            {exercice.derniereCharge !== null && exercice.derniereCharge !== undefined
              ? `La dernière fois : ${exercice.derniereCharge} kg`
              : "Première fois sur cet exercice — note ta charge."}
          </Text>
          {charge !== "" && nombreOuNull(charge) === null ? (
            <Text style={styles.chargeErreur}>
              Charge entre {CHARGE_MIN} et {CHARGE_MAX} kg — sinon elle ne sera pas retenue.
            </Text>
          ) : null}
        </Carte>
      ) : null}

      <ChronoRepos secondes={exercice.restSec} />

      <View style={styles.actions}>
        <Bouton titre="Série terminée" onPress={onTerminee} />
        <Bouton
          titre="Je n'ai pas fini"
          aide="La série compte pour moitié"
          intention="sombre"
          onPress={onInachevee}
        />
        <Bouton titre="Passer cet exercice" intention="discret" onPress={onPassee} />
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Étape : ressenti
// ---------------------------------------------------------------------------

/**
 * Le ressenti pilote l'ajustement de difficulté (`lib/difficulte.ts`).
 *
 * Les trois choix et leurs libellés viennent de `GET /referentiel` : les
 * recopier ici les ferait diverger du serveur, qui est seul à décider de ce
 * qu'un ressenti déclenche.
 */
function EtapeRessenti({
  erreur,
  envoi,
  onChoisir,
}: {
  erreur: string | null;
  envoi: boolean;
  onChoisir: (ressenti: Ressenti) => void;
}) {
  const styles = useStyles(creerStyles);
  const { referentiel, chargement, recharger } = useReferentiel();

  if (!referentiel) {
    return chargement ? (
      <Chargement message="Chargement des ressentis…" />
    ) : (
      <EcranErreur message="Les ressentis n'ont pas pu être chargés." onReessayer={recharger} />
    );
  }

  return (
    <View style={styles.fin}>
      <Ornement />
      <Text style={styles.finTitre}>Séance bouclée</Text>
      <Text style={styles.finTexte}>Comment c&apos;était ?</Text>

      <View style={styles.actions}>
        {referentiel.ressentis.map((r, position) => (
          <Bouton
            key={r.id}
            titre={r.label}
            aide={r.aide}
            intention={position === 0 ? "or" : "sombre"}
            onPress={() => onChoisir(r.id)}
            enCours={envoi}
          />
        ))}
      </View>

      {erreur ? <Text style={styles.erreurTexte}>{erreur}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Étape : bilan différé
// ---------------------------------------------------------------------------

/**
 * Séance faite, mais pas encore envoyée.
 *
 * **Aucun chiffre de Δ ici.** Le barème est serveur — régularité, bonus déjà
 * compté, finisher — et l'annoncer de mémoire reviendrait à promettre un gain
 * que la validation pourrait démentir. On dit ce qui est certain : la séance
 * est enregistrée, elle partira toute seule.
 */
function EtapeEnAttente({ onFini }: { onFini: () => void }) {
  const styles = useStyles(creerStyles);

  return (
    <View style={styles.fin}>
      <Ornement />
      <Text style={styles.finTitre}>Séance enregistrée</Text>
      <Text style={styles.finTexte}>
        Le réseau manquait : elle est gardée sur le téléphone et partira à la prochaine
        ouverture de l&apos;app avec du signal.
      </Text>

      <Carte style={styles.consigne}>
        <Text style={styles.consigneTexte}>
          Sa date part avec elle : les Δ seront comptés sur aujourd&apos;hui, et le calendrier
          marquera le bon jour. Passé demain soir, le serveur ne l&apos;acceptera plus.
        </Text>
      </Carte>

      <Bouton titre="Terminer" intention="sombre" onPress={onFini} style={styles.terminer} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Étape : bilan
// ---------------------------------------------------------------------------

function EtapeBilan({ bilan, onFini }: { bilan: ReponseValidation; onFini: () => void }) {
  const styles = useStyles(creerStyles);
  const [proposition, setProposition] = useState(bilan.proposition);
  const [ajustement, setAjustement] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const accepter = useCallback(() => {
    if (!proposition) return;
    setEnCours(true);

    void ajusterDifficulte(proposition.groupe, proposition.delta)
      .then(() => {
        setAjustement("C'est noté. La prochaine séance en tiendra compte.");
        setProposition(null);
      })
      .catch((cause: unknown) => {
        setAjustement(cause instanceof Error ? cause.message : "Ajustement impossible");
      })
      .finally(() => setEnCours(false));
  }, [proposition]);

  return (
    <View style={styles.fin}>
      <Ornement />
      <Text style={styles.gain}>+{bilan.lpGagnes} Δ</Text>
      <Text style={styles.finTexte}>
        {bilan.promotion ? `Nouveau palier : ${bilan.rang}` : bilan.rang}
      </Text>

      <Carte style={styles.detail}>
        {bilan.details.length === 0 ? (
          <Text style={styles.detailVide}>
            Pas assez d&apos;exercices bouclés pour créditer des Δ cette fois. Aucune perte : le
            compteur ne recule jamais.
          </Text>
        ) : (
          bilan.details.map((ligne) => (
            <View key={ligne.libelle} style={styles.detailLigne}>
              <Text style={styles.detailLibelle}>{ligne.libelle}</Text>
              <Text style={styles.detailLp}>+{ligne.lp}</Text>
            </View>
          ))
        )}
        <View style={styles.detailTotal}>
          <Text style={styles.detailLibelle}>Total du compte</Text>
          <Text style={styles.detailLp}>{bilan.lpTotal} Δ</Text>
        </View>
      </Carte>

      {proposition ? (
        <>
          <TitreSection>Ajustement</TitreSection>
          <Carte style={styles.consigne}>
            <Text style={styles.consigneTexte}>{proposition.message}</Text>
          </Carte>
          <View style={styles.actions}>
            <Bouton titre="Oui, ajuste" onPress={accepter} enCours={enCours} />
            <Bouton
              titre="Non, garde comme ça"
              intention="discret"
              onPress={() => setProposition(null)}
            />
          </View>
        </>
      ) : null}

      {ajustement ? <Text style={styles.apercu}>{ajustement}</Text> : null}

      <Bouton titre="Terminer" intention="sombre" onPress={onFini} style={styles.terminer} />
    </View>
  );
}

/**
 * Charge saisie → nombre, ou `null` si le champ est vide, illisible, ou hors
 * des bornes du serveur. Mieux vaut une charge non notée qu'une séance entière
 * refusée en 400.
 */
function nombreOuNull(valeur: string | undefined): number | null {
  if (!valeur) return null;
  // Le clavier décimal d'iOS produit une virgule en français.
  const nombre = Number(valeur.replace(",", "."));
  if (!Number.isFinite(nombre)) return null;
  return nombre >= CHARGE_MIN && nombre <= CHARGE_MAX ? nombre : null;
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  entete: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 12,
    borderBottomColor: c.fond2,
    borderBottomWidth: 1,
  },
  enteteLigne: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  retour: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 15,
  },
  groupe: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.accent,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  horsLigne: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 11.5,
    lineHeight: 16,
  },
  contenu: {
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 14,
  },
  carteAlerte: {
    borderColor: c.accent,
  },
  alerteTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.accent,
    fontSize: 13,
    lineHeight: 20,
  },
  apercu: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    textAlign: "center",
  },
  echauffement: {
    gap: 4,
  },
  echauffementTitre: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.texte2,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 4,
  },
  echauffementLigne: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 13,
    lineHeight: 20,
  },
  nom: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    lineHeight: 38,
  },
  prescription: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.accent,
    fontSize: 17,
    fontWeight: "600",
    marginTop: -6,
  },
  finisher: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.accent,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  consigne: {
    gap: 8,
  },
  consigneTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 14,
    lineHeight: 22,
  },
  progression: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12,
  },
  charge: {
    gap: 8,
  },
  chargeTitre: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.texte2,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  chargeLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  champ: {
    fontFamily: POLICE_TEXTE,
    flex: 1,
    color: c.texte,
    backgroundColor: c.fond,
    borderColor: c.filet,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 22,
  },
  unite: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 16,
  },
  chargeAide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12,
  },
  chargeErreur: {
    fontFamily: POLICE_TEXTE,
    color: c.negatif,
    fontSize: 12,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  fin: {
    gap: 12,
    alignItems: "stretch",
  },
  finTitre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    textAlign: "center",
  },
  finTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 15,
    textAlign: "center",
  },
  gain: {
    color: c.accent,
    fontFamily: POLICE_TITRE,
    fontSize: 46,
    textAlign: "center",
  },
  detail: {
    gap: 10,
  },
  detailLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopColor: c.fond3,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  detailLibelle: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 14,
  },
  detailLp: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  detailVide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
  erreurTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.negatif,
    fontSize: 13,
    textAlign: "center",
  },
  terminer: {
    marginTop: 10,
  },
});
