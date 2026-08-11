import type { Metadata, Viewport } from "next";
import { Manrope, Cinzel } from "next/font/google";
import { EnregistrerServiceWorker } from "@/components/EnregistrerServiceWorker";
import { SCRIPT_THEME } from "@/components/Theme";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Cinzel : capitales gravées, dérivées des inscriptions romaines. C'est la
// lettre du logotype et des chiffres de donnée.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Frame of Legends",
  description:
    "La différence se fait chez toi. Ton programme de musculation hebdomadaire, tes séances validées, et une progression d'Hoplite à Dieu de l'Olympe.",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "Frame of Legends",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Suit le thème choisi, pour que la barre système de l'app installée
  // s'accorde au fond plutôt que de trancher dessus.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1c1e" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${manrope.variable} ${cinzel.variable} h-full`}>
      <head>
        {/* Avant tout rendu : sans ça, qui a choisi le sombre verrait un
            éclair de marbre à chaque chargement. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:border focus:border-filet focus:bg-fond-2 focus:px-4 focus:py-2 focus:text-sm focus:text-texte"
        >
          Aller au contenu
        </a>
        {children}
        <EnregistrerServiceWorker />
      </body>
    </html>
  );
}
