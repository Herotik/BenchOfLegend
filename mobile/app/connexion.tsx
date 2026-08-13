import { useCallback, useState } from "react";
import { Redirect } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_API } from "../src/api/client";
import { useSession } from "../src/auth/session";
import { ConnexionAnnulee } from "../src/auth/relais";
import { Bouton } from "../src/composants/Bouton";
import { Carte, Ornement } from "../src/composants/Carte";
import { Logotype } from "../src/composants/Logo";
import { POLICE_TEXTE_MOYEN, POLICE_TEXTE, type Couleurs } from "../src/theme/couleurs";
import { useStyles } from "../src/theme/theme";

/**
 * Écran de connexion.
 *
 * Un seul chemin : le relais navigateur. La connexion Google native suppose que
 * l'app enregistre le schéma d'URL de son client OAuth iOS, ce qu'Expo Go ne
 * permet pas — voir `lib/api/relais.ts` côté serveur.
 *
 * Le choix du fournisseur — Google, Apple, Discord — se fait donc dans le
 * navigateur, sur la page d'accueil du site. L'app n'en connaît aucun : ajouter
 * une porte d'entrée côté serveur n'oblige pas à reconstruire l'app.
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
      <Logotype taille={124} style={styles.logotype} />
      <Ornement style={styles.ornement} />
      <Text style={styles.accroche}>
        Chaque répétition te rapproche de l&apos;Olympe. Gagne des Δ, monte les rangs, tiens la
        ligne.
      </Text>

      <Bouton
        titre="Se connecter"
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
        La connexion passe par le site : le navigateur s&apos;ouvre, te laisse choisir entre
        Google, Apple et Discord, puis rend la main à l&apos;app.
      </Text>
    </ScrollView>
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
  logotype: {
    marginBottom: 4,
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
