import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { POLICE_TEXTE, POLICE_TEXTE_MOYEN, POLICE_TITRE, type Couleurs } from "../theme/couleurs";
import { useCouleurs, useStyles } from "../theme/theme";

/**
 * Contrôles de saisie partagés par le questionnaire d'entrée et les
 * préférences.
 *
 * Les deux écrans posent **les mêmes questions** — le premier pour les
 * établir, le second pour les revoir. Deux jeux de contrôles auraient
 * divergé : une aide reformulée d'un côté, une borne oubliée de l'autre.
 */

/**
 * Une réponse possible.
 *
 * `multiple` ne change que le rôle d'accessibilité et la forme de la marque —
 * carré pour un choix cumulable, rond pour un choix exclusif. C'est la seule
 * indication qu'on peut en cocher plusieurs, et elle doit être lisible avant
 * d'avoir essayé.
 */
export function Option({
  titre,
  aide,
  actif,
  multiple = false,
  onPress,
}: {
  titre: string;
  aide?: string;
  actif: boolean;
  multiple?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(creerStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: actif, selected: actif }}
      style={[styles.option, actif && styles.optionActive]}
    >
      <View
        style={[
          styles.marque,
          multiple ? styles.marqueCarree : styles.marqueRonde,
          actif && styles.marqueActive,
        ]}
      />
      <View style={styles.optionTexte}>
        <Text style={[styles.optionTitre, actif && styles.optionTitreActif]}>{titre}</Text>
        {aide ? <Text style={styles.optionAide}>{aide}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Choix d'un entier parmi quelques-uns, présentés en rang. */
export function GrilleNombres({
  valeurs,
  choisi,
  onChoisir,
}: {
  valeurs: number[];
  choisi: number | null;
  onChoisir: (n: number) => void;
}) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.grille}>
      {valeurs.map((n) => (
        <Pressable
          key={n}
          onPress={() => onChoisir(n)}
          accessibilityRole="radio"
          accessibilityState={{ selected: choisi === n }}
          style={[styles.case, choisi === n && styles.caseActive]}
        >
          <Text style={[styles.caseChiffre, choisi === n && styles.caseChiffreActif]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Saisie d'une mesure avec son unité. */
export function Mesure({
  etiquette,
  unite,
  valeur,
  onChange,
  exemple,
}: {
  etiquette: string;
  unite: string;
  valeur: string;
  onChange: (v: string) => void;
  exemple: string;
}) {
  const styles = useStyles(creerStyles);
  const c = useCouleurs();
  return (
    <View style={styles.mesure}>
      <Text style={styles.mesureEtiquette}>{etiquette}</Text>
      <View style={styles.mesureLigne}>
        <TextInput
          value={valeur}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={exemple}
          // Sans cela, l'indication reste au gris du système et disparaît
          // dans le fond en thème sombre.
          placeholderTextColor={c.texte3}
          style={styles.mesureChamp}
          accessibilityLabel={`${etiquette} en ${unite}`}
        />
        <Text style={styles.mesureUnite}>{unite}</Text>
      </View>
    </View>
  );
}

/** Accepte la virgule : c'est ce que propose le clavier décimal français. */
export function nombreOuNull(valeur: string): number | null {
  if (valeur.trim() === "") return null;
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.filet,
    backgroundColor: c.fond2,
  },
  // L'état choisi se marque au filet, jamais à un aplat d'accent : le
  // porphyre ne porte que l'identité.
  optionActive: {
    borderColor: c.filetFort,
    backgroundColor: c.fond3,
  },
  marque: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: c.texte3,
  },
  marqueRonde: { borderRadius: 9 },
  marqueCarree: { borderRadius: 3 },
  marqueActive: {
    borderColor: c.accent,
    backgroundColor: c.accent,
  },
  optionTexte: {
    flex: 1,
    gap: 3,
  },
  optionTitre: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 15,
  },
  optionTitreActif: {
    fontFamily: POLICE_TEXTE_MOYEN,
    fontWeight: "600",
  },
  optionAide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12.5,
    lineHeight: 18,
  },
  grille: {
    flexDirection: "row",
    gap: 8,
  },
  case: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.filet,
    backgroundColor: c.fond2,
  },
  caseActive: {
    borderColor: c.filetFort,
    backgroundColor: c.fond3,
  },
  caseChiffre: {
    fontFamily: POLICE_TITRE,
    color: c.texte2,
    fontSize: 22,
  },
  caseChiffreActif: {
    color: c.accent,
  },
  mesure: { gap: 6 },
  mesureEtiquette: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
  },
  mesureLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mesureChamp: {
    fontFamily: POLICE_TEXTE,
    flex: 1,
    minWidth: 0,
    color: c.texte,
    backgroundColor: c.fond2,
    borderColor: c.filet,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
  },
  mesureUnite: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 15,
    width: 24,
  },
});
