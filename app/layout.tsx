import type { Metadata, Viewport } from "next";
import { Inter, Cinzel } from "next/font/google";
import { EnregistrerServiceWorker } from "@/components/EnregistrerServiceWorker";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Sérif « épigraphique » : c'est la lettre de la planche de rangs.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "La Faille — entraînement classé",
  description:
    "Suivi d'entraînement gamifié : un programme hebdomadaire sur mesure, des séances qui rapportent des LP, et une progression d'Hoplite à Dieu de l'Olympe.",
  // iOS ne lit pas le manifeste : sans ce lien explicite, l'icône d'écran
  // d'accueil serait une capture de la page.
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "La Faille", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#05080d",
  width: "device-width",
  initialScale: 1,
  // L'app est utilisée en salle : on évite le zoom accidentel sur un double
  // appui, sans pour autant l'interdire (maximumScale reste absent).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-nuit-800 focus:px-4 focus:py-2 focus:text-sm focus:text-ivoire"
        >
          Aller au contenu
        </a>
        {children}
        <EnregistrerServiceWorker />
      </body>
    </html>
  );
}
