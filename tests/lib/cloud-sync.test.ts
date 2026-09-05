import { describe, expect, it } from "vitest";

import { isSyncConflict } from "@/lib/cloud-sync";

// ============================================================================
// A szinkron-ütközés detektálásának regressziós tesztje. Az isSyncConflict()
// szándékosan tiszta függvény (lásd lib/cloud-sync.ts), hogy Firestore/store
// bekötése nélkül, önmagában tesztelhető legyen — itt a négy lehetséges
// eset mindegyikét lefedjük.
// ============================================================================

describe("isSyncConflict", () => {
  it("nem ütközés, ha a helyi állapot 'tiszta' (nincs el nem küldött módosítás), és a távoli más", () => {
    // hasUnsavedLocalChanges = false -> sosem ütközés, függetlenül a
    // távoli tartalomtól (ez a normál, konfliktusmentes távoli frissítés).
    expect(
      isSyncConflict({
        remoteJson: '{"a":2}',
        localJson: '{"a":1}',
        lastSyncedJson: '{"a":1}',
      })
    ).toBe(false);
  });

  it("nem ütközés, ha van el nem küldött helyi módosítás, de a távoli VÉLETLENÜL megegyezik vele", () => {
    // hasUnsavedLocalChanges = true, de remoteDiffersFromLocal = false.
    expect(
      isSyncConflict({
        remoteJson: '{"a":2}',
        localJson: '{"a":2}',
        lastSyncedJson: '{"a":1}',
      })
    ).toBe(false);
  });

  it("ÜTKÖZÉS: van el nem küldött helyi módosítás, ÉS a távoli állapot más, mint a helyi", () => {
    expect(
      isSyncConflict({
        remoteJson: '{"a":3}',
        localJson: '{"a":2}',
        lastSyncedJson: '{"a":1}',
      })
    ).toBe(true);
  });

  it("nem ütközés, ha semmi nem változott sehol (mindhárom megegyezik)", () => {
    expect(
      isSyncConflict({
        remoteJson: '{"a":1}',
        localJson: '{"a":1}',
        lastSyncedJson: '{"a":1}',
      })
    ).toBe(false);
  });
});
