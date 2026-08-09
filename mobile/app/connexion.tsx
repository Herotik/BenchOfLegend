import { useCallback, useState } from "react";
import { Redirect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_API } from "../src/api/client";
import { useSession } from "../src/auth/session";
import { ConnexionAnnulee } from "../src/auth/relais";
import { Bouton } from "../src/composants/Bouton";
import { Carte, Ornement } from "../src/composants/Carte";
import { COULEURS, POLICE_TITRE } from "../src/theme/couleurs";

/**
 * Écran de connexion.
 *
 * Un seul chemin : le relais navigateur. La connexion Google native suppose que
 * l'app enregistre le schéma d'URL de son client OAuth iOS, ce qu'Expo Go ne
 * permet pas — voir `lib/api/relais.ts` côté serveur.
 */
export default function Connexion() {
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
        <View style={styles.emblemeHalo} />
        <View style={styles.embleme}>
          <Text style={styles.emblemeLettre}>Λ</Text>
        </View>
      </View>

      <Text style={styles.titre}>LA FAILLE</Text>
      <Ornement style={styles.ornement} />
      <Text style={styles.accroche}>
        Chaque répétition te rapproche de l&apos;Olympe. Gagne des LP, monte les rangs, tiens la
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COULEURS.nuit950,
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
  emblemeHalo: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: COULEURS.or500,
    opacity: 0.12,
  },
  embleme: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: COULEURS.or500,
    backgroundColor: COULEURS.nuit900,
    alignItems: "center",
    justifyContent: "center",
  },
  emblemeLettre: {
    color: COULEURS.or400,
    fontFamily: POLICE_TITRE,
    fontSize: 52,
    lineHeight: 60,
  },
  titre: {
    color: COULEURS.ivoire,
    fontFamily: POLICE_TITRE,
    fontSize: 38,
    letterSpacing: 6,
  },
  ornement: {
    marginTop: -4,
  },
  accroche: {
    color: COULEURS.brume,
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
    borderColor: COULEURS.manque,
    gap: 6,
  },
  erreurTitre: {
    color: COULEURS.ivoire,
    fontWeight: "600",
    fontSize: 15,
  },
  erreurTexte: {
    color: COULEURS.brume,
    fontSize: 13,
    lineHeight: 20,
  },
  erreurAdresse: {
    color: COULEURS.cendre,
    fontSize: 12,
  },
  mention: {
    color: COULEURS.cendre,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },
});
