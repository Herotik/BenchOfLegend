import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { chargerPlan } from "../api/routes";
import type { JourPlan } from "../api/types";
import { jourCivilISO } from "../outils/dates";
import { rappelsAPoser } from "./rappels-choix";
import { ecrire, lire } from "../outils/stockage";

/**
 * Rappels de séance.
 *
 * Le calendrier sait quels jours on s'entraîne, mais rien ne le disait : une
 * séance oubliée l'était pour de bon, et la série de régularité avec elle.
 *
 * **Des notifications locales**, planifiées par le téléphone lui-même, et non
 * envoyées par un serveur. Le plan est connu six semaines à l'avance : rien ne
 * justifie d'ouvrir un canal de notifications distantes, ses jetons, ses clés
 * Apple et son point de panne — pour annoncer une information que l'app a déjà.
 *
 * Le réglage vit **sur l'appareil**, pas dans le profil : quelqu'un qui a deux
 * téléphones n'a aucune raison de vouloir la même heure sur les deux, et ça
 * évite une migration de base pour un confort local.
 */

const CLE = "fol.rappels.v1";

/**
 * iOS n'accepte que 64 notifications locales en attente, et jette
 * silencieusement les suivantes. On reste très en deçà : au rythme de quatre
 * séances par semaine, vingt entrées couvrent plus d'un mois, et la
 * replanification a lieu à chaque ouverture de l'app.
 */
const MAX_PROGRAMMEES = 20;

/** Heures proposées. Une liste courte évite d'embarquer un sélecteur natif. */
export const HEURES_RAPPEL = [8, 12, 18, 20] as const;

export interface ReglageRappels {
  actif: boolean;
  /** Heure locale de déclenchement, parmi `HEURES_RAPPEL`. */
  heure: number;
}

const DEFAUT: ReglageRappels = { actif: false, heure: 18 };

export async function lireReglage(): Promise<ReglageRappels> {
  const garde = await lire<ReglageRappels>(CLE);
  if (!garde || typeof garde.actif !== "boolean") return DEFAUT;

  // L'heure gardée peut venir d'une version qui en proposait d'autres.
  const heure = HEURES_RAPPEL.includes(garde.heure as (typeof HEURES_RAPPEL)[number])
    ? garde.heure
    : DEFAUT.heure;

  return { actif: garde.actif, heure };
}

export const ecrireReglage = (reglage: ReglageRappels): Promise<void> => ecrire(CLE, reglage);

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Demande l'autorisation, une fois.
 *
 * Rendue **avant** d'écrire le réglage : activer les rappels dans l'app alors
 * qu'iOS les refuse afficherait un interrupteur qui ment.
 */
export async function autoriser(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const Notifications = await import("expo-notifications");
  const actuelle = await Notifications.getPermissionsAsync();
  if (actuelle.granted) return true;

  // Refus définitif : redemander n'ouvre plus aucune fenêtre, iOS renvoie le
  // même refus sans rien afficher. Il faut passer par les réglages du système.
  if (!actuelle.canAskAgain) return false;

  const demande = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return demande.granted;
}

// ---------------------------------------------------------------------------
// Planification
// ---------------------------------------------------------------------------

/**
 * Reprend toute la planification à partir du plan reçu.
 *
 * On efface avant de replanifier plutôt que d'ajuster au cas par cas : le plan
 * change — séance validée, préférences modifiées, semaine régénérée — et
 * suivre ces changements un par un ferait survivre des rappels pour des
 * séances qui n'existent plus.
 *
 * Rend le nombre de rappels effectivement posés.
 */
export async function replanifier(
  jours: JourPlan[],
  reglage: ReglageRappels,
): Promise<number> {
  if (Platform.OS === "web") return 0;

  const Notifications = await import("expo-notifications");
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!reglage.actif) return 0;
  if (!(await Notifications.getPermissionsAsync()).granted) return 0;

  const poser = rappelsAPoser(jours, {
    heure: reglage.heure,
    aujourdhui: jourCivilISO(),
    maintenant: Date.now(),
    maximum: MAX_PROGRAMMEES,
  });

  for (const { quand, genre } of poser) {
    await Notifications.scheduleNotificationAsync({
      content:
        genre === "rappel"
          ? {
              title: "Séance prévue aujourd'hui",
              // Ton motivant, jamais culpabilisant — c'est une contrainte de la
              // spécification, pas une préférence de rédaction.
              body: "Ta séance t'attend. Une de plus, un rang de gagné.",
              sound: true,
            }
          : {
              // Sans son : c'est une bonne nouvelle, pas une sollicitation.
              title: "Le job est déjà fait",
              body: "Bien joué. Ta séance est validée, les Δ sont comptés.",
              sound: false,
            },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quand },
    });
  }

  return poser.length;
}

/** Efface tous les rappels — à l'extinction du réglage, ou à la déconnexion. */
export async function toutEffacer(): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Fait apparaître le rappel même quand l'app est ouverte.
 *
 * Sans ce réglage, iOS remet la notification au système de notifications sans
 * rien montrer : quelqu'un qui consulte son historique à 18 h ne verrait jamais
 * le rappel de sa propre séance.
 */
async function installerAffichage(): Promise<void> {
  if (Platform.OS === "web") return;

  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      // Aucune pastille sur l'icône : elle resterait après coup, et il faudrait
      // penser à l'effacer. Un rappel se lit, il ne se compte pas.
      shouldSetBadge: false,
    }),
  });
}

/** Quatre semaines : bien au-delà des vingt rappels que l'on posera. */
const HORIZON_JOURS = 27;

/**
 * Va chercher le plan et replanifie. Point d'entrée unique : l'écran de
 * réglages et le réveil de l'app appellent le même code.
 *
 * Jamais rejetée — un rappel est un confort, pas une condition. Une panne de
 * réseau au réveil de l'app ne doit pas produire d'écran d'erreur.
 */
export async function appliquer(reglage: ReglageRappels): Promise<number> {
  if (!reglage.actif) {
    await toutEffacer();
    return 0;
  }

  try {
    const debut = jourCivilISO();
    const fin = jourCivilISO(new Date(Date.now() + HORIZON_JOURS * 86_400_000));
    const { jours } = await chargerPlan(debut, fin);
    return await replanifier(jours, reglage);
  } catch {
    // Les rappels déjà posés survivent : mieux vaut une planification d'hier
    // que plus de rappels du tout.
    return -1;
  }
}

/**
 * Replanifie au démarrage et à chaque retour au premier plan.
 *
 * À monter **une seule fois**, dans la coquille de l'app. Le plan bouge — une
 * séance validée, une semaine régénérée, des préférences changées — et c'est
 * au moment où l'on rouvre l'app que l'on peut s'en apercevoir sans rien
 * interroger en permanence.
 */
export function useRappels(actif: boolean): void {
  useEffect(() => {
    if (!actif) return;

    void installerAffichage();

    const rejouer = () => void lireReglage().then(appliquer);
    rejouer();

    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") rejouer();
    });

    return () => abonnement.remove();
  }, [actif]);
}

