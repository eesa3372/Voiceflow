import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Allow large audio payload for chunked / long-form dictation
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy initialize Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// In-memory vocabulary store (pre-seeded with chemistry, biotech, and software terminology)
interface VocabularyItem {
  id: string;
  term: string;
  alternatives: string[];
  category: "chemistry" | "software" | "general" | "hardware";
}

let customVocabulary: VocabularyItem[] = [
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

/**
 * Apply local dictionary replacements deterministically before/after model cleaning
 */
function applyVocabularyReplacements(text: string, vocabulary: VocabularyItem[]): string {
  let result = text;
  // Collect all substitutions sorted by target phrase length descending
  const substitutions: Array<{ pattern: string; target: string }> = [];

  for (const item of vocabulary) {
    for (const alt of item.alternatives) {
      if (alt.trim()) {
        substitutions.push({ pattern: alt.trim(), target: item.term });
      }
    }
    substitutions.push({ pattern: item.term, target: item.term });
  }

  // Sort by length descending to match longer compounds like "Suzuki cross coupling" before "Suzuki"
  substitutions.sort((a, b) => b.pattern.length - a.pattern.length);

  for (const sub of substitutions) {
    const escaped = sub.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Boundary matching allowing hyphens in chemical names
    const regex = new RegExp(`(^|[^a-zA-Z0-9_-])(${escaped})($|[^a-zA-Z0-9_-])`, "gi");
    result = result.replace(regex, (_match, prefix, _captured, suffix) => {
      return prefix + sub.target + suffix;
    });
  }
  return result;
}

// ================= API ROUTES =================

// Health and capability check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    appName: "VoiceFlow",
    version: "1.0.0",
    target: "Windows 11 x64",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    activeArchitecture: {
      globalHotkey: "Win32 RegisterHotKey / WH_KEYBOARD_LL hook",
      textInjection: "Win32 SendInput (Unicode) + Arboard Clipboard Fallback",
      speechEngine: "Provider Abstraction (Cloud / Local Whisper / WebSpeech)",
      runtime: "Tauri v2 + Rust + WebView2",
    },
  });
});

// Manage custom vocabulary
app.get("/api/vocabulary", (_req, res) => {
  res.json({ items: customVocabulary });
});

app.post("/api/vocabulary", (req, res) => {
  const { term, alternatives, category } = req.body;
  if (!term || typeof term !== "string") {
    res.status(400).json({ error: "Term string is required" });
    return;
  }
  const newItem: VocabularyItem = {
    id: `vocab-${Date.now()}`,
    term: term.trim(),
    alternatives: Array.isArray(alternatives)
      ? alternatives.map((a: string) => a.trim()).filter(Boolean)
      : [],
    category: category || "general",
  };
  customVocabulary.push(newItem);
  res.status(201).json({ item: newItem, items: customVocabulary });
});

app.delete("/api/vocabulary/:id", (req, res) => {
  const { id } = req.params;
  customVocabulary = customVocabulary.filter((v) => v.id !== id);
  res.json({ success: true, items: customVocabulary });
});

// Direct Audio Transcription route (using standard multimodal Gemini 2.5 Flash)
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audioData, mimeType = "audio/webm" } = req.body;
    if (!audioData) {
      res.status(400).json({ error: "No audio data provided" });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      res.status(503).json({
        error: "GEMINI_API_KEY is not configured. Falling back to local/web speech recognition.",
      });
      return;
    }

    // Strip header if data URL format
    const base64Data = audioData.includes(",")
      ? audioData.split(",")[1]
      : audioData;

    const audioPart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          audioPart,
          {
            text: "Transcribe the spoken audio verbatim. Do not add commentary, prefixes, or conversational filler.",
          },
        ],
      });
    } catch {
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          audioPart,
          {
            text: "Transcribe the spoken audio verbatim. Do not add commentary, prefixes, or conversational filler.",
          },
        ],
      });
    }

    const rawTranscript = response.text?.trim() || "";
    res.json({ rawTranscript });
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.status(500).json({
      error: error?.message || "Audio transcription failed",
    });
  }
});

// Punctuation, Capitalization, and Grammar Cleanup Engine
app.post("/api/clean-grammar", async (req, res) => {
  try {
    const { rawText, customTerms } = req.body;
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      res.json({ cleanedText: "" });
      return;
    }

    const vocabToUse = Array.isArray(customTerms) ? customTerms : customVocabulary;

    // Apply pre-pass dictionary substitution
    const preProcessed = applyVocabularyReplacements(rawText.trim(), vocabToUse);

    const ai = getGenAI();
    if (!ai) {
      // Offline fallback: rule-based capitalization and punctuation
      let simpleClean = preProcessed;
      // Capitalize first character
      simpleClean = simpleClean.charAt(0).toUpperCase() + simpleClean.slice(1);
      // Append period if missing
      if (!/[.?!]$/.test(simpleClean)) {
        simpleClean += ".";
      }
      res.json({
        cleanedText: simpleClean,
        mode: "offline-rule-based",
      });
      return;
    }

    // Prepare dictionary prompt list
    const vocabTermsList = vocabToUse.map((v: VocabularyItem) => v.term).join(", ");

    const prompt = `Raw speech transcript:
"${preProcessed}"

Clean this transcript by adding appropriate capitalization, punctuation, and natural sentence formatting according to the system instructions.`;

    const systemInstruction = `You are the VoiceFlow Windows 11 Voice Dictation Grammar and Punctuation Engine.
Your task is to accurately add punctuation (periods, commas, question marks, colons, semicolons), proper capitalization, and natural sentence boundaries to raw speech transcription.

ABSOLUTE CRITICAL RULES:
1. STRICTLY PRESERVE USER MEANING. This is dictation, NOT a chatbot, editor, or creative writing tool.
2. DO NOT summarize, embellish, reword, or add any new ideas or text.
3. DO NOT output introductory phrases like "Here is your text:" or quotes around the result. Output ONLY the clean dictated text.
4. PRESERVE TECHNICAL VOCABULARY AND EXACT CASING:
   Preserve terms such as: ${vocabTermsList}.
   Do NOT change technical jargon into common English words (e.g. keep "LiHMDS", "DIBAL-H", "Suzuki coupling", "NMR", "HPLC", "LC-MS", "RDKit", "ChemDraw", "AutoDock Vina").
5. PRESERVE numbers, dates, acronyms, code snippets, file paths, and mathematical or chemical symbols as intended by the user.
6. When uncertain, PREFER the user's literal transcription rather than guessing.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      });
    } catch {
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      });
    }

    let cleaned = response.text?.trim() || preProcessed;
    // Strip accidental wrapping quotes if generated
    if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    // Post-pass dictionary replacement to ensure zero degradation of technical terms
    const finalCleaned = applyVocabularyReplacements(cleaned, vocabToUse);

    res.json({
      cleanedText: finalCleaned,
      rawText,
      mode: "gemini-cleaner",
    });
  } catch (error: any) {
    console.error("Grammar cleaning error:", error?.message || error);
    const vocabToUse = Array.isArray(req.body.customTerms) ? req.body.customTerms : customVocabulary;
    let fallback = applyVocabularyReplacements((req.body.rawText || "").trim(), vocabToUse);
    if (fallback) {
      fallback = fallback.charAt(0).toUpperCase() + fallback.slice(1);
      if (!/[.?!]$/.test(fallback)) {
        fallback += ".";
      }
    }
    res.json({
      cleanedText: fallback,
      rawText: req.body.rawText || "",
      mode: "rule-based-fallback",
      errorDetails: error?.message || "Model request error",
    });
  }
});

// Combined Dictate Pipeline: Audio -> Transcript -> Vocabulary & Grammar Cleaning
app.post("/api/dictate", async (req, res) => {
  try {
    const { audioData, rawTranscriptText, customTerms } = req.body;
    let textToProcess = rawTranscriptText || "";

    // If raw audio provided, transcribe first
    if (!textToProcess && audioData) {
      const ai = getGenAI();
      if (ai) {
        const base64Data = audioData.includes(",")
          ? audioData.split(",")[1]
          : audioData;

        let response;
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: base64Data,
                },
              },
              {
                text: "Transcribe the spoken audio verbatim. Do not add commentary.",
              },
            ],
          });
        } catch {
          response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: base64Data,
                },
              },
              {
                text: "Transcribe the spoken audio verbatim. Do not add commentary.",
              },
            ],
          });
        }
        textToProcess = response.text?.trim() || "";
      }
    }

    if (!textToProcess) {
      res.json({
        rawTranscript: "",
        finalText: "",
        charCount: 0,
        wordCount: 0,
      });
      return;
    }

    const vocabToUse = Array.isArray(customTerms) ? customTerms : customVocabulary;
    const preProcessed = applyVocabularyReplacements(textToProcess, vocabToUse);

    const ai = getGenAI();
    let finalCleaned = preProcessed;

    if (ai) {
      const vocabTermsList = vocabToUse.map((v: VocabularyItem) => v.term).join(", ");
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Raw speech: "${preProcessed}"\nClean this for immediate Windows text insertion with punctuation and capitalization:`,
          config: {
            systemInstruction: `You are the VoiceFlow Windows 11 text dictation cleaner. Add punctuation, capitalization, and paragraphing without changing any meaning. Never summarize or omit words. Strictly preserve technical terms like ${vocabTermsList}. Output ONLY the cleaned text.`,
            temperature: 0.1,
          },
        });
      } catch {
        response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: `Raw speech: "${preProcessed}"\nClean this for immediate Windows text insertion with punctuation and capitalization:`,
          config: {
            systemInstruction: `You are the VoiceFlow Windows 11 text dictation cleaner. Add punctuation, capitalization, and paragraphing without changing any meaning. Never summarize or omit words. Strictly preserve technical terms like ${vocabTermsList}. Output ONLY the cleaned text.`,
            temperature: 0.1,
          },
        });
      }
      let result = response.text?.trim() || preProcessed;
      if (result.startsWith('"') && result.endsWith('"') && result.length > 2) {
        result = result.slice(1, -1).trim();
      }
      finalCleaned = applyVocabularyReplacements(result, vocabToUse);
    } else {
      finalCleaned = preProcessed.charAt(0).toUpperCase() + preProcessed.slice(1);
      if (!/[.?!]$/.test(finalCleaned)) finalCleaned += ".";
    }

    const words = finalCleaned.split(/\s+/).filter(Boolean).length;

    res.json({
      rawTranscript: textToProcess,
      finalText: finalCleaned,
      charCount: finalCleaned.length,
      wordCount: words,
      status: "ready_for_injection",
    });
  } catch (error: any) {
    console.error("Dictate pipeline error:", error);
    const vocabToUse = Array.isArray(req.body.customTerms) ? req.body.customTerms : customVocabulary;
    let fallback = applyVocabularyReplacements((req.body.rawTranscriptText || "").trim(), vocabToUse);
    if (fallback) {
      fallback = fallback.charAt(0).toUpperCase() + fallback.slice(1);
      if (!/[.?!]$/.test(fallback)) fallback += ".";
    }
    res.json({
      rawTranscript: req.body.rawTranscriptText || "",
      finalText: fallback,
      charCount: fallback.length,
      wordCount: fallback.split(/\s+/).filter(Boolean).length,
      status: "fallback_injection",
      warning: error?.message || "Dictation processed with local rules",
    });
  }
});

// Vite Middleware for development & Static fallback for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VoiceFlow server running on http://localhost:${PORT}`);
  });
}

startServer();
