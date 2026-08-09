"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker, ce qui rend l'app installable.
 *
 * Uniquement en production : en développement, un service worker interfère
 * avec le rechargement à chaud de Next et sert des fichiers périmés.
 */
export function EnregistrerServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Un échec d'enregistrement ne doit rien casser : l'app fonctionne
      // parfaitement sans, elle n'est simplement pas installable.
    });
  }, []);

  return null;
}
