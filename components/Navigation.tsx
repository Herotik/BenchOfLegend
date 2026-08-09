"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION, type IconeNav } from "@/lib/navigation";

/**
 * Mobile-first : barre fixe en bas sur téléphone — l'app est utilisée pendant
 * la séance, le pouce n'atteint pas le haut de l'écran — et colonne latérale
 * à partir du desktop.
 */
export function Navigation() {
  const chemin = usePathname();
  const actif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-nuit-700/70 bg-nuit-950/95 backdrop-blur sm:hidden"
      >
        <ul className="flex">
          {NAVIGATION.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={actif(item.href) ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition ${
                  actif(item.href) ? "text-or-400" : "text-cendre"
                }`}
              >
                <Icone nom={item.icone} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav
        aria-label="Navigation principale"
        className="fixed top-0 left-0 z-40 hidden h-full w-56 flex-col border-r border-nuit-700/70 px-4 py-8 sm:flex"
      >
        <Link
          href="/"
          className="font-display px-3 text-lg font-bold text-ivoire transition hover:text-or-400"
        >
          La Faille
        </Link>
        <ul className="mt-8 flex flex-col gap-1">
          {NAVIGATION.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={actif(item.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  actif(item.href)
                    ? "bg-or-500/10 text-or-400"
                    : "text-brume hover:text-ivoire"
                }`}
              >
                <Icone nom={item.icone} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function Icone({ nom }: { nom: IconeNav }) {
  const commun = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (nom) {
    case "flamme":
      return (
        <svg {...commun}>
          <path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1.5.6-2.7 1.5-3.8.4 1 1 1.6 1.8 1.9C10 8 11 5.5 12 3Z" />
        </svg>
      );
    case "calendrier":
      return (
        <svg {...commun}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "courbe":
      return (
        <svg {...commun}>
          <path d="M4 19V5M4 19h16M7 15l3.5-4 3 2.5L18 8" />
        </svg>
      );
    case "liste":
      return (
        <svg {...commun}>
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case "reglages":
      return (
        <svg {...commun}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9.4a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
        </svg>
      );
  }
}
