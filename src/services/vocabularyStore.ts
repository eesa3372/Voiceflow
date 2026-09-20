import { VocabularyItem } from "../types";

export const DEFAULT_VOCABULARY: VocabularyItem[] = [
  {
    id: "vocab-1",
    term: "LiHMDS",
    alternatives: ["L-I-H-M-D-S", "lihmds", "Li H M D S", "lithium hexamethyldisilazide"],
    category: "chemistry",
  },
  {
    id: "vocab-2",
    term: "DIBAL-H",
    alternatives: ["dibal h", "die ball h", "dibal-h", "diisobutylaluminium hydride"],
    category: "chemistry",
  },
  {
    id: "vocab-3",
    term: "Suzuki coupling",
    alternatives: ["suzuki cross coupling", "suzuki reaction"],
    category: "chemistry",
  },
  {
    id: "vocab-4",
    term: "Buchwald-Hartwig",
    alternatives: ["buchwald hartwig amination", "buchwald hartwig"],
    category: "chemistry",
  },
  {
    id: "vocab-5",
    term: "LC-MS",
    alternatives: ["L C M S", "lcms", "liquid chromatography mass spectrometry"],
    category: "chemistry",
  },
  {
    id: "vocab-6",
    term: "HPLC",
    alternatives: ["H P L C", "hplc", "high performance liquid chromatography"],
    category: "chemistry",
  },
  {
    id: "vocab-7",
    term: "NMR",
    alternatives: ["N M R", "nuclear magnetic resonance"],
    category: "chemistry",
  },
  {
    id: "vocab-8",
    term: "RDKit",
    alternatives: ["rd kit", "R D kit", "rdkit"],
    category: "software",
  },
  {
    id: "vocab-9",
    term: "ChemDraw",
    alternatives: ["chem draw", "chemdraw"],
    category: "software",
  },
  {
    id: "vocab-10",
    term: "AutoDock Vina",
    alternatives: ["autodock vina", "auto dock vina"],
    category: "software",
  },
];

const STORAGE_KEY = "voiceflow_custom_vocabulary_v1";

export async function fetchVocabulary(): Promise<VocabularyItem[]> {
  try {
    const res = await fetch("/api/vocabulary");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.items));
        return data.items;
      }
    }
  } catch (err) {
    console.warn("Could not fetch vocabulary from server, using local fallback", err);
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  return DEFAULT_VOCABULARY;
}

export async function saveVocabularyTerm(item: Omit<VocabularyItem, "id">): Promise<VocabularyItem> {
  try {
    const res = await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const data = await res.json();
      return data.item;
    }
  } catch (err) {
    console.warn("Server save failed, saving to local store", err);
  }

  const newItem: VocabularyItem = {
    ...item,
    id: `vocab-${Date.now()}`,
  };

  const existing = await fetchVocabulary();
  const updated = [...existing, newItem];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newItem;
}

export async function deleteVocabularyTerm(id: string): Promise<void> {
  try {
    await fetch(`/api/vocabulary/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("Server delete failed, updating local store", err);
  }

  const existing = await fetchVocabulary();
  const updated = existing.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Apply vocabulary replacements client-side
 */
export function applyLocalVocabulary(text: string, vocab: VocabularyItem[]): string {
  let result = text;
  const substitutions: Array<{ pattern: string; target: string }> = [];

  for (const item of vocab) {
    for (const alt of item.alternatives) {
      if (alt.trim()) {
        substitutions.push({ pattern: alt.trim(), target: item.term });
      }
    }
    substitutions.push({ pattern: item.term, target: item.term });
  }

  substitutions.sort((a, b) => b.pattern.length - a.pattern.length);

  for (const sub of substitutions) {
    const escaped = sub.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-zA-Z0-9_-])(${escaped})($|[^a-zA-Z0-9_-])`, "gi");
    result = result.replace(regex, (_match, prefix, _captured, suffix) => {
      return prefix + sub.target + suffix;
    });
  }
  return result;
}
