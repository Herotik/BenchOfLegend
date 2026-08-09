import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests d'intégration : ils parlent à une vraie base PostgreSQL.
 *
 * Configuration séparée de `vitest.config.mts` pour que `npm test` reste une
 * suite unitaire rapide, sans base ni migration. Les deux ne partagent que
 * l'alias `@`.
 */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],

    // Une seule base pour toute la suite, et chaque fichier la vide entre ses
    // tests : les laisser tourner en parallèle les ferait se marcher dessus.
    fileParallelism: false,

    // Filet de sécurité : même si quelqu'un lance cette config sans passer par
    // le script npm, jamais la base de développement.
    env: {
      DATABASE_URL: "postgresql://lafaille:lafaille@localhost:5433/lafaille_test?schema=public",
      // Les tests d'API signent de vrais jetons d'accès plutôt que de mocker
      // la garde : sans secret, `lib/api/jetons.ts` refuse de signer.
      AUTH_SECRET: "secret-de-test-la-faille-jamais-deploye",
    },

    testTimeout: 20_000,
    // Le globalSetup applique le schéma puis charge 147 exercices.
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      // Même alias que tsconfig.json.
      "@": import.meta.dirname,
      // `server-only` lève une exception dès qu'il est importé hors contexte
      // React Server. On le neutralise avec le module vide que le paquet
      // fournit lui-même pour cet usage.
      "server-only": path.join(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
});
