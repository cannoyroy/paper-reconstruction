import { openDB, type DBSchema } from "idb";
import type { AnyAnalysis as AnalysisBundle } from "../core/workbench";
import {
  assertAnyConflict as assertNoVersionConflict,
  checkAnyRevision as checkRevision,
} from "../core/workbench";
import { AnalysisConflictError } from "../core/validate";

export type ReadingState = {
  pathId: string;
  nodeId: string | null;
  blockId: string | null;
  scrollY: number;
  collection?: {
    view: string;
    paperFilter: string;
    clusterFilter: string;
    relationFilter: string;
    target: {
      kind: "node" | "relation" | "block" | "paper";
      id: string;
    } | null;
  };
};
export type SavedAnalysis = {
  key: string;
  bundle: AnalysisBundle;
  origin: "example" | "imported";
  savedAt: number;
};
interface WorkbenchDB extends DBSchema {
  analyses: { key: string; value: SavedAnalysis };
  reading: { key: string; value: ReadingState };
  preferences: { key: string; value: string };
}
export const bundleKey = (b: AnalysisBundle) =>
  `${b.analysis_id}@${b.analysis_version}`;
const db = () =>
  openDB<WorkbenchDB>("paper-reconstruction-v1", 1, {
    upgrade(d) {
      d.createObjectStore("analyses");
      d.createObjectStore("reading");
      d.createObjectStore("preferences");
    },
  });
export async function listSaved(): Promise<SavedAnalysis[]> {
  const d = await db();
  try {
    return (await d.getAll("analyses")).sort((a, b) => b.savedAt - a.savedAt);
  } finally {
    d.close();
  }
}
export async function saveAnalysis(
  bundle: AnalysisBundle,
  origin: SavedAnalysis["origin"],
): Promise<void> {
  const d = await db();
  try {
    const tx = d.transaction("analyses", "readwrite"),
      key = bundleKey(bundle);
    try {
      const existing = await tx.store.get(key);
      if (existing) assertNoVersionConflict(existing.bundle, bundle);
      const previous = await tx.store.get(
        `${bundle.analysis_id}@${bundle.analysis_version - 1}`,
      );
      if (previous) {
        const errors = checkRevision(previous.bundle, bundle);
        if (errors.length) throw new AnalysisConflictError(errors.join("；"));
      }
      // Also protect the relationship when an older version is imported after its successor.
      const successor = await tx.store.get(
        `${bundle.analysis_id}@${bundle.analysis_version + 1}`,
      );
      if (successor) {
        const errors = checkRevision(bundle, successor.bundle);
        if (errors.length) throw new AnalysisConflictError(errors.join("；"));
      }
      await tx.store.put(
        {
          key,
          bundle,
          origin: existing?.origin ?? origin,
          savedAt: Date.now(),
        },
        key,
      );
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* transaction may already be inactive */
      }
      await tx.done.catch(() => {});
      throw error;
    }
  } finally {
    d.close();
  }
}
export async function loadReading(key: string) {
  const d = await db();
  try {
    return await d.get("reading", key);
  } finally {
    d.close();
  }
}
export async function saveReading(key: string, state: ReadingState) {
  const d = await db();
  try {
    await d.put("reading", state, key);
  } finally {
    d.close();
  }
}
export async function loadLast() {
  const d = await db();
  try {
    return await d.get("preferences", "last");
  } finally {
    d.close();
  }
}
export async function saveLast(key: string) {
  const d = await db();
  try {
    await d.put("preferences", key, "last");
  } finally {
    d.close();
  }
}
export async function deleteSaved(key: string) {
  const d = await db();
  try {
    const t = d.transaction(
      ["analyses", "reading", "preferences"],
      "readwrite",
    );
    await t.objectStore("analyses").delete(key);
    await t.objectStore("reading").delete(key);
    if ((await t.objectStore("preferences").get("last")) === key)
      await t.objectStore("preferences").delete("last");
    await t.done;
  } finally {
    d.close();
  }
}
