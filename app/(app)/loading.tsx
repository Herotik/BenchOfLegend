/**
 * Squelette affiché pendant le rendu serveur des pages connectées.
 *
 * Le tableau de bord fait plusieurs requêtes — plan de la semaine, séances,
 * statistiques — et un écran vide pendant ce temps donne l'impression que
 * l'app a planté.
 */
export default function Chargement() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10" aria-busy="true">
      <span className="sr-only">Chargement en cours</span>

      <div className="h-8 w-40 animate-pulse rounded-lg bg-nuit-800" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded bg-nuit-800/70" />

      <div className="surface mt-8 flex flex-col items-center gap-4 p-8">
        <div className="size-32 animate-pulse rounded-full bg-nuit-800" />
        <div className="h-6 w-32 animate-pulse rounded bg-nuit-800" />
        <div className="h-1.5 w-56 animate-pulse rounded-full bg-nuit-800" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface h-16 animate-pulse" />
        ))}
      </div>

      <div className="surface mt-8 h-64 animate-pulse" />
    </main>
  );
}
