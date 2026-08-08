import { getISOWeek, getISOWeekYear, startOfISOWeek } from "date-fns";
import { jourUTC } from "./dates";

/** Lundi de la semaine ISO contenant `date`, à minuit UTC. */
export function debutSemaineUTC(date: Date = new Date()): Date {
  return jourUTC(startOfISOWeek(date));
}

/** Les sept jours de la semaine ISO, du lundi au dimanche, à minuit UTC. */
export function joursDeLaSemaine(date: Date = new Date()): Date[] {
  const lundi = debutSemaineUTC(date);
  // Arithmétique en millisecondes sur une date déjà calée à minuit UTC :
  // insensible aux changements d'heure, contrairement à un addDays local.
  return Array.from({ length: 7 }, (_, i) => new Date(lundi.getTime() + i * 86_400_000));
}

/** 0 = lundi … 6 = dimanche. */
export function indexJour(date: Date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Entier stable et croissant identifiant une semaine ISO. Sert de graine au
 * moteur : la rotation des groupes et des exercices devient déterministe,
 * donc reproductible d'un rechargement de page à l'autre.
 */
export function grainesSemaine(date: Date = new Date()): number {
  return getISOWeekYear(date) * 53 + getISOWeek(date);
}
