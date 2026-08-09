import Link from "next/link";

export default function Introuvable() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <p className="font-display text-xs tracking-[0.3em] text-or-500 uppercase">Erreur 404</p>
      <h1 className="text-2xl font-bold text-ivoire">Cette page n&apos;existe pas</h1>
      <p className="text-sm leading-relaxed text-brume">
        Le lien est peut-être périmé, ou l&apos;adresse comporte une faute.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-lg border border-or-600/60 bg-or-500/10 px-5 py-2.5 text-sm font-medium text-or-400 transition hover:bg-or-500/20"
      >
        Retour au tableau de bord
      </Link>
    </main>
  );
}
