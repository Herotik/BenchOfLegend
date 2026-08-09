import { Image, StyleSheet, Text, View } from "react-native";
import { COULEURS, POLICE_TITRE } from "../theme/couleurs";
import { ecussonDuRang } from "../donnees/ecussons";
import type { RangCourant } from "../api/types";

/**
 * Écusson du rang courant, halo compris.
 *
 * Le nom, la couleur et la progression viennent du serveur (`GET /me`) : l'app
 * ne connaît que le fichier image associé au slug.
 */
export function Ecusson({ rang, taille = 132 }: { rang: RangCourant; taille?: number }) {
  const source = ecussonDuRang(rang.slug);

  return (
    <View style={[styles.cadre, { width: taille, height: taille }]}>
      {/* Halo teinté de la couleur du rang : c'est ce qui distingue un
          Spartiate argenté d'un Titan bleu au premier coup d'œil. */}
      <View
        style={[
          styles.halo,
          {
            width: taille,
            height: taille,
            borderRadius: taille / 2,
            backgroundColor: rang.couleur,
          },
        ]}
      />
      {source ? (
        <Image source={source} style={{ width: taille, height: taille }} resizeMode="contain" />
      ) : (
        // Rang inconnu de cette version de l'app : cartouche sobre plutôt
        // qu'une image manquante.
        <View style={[styles.replis, { borderColor: rang.couleur }]}>
          <Text style={[styles.replisTexte, { color: rang.couleur }]}>
            {rang.nom.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Nom du rang et division, en sérif, sous l'écusson. */
export function LibelleRang({ rang }: { rang: RangCourant }) {
  return (
    <View style={styles.libelle}>
      <Text style={[styles.nom, { color: rang.couleur }]}>{rang.libelle}</Text>
      <Text style={styles.sousTitre}>{rang.sousTitre}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    opacity: 0.18,
    transform: [{ scale: 0.82 }],
  },
  replis: {
    width: "72%",
    height: "72%",
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  replisTexte: {
    fontFamily: POLICE_TITRE,
    fontSize: 26,
    letterSpacing: 1,
  },
  libelle: {
    alignItems: "center",
    gap: 2,
  },
  nom: {
    fontFamily: POLICE_TITRE,
    fontSize: 24,
    letterSpacing: 1,
  },
  sousTitre: {
    color: COULEURS.brume,
    fontSize: 13,
  },
});
