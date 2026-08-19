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

/** Images par seconde. Douze suffisent à lire un geste et ménagent la batterie. */
const CADENCE = 12;

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
    const battement = setInterval(() => {
      // Depuis un instant absolu, jamais en incrémentant : un intervalle dérive,
      // et la répétition finirait plus lente que la durée annoncée.
      const ecoule = (Date.now() - debut.current) % duree;
      setIndex(Math.floor((ecoule / duree) * planche.images) % planche.images);
    }, 1000 / CADENCE);

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
  fenetre: { overflow: "hidden" },
});
