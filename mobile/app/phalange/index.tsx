import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  chargerCodeAmi,
  chargerPhalange,
  demanderAmi,
  regenererCodeAmi,
  repondreDemande,
  rompreAmitie,
} from "../../src/api/routes";
import type { Compagnon, Phalange } from "../../src/api/types";
import { ecussonDuRang } from "../../src/donnees/ecussons";
import { Bouton } from "../../src/composants/Bouton";
import { Carte, Ornement, TitreSection } from "../../src/composants/Carte";
import { Chargement, EcranErreur } from "../../src/composants/Etats";
import { EcussonAdmirable } from "../../src/composants/VitrineEcusson";
import { revenir } from "../../src/outils/navigation";
import {
  POLICE_TEXTE,
  POLICE_TEXTE_MOYEN,
  POLICE_TITRE,
  type Couleurs,
} from "../../src/theme/couleurs";
import { useCouleurs, useStyles } from "../../src/theme/theme";

/**
 * La phalange : les comptes qu'on a choisi de suivre.
 *
 * ## Deux classements, et pourquoi il en faut deux
 *
 * Les Δ ne redescendent jamais. Quelqu'un qui rejoint une phalange déjà
 * installée ne rattrapera pas son retard, et un écran qui ne montrerait que le
 * total le désignerait dernier pour toujours. **Cette semaine** est donc l'onglet
 * par défaut : l'assiduité repart de zéro chaque lundi, et c'est la seule mesure
 * sur laquelle un nouveau venu peut gagner dès ses premiers jours.
 *
 * ## Ce que l'écran s'interdit
 *
 * Pas de dernier désigné, pas de rouge, pas de numéro de place. Des écussons
 * alignés et ordonnés, rien de plus. La spec interdit de culpabiliser — « la
 * sanction est l'absence de gain » — et une comparaison mal faite est la façon
 * la plus rapide de trahir cette règle.
 *
 * Le poids n'apparaît nulle part, et le serveur ne l'envoie même pas.
 */

type Vue = "semaine" | "total";

export default function EcranPhalange() {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  const marges = useSafeAreaInsets();
  // Rempli par le lien profond `frameoflegends://phalange/CODE`, qui ne fait
  // que pré-remplir le champ : rejoindre reste un geste volontaire.
  const { code: codeRecu } = useLocalSearchParams<{ code?: string }>();

  const [phalange, setPhalange] = useState<Phalange | null>(null);
  const [monCode, setMonCode] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);
  const [vue, setVue] = useState<Vue>("semaine");

  const [saisie, setSaisie] = useState(codeRecu ?? "");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const [liste, code] = await Promise.all([chargerPhalange(), chargerCodeAmi()]);
      setPhalange(liste);
      setMonCode(code.code);
      // L'erreur n'est levée qu'au succès, et non avant l'appel : poser un état
      // avant le premier `await` le poserait pendant l'effet qui appelle
      // `charger`, ce que React déconseille — et afficher « plus d'erreur »
      // avant de savoir si le rechargement aboutit serait de toute façon
      // prématuré.
      setErreur(null);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Chargement impossible");
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const rafraichir = useCallback(() => {
    setRafraichit(true);
    void charger().finally(() => setRafraichit(false));
  }, [charger]);

  const rejoindre = useCallback(async () => {
    setEnCours(true);
    setMessage(null);
    try {
      await demanderAmi(saisie);
      setSaisie("");
      setMessage("Demande envoyée. Elle apparaîtra chez ton compagnon.");
      await charger();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Demande impossible");
    } finally {
      setEnCours(false);
    }
  }, [saisie, charger]);

  const repondre = useCallback(async (amitieId: string, accepte: boolean) => {
    setEnCours(true);
    try {
      setPhalange(await repondreDemande(amitieId, accepte));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Réponse impossible");
    } finally {
      setEnCours(false);
    }
  }, []);

  const retirer = useCallback((compagnon: Compagnon) => {
    Alert.alert(
      `Retirer ${compagnon.nom ?? "ce compagnon"} ?`,
      "Vous ne verrez plus vos progressions respectives. Vous pourrez vous ajouter de nouveau plus tard.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => {
            setEnCours(true);
            rompreAmitie(compagnon.amitieId)
              .then(setPhalange)
              .catch((cause: unknown) =>
                setMessage(cause instanceof Error ? cause.message : "Retrait impossible"),
              )
              .finally(() => setEnCours(false));
          },
        },
      ],
    );
  }, []);

  const partager = useCallback(() => {
    if (!monCode) return;
    void Share.share({
      message:
        `Rejoins ma phalange sur Frame of Legends : ${monCode}\n` +
        `frameoflegends://phalange/${monCode}`,
    });
  }, [monCode]);

  const renouveler = useCallback(() => {
    Alert.alert(
      "Changer de code ?",
      "L'ancien cessera aussitôt de fonctionner. Tes compagnons actuels restent : le code ne sert qu'à te demander.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Changer",
          onPress: () => {
            void regenererCodeAmi()
              .then((r) => setMonCode(r.code))
              .catch(() => setMessage("Impossible de changer le code."));
          },
        },
      ],
    );
  }, []);

  if (erreur && !phalange) return <EcranErreur message={erreur} onReessayer={() => void charger()} />;
  if (!phalange) return <Chargement message="Chargement de la phalange…" />;

  // Le classement porte sur la vue choisie. À égalité — deux personnes à 100 %
  // d'assiduité, le cas le plus fréquent d'une bonne semaine — les Δ tranchent,
  // faute de quoi l'ordre changerait à chaque rechargement.
  const classes = [...phalange.compagnons].sort((a, b) =>
    vue === "total"
      ? b.lp - a.lp
      : (b.semaine.assiduite ?? -1) - (a.semaine.assiduite ?? -1) ||
        b.semaine.faites - a.semaine.faites ||
        b.lp - a.lp,
  );

  const seul = phalange.compagnons.length <= 1;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: marges.top + 16, paddingBottom: 40 },
      ]}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} />}
    >
      <Text style={styles.titre}>Phalange</Text>
      <Text style={styles.chapeau}>
        L&apos;hoplite ne combat pas seul : il tient le rang. Personne ne voit ton poids ni tes
        charges — seulement ton écusson et ta régularité.
      </Text>

      {phalange.recues.length > 0 ? (
        <>
          <TitreSection>Demandes reçues</TitreSection>
          {phalange.recues.map((demande) => (
            <Carte key={demande.amitieId} style={styles.carte}>
              <Text style={styles.nomDemande}>{demande.nom ?? "Quelqu'un"}</Text>
              <Text style={styles.aide}>
                souhaite rejoindre ta phalange. Vous verrez alors vos rangs et votre régularité.
              </Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => void repondre(demande.amitieId, true)}
                  disabled={enCours}
                  accessibilityRole="button"
                  style={[styles.action, styles.actionOui]}
                >
                  <Text style={styles.actionOuiTexte}>Accepter</Text>
                </Pressable>
                <Pressable
                  onPress={() => void repondre(demande.amitieId, false)}
                  disabled={enCours}
                  accessibilityRole="button"
                  style={styles.action}
                >
                  <Text style={styles.actionTexte}>Refuser</Text>
                </Pressable>
              </View>
            </Carte>
          ))}
        </>
      ) : null}

      <TitreSection>{seul ? "Toi" : "Le rang"}</TitreSection>

      {!seul ? (
        <View style={styles.segments}>
          {(
            [
              { valeur: "semaine", libelle: "Cette semaine" },
              { valeur: "total", libelle: "Depuis toujours" },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.valeur}
              onPress={() => setVue(option.valeur)}
              accessibilityRole="radio"
              accessibilityState={{ selected: vue === option.valeur }}
              style={[styles.segment, vue === option.valeur && styles.segmentActif]}
            >
              <Text
                style={[styles.segmentTexte, vue === option.valeur && styles.segmentTexteActif]}
              >
                {option.libelle}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Carte style={styles.carteRang}>
        {classes.map((compagnon, index) => (
          <Ligne
            key={compagnon.amitieId || "moi"}
            compagnon={compagnon}
            vue={vue}
            dernier={index === classes.length - 1}
            onRetirer={retirer}
          />
        ))}
      </Carte>

      {vue === "semaine" ? (
        <Text style={styles.legende}>
          Part des séances prévues qui ont été faites. Tout le monde repart à zéro le lundi.
        </Text>
      ) : (
        <Text style={styles.legende}>
          Δ cumulés depuis l&apos;inscription. Ils ne redescendent jamais.
        </Text>
      )}

      <Ornement style={styles.ornement} />

      <TitreSection>Ton code</TitreSection>
      <Carte style={styles.carte}>
        <Text style={styles.code}>{monCode ?? "…"}</Text>
        <Text style={styles.aide}>
          Donne-le à qui tu veux : il ne permet que de t&apos;envoyer une demande, que tu restes
          libre de refuser.
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={partager} accessibilityRole="button" style={styles.action}>
            <Text style={styles.actionTexte}>Partager</Text>
          </Pressable>
          <Pressable onPress={renouveler} accessibilityRole="button" style={styles.action}>
            <Text style={styles.actionTexte}>Changer de code</Text>
          </Pressable>
        </View>
      </Carte>

      <TitreSection>Rejoindre quelqu&apos;un</TitreSection>
      <Carte style={styles.carte}>
        <TextInput
          value={saisie}
          onChangeText={setSaisie}
          placeholder="ABCD-2345"
          // Sans couleur explicite, l'exemple s'affiche aussi franchement que
          // le texte saisi et se prend pour un code déjà entré.
          placeholderTextColor={c.texte3}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Code d'un compagnon"
          style={styles.champ}
        />
        <Bouton
          titre="Envoyer la demande"
          onPress={() => void rejoindre()}
          desactive={saisie.trim().length === 0}
          enCours={enCours}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Carte>

      {phalange.envoyees.length > 0 ? (
        <Text style={styles.legende}>
          En attente de réponse :{" "}
          {phalange.envoyees.map((e) => e.nom ?? "quelqu'un").join(", ")}.
        </Text>
      ) : null}

      <Bouton
        titre="Retour"
        intention="discret"
        onPress={() => revenir("/(app)/aujourdhui")}
      />
    </ScrollView>
  );
}

/**
 * Une ligne du rang.
 *
 * L'écusson est « admirable » ici comme ailleurs : un appui maintenu l'ouvre en
 * grand. C'est le seul geste long de l'écran, et il n'entre donc en conflit
 * avec rien.
 */
function Ligne({
  compagnon,
  vue,
  dernier,
  onRetirer,
}: {
  compagnon: Compagnon;
  vue: Vue;
  dernier: boolean;
  onRetirer: (compagnon: Compagnon) => void;
}) {
  const styles = useStyles(creerStyles);
  const source = ecussonDuRang(compagnon.rang.slug);
  const moi = compagnon.amitieId === "";

  const valeur =
    vue === "total"
      ? `${compagnon.lp} Δ`
      : compagnon.semaine.assiduite === null
        ? "—"
        : `${compagnon.semaine.assiduite} %`;

  const appoint =
    vue === "total"
      ? compagnon.rang.libelle
      : compagnon.semaine.prevues === 0
        ? "aucune séance prévue"
        : `${compagnon.semaine.faites} / ${compagnon.semaine.prevues} séances`;

  return (
    <View style={[styles.ligne, dernier && styles.ligneDerniere]}>
      <EcussonAdmirable
        slug={compagnon.rang.slug}
        couleur={compagnon.rang.couleur}
        titre={compagnon.rang.nom}
        sousTitre={compagnon.nom ?? undefined}
      >
        <View style={styles.medaillon}>
          <View style={[styles.halo, { backgroundColor: compagnon.rang.couleur }]} />
          {source ? (
            <Image
              source={source}
              alt={`Écusson ${compagnon.rang.nom}`}
              style={styles.ecusson}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </EcussonAdmirable>

      <View style={styles.identite}>
        <Text style={styles.nom} numberOfLines={1}>
          {moi ? "Toi" : (compagnon.nom ?? "Compagnon")}
        </Text>
        <Text style={styles.appoint}>{appoint}</Text>
      </View>

      <Text style={[styles.valeur, { color: compagnon.rang.couleur }]}>{valeur}</Text>

      {moi ? null : (
        <Pressable
          onPress={() => onRetirer(compagnon)}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${compagnon.nom ?? "ce compagnon"}`}
          hitSlop={10}
          style={styles.retirer}
        >
          <Text style={styles.retirerTexte}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fond },
  contenu: { paddingHorizontal: 18, gap: 8 },
  titre: { color: c.texte, fontFamily: POLICE_TITRE, fontSize: 30 },
  chapeau: {
    color: c.texte2,
    fontFamily: POLICE_TEXTE,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  carte: { padding: 14, gap: 10 },
  carteRang: { paddingHorizontal: 14, paddingVertical: 4 },

  segments: { flexDirection: "row", gap: 8, marginBottom: 4 },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.filet,
    alignItems: "center",
  },
  segmentActif: { backgroundColor: c.fond3, borderColor: c.accent },
  segmentTexte: { fontFamily: POLICE_TEXTE, color: c.texte2, fontSize: 13 },
  segmentTexteActif: { fontFamily: POLICE_TEXTE_MOYEN, color: c.texte },

  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.filet,
  },
  ligneDerniere: { borderBottomWidth: 0 },
  medaillon: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 46, height: 46, borderRadius: 23, opacity: 0.18 },
  ecusson: { width: 42, height: 42 },
  identite: { flex: 1, gap: 1 },
  nom: { fontFamily: POLICE_TEXTE_MOYEN, color: c.texte, fontSize: 15 },
  appoint: { fontFamily: POLICE_TEXTE, color: c.texte3, fontSize: 11.5 },
  valeur: { fontFamily: POLICE_TITRE, fontSize: 18 },
  retirer: { paddingHorizontal: 4 },
  retirerTexte: { fontFamily: POLICE_TEXTE, color: c.texte3, fontSize: 20, lineHeight: 22 },

  nomDemande: { fontFamily: POLICE_TEXTE_MOYEN, color: c.texte, fontSize: 16 },
  aide: { fontFamily: POLICE_TEXTE, color: c.texte2, fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.filet,
    alignItems: "center",
  },
  actionOui: { borderColor: c.accent },
  actionTexte: { fontFamily: POLICE_TEXTE, color: c.texte2, fontSize: 13 },
  actionOuiTexte: { fontFamily: POLICE_TEXTE_MOYEN, color: c.accent, fontSize: 13 },

  code: {
    fontFamily: POLICE_TITRE,
    color: c.texte,
    fontSize: 28,
    letterSpacing: 2,
    textAlign: "center",
  },
  champ: {
    fontFamily: POLICE_TITRE,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: "center",
    color: c.texte,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.filet,
    borderRadius: 8,
    paddingVertical: 12,
  },
  message: { fontFamily: POLICE_TEXTE, color: c.texte2, fontSize: 12.5, lineHeight: 18 },
  legende: { fontFamily: POLICE_TEXTE, color: c.texte3, fontSize: 12, lineHeight: 17 },
  ornement: { marginVertical: 10 },
});
