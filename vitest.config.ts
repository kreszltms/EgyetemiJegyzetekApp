import { defineConfig } from "vitest/config";
import path from "node:path";

// ============================================================================
// UNINOTES — Vitest konfiguráció
// jsdom környezet kell, mert néhány teszt (lib/store.ts, lib/ics-import.ts)
// böngésző-API-kat használ (localStorage, crypto.randomUUID, File/Blob) —
// ugyanazokat a globálisokat, amikre a store persist middleware-je és az
// .ics import épül. A "@/" alias a tsconfig.json "paths" beállítását
// tükrözi, hogy a tesztek ugyanúgy importálhassanak, mint az app kódja.
// ============================================================================

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/note-attachments.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
