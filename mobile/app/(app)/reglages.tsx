import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_API } from "../../src/api/client";
import { useSession } from "../../src/auth/session";
import { useReferentiel } from "../../src/donnees/referentiel";
import { Bouton } from "../../src/composants/Bouton";
import { Carte, Ornement, TitreSection } from "../../src/composants/Carte";
import { Chargement } from "../../src/composants/Etats";
import { jourEnFrancais } from "../../src/outils/dates";
import { COULEURS, POLICE_TITRE } from "../../src/theme/couleurs";

/**
 * Réglages : profil en lecture seule, et déconnexion.
 *
 * Les préférences se **modifient** sur le web (`PUT /me/preferences` attend le
 * bloc entier : un envoi partiel effacerait des groupes sans le dire). L'app
 * les montre telles que le serveur les renvoie.
 */
export default function Reglages() {
  const { moi, seDeconnecter } = useSession();
  const { libelleGroupe, libelleMateriel, libelleNiveau, libelleObjectif } = useReferentiel();
  const marges = useSafeAreaInsets();
  const [enCours, setEnCours] = useState(false);

  const deconnecter = useCallback(() => {
    setEnCours(true);
    void seDeconnecter().finally(() => setEnCours(false));
  }, [seDeconnecter]);

  if (!moi) return <Chargement message="Chargement du profil…" />;

  const { utilisateur, preferences, rang } = moi;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: marges.top + 16, paddingBottom: 40 },
      ]}
    >
      <Text style={styles.titre}>Réglages</Text>

      <TitreSection>Profil</TitreSection>
      <Carte style={styles.carte}>
        <Ligne etiquette="Nom" valeur={utilisateur.nom ?? "—"} />
        <Ligne etiquette="Adresse" valeur={utilisateur.email ?? "—"} />
        <Ligne etiquette="Inscrit le" valeur={jourEnFrancais(utilisateur.inscritLe.slice(0, 10))} />
        <Ligne etiquette="Rang" valeur={`${rang.libelle} · ${rang.sousTitre}`} />
        <Ligne etiquette="LP" valeur={`${moi.lp}`} />
      </Carte>

      <TitreSection>Entraînement</TitreSection>
      {preferences ? (
        <Carte style={styles.carte}>
          <Ligne etiquette="Niveau" valeur={libelleNiveau(preferences.niveau)} />
          <Ligne etiquette="Objectif" valeur={libelleObjectif(preferences.objectif)} />
          <Ligne etiquette="Séances par semaine" valeur={`${preferences.joursParSemaine}`} />
          <Ligne
            etiquette="Taille"
            valeur={preferences.tailleCm ? `${preferences.tailleCm} cm` : "—"}
          />
          <Ligne
            etiquette="Matériel"
            valeur={
              preferences.materiel.length > 0
                ? preferences.materiel.map(libelleMateriel).join(", ")
                : "Poids de corps"
            }
          />
        </Carte>
      ) : (
        <Carte style={styles.carte}>
          <Text style={styles.vide}>
            Profil non complété. Le questionnaire d&apos;entrée se remplit sur la version web.
          </Text>
        </Carte>
      )}

      {preferences && preferences.groupesMusculaires.length > 0 ? (
        <>
          <TitreSection>Groupes travaillés</TitreSection>
          <Carte style={styles.carte}>
            {preferences.groupesMusculaires.map((groupe) => (
              <View key={groupe.groupe} style={styles.groupe}>
                <View style={styles.groupeTexte}>
                  <Text style={styles.groupeNom}>
                    {libelleGroupe(groupe.groupe)}
                    {groupe.priorite >= 2 ? " · point fort" : ""}
                  </Text>
                  <Text style={styles.groupeAide}>{legendeDecalage(groupe.decalageNiveau)}</Text>
                </View>
              </View>
            ))}
          </Carte>
        </>
      ) : null}

      <Ornement style={styles.ornement} />

      <Bouton
        titre="Se déconnecter"
        aide="Le jeton de cet appareil est révoqué côté serveur"
        intention="sombre"
        onPress={deconnecter}
        enCours={enCours}
      />

      <Text style={styles.mention}>Serveur : {BASE_API}</Text>
    </ScrollView>
  );
}

function Ligne({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.etiquette}>{etiquette}</Text>
      <Text style={styles.valeur}>{valeur}</Text>
    </View>
  );
}

/**
 * Le décalage n'est pas une préférence : il se gagne séance après séance par le
 * ressenti déclaré, d'où l'absence de contrôle pour le modifier ici.
 */
function legendeDecalage(decalage: number): string {
  if (decalage > 0) return "Variantes plus difficiles";
  if (decalage < 0) return "Variantes plus accessibles";
  return "Calibrage standard";
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COULEURS.nuit950,
  },
  contenu: {
    paddingHorizontal: 18,
    gap: 10,
  },
  titre: {
    color: COULEURS.ivoire,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    marginBottom: 8,
  },
  carte: {
    gap: 12,
  },
  ligne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  etiquette: {
    color: COULEURS.brume,
    fontSize: 13,
  },
  valeur: {
    color: COULEURS.ivoire,
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
  },
  groupe: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupeTexte: {
    flex: 1,
    gap: 2,
  },
  groupeNom: {
    color: COULEURS.ivoire,
    fontSize: 15,
    fontWeight: "600",
  },
  groupeAide: {
    color: COULEURS.brume,
    fontSize: 12,
  },
  vide: {
    color: COULEURS.brume,
    fontSize: 13,
    lineHeight: 20,
  },
  ornement: {
    marginVertical: 16,
  },
  mention: {
    color: COULEURS.cendre,
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },
});
