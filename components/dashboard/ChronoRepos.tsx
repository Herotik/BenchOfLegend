"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Décompte du temps de repos, déclenché après une série.
 *
 * L'app est utilisée téléphone en main pendant la séance : à la fin du
 * décompte on vibre si l'appareil le permet, parce que l'écran est
 * généralement verrouillé ou posé à ce moment-là.
 */
export function ChronoRepos({ secondes, couleur }: { secondes: number; couleur: string }) {
  const [restant, setRestant] = useState<number | null>(null);
  const echeance = useRef<number>(0);

  useEffect(() => {
    if (restant === null) return;

    const tick = setInterval(() => {
      const reste = Math.max(0, Math.round((echeance.current - Date.now()) / 1000));
      setRestant(reste);
      if (reste === 0) {
        clearInterval(tick);
        navigator.vibrate?.([200, 100, 200]);
        setTimeout(() => setRestant(null), 1500);
      }
    }, 250);

    return () => clearInterval(tick);
    // `restant` n'est volontairement pas en dépendance : l'intervalle se pilote
    // seul et se relancerait à chaque seconde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restant === null]);

  function lancer() {
    // On mémorise une échéance absolue plutôt que de décrémenter un compteur :
    // les navigateurs mobiles ralentissent les timers en arrière-plan, et un
    // décompte par soustraction dériverait de plusieurs secondes.
    echeance.current = Date.now() + secondes * 1000;
    setRestant(secondes);
  }

  if (restant === null) {
    return (
      <button
        type="button"
        onClick={lancer}
        className="rounded-lg border border-filet px-3 py-1.5 text-xs text-texte-2 transition hover:text-texte"
      >
        Repos {formater(secondes)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRestant(null)}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium tabular-nums transition"
      style={{ borderColor: couleur, color: restant === 0 ? "var(--color-positif)" : couleur }}
      aria-live="polite"
    >
      {restant === 0 ? "Reprends !" : formater(restant)}
    </button>
  );
}

function formater(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}
