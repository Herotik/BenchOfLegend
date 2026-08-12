import { useCallback, useState } from "react";
import { Redirect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_API } from "../src/api/client";
import { useSession } from "../src/auth/session";
import { ConnexionAnnulee } from "../src/auth/relais";
import { Bouton } from "../src/composants/Bouton";
import { Carte, Ornement } from "../src/composants/Carte";
import { POLICE_TEXTE_MOYEN, POLICE_TEXTE, POLICE_TITRE, type Couleurs } from "../src/theme/couleurs";
import { useStyles } from "../src/theme/theme";

/**
 * Écran de connexion.
 *
 * Un seul chemin : le relais navigateur. La connexion Google native suppose que
 * l'app enregistre le schéma d'URL de son client OAuth iOS, ce qu'Expo Go ne
 * permet pas — voir `lib/api/relais.ts` côté serveur.
 */
export default function Connexion() {
  const styles = useStyles(creerStyles);
  const { etat, seConnecter } = useSession();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const marges = useSafeAreaInsets();

  const lancer = useCallback(() => {
    setErreur(null);
    setEnCours(true);

    void (async () => {
      try {
        await seConnecter();
      } catch (cause) {
        // Fermer le navigateur est un geste délibéré, pas un incident : on ne
        // le signale pas comme une erreur.
        if (!(cause instanceof ConnexionAnnulee)) {
          setErreur(cause instanceof Error ? cause.message : "Connexion impossible");
        }
      } finally {
        setEnCours(false);
      }
    })();
  }, [seConnecter]);

  if (etat === "connecte") return <Redirect href="/aujourdhui" />;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: marges.top + 48, paddingBottom: marges.bottom + 32 },
      ]}
    >
      <View style={styles.emblemeCadre}>
        <Equerres />
        <Text style={styles.emblemeLettre}>Δ</Text>
      </View>

      <Text style={styles.titre}>FRAME OF LEGENDS</Text>
      <Ornement style={styles.ornement} />
      <Text style={styles.accroche}>
        Chaque répétition te rapproche de l&apos;Olympe. Gagne des Δ, monte les rangs, tiens la
        ligne.
      </Text>

      <Bouton
        titre="Se connecter avec Google"
        aide="Le navigateur s'ouvre, puis te ramène ici"
        onPress={lancer}
        enCours={enCours}
        style={styles.bouton}
      />

      {erreur ? (
        <Carte style={styles.erreur}>
          <Text style={styles.erreurTitre}>La connexion a échoué</Text>
          <Text style={styles.erreurTexte}>{erreur}</Text>
          <Text style={styles.erreurAdresse}>Serveur visé : {BASE_API}</Text>
        </Carte>
      ) : null}

      <Text style={styles.mention}>
        La connexion passe par le site : le navigateur s&apos;ouvre le temps de l&apos;identification
        Google, puis rend la main à l&apos;app.
      </Text>
    </ScrollView>
  );
}

/**
 * Les quatre équerres de l'identité.
 *
 * Elles ne se rejoignent jamais et sont toujours quatre : c'est ce qui les
 * distingue d'un cadre, lequel enfermerait la marque au lieu de la désigner.
 * Aucun halo, aucune ombre — l'identité ne connaît que des traits.
 */
function Equerres() {
  const styles = useStyles(creerStyles);
  return (
    <>
      <View style={[styles.equerre, styles.equerreHG]} />
      <View style={[styles.equerre, styles.equerreHD]} />
      <View style={[styles.equerre, styles.equerreBG]} />
      <View style={[styles.equerre, styles.equerreBD]} />
    </>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  contenu: {
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 16,
  },
  emblemeCadre: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },
  equerre: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: c.accent,
  },
  equerreHG: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  equerreHD: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  equerreBG: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  equerreBD: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  emblemeLettre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 62,
    lineHeight: 74,
  },
  titre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 25,
    letterSpacing: 3.5,
    textAlign: "center",
  },
  ornement: {
    marginTop: -4,
  },
  accroche: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginBottom: 12,
  },
  bouton: {
    alignSelf: "stretch",
  },
  erreur: {
    alignSelf: "stretch",
    borderColor: c.negatif,
    gap: 6,
  },
  erreurTitre: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontWeight: "600",
    fontSize: 15,
  },
  erreurTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
  erreurAdresse: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12,
  },
  mention: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },
});
