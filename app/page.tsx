import Image from "next/image";
import { RANKS } from "@/lib/ranks";

const ETAPES = [
  {
    titre: "Tu déclares ton matériel",
    texte:
      "Haltères, barre de traction, ou rien du tout. Le poids de corps suffit — tout le monde a une chaise.",
  },
  {
    titre: "L'app construit ta semaine",
    texte:
      "Un calendrier avec tes séances minimum, chaque groupe travaillé deux fois, jamais deux jours d'affilée.",
  },
  {
    titre: "Chaque séance validée rapporte des LP",
    texte:
      "Séries, répétitions et temps de repos affichés. Tu coches, tu montes. Aucun LP ne se perd jamais.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* --- Hero --- */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28">
        <p className="font-display text-xs tracking-[0.35em] text-or-500 uppercase">
          Entraînement classé
        </p>
        <h1 className="mt-5 text-5xl font-bold text-ivoire sm:text-7xl">La Faille</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-brume">
          Ton programme de musculation, construit chaque semaine à partir de ton matériel et de
          tes objectifs. Tu valides tes séances, tu gagnes des LP, tu grimpes d&apos;
          <span className="text-ivoire">Hoplite</span> à{" "}
          <span className="text-or-500">Dieu de l&apos;Olympe</span>.
        </p>

        <a
          href="/api/auth/signin/google"
          className="mt-10 inline-flex items-center gap-3 rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 text-base font-medium text-or-400 transition hover:bg-or-500/20 hover:text-or-400"
        >
          <GoogleIcon />
          Se connecter avec Google
        </a>
        <p className="mt-4 text-sm text-cendre">Gratuit. Aucune donnée revendue.</p>
      </section>

      {/* --- Comment ça marche --- */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {ETAPES.map((etape, i) => (
            <div key={etape.titre} className="surface p-5">
              <span className="font-display text-2xl text-or-600">{i + 1}</span>
              <h3 className="mt-2 text-base font-semibold text-ivoire">{etape.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brume">{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- L'échelle des rangs --- */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="text-center text-2xl font-semibold text-ivoire sm:text-3xl">
          Huit rangs à gravir
        </h2>
        <p className="mt-3 text-center text-sm text-brume">
          Du fantassin anonyme au sommet de l&apos;Olympe.
        </p>

        <ul className="mt-12 flex flex-col gap-6">
          {RANKS.map((rang) => (
            <li key={rang.slug} className="flex items-center gap-5 sm:gap-8">
              <Image
                src={rang.logo}
                alt=""
                width={96}
                height={96}
                className="size-16 shrink-0 sm:size-24"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3
                    className="font-display text-xl font-bold sm:text-2xl"
                    style={{ color: rang.color }}
                  >
                    {rang.name}
                  </h3>
                  <span className="text-xs text-cendre">{rang.metal}</span>
                </div>
                <p className="mt-0.5 text-sm tracking-wide text-brume uppercase">
                  {rang.subtitle}
                </p>
                <p className="mt-1 text-sm text-cendre">{rang.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-nuit-700/60 px-6 py-8 text-center text-xs text-cendre">
        La Faille ne remplace pas un avis médical.
      </footer>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
