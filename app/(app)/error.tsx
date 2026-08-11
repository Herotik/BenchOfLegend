"use client";

import { useEffect } from "react";

/**
 * Filet de sécurité des pages connectées.
 *
 * Ton neutre, conformément à la spec : on n'accuse pas l'utilisateur, et on
 * lui rappelle que rien n'est perdu — c'est la crainte réelle quand l'écran
 * casse au milieu d'une séance.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <h1 className="text-xl font-semibold text-texte">Quelque chose a lâché</h1>
      <p className="text-sm leading-relaxed text-texte-2">
        L&apos;affichage n&apos;a pas pu se charger. Ta progression, tes séances et tes pesées
        sont intactes — rien n&apos;a été perdu.
      </p>

      {error.digest && (
        <p className="font-mono text-xs text-texte-3">Référence : {error.digest}</p>
      )}

      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-accent/60 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20"
        >
          Réessayer
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-filet px-5 py-2.5 text-sm text-texte-2 transition hover:text-texte"
        >
          Retour au tableau de bord
        </a>
      </div>
    </main>
  );
}
