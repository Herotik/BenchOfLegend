import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { RANKS } from "@/lib/ranks";
import { auth } from "@/auth";
import { fournisseursActifs } from "@/lib/fournisseurs";
import { connexion } from "@/app/actions/auth";
import { Meandre, SeparateurLosange } from "@/components/ornements/Meandre";

/** Chiffres romains : l'app compte comme la planche de rangs, pas comme un tableur. */
const ROMAIN = ["I", "II", "III"];

/**
 * Échecs de connexion renvoyés par Auth.js sur `pages.error`, traduits.
 *
 * Sans cette table, l'utilisateur retombe sur la page d'accueil avec un
 * `?error=AccessDenied` dans la barre d'adresse et aucune explication — le pire
 * des cas quand il n'y a pas de mot de passe pour retenter autrement.
 */
const ERREURS: Record<string, string> = {
  AccessDenied:
    "Connexion refusée : ce compte n'a pas d'adresse e-mail vérifiée chez le fournisseur choisi. Vérifie ton adresse chez lui, ou entre par un autre.",
  OAuthAccountNotLinked:
    "Cette adresse est déjà rattachée à une autre façon de se connecter. Reprends celle que tu avais utilisée la première fois.",
  Configuration:
    "La connexion n'est pas configurée correctement côté serveur. Rien à faire de ton côté.",
  Verification: "Ce lien de connexion a expiré. Recommence.",
};

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
    titre: "Chaque séance validée rapporte des Δ",
    texte:
      "Séries, répétitions et temps de repos affichés. Tu coches, tu montes. Aucun Δ ne se perd jamais.",
  },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  // Accessible même connecté : c'est la seule page qui présente l'échelle des
  // rangs en entier. On remplace simplement le bouton de connexion par un
  // accès direct au tableau de bord.
  const session = await auth();
  const connecte = Boolean(session?.user);

  const { suivant, error } = await searchParams;
  const fournisseurs = fournisseursActifs();
  const messageErreur =
    typeof error === "string"
      ? (ERREURS[error] ?? "La connexion a échoué. Réessaie, ou passe par un autre fournisseur.")
      : null;

  return (
    <main className="flex-1">
      {/* --- Hero --- */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28">
        <p className="font-display text-xs tracking-[0.35em] text-accent uppercase motion-safe:apparait">
          Entraînement classé
        </p>
        <h1 className="mt-5 text-5xl font-bold text-texte sm:text-7xl motion-safe:apparait">
          Frame of Legends
        </h1>
        <div className="mt-5 w-40 text-accent motion-safe:apparait">
          <Meandre opacite={0.5} />
        </div>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-texte-2">
          Ton programme de musculation, construit chaque semaine à partir de ton matériel et de
          tes objectifs. Tu valides tes séances, tu gagnes des Δ, tu grimpes d&apos;
          <span className="text-texte">Hoplite</span> à{" "}
          <span className="text-accent">Dieu de l&apos;Olympe</span>.
        </p>

        {connecte ? (
          <Link
            href={session!.user.onboarded ? "/dashboard" : "/onboarding"}
            className="mt-10 inline-flex items-center gap-3 rounded-lg border border-accent/60 bg-accent/10 px-6 py-3 text-base font-medium text-accent transition hover:bg-accent/20"
          >
            {session!.user.onboarded ? "Aller au tableau de bord" : "Terminer mon inscription"}
          </Link>
        ) : fournisseurs.length > 0 ? (
          <>
            {messageErreur ? (
              <div className="surface mt-10 max-w-md border-accent/50 p-4 text-left">
                <p className="text-sm leading-relaxed text-accent">{messageErreur}</p>
              </div>
            ) : null}

            {/* Un formulaire par fournisseur : chacun poste sa propre valeur, et
                l'action serveur ne retient que celles réellement configurées. */}
            <div className="mt-10 flex flex-col items-center gap-3">
              {fournisseurs.map((fournisseur) => (
                <form key={fournisseur.id} action={connexion}>
                  <input type="hidden" name="fournisseur" value={fournisseur.id} />
                  <input
                    type="hidden"
                    name="suivant"
                    value={typeof suivant === "string" ? suivant : "/dashboard"}
                  />
                  <button
                    type="submit"
                    className="inline-flex w-72 items-center justify-center gap-3 rounded-lg border border-accent/60 bg-accent/10 px-6 py-3 text-base font-medium text-accent transition hover:bg-accent/20"
                  >
                    {ICONES[fournisseur.id]}
                    Se connecter avec {fournisseur.nom}
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-4 text-sm text-texte-3">Gratuit. Aucune donnée revendue.</p>
            {fournisseurs.length > 1 ? (
              <p className="mt-1 text-sm text-texte-3">
                Même adresse e-mail, même compte — quelle que soit la porte d&apos;entrée.
              </p>
            ) : null}
          </>
        ) : (
          <div className="surface mt-10 max-w-md p-5 text-left">
            <p className="text-sm font-medium text-accent">Aucune connexion configurée</p>
            <p className="mt-2 text-sm leading-relaxed text-texte-2">
              Renseigne au moins un fournisseur — <code className="text-texte">AUTH_GOOGLE_ID</code>{" "}
              et <code className="text-texte">AUTH_GOOGLE_SECRET</code>, par exemple — dans le
              fichier <code className="text-texte">.env</code>, puis redémarre le serveur. Une
              variable créée sans valeur compte pour absente. La marche à suivre est dans la
              section « Connexion » du README.
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
              className="surface p-5 transition-colors hover:border-accent/50 motion-safe:monte"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="font-display text-2xl text-accent">{ROMAIN[i]}</span>
              <h3 className="mt-2 text-base font-semibold text-texte">{etape.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-texte-2">{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- L'échelle des rangs --- */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="mx-auto max-w-xs">
          <SeparateurLosange />
        </div>
        <h2 className="mt-8 text-center text-2xl font-semibold text-texte sm:text-3xl">
          Huit rangs à gravir
        </h2>
        <p className="mt-3 text-center text-sm text-texte-2">
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
                  <span className="text-xs text-texte-3">{rang.metal}</span>
                </div>
                <p className="mt-0.5 text-sm tracking-wide text-texte-2 uppercase">
                  {rang.subtitle}
                </p>
                <p className="mt-1 text-sm text-texte-3">{rang.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-filet/60 px-6 py-8 text-center text-xs text-texte-3">
        Frame of Legends ne remplace pas un avis médical.
      </footer>
    </main>
  );
}

/**
 * Marques des fournisseurs.
 *
 * Apple et Discord sont dessinés en `currentColor` — leurs chartes imposent le
 * noir ou le violet sur fond clair, ce que le thème hextech ne peut pas tenir.
 * Google garde ses quatre couleurs, sa marque n'existant pas autrement.
 */
const ICONES: Record<string, ReactNode> = {
  google: <GoogleIcon />,
  apple: <AppleIcon />,
  discord: <DiscordIcon />,
};

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M17.05 12.5c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.31-3.5ZM14.9 5.6c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.5 2.58-1.23Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M19.54 5.34A16.1 16.1 0 0 0 15.5 4.1l-.2.37c1.34.33 2.44.87 3.47 1.54a12.7 12.7 0 0 0-4.28-1.36 13.6 13.6 0 0 0-4.99 0A12.7 12.7 0 0 0 5.22 6c1.03-.67 2.13-1.2 3.47-1.54l-.2-.37c-1.4.24-2.75.66-4.03 1.25C2.02 9.06 1.32 12.66 1.67 16.2a16.3 16.3 0 0 0 4.95 2.5l.4-.55c-.79-.3-1.53-.66-2.2-1.1l.55-.42c2.15.99 4.47 1.5 6.63 1.5s4.48-.51 6.63-1.5l.55.42c-.67.44-1.41.8-2.2 1.1l.4.55a16.3 16.3 0 0 0 4.95-2.5c.42-4.1-.7-7.67-2.79-10.86ZM8.52 14.25c-.97 0-1.77-.89-1.77-1.98 0-1.1.78-1.99 1.77-1.99s1.79.9 1.77 1.99c0 1.1-.79 1.98-1.77 1.98Zm6.96 0c-.97 0-1.77-.89-1.77-1.98 0-1.1.78-1.99 1.77-1.99s1.78.9 1.77 1.99c0 1.1-.78 1.98-1.77 1.98Z" />
    </svg>
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
