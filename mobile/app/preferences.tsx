import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modifierPreferences } from "../src/api/routes";
import type { CorpsPreferences, Niveau, Objectif } from "../src/api/types";
import { useSession } from "../src/auth/session";
import { useReferentiel } from "../src/donnees/referentiel";
import { Bouton } from "../src/composants/Bouton";
import { Carte, TitreSection } from "../src/composants/Carte";
import { Chargement } from "../src/composants/Etats";
import { GrilleNombres, Mesure, Option, nombreOuNull } from "../src/composants/Choix";
import { revenir } from "../src/outils/navigation";
import { POLICE_TEXTE, POLICE_TEXTE_MOYEN, POLICE_TITRE, type Couleurs } from "../src/theme/couleurs";
import { useStyles } from "../src/theme/theme";

/**
 * Modification des préférences.
 *
 * Les mêmes questions que le questionnaire d'entrée, mais **toutes sur une
 * page** : on vient ici pour changer une chose précise, pas pour tout
 * reparcourir. Le déroulé en étapes ne se justifie qu'à la première saisie,
 * quand on ne sait pas encore ce qui est demandé.
 *
 * Le poids n'y figure pas : il se saisit chaque jour depuis l'accueil, et le
 * remettre ici laisserait croire qu'on peut réécrire la première pesée.
 *
 * `PUT /me/preferences` remplace le bloc entier et régénère le plan à venir —
 * jamais le passé, dont les séances validées ont rapporté des Δ.
 */

const JOURS_POSSIBLES = [2, 3, 4, 5, 6];
const TAILLE_MIN = 120;
const TAILLE_MAX = 230;

export default function Preferences() {
  const styles = useStyles(creerStyles);
  const { moi, rafraichirProfil } = useSession();
  const { referentiel, libelleGroupe } = useReferentiel();
  const marges = useSafeAreaInsets();

  const [niveau, setNiveau] = useState<Niveau | null>(null);
  const [objectif, setObjectif] = useState<Objectif | null>(null);
  const [jours, setJours] = useState<number | null>(null);
  const [groupes, setGroupes] = useState<string[]>([]);
  const [pointsForts, setPointsForts] = useState<string[]>([]);
  const [materiel, setMateriel] = useState<string[]>([]);
  const [taille, setTaille] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le formulaire part de l'existant : arriver sur des champs vides donnerait
  // à croire que les préférences ont été perdues.
  const p = moi?.preferences;
  useEffect(() => {
    if (!p) return;
    setNiveau(p.niveau as Niveau);
    setObjectif(p.objectif as Objectif);
    setJours(p.joursParSemaine);
    setGroupes(p.groupesMusculaires.map((g) => g.groupe));
    setPointsForts(p.groupesMusculaires.filter((g) => g.priorite >= 2).map((g) => g.groupe));
    setMateriel(p.materiel);
    setTaille(p.tailleCm ? String(p.tailleCm) : "");
  }, [p]);

  const basculerGroupe = useCallback((id: string) => {
    setGroupes((precedent) => {
      const suivant = precedent.includes(id)
        ? precedent.filter((x) => x !== id)
        : [...precedent, id];
      // Un point fort sur un groupe retiré serait filtré en silence par le
      // serveur : autant le retirer ici, où l'on peut le montrer.
      setPointsForts((forts) => forts.filter((g) => suivant.includes(g)));
      return suivant;
    });
  }, []);

  const basculer = (liste: string[], set: (v: string[]) => void, id: string) =>
    set(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);

  const cm = nombreOuNull(taille);
  const valide =
    niveau !== null &&
    objectif !== null &&
    jours !== null &&
    groupes.length > 0 &&
    cm !== null &&
    cm >= TAILLE_MIN &&
    cm <= TAILLE_MAX;

  const enregistrer = useCallback(() => {
    if (!valide || niveau === null || objectif === null || jours === null || cm === null) return;
    setErreur(null);
    setEnCours(true);

    const corps: CorpsPreferences = {
      tailleCm: Math.round(cm),
      niveau,
      materiel,
      groupesMusculaires: groupes,
      pointsForts,
      objectif,
      joursParSemaine: jours,
    };

    void (async () => {
      try {
        await modifierPreferences(corps);
        await rafraichirProfil();
        revenir("/reglages");
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Enregistrement impossible");
        setEnCours(false);
      }
    })();
  }, [valide, niveau, objectif, jours, cm, materiel, groupes, pointsForts, rafraichirProfil]);

  if (!moi || !referentiel) return <Chargement message="Chargement des préférences…" />;

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: marges.top + 16, paddingBottom: 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titre}>Préférences</Text>
        <Text style={styles.avertissement}>
          Le plan à venir sera régénéré. Les séances déjà validées ne bougent pas — elles ont
          rapporté des Δ.
        </Text>

        <TitreSection>Niveau</TitreSection>
        <View style={styles.groupe}>
          {referentiel.niveaux.map((n) => (
            <Option
              key={n.id}
              titre={n.label}
              aide={n.aide}
              actif={niveau === n.id}
              onPress={() => setNiveau(n.id as Niveau)}
            />
          ))}
        </View>

        <TitreSection>Objectif</TitreSection>
        <View style={styles.groupe}>
          {referentiel.objectifs.map((o) => (
            <Option
              key={o.id}
              titre={o.label}
              actif={objectif === o.id}
              onPress={() => setObjectif(o.id as Objectif)}
            />
          ))}
        </View>

        <TitreSection>Séances par semaine</TitreSection>
        <GrilleNombres valeurs={JOURS_POSSIBLES} choisi={jours} onChoisir={setJours} />

        <TitreSection>Groupes travaillés</TitreSection>
        <View style={styles.groupe}>
          {referentiel.groupesMusculaires.map((g) => (
            <Option
              key={g.id}
              titre={g.label}
              actif={groupes.includes(g.id)}
              multiple
              onPress={() => basculerGroupe(g.id)}
            />
          ))}
        </View>

        {groupes.length > 0 ? (
          <>
            <TitreSection>Priorités</TitreSection>
            <View style={styles.groupe}>
              {groupes.map((id) => (
                <Option
                  key={id}
                  titre={libelleGroupe(id)}
                  actif={pointsForts.includes(id)}
                  multiple
                  onPress={() => basculer(pointsForts, setPointsForts, id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <TitreSection>Matériel</TitreSection>
        <View style={styles.groupe}>
          {referentiel.materiel.map((m) => (
            <Option
              key={m.id}
              titre={m.label}
              actif={materiel.includes(m.id)}
              multiple
              onPress={() => basculer(materiel, setMateriel, m.id)}
            />
          ))}
        </View>

        <TitreSection>Taille</TitreSection>
        <Mesure etiquette="Taille" unite="cm" valeur={taille} onChange={setTaille} exemple="178" />

        {erreur ? (
          <Carte style={styles.erreur}>
            <Text style={styles.erreurTitre}>L&apos;enregistrement a échoué</Text>
            <Text style={styles.erreurTexte}>{erreur}</Text>
          </Carte>
        ) : null}
      </ScrollView>

      <View style={[styles.pied, { paddingBottom: marges.bottom + 16 }]}>
        <Bouton
          titre="Enregistrer"
          onPress={enregistrer}
          desactive={!valide}
          enCours={enCours}
        />
        <Bouton titre="Annuler" intention="discret" onPress={() => revenir("/reglages")} />
      </View>
    </View>
  );
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
  },
  avertissement: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  groupe: {
    gap: 8,
  },
  pied: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: c.filet,
    backgroundColor: c.fond,
  },
  erreur: {
    borderColor: c.negatif,
    gap: 6,
    marginTop: 12,
  },
  erreurTitre: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 15,
    fontWeight: "600",
  },
  erreurTexte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
});
