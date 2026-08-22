import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * Quelle version tourne réellement, et un bouton pour aller en chercher une.
 *
 * ## Pourquoi cet écran de trois lignes
 *
 * Une mise à jour publiée et une mise à jour **installée** sont deux choses, et
 * rien dans l'app ne permettait de savoir laquelle on regardait. Une session
 * entière s'est passée à chercher pourquoi des démonstrations corrigées
 * n'apparaissaient pas sur un téléphone : les planches étaient bonnes, la
 * publication avait réussi, et il a fallu comparer des dépôts pour comprendre.
 * Trois lignes à l'écran auraient tranché en trois secondes.
 *
 * Ce qu'elles disent, et pourquoi chacune compte :
 *
 * - **le canal** — une build `developpement` ne reçoit pas ce qu'on publie sur
 *   `preview`, et c'est l'erreur la plus facile à commettre ;
 * - **la version d'exécution** — l'empreinte du natif. Une mise à jour ne
 *   descend que sur les binaires dont elle correspond exactement ; si elle
 *   diffère de celle de la publication, le canal sert bien la mise à jour mais
 *   plus à ce téléphone-ci ;
 * - **l'origine du paquet** — « embarquée » veut dire qu'on exécute le
 *   JavaScript compilé dans le binaire, donc qu'aucune mise à jour n'a jamais
 *   été appliquée.
 *
 * ## Le bouton
 *
 * `expo-updates` télécharge en arrière-plan au lancement et n'applique qu'au
 * **suivant** : il faut donc rouvrir l'app deux fois pour voir arriver une
 * correction, ce que personne ne devine. Le bouton fait les trois temps —
 * chercher, télécharger, redémarrer — en une fois.
 */
export function Version() {
  const [etat, setEtat] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const chercher = async () => {
    setEnCours(true);
    setEtat("Recherche…");
    try {
      const trouvee = await Updates.checkForUpdateAsync();
      if (!trouvee.isAvailable) {
        setEtat("Déjà à jour");
        return;
      }
      setEtat("Téléchargement…");
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (erreur) {
      // En développement le module est inerte et lève : le dire plutôt que de
      // laisser un bouton qui ne répond pas.
      setEtat(
        __DEV__
          ? "Indisponible en développement"
          : `Échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
      );
    } finally {
      setEnCours(false);
    }
  };

  const paquet = Updates.isEmbeddedLaunch
    ? "embarquée"
    : `mise à jour du ${Updates.createdAt?.toLocaleDateString("fr-FR") ?? "?"}`;

  return (
    <View>
      <Text style={{ opacity: 0.6, fontSize: 12, textAlign: "center" }}>
        {`Version ${Constants.expoConfig?.version ?? "?"} · canal ${Updates.channel ?? "aucun"}`}
      </Text>
      <Text style={{ opacity: 0.6, fontSize: 12, textAlign: "center" }}>
        {`Exécution ${Updates.runtimeVersion ?? "?"} · ${paquet}`}
      </Text>
      <Pressable onPress={chercher} disabled={enCours} hitSlop={10} accessibilityRole="button">
        <Text style={{ opacity: 0.8, fontSize: 12, textAlign: "center", marginTop: 8 }}>
          {etat ?? "Chercher une mise à jour"}
        </Text>
      </Pressable>
    </View>
  );
}
