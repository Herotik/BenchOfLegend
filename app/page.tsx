import Image from "next/image";
import Link from "next/link";
import { RANKS } from "@/lib/ranks";
import { auth, googleConfigured } from "@/auth";
import { connexionGoogle } from "@/app/actions/auth";
import { Meandre, SeparateurLosange } from "@/components/ornements/Meandre";

/** Chiffres romains : l'app compte comme la planche de rangs, pas comme un tableur. */
const ROMAIN = ["I", "II", "III"];

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

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  // Accessible même connecté : c'est la seule page qui présente l'échelle des
  // rangs en entier. On remplace simplement le bouton de connexion par un
  // accès direct au tableau de bord.
  const session = await auth();
  const connecte = Boolean(session?.user);

  const { suivant } = await searchParams;

  return (
    <main className="flex-1">
      {/* --- Hero --- */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28">
        <p className="font-display text-xs tracking-[0.35em] text-or-500 uppercase motion-safe:apparait">
          Entraînement classé
        </p>
        <h1 className="mt-5 text-5xl font-bold text-ivoire sm:text-7xl motion-safe:surgit">
          La Faille
        </h1>
        <div className="mt-5 w-40 text-or-600 motion-safe:apparait">
          <Meandre opacite={0.5} />
        </div>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-brume">
          Ton programme de musculation, construit chaque semaine à partir de ton matériel et de
          tes objectifs. Tu valides tes séances, tu gagnes des LP, tu grimpes d&apos;
          <span className="text-ivoire">Hoplite</span> à{" "}
          <span className="text-or-500">Dieu de l&apos;Olympe</span>.
        </p>

        {connecte ? (
          <Link
            href={session!.user.onboarded ? "/dashboard" : "/onboarding"}
            className="mt-10 inline-flex items-center gap-3 rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 text-base font-medium text-or-400 transition hover:bg-or-500/20"
          >
            {session!.user.onboarded ? "Aller au tableau de bord" : "Terminer mon inscription"}
          </Link>
        ) : googleConfigured ? (
          <>
            <form action={connexionGoogle} className="mt-10">
              <input
                type="hidden"
                name="suivant"
                value={typeof suivant === "string" ? suivant : "/dashboard"}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-3 rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 text-base font-medium text-or-400 transition hover:bg-or-500/20"
              >
                <GoogleIcon />
                Se connecter avec Google
              </button>
            </form>
            <p className="mt-4 text-sm text-cendre">Gratuit. Aucune donnée revendue.</p>
          </>
        ) : (
          <div className="surface mt-10 max-w-md p-5 text-left">
            <p className="text-sm font-medium text-or-400">Connexion Google non configurée</p>
            <p className="mt-2 text-sm leading-relaxed text-brume">
              Renseigne <code className="text-ivoire">AUTH_GOOGLE_ID</code> et{" "}
              <code className="text-ivoire">AUTH_GOOGLE_SECRET</code> dans le fichier{" "}
              <code className="text-ivoire">.env</code>, puis redémarre le serveur. La marche à
              suivre est dans la section « Connexion Google » du README.
            </p>
          </div>
        )}
      </section>

      {/* --- Comment ça marche --- */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {ETAPES.map((etape, i) => (
            <div
              key={etape.titre}
              className="surface p-5 transition-colors hover:border-or-600/50 motion-safe:monte"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="font-display text-2xl text-or-600">{ROMAIN[i]}</span>
              <h3 className="mt-2 text-base font-semibold text-ivoire">{etape.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brume">{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- L'échelle des rangs --- */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="mx-auto max-w-xs">
          <SeparateurLosange />
        </div>
        <h2 className="mt-8 text-center text-2xl font-semibold text-ivoire sm:text-3xl">
          Huit rangs à gravir
        </h2>
        <p className="mt-3 text-center text-sm text-brume">
          Du fantassin anonyme au sommet de l&apos;Olympe.
        </p>

        <ul className="mt-12 flex flex-col gap-6">
          {RANKS.map((rang, i) => (
            <li
              key={rang.slug}
              className="group flex items-center gap-5 motion-safe:monte sm:gap-8"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="relative shrink-0">
                <span
                  aria-hidden
                  className="absolute inset-2 rounded-full opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-60"
                  style={{ backgroundColor: rang.color }}
                />
                <Image
                  src={rang.logo}
                  alt=""
                  width={96}
                  height={96}
                  className="relative size-16 transition-transform duration-500 group-hover:scale-105 sm:size-24"
                />
              </div>
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
