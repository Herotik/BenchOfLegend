import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErreurApi } from "../../src/api/client";
import { chargerPlan, chargerStats, enregistrerPesee } from "../../src/api/routes";
import type { JourPlan, Stats } from "../../src/api/types";
import { useSession } from "../../src/auth/session";
import { useFileEnAttente } from "../../src/donnees/envoi-differe";
import { envoyerLaFile } from "../../src/donnees/file-attente";
import { useReferentiel } from "../../src/donnees/referentiel";
import { BarreProgression } from "../../src/composants/BarreProgression";
import { Bouton } from "../../src/composants/Bouton";
import { Carte, Ornement, TitreSection } from "../../src/composants/Carte";
import { Ecusson, LibelleRang } from "../../src/composants/Ecusson";
import { EcussonAdmirable } from "../../src/composants/VitrineEcusson";
import { Chargement, EcranErreur } from "../../src/composants/Etats";
import { jourCivilISO, jourEnFrancais, lundiCivilISO } from "../../src/outils/dates";
import { POLICE_TEXTE_MOYEN, POLICE_TEXTE_GRAS, POLICE_TEXTE, POLICE_TITRE, type Couleurs } from "../../src/theme/couleurs";
import { useCouleurs, useStyles } from "../../src/theme/theme";

/**
 * Écran « Aujourd'hui ».
 *
 * Tout ce qui s'y affiche vient du serveur : le rang et la progression de
 * `GET /me`, les séances du jour de `GET /plan`, les agrégats de `GET /stats`.
 * L'app ne calcule ni Δ, ni rang, ni assiduité.
 */
export default function Aujourdhui() {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const { moi, erreurProfil, rafraichirProfil } = useSession();
  const { libelleGroupe } = useReferentiel();
  const router = useRouter();
  const marges = useSafeAreaInsets();

  const [plan, setPlan] = useState<JourPlan[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onboardingRequis, setOnboardingRequis] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);
  const dejaCharge = useRef(false);
  const enAttente = useFileEnAttente();

  const jour = jourCivilISO();

  const charger = useCallback(async () => {
    // `allSettled` et non `all` : les deux routes exigent un profil complet et
    // échouent donc ensemble. Avec `all`, le second rejet n'aurait pas de
    // gestionnaire et remonterait en rejet non traité.
    const [resultatPlan, resultatStats] = await Promise.allSettled([
      chargerPlan(jour, jour),
      chargerStats(),
    ]);

    dejaCharge.current = true;

    if (resultatPlan.status === "fulfilled") setPlan(resultatPlan.value.jours);
    if (resultatStats.status === "fulfilled") setStats(resultatStats.value);

    const echec = [resultatPlan, resultatStats].find(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    if (!echec) {
      setErreur(null);
      setOnboardingRequis(false);
      return;
    }

    // Le serveur répond 409 tant que le profil n'est pas rempli : ce n'est pas
    // une panne, c'est une étape qui manque.
    const cause: unknown = echec.reason;
    if (cause instanceof ErreurApi && cause.code === "onboarding_requis") {
      setOnboardingRequis(true);
      setErreur(null);
      return;
    }

    setErreur(cause instanceof Error ? cause.message : "Chargement impossible");
  }, [jour]);

  // Rechargement à chaque retour sur l'onglet : une séance validée change le
  // rang, les Δ et le statut du jour de plan. Sans cela, l'écran mentirait
  // jusqu'au prochain démarrage.
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void (async () => {
        await Promise.all([charger(), rafraichirProfil()]);
        if (!vivant) return;
      })();
      return () => {
        vivant = false;
      };
    }, [charger, rafraichirProfil]),
  );

  const relancer = useCallback(() => {
    setRafraichit(true);
    void Promise.all([charger(), rafraichirProfil()]).finally(() => setRafraichit(false));
  }, [charger, rafraichirProfil]);

  const seances = useMemo(
    () => (plan ?? []).filter((j) => j.groupe !== "repos"),
    [plan],
  );

  const semaine = useMemo(() => {
    const lundi = lundiCivilISO();
    return stats?.semaines.find((s) => s.semaine === lundi) ?? null;
  }, [stats]);

  const dernierePesee = stats?.poids.at(-1) ?? null;
  const peseeDuJourFaite = dernierePesee?.date === jour;

  if (!dejaCharge.current && !moi) {
    return <Chargement message="Chargement de ton profil…" />;
  }

  if (erreur && !plan) {
    return <EcranErreur message={erreurProfil ?? erreur} onReessayer={relancer} />;
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: marges.top + 16, paddingBottom: 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={rafraichit}
          onRefresh={relancer}
          tintColor={c.accent}
          colors={[c.accent]}
        />
      }
    >
      <Text style={styles.date}>{jourEnFrancais(jour).toUpperCase()}</Text>
      {moi?.utilisateur.nom ? (
        <Text style={styles.salutation}>{moi.utilisateur.nom}</Text>
      ) : null}

      {onboardingRequis ? <CarteOnboarding /> : null}

      {enAttente > 0 ? <CarteEnAttente nombre={enAttente} onEnvoyee={relancer} /> : null}

      {moi ? (
        <Carte style={styles.carteRang}>
          <EcussonAdmirable
            slug={moi.rang.slug}
            couleur={moi.rang.couleur}
            titre={moi.rang.libelle}
            sousTitre={moi.rang.sousTitre}
          >
            <Ecusson rang={moi.rang} taille={172} />
          </EcussonAdmirable>
          <LibelleRang rang={moi.rang} />
          {/* Un seul compteur au-dessus de la barre. Le répéter en légende et
              en rappeler le reste à parcourir disait trois fois la même
              chose — et le reste se lit déjà dans la barre. */}
          <Text style={styles.lp}>
            {moi.rang.division === null
              ? `${moi.lp} Δ`
              : `${moi.rang.lpDansDivision} / ${moi.rang.lpProchaineDivision} Δ`}
          </Text>
          <BarreProgression part={moi.rang.progression} couleur={moi.rang.couleur} />

          {/* Sous l'écusson, et discret : la phalange se consulte, elle ne
              s'impose pas. Un aperçu ici obligerait à charger la liste des
              compagnons sur l'écran le plus souvent ouvert de l'app, pour une
              information qu'on ne vient pas y chercher. */}
          <Pressable
            onPress={() => router.push("/phalange")}
            accessibilityRole="link"
            style={styles.lienPhalange}
          >
            <Text style={styles.lienPhalangeTexte}>Ma phalange →</Text>
          </Pressable>
        </Carte>
      ) : null}

      {erreurProfil ? <Text style={styles.avertissement}>{erreurProfil}</Text> : null}

      {stats ? (
        <>
          <TitreSection>En un coup d&apos;œil</TitreSection>
          <View style={styles.tuiles}>
            <Tuile
              valeur={semaine ? `${semaine.faites}/${semaine.prevues}` : "0/0"}
              legende="séances cette semaine"
            />
            <Tuile
              valeur={semaine?.assiduite !== null && semaine ? `${semaine.assiduite}%` : "—"}
              legende="assiduité"
            />
            <Tuile
              valeur={semaine ? String(Math.round(semaine.volumeTotal)) : "0"}
              legende="séries cette semaine"
            />
            <Tuile
              valeur={dernierePesee ? `${dernierePesee.kg} kg` : "—"}
              legende={
                dernierePesee?.tendance !== null && dernierePesee
                  ? `tendance ${dernierePesee.tendance} kg`
                  : "dernière pesée"
              }
            />
          </View>
        </>
      ) : null}

      {!onboardingRequis && stats && !peseeDuJourFaite ? (
        <CartePesee onEnregistree={relancer} />
      ) : null}

      {!onboardingRequis ? (
        <>
          <TitreSection>La séance du jour</TitreSection>
          {seances.length === 0 ? (
            <Carte>
              <Text style={styles.reposTitre}>Jour de repos</Text>
              <Text style={styles.reposTexte}>
                La récupération fait partie de la progression. Tu peux quand même lancer une séance
                bonus si l&apos;envie est là.
              </Text>
            </Carte>
          ) : (
            seances.map((jourPlan) => (
              <Pressable
                key={jourPlan.id}
                onPress={() => router.push(`/seance/${jourPlan.groupe}`)}
                style={({ pressed }) => [styles.seance, pressed && styles.seanceAppuyee]}
              >
                <View style={styles.seanceTexte}>
                  <Text style={styles.seanceGroupe}>{libelleGroupe(jourPlan.groupe)}</Text>
                  <Text style={styles.seanceStatut}>{legendeStatut(jourPlan.statut)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}

          <SeancesBonus
            dejaPrevus={seances.map((s) => s.groupe)}
            groupes={moi?.preferences?.groupesMusculaires.map((g) => g.groupe) ?? []}
          />
        </>
      ) : null}

      <Ornement style={styles.pied} />
    </ScrollView>
  );
}

function Tuile({ valeur, legende }: { valeur: string; legende: string }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.tuile}>
      <Text style={styles.tuileValeur}>{valeur}</Text>
      <Text style={styles.tuileLegende}>{legende}</Text>
    </View>
  );
}

/**
 * Séances faites hors ligne, en attente d'envoi.
 *
 * L'app les renvoie déjà toute seule à chaque ouverture. La carte n'est donc
 * pas là pour réclamer un geste, mais pour que la séance d'hier soir ne
 * paraisse pas oubliée tant que le compteur de Δ ne l'a pas prise en compte —
 * et pour offrir une relance immédiate quand on sait, soi, que le réseau est
 * revenu.
 */
function CarteEnAttente({ nombre, onEnvoyee }: { nombre: number; onEnvoyee: () => void }) {
  const styles = useStyles(creerStyles);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const envoyer = useCallback(() => {
    setEnCours(true);
    setMessage(null);

    void envoyerLaFile()
      .then((bilan) => {
        const perdue = bilan.abandonnees.find((a) => !a.dejaConnue);
        if (perdue) {
          // Le seul cas où l'on annonce une perte. Elle est dite en clair, avec
          // son jour : une séance qui disparaît sans un mot serait pire que
          // tout, et c'est bien celle du calendrier qu'on perd.
          setMessage(`Séance du ${jourEnFrancais(perdue.jour)} : ${perdue.raison}`);
        } else if (bilan.restantes > 0) {
          setMessage("Toujours pas de réseau. La séance reste gardée.");
        }
        if (bilan.envoyees.length > 0 || bilan.abandonnees.length > 0) onEnvoyee();
      })
      .finally(() => setEnCours(false));
  }, [onEnvoyee]);

  return (
    <Carte style={styles.carteAlerte}>
      <Text style={styles.alerteTitre}>
        {nombre > 1 ? `${nombre} séances à envoyer` : "Séance à envoyer"}
      </Text>
      <Text style={styles.alerteTexte}>
        {nombre > 1 ? "Elles ont été faites" : "Elle a été faite"} sans réseau et
        {nombre > 1 ? " attendent" : " attend"} sur le téléphone. Les Δ seront comptés à
        l&apos;envoi.
      </Text>
      <Bouton titre="Envoyer maintenant" onPress={envoyer} enCours={enCours} />
      {message ? <Text style={styles.alerteTexte}>{message}</Text> : null}
    </Carte>
  );
}

/** Le profil se remplit sur le web : l'app n'embarque pas l'onboarding. */
function CarteOnboarding() {
  const styles = useStyles(creerStyles);
  return (
    <Carte style={styles.carteAlerte}>
      <Text style={styles.alerteTitre}>Profil à compléter</Text>
      <Text style={styles.alerteTexte}>
        Ton compte existe, mais le questionnaire d&apos;entrée — niveau, matériel, groupes,
        objectif — n&apos;a pas encore été rempli. Ouvre Frame of Legends dans un navigateur pour le
        terminer, puis reviens ici : plan, séances et statistiques s&apos;afficheront.
      </Text>
    </Carte>
  );
}

/**
 * Pesée du jour.
 *
 * Elle rapporte des Δ la première fois seulement (`BAREME.pesee`), et la route
 * est idempotente dans la journée : corriger sa valeur ne recrédite rien.
 */
function CartePesee({ onEnregistree }: { onEnregistree: () => void }) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const envoyer = useCallback(() => {
    // Le clavier décimal d'iOS produit une virgule en français.
    const kg = Number(saisie.replace(",", "."));
    if (!Number.isFinite(kg) || kg <= 0) {
      setMessage("Saisis un poids en kilos, par exemple 78,4.");
      return;
    }

    setEnCours(true);
    setMessage(null);

    void enregistrerPesee(kg)
      .then((resultat) => {
        setMessage(
          resultat.lpGagnes > 0
            ? `Pesée enregistrée · +${resultat.lpGagnes} Δ${
                resultat.promotion ? ` · ${resultat.rang} !` : ""
              }`
            : "Pesée mise à jour.",
        );
        onEnregistree();
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : "Enregistrement impossible");
      })
      .finally(() => setEnCours(false));
  }, [saisie, onEnregistree]);

  return (
    <Carte style={styles.cartePesee}>
      <Text style={styles.peseeTitre}>Tu ne t&apos;es pas pesé aujourd&apos;hui</Text>
      <Text style={styles.peseeTexte}>Une pesée par jour suffit, et elle rapporte des Δ.</Text>
      <View style={styles.peseeLigne}>
        <TextInput
          value={saisie}
          onChangeText={setSaisie}
          keyboardType="decimal-pad"
          placeholder="78,4"
          placeholderTextColor={c.texte3}
          style={styles.champ}
          accessibilityLabel="Poids du jour en kilos"
          returnKeyType="done"
          onSubmitEditing={envoyer}
        />
        <Text style={styles.unite}>kg</Text>
        <Bouton titre="Valider" onPress={envoyer} enCours={enCours} style={styles.peseeBouton} />
      </View>
      {message ? <Text style={styles.peseeMessage}>{message}</Text> : null}
    </Carte>
  );
}

/**
 * Séances libres.
 *
 * N'importe quel groupe est acceptable côté serveur, y compris hors
 * préférences ; on ne propose ici que ceux du profil, et seulement s'ils ne
 * sont pas déjà au programme du jour.
 */
function SeancesBonus({
  groupes,
  dejaPrevus,
}: {
  groupes: string[];
  dejaPrevus: string[];
}) {
  const styles = useStyles(creerStyles);
  const { libelleGroupe } = useReferentiel();
  const router = useRouter();

  const libres = groupes.filter((g) => !dejaPrevus.includes(g));
  if (libres.length === 0) return null;

  return (
    <View style={styles.bonus}>
      <Text style={styles.bonusTitre}>Séance bonus</Text>
      <View style={styles.pastilles}>
        {libres.map((groupe) => (
          <Pressable
            key={groupe}
            onPress={() => router.push(`/seance/${groupe}`)}
            style={({ pressed }) => [styles.pastille, pressed && styles.seanceAppuyee]}
          >
            <Text style={styles.pastilleTexte}>{libelleGroupe(groupe)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function legendeStatut(statut: JourPlan["statut"]): string {
  switch (statut) {
    case "FAIT":
      return "Validée · bien joué";
    case "MANQUE":
      // Ni reproche ni rouge : la sanction est l'absence de gain, pas le ton.
      return "Non validée · rattrape-la en bonus";
    case "REPOS":
      return "Repos";
    default:
      return "À faire";
  }
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  contenu: {
    paddingHorizontal: 18,
    gap: 12,
  },
  date: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: "700",
  },
  salutation: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 28,
    marginBottom: 4,
  },
  carteRang: {
    alignItems: "center",
    gap: 12,
  },
  lienPhalange: {
    paddingTop: 2,
    paddingHorizontal: 8,
  },
  lienPhalangeTexte: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte2,
    fontSize: 13,
  },
  lp: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.accent,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
  avertissement: {
    fontFamily: POLICE_TEXTE,
    color: c.negatif,
    fontSize: 13,
  },
  tuiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tuile: {
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: c.fond2,
    borderColor: c.fond3,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 2,
  },
  tuileValeur: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.texte,
    fontSize: 22,
    fontWeight: "700",
  },
  tuileLegende: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12,
  },
  carteAlerte: {
    borderColor: c.accent,
    gap: 8,
  },
  alerteTitre: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  alerteTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
  cartePesee: {
    gap: 10,
  },
  peseeTitre: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 16,
    fontWeight: "600",
  },
  peseeTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
  },
  peseeLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  champ: {
    fontFamily: POLICE_TEXTE,
    flex: 1,
    // Un champ de saisie se donne une largeur naturelle d'une vingtaine de
    // caractères. Sans plancher à zéro, il refuse de descendre en dessous et
    // pousse le bouton hors de la carte.
    minWidth: 0,
    color: c.texte,
    backgroundColor: c.fond,
    borderColor: c.filet,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
  },
  unite: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 15,
  },
  peseeBouton: {
    paddingHorizontal: 22,
    flexShrink: 0,
  },
  peseeMessage: {
    fontFamily: POLICE_TEXTE,
    color: c.accent,
    fontSize: 13,
  },
  seance: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.fond2,
    borderColor: c.fond3,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  seanceAppuyee: {
    opacity: 0.7,
  },
  seanceTexte: {
    flex: 1,
    gap: 2,
  },
  seanceGroupe: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 18,
    fontWeight: "600",
  },
  seanceStatut: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
  },
  chevron: {
    fontFamily: POLICE_TEXTE,
    color: c.accent,
    fontSize: 28,
    lineHeight: 30,
  },
  reposTitre: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 6,
  },
  reposTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
  bonus: {
    marginTop: 6,
    gap: 8,
  },
  bonusTitre: {
    fontFamily: POLICE_TEXTE_GRAS,
    color: c.texte2,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  pastilles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pastille: {
    borderColor: c.filet,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: c.fond,
  },
  pastilleTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 13,
  },
  pied: {
    marginTop: 18,
  },
});
