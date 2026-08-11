"use client";

import { useEffect, useState } from "react";

export type Theme = "clair" | "sombre";
const CLE = "fol-theme";

/**
 * Script injecté avant le rendu, dans le `<head>`.
 *
 * Sans lui, la page s'affiche une fraction de seconde dans le thème par défaut
 * avant de basculer — un éclair blanc désagréable pour qui a choisi le sombre.
 * Il doit rester synchrone et minuscule.
 */
export const SCRIPT_THEME = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(CLE)});
if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'sombre':'clair'}
document.documentElement.dataset.theme=t;
}catch(e){document.documentElement.dataset.theme='clair'}})()`;

function lire(): Theme {
  if (typeof document === "undefined") return "clair";
  return document.documentElement.dataset.theme === "sombre" ? "sombre" : "clair";
}

export function useTheme() {
  const [theme, setThemeLocal] = useState<Theme>("clair");

  // Le thème est déjà posé par le script ci-dessus : on ne fait que le relire
  // après hydratation, sans jamais le recalculer — sinon le rendu serveur et
  // le rendu client divergeraient.
  useEffect(() => setThemeLocal(lire()), []);

  const basculer = () => {
    const suivant: Theme = lire() === "sombre" ? "clair" : "sombre";
    document.documentElement.dataset.theme = suivant;
    try {
      localStorage.setItem(CLE, suivant);
    } catch {
      // Navigation privée : le choix ne survivra pas à la session, tant pis.
    }
    setThemeLocal(suivant);
  };

  return { theme, basculer };
}

export function BasculeTheme({ className = "" }: { className?: string }) {
  const { theme, basculer } = useTheme();

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={theme === "sombre" ? "Passer au thème clair" : "Passer au thème sombre"}
      className={`grid size-9 place-items-center border border-filet text-texte-2 transition-colors hover:text-texte ${className}`}
    >
      {theme === "sombre" ? <Soleil /> : <Lune />}
    </button>
  );
}

const traits = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function Lune() {
  return (
    <svg {...traits}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

function Soleil() {
  return (
    <svg {...traits}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}
