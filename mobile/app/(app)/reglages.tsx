import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_API } from "../../src/api/client";
import { chargerConnexions, detacherConnexion } from "../../src/api/routes";
import { useSession } from "../../src/auth/session";
import {
  appleDisponible,
  ConnexionAbandonnee,
  discordDisponible,
  googleDisponible,
  rattacher,
} from "../../src/auth/natif";
import { useReferentiel } from "../../src/donnees/referentiel";
import { Bouton } from "../../src/composants/Bouton";
import { Carte, Ornement, TitreSection } from "../../src/composants/Carte";
import { Chargement } from "../../src/composants/Etats";
import { Marque } from "../../src/composants/Logo";
import { jourEnFrancais } from "../../src/outils/dates";
import { POLICE_TEXTE_MOYEN, POLICE_TEXTE, POLICE_TITRE, type Couleurs } from "../../src/theme/couleurs";
import { useStyles, useTheme, type ChoixTheme } from "../../src/theme/theme";

/**
 * Réglages : profil, apparence, et sortie.
 *
 * Le profil est montré tel que le serveur le renvoie ; sa modification a son
 * propre écran, `/preferences`, parce que `PUT /me/preferences` remplace le
 * bloc entier et régénère le plan à venir — ce n'est pas un réglage qu'on
 * change en passant.
 */
export default function Reglages() {
  const styles = useStyles(creerStyles);
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
        <Ligne etiquette="Δ" valeur={`${moi.lp}`} />
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
            Profil non complété. Le questionnaire d&apos;entrée reprendra à la prochaine
            ouverture.
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

      <TitreSection>Lier un compte</TitreSection>
      <Connexions />

      <TitreSection>Apparence</TitreSection>
      <Carte style={styles.carte}>
        <ChoixApparence />
      </Carte>

      <Ornement style={styles.ornement} />

      <Bouton
        titre="Modifier mes préférences"
        aide="Le plan à venir sera régénéré ; les séances validées ne bougent pas"
        intention="sombre"
        onPress={() => router.push("/preferences")}
      />

      <Bouton
        titre="Se déconnecter"
        aide="Le jeton de cet appareil est révoqué côté serveur"
        intention="sombre"
        onPress={deconnecter}
        enCours={enCours}
      />

      <View style={styles.signature}>
        <Marque taille={44} />
        <Text style={styles.signatureNom}>FRAME OF LEGENDS</Text>
        <Text style={styles.mention}>Serveur : {BASE_API}</Text>
      </View>
    </ScrollView>
  );
}

const APPARENCES: { valeur: ChoixTheme; libelle: string }[] = [
  { valeur: "systeme", libelle: "Système" },
  { valeur: "clair", libelle: "Clair" },
  { valeur: "sombre", libelle: "Sombre" },
];

/**
 * Le thème est un réglage d'appareil, pas une préférence de compte : il ne
 * passe donc pas par `PUT /me/preferences`. Quelqu'un peut vouloir son iPhone
 * en sombre et son iPad en clair.
 */
/**
 * Façons de se connecter rattachées au compte.
 *
 * À la connexion, deux comptes ne se rejoignent que s'ils portent la **même
 * adresse vérifiée** — seule règle sûre tant que personne n'est identifié. Mais
 * l'identifiant Apple et le compte Google d'une même personne n'ont aucune
 * raison de partager une adresse, et l'app en créait alors un second.
 *
 * Ici, la session prouve déjà qui l'on est : rattacher devient sûr, et
 * l'adresse n'arbitre plus rien.
 */
function Connexions() {
  const styles = useStyles(creerStyles);
  const [connexions, setConnexions] = useState<string[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [appleDispo, setAppleDispo] = useState(false);

  useEffect(() => {
    let vivant = true;
    void chargerConnexions()
      .then((r) => vivant && setConnexions(r.connexions))
      .catch(() => vivant && setConnexions([]));
    void appleDisponible().then((d) => vivant && setAppleDispo(d));
    return () => {
      vivant = false;
    };
  }, []);

  const agir = useCallback((quoi: string, action: () => Promise<string[]>) => {
    setEnCours(quoi);
    setMessage(null);

    void action()
      .then(setConnexions)
      .catch((cause: unknown) => {
        // Fermer la feuille n'est pas un incident : rien à signaler.
        if (cause instanceof ConnexionAbandonnee) return;
        setMessage(cause instanceof Error ? cause.message : "Opération impossible");
      })
      .finally(() => setEnCours(null));
  }, []);

  if (!connexions) return null;

  const proposables = (
    [
      { id: "apple", nom: "Apple", dispo: appleDispo },
      { id: "google", nom: "Google", dispo: googleDisponible() },
      { id: "discord", nom: "Discord", dispo: discordDisponible() },
    ] as const
  ).filter((f) => f.dispo && !connexions.includes(f.id));

  return (
    <>
      <Carte style={styles.carte}>
        {connexions.length === 0 ? (
          <Text style={styles.vide}>Aucun compte lié.</Text>
        ) : (
          connexions.map((fournisseur) => (
            <View key={fournisseur} style={styles.groupe}>
              <View style={styles.groupeTexte}>
                <Text style={styles.groupeNom}>{LIBELLES[fournisseur] ?? fournisseur}</Text>
                <Text style={styles.groupeAide}>
                  {connexions.length === 1
                    ? "Ta seule façon d'entrer : elle ne peut pas être déliée"
                    : "Liée à ce compte"}
                </Text>
              </View>
              {connexions.length > 1 ? (
                <Pressable
                  onPress={() =>
                    agir(`retrait-${fournisseur}`, () =>
                      detacherConnexion(fournisseur).then((r) => r.connexions),
                    )
                  }
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer la connexion ${fournisseur}`}
                >
                  <Text style={styles.retirer}>
                    {enCours === `retrait-${fournisseur}` ? "…" : "Retirer"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </Carte>

      {proposables.map((f) => (
        <Bouton
          key={f.id}
          titre={`Lier un compte ${f.nom}`}
          aide="La feuille s'ouvre pour prouver l'identité, puis la lie à ce compte"
          intention="sombre"
          onPress={() => agir(f.id, () => rattacher(f.id))}
          enCours={enCours === f.id}
        />
      ))}

      {message ? <Text style={styles.messageConnexion}>{message}</Text> : null}
    </>
  );
}

const LIBELLES: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  discord: "Discord",
};

function ChoixApparence() {
  const styles = useStyles(creerStyles);
  const { choix, definirChoix } = useTheme();

  return (
    <View style={styles.segments}>
      {APPARENCES.map((option) => {
        const actif = option.valeur === choix;
        return (
          <Pressable
            key={option.valeur}
            onPress={() => definirChoix(option.valeur)}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
            style={[styles.segment, actif && styles.segmentActif]}
          >
            <Text style={[styles.segmentTexte, actif && styles.segmentTexteActif]}>
              {option.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Ligne({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  const styles = useStyles(creerStyles);
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

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  contenu: {
    paddingHorizontal: 18,
    gap: 10,
  },
  titre: {
    color: c.texte,
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
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
  },
  valeur: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
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
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 15,
    fontWeight: "600",
  },
  groupeAide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12,
  },
  vide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
  retirer: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte2,
    fontSize: 13,
    fontWeight: "600",
  },
  messageConnexion: {
    fontFamily: POLICE_TEXTE,
    color: c.accent,
    fontSize: 13,
    lineHeight: 20,
  },
  segments: {
    flexDirection: "row",
    gap: 6,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.filet,
    backgroundColor: c.fond,
  },
  // Le choix actif se marque au filet et à la couleur du texte, pas à un
  // aplat d'accent : le porphyre ne porte que l'identité, jamais l'état.
  segmentActif: {
    borderColor: c.filetFort,
    backgroundColor: c.fond3,
  },
  segmentTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
  },
  segmentTexteActif: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
  },
  ornement: {
    marginVertical: 16,
  },
  signature: {
    alignItems: "center",
    gap: 8,
    marginTop: 26,
  },
  signatureNom: {
    fontFamily: POLICE_TITRE,
    color: c.texte2,
    fontSize: 12,
    letterSpacing: 2.4,
  },
  mention: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },
});
