import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";
import { plancheDe, type Planche } from "../donnees/planches";
import { Silhouette } from "./Silhouette";

/**
 * Démonstration d'un geste : rendu 3D s'il existe, bonhomme bâton sinon.
 *
 * Un seul endroit choisit, et les écrans n'ont pas à savoir lequel des deux
 * s'affiche. Remplacer un bonhomme par un rendu texturé se fait alors en
 * déclarant une planche dans `donnees/planches.ts` — sans toucher à un écran.
 */

/**
 * Cadence maximale, en images par seconde.
 *
 * Le rythme d'affichage se règle sur la planche — une image de planche par
 * battement — et ce plafond ne sert qu'à protéger la batterie sur les gestes
 * les plus rapides. Une cadence **fixe** ne convenait pas : à douze images par
 * seconde, une corde à sauter de 417 ms n'en montrait que cinq sur ses vingt,
 * et pas les mêmes d'un tour à l'autre. Le geste paraissait haché alors que la
 * planche est complète.
 *
 * Vingt-quatre est un **plafond**, pas un objectif : une planche lente bat plus
 * lentement que ça et consomme donc moins qu'avec l'ancienne cadence fixe.
 * C'est la cadence du cinéma, largement suffisante pour lire un geste, et deux
 * fois moins de rendus React par seconde qu'à trente — ce qui compte sur un
 * écran de séance qui reste allumé.
 */
const CADENCE_MAX = 24;

/** Durée d'une répétition entière, quand la planche n'en impose pas. */
const DUREE_DEFAUT = 1400;

export function Demonstration({
  motif,
  taille = 150,
}: {
  motif: string | null | undefined;
  taille?: number;
}) {
  const planche = plancheDe(motif);
  if (planche) return <PlancheAnimee planche={planche} taille={taille} />;
  return <Silhouette motif={motif} taille={taille} />;
}

/**
 * Fait défiler les images d'une planche.
 *
 * L'image entière est chargée une fois, puis **déplacée** derrière une fenêtre
 * qui la rogne : c'est ce qui évite de charger vingt fichiers et de les voir
 * apparaître un à un. La planche est en grille et non en bande, une bande de
 * vingt images dépassant la largeur de texture que certains téléphones
 * acceptent d'un seul tenant.
 */
function PlancheAnimee({ planche, taille }: { planche: Planche; taille: number }) {
  const [index, setIndex] = useState(0);
  const [reduit, setReduit] = useState(false);
  const debut = useRef(0);

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valeur) => vivant && setReduit(valeur))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  const duree = planche.duree ?? DUREE_DEFAUT;

  useEffect(() => {
    if (reduit) return;

    debut.current = Date.now();

    // Combien d'images le plafond laisse passer sur un tour, et de combien il
    // faut donc avancer à chaque battement.
    //
    // Plafonner le **battement** en lisant quand même l'image dans l'horloge ne
    // suffisait pas, et donnait sa propre saccade. Une montée de genoux fait
    // trente-deux images en 751 ms, soit une image toutes les 23 ms ; le
    // plafond bat toutes les 42 ms et n'en prélève donc que dix-huit. Lesquelles
    // dépend de la gigue du minuteur, et change d'un tour à l'autre : le geste
    // avance de une image, puis de deux, puis de une.
    //
    // On choisit donc un pas **entier** — une image sur deux, sur quatre — et
    // l'on montre toujours les mêmes, régulièrement espacées. Le tour garde sa
    // durée vraie, la cadence reste sous le plafond, et le geste ne bronche
    // plus.
    const tenables = Math.max(1, Math.floor(duree / (1000 / CADENCE_MAX)));
    const pas = Math.max(1, Math.ceil(planche.images / tenables));
    const montrees = Math.ceil(planche.images / pas);

    const battement = setInterval(() => {
      // Depuis un instant absolu, jamais en incrémentant : un intervalle dérive,
      // et la répétition finirait plus lente que la durée annoncée.
      const ecoule = (Date.now() - debut.current) % duree;
      const rang = Math.floor((ecoule / duree) * montrees) % montrees;
      setIndex((rang * pas) % planche.images);
    }, duree / montrees);

    return () => clearInterval(battement);
  }, [planche.images, duree, reduit]);

  const lignes = Math.ceil(planche.images / planche.colonnes);
  const colonne = index % planche.colonnes;
  const ligne = Math.floor(index / planche.colonnes);

  return (
    <View style={[styles.fenetre, { width: taille, height: taille }]}>
      <Image
        source={planche.source}
        alt=""
        style={{
          width: taille * planche.colonnes,
          height: taille * lignes,
          transform: [{ translateX: -colonne * taille }, { translateY: -ligne * taille }],
        }}
        resizeMode="stretch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // La fenêtre rogne la planche : sans elle on verrait les vingt images.
  //
  // `alignSelf` la **centre**, et ce n'est pas un détail : une vue de largeur
  // fixe dans une colonne se colle au bord de départ, si bien que la
  // démonstration s'affichait contre la marge gauche avec un vide à sa droite.
  // Personne ne l'avait vu tant qu'aucun écran ne l'affichait pour de bon.
  fenetre: { overflow: "hidden", alignSelf: "center" },
});
