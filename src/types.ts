export type DictationStatus = "ready" | "listening" | "processing" | "done" | "error";

export type DictationMode = "push-to-talk" | "toggle";

export type SpeechProviderType = "cloud" | "local" | "auto";

export interface VocabularyItem {
  id: string;
  term: string;
  alternatives: string[];
  category: "chemistry" | "software" | "general" | "hardware";
}

export interface HotkeyConfig {
  key: string; // e.g. "Space"
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface DictationSession {
  id: string;
  timestamp: number;
  rawTranscript: string;
  finalText: string;
  durationSeconds: number;
  wordCount: number;
  targetApp: string;
  injectionMethod: string;
}

export interface PrivacyMetrics {
  microphoneActive: boolean;
  currentlyRecording: boolean;
  audioUploaded: boolean;
  transcriptPersisted: boolean;
  telemetryTrackers: number;
}
