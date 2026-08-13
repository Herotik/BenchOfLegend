import { useCallback, useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_API } from "../src/api/client";
import { useSession } from "../src/auth/session";
import {
  appleDisponible,
  ConnexionAbandonnee,
  discordDisponible,
  googleDisponible,
} from "../src/auth/natif";
import { ConnexionAnnulee } from "../src/auth/relais";
import { Bouton } from "../src/composants/Bouton";
import { Carte, Ornement } from "../src/composants/Carte";
import { Logotype } from "../src/composants/Logo";
import { POLICE_TEXTE_MOYEN, POLICE_TEXTE, type Couleurs } from "../src/theme/couleurs";
import { useStyles } from "../src/theme/theme";

/**
 * Écran de connexion.
 *
 * Les connexions natives d'abord — la feuille de comptes de Google, celle
 * d'Apple, la feuille système de Discord — puis le relais navigateur en repli,
 * qui passe par le site.
 *
 * Le repli n'est pas une politesse : les modules natifs n'existent ni dans
 * l'aperçu web, où se fait le travail quotidien, ni dans Expo Go. Chaque
 * bouton natif ne s'affiche que si son identifiant a été fourni à la
 * compilation — sinon il ouvrirait une feuille vouée à l'échec.
 */
export default function Connexion() {
  const styles = useStyles(creerStyles);
  const { etat, seConnecter, seConnecterNatif } = useSession();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [appleDispo, setAppleDispo] = useState(false);
  const marges = useSafeAreaInsets();

  // Apple est le seul dont la disponibilité se demande au système : elle
  // dépend de la version d'iOS, pas d'une variable de compilation.
  useEffect(() => {
    let vivant = true;
    void appleDisponible().then((dispo) => {
      if (vivant) setAppleDispo(dispo);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const lancer = useCallback(
    (quoi: string, connecter: () => Promise<void>) => {
      setErreur(null);
      setEnCours(quoi);

      void (async () => {
        try {
          await connecter();
        } catch (cause) {
          // Fermer la feuille ou le navigateur est un geste délibéré, pas un
          // incident : on ne le signale pas comme une erreur.
          if (!(cause instanceof ConnexionAnnulee) && !(cause instanceof ConnexionAbandonnee)) {
            setErreur(cause instanceof Error ? cause.message : "Connexion impossible");
          }
        } finally {
          setEnCours(null);
        }
      })();
    },
    [],
  );

  if (etat === "connecte") return <Redirect href="/aujourdhui" />;

  const natifDisponible = appleDispo || googleDisponible() || discordDisponible();

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

      {appleDispo ? (
        <Bouton
          titre="Continuer avec Apple"
          onPress={() => lancer("apple", () => seConnecterNatif("apple"))}
          enCours={enCours === "apple"}
          style={styles.bouton}
        />
      ) : null}

      {googleDisponible() ? (
        <Bouton
          titre="Continuer avec Google"
          intention={appleDispo ? "sombre" : "or"}
          onPress={() => lancer("google", () => seConnecterNatif("google"))}
          enCours={enCours === "google"}
          style={styles.bouton}
        />
      ) : null}

      {discordDisponible() ? (
        <Bouton
          titre="Continuer avec Discord"
          intention="sombre"
          onPress={() => lancer("discord", () => seConnecterNatif("discord"))}
          enCours={enCours === "discord"}
          style={styles.bouton}
        />
      ) : null}

      <Bouton
        titre={natifDisponible ? "Autre méthode" : "Se connecter"}
        aide="Le navigateur s'ouvre, puis te ramène ici"
        intention={natifDisponible ? "discret" : "or"}
        onPress={() => lancer("relais", seConnecter)}
        enCours={enCours === "relais"}
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
        {natifDisponible
          ? "Même adresse, même compte : peu importe la porte d'entrée, tu retrouves tes séances et ton rang."
          : "La connexion passe par le site : le navigateur s'ouvre, te laisse choisir entre Google, Apple et Discord, puis rend la main à l'app."}
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
