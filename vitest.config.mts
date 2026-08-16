import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `mobile/src` n'y figure que pour les modules **purs** de l'app — ceux
    // qui portent une décision sans toucher à React Native, et qu'on peut donc
    // éprouver sans monter d'émulateur. Le reste de `mobile/` reste hors de
    // portée de cette suite, faute d'un environnement pour l'exécuter.
    include: ["lib/**/*.test.ts", "mobile/src/**/*.test.ts"],
  },
  resolve: {
    // Même alias que tsconfig.json, pour que les modules du moteur résolvent
    // `@/lib/...` en test comme à l'exécution.
    alias: { "@": import.meta.dirname },
  },
});
