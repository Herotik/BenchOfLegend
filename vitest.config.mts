import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    // Même alias que tsconfig.json, pour que les modules du moteur résolvent
    // `@/lib/...` en test comme à l'exécution.
    alias: { "@": import.meta.dirname },
  },
});
