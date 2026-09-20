import React, { useState } from "react";
import {
  X,
  BookOpen,
  Keyboard,
  Cpu,
  Shield,
  Layers,
  Plus,
  Trash2,
  Download,
  Upload,
  Check,
  FileCode,
  ExternalLink,
  Laptop,
} from "lucide-react";
import {
  DictationMode,
  SpeechProviderType,
  VocabularyItem,
  HotkeyConfig,
  PrivacyMetrics,
} from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: DictationMode;
  onModeChange: (mode: DictationMode) => void;
  hotkeyConfig: HotkeyConfig;
  onHotkeyChange: (config: HotkeyConfig) => void;
  speechProvider: SpeechProviderType;
  onSpeechProviderChange: (p: SpeechProviderType) => void;
  vocabulary: VocabularyItem[];
  onAddVocabulary: (term: Omit<VocabularyItem, "id">) => void;
  onDeleteVocabulary: (id: string) => void;
  privacyMetrics: PrivacyMetrics;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  mode,
  onModeChange,
  hotkeyConfig,
  onHotkeyChange,
  speechProvider,
  onSpeechProviderChange,
  vocabulary,
  onAddVocabulary,
  onDeleteVocabulary,
  privacyMetrics,
}) => {
  const [activeTab, setActiveTab] = useState<
    "vocabulary" | "shortcut" | "provider" | "injection" | "privacy" | "windows"
  >("vocabulary");

  // New term form state
  const [newTerm, setNewTerm] = useState("");
  const [newAlternatives, setNewAlternatives] = useState("");
  const [newCategory, setNewCategory] = useState<"chemistry" | "software" | "general">("chemistry");
  const [copiedScript, setCopiedScript] = useState(false);

  if (!isOpen) return null;

  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;

    const alts = newAlternatives
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    onAddVocabulary({
      term: newTerm.trim(),
      alternatives: alts,
      category: newCategory,
    });

    setNewTerm("");
    setNewAlternatives("");
  };

  const handleExportVocabulary = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vocabulary, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "voiceflow_vocabulary.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      id="modal-settings-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        id="modal-settings-content"
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-zinc-100"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">VoiceFlow Settings</h2>
              <p className="text-[11px] text-zinc-400">Windows 11 Voice Dictation Engine</p>
            </div>
          </div>

          <button
            id="btn-close-settings"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-zinc-800/80 flex space-x-2 text-xs overflow-x-auto">
          {[
            { id: "vocabulary", label: "Custom Dictionary", icon: BookOpen },
            { id: "shortcut", label: "Shortcut & Mode", icon: Keyboard },
            { id: "provider", label: "Speech Engine", icon: Cpu },
            { id: "injection", label: "Text Injection", icon: Layers },
            { id: "privacy", label: "Privacy & Security", icon: Shield },
            { id: "windows", label: "Windows Native App", icon: Laptop },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2.5 px-2 flex items-center space-x-1.5 border-b-2 font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-zinc-300 space-y-6">
          {/* TAB: VOCABULARY */}
          {activeTab === "vocabulary" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">
                  Personal Technical Vocabulary
                </h3>
                <p className="text-zinc-400 text-xs">
                  Prevents specialized terminology (e.g. chemical reagents, scientific models, acronyms)
                  from being misinterpreted as common English words.
                </p>
              </div>

              {/* Add Term Form */}
              <form onSubmit={handleAddTerm} className="bg-zinc-950/60 p-4 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="font-medium text-zinc-200">Add Technical Term</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Canonical Term</label>
                    <input
                      type="text"
                      id="input-vocab-term"
                      placeholder="e.g. LiHMDS or DIBAL-H"
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Phonetic Variations (comma-separated)</label>
                    <input
                      type="text"
                      id="input-vocab-alts"
                      placeholder="e.g. lihmds, L-I-H-M-D-S"
                      value={newAlternatives}
                      onChange={(e) => setNewAlternatives(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] text-zinc-400">Category:</label>
                    <select
                      value={newCategory}
                      onChange={(e: any) => setNewCategory(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200"
                    >
                      <option value="chemistry">Chemistry</option>
                      <option value="software">Software / Code</option>
                      <option value="general">General Science</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    id="btn-add-vocab"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Term</span>
                  </button>
                </div>
              </form>

              {/* Term List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Configured Terms ({vocabulary.length})</span>
                  <button
                    onClick={handleExportVocabulary}
                    className="flex items-center space-x-1 text-zinc-400 hover:text-zinc-200 text-[11px]"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export JSON</span>
                  </button>
                </div>

                <div className="border border-zinc-800 rounded-xl divide-y divide-zinc-800/60 max-h-56 overflow-y-auto">
                  {vocabulary.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-zinc-800/30">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-medium text-zinc-100">{item.term}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                            {item.category}
                          </span>
                        </div>
                        {item.alternatives.length > 0 && (
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            Matches: {item.alternatives.join(", ")}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => onDeleteVocabulary(item.id)}
                        title="Delete term"
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SHORTCUT & MODE */}
          {activeTab === "shortcut" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">Global Hotkey & Activation</h3>
                <p className="text-zinc-400 text-xs">
                  Configures the system-wide shortcut that activates voice dictation across Windows.
                </p>
              </div>

              {/* Dictation Mode Selector */}
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="font-medium text-zinc-200">Dictation Mode</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => onModeChange("push-to-talk")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === "push-to-talk"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-200"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="font-medium flex items-center justify-between">
                      <span>Push-to-talk</span>
                      {mode === "push-to-talk" && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Hold shortcut to speak, release to transcribe and inject.
                    </p>
                  </button>

                  <button
                    onClick={() => onModeChange("toggle")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === "toggle"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-200"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="font-medium flex items-center justify-between">
                      <span>Toggle mode</span>
                      {mode === "toggle" && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Press once to start recording, press again to stop.
                    </p>
                  </button>
                </div>
              </div>

              {/* Shortcut Key Configuration */}
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-zinc-200">Global Activation Shortcut</div>
                  <div className="font-mono bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-lg text-xs text-indigo-300 font-semibold">
                    {hotkeyConfig.ctrl && "Ctrl + "}
                    {hotkeyConfig.alt && "Alt + "}
                    {hotkeyConfig.shift && "Shift + "}
                    {hotkeyConfig.win && "Win + "}
                    {hotkeyConfig.key}
                  </div>
                </div>

                {/* Interactive Modifiers */}
                <div className="space-y-2">
                  <label className="text-[11px] text-zinc-400">Modifier Keys:</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "ctrl" as const, label: "Ctrl" },
                      { key: "alt" as const, label: "Alt" },
                      { key: "shift" as const, label: "Shift" },
                      { key: "win" as const, label: "Windows Key" },
                    ].map((mod) => {
                      const isActive = hotkeyConfig[mod.key];
                      return (
                        <button
                          key={mod.key}
                          type="button"
                          onClick={() =>
                            onHotkeyChange({
                              ...hotkeyConfig,
                              [mod.key]: !isActive,
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                            isActive
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {mod.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Key Selection */}
                <div className="space-y-2">
                  <label className="text-[11px] text-zinc-400">Trigger Key:</label>
                  <select
                    value={hotkeyConfig.key}
                    onChange={(e) =>
                      onHotkeyChange({
                        ...hotkeyConfig,
                        key: e.target.value,
                      })
                    }
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Space">Space</option>
                    <option value="F8">F8</option>
                    <option value="F9">F9</option>
                    <option value="F10">F10</option>
                    <option value="CapsLock">Caps Lock</option>
                    <option value="ScrollLock">Scroll Lock</option>
                  </select>
                </div>

                <div className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-3">
                  In native Windows builds, VoiceFlow binds via Win32 <code className="text-zinc-300">RegisterHotKey</code> and the <code className="text-zinc-300">WH_KEYBOARD_LL</code> low-level keyboard hook, intercepting keydown and keyup events globally even when running in the background.
                </div>
              </div>
            </div>
          )}

          {/* TAB: SPEECH ENGINE */}
          {activeTab === "provider" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">Speech Recognition Provider</h3>
                <p className="text-zinc-400 text-xs">
                  Decoupled architecture supporting Cloud, Local Whisper, and Automatic switching.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    id: "cloud",
                    title: "Cloud Provider (Gemini 3.5 Transcribe + 3.8 Flash)",
                    desc: "High accuracy, instant technical terminology recognition, punctuation and capitalization cleaning via secure backend.",
                    badge: "Active",
                  },
                  {
                    id: "local",
                    title: "Local Whisper-Compatible Model (whisper.cpp / ONNX)",
                    desc: "Runs entirely on your local Windows PC. Zero audio transmitted over the network. Uses local CPU/NPU acceleration.",
                    badge: "Supported",
                  },
                  {
                    id: "auto",
                    title: "Automatic (Hybrid)",
                    desc: "Prefers local speech engine when offline; switches to Cloud when network is active for maximum vocabulary fidelity.",
                    badge: "Smart",
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSpeechProviderChange(item.id as any)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      speechProvider === item.id
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-200"
                        : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-zinc-100">{item.title}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-[11px] mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: TEXT INJECTION */}
          {activeTab === "injection" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">System-Wide Text Insertion</h3>
                <p className="text-zinc-400 text-xs">
                  Methods for injecting typed text directly into whichever Windows application currently has keyboard focus.
                </p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100">Primary: Win32 SendInput (Unicode)</div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Sends synthetic <code className="text-zinc-300">KEYEVENTF_UNICODE</code> input events directly to the foreground window HWND. Works natively in VS Code, Word, Notepad, Chrome, Edge, and Windows Terminal without touching the clipboard.
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-3 flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100">Secondary: Secure Clipboard Fallback</div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      If an application rejects synthetic keystrokes, VoiceFlow captures your current clipboard text, copies the dictated phrase, sends <code className="text-zinc-300">Ctrl + V</code>, and restores your previous clipboard contents after 150ms.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PRIVACY & SECURITY */}
          {activeTab === "privacy" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">Privacy & Security Transparency</h3>
                <p className="text-zinc-400 text-xs">
                  Hardened security architecture. Zero tracking, least privilege, ephemeral memory.
                </p>
              </div>

              {/* Status checklist from Section 14 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400 text-[11px]">Microphone:</div>
                  <div className="font-mono text-sm font-bold text-zinc-100 mt-0.5">
                    {privacyMetrics.microphoneActive ? "ON (Active)" : "OFF (Standby)"}
                  </div>
                </div>

                <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400 text-[11px]">Recording:</div>
                  <div className="font-mono text-sm font-bold text-zinc-100 mt-0.5">
                    {privacyMetrics.currentlyRecording ? "YES (Live)" : "NO"}
                  </div>
                </div>

                <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400 text-[11px]">Audio Uploaded:</div>
                  <div className="font-mono text-sm font-bold text-zinc-100 mt-0.5">
                    {privacyMetrics.audioUploaded ? "YES (Encrypted TLS)" : "NO (Local)"}
                  </div>
                </div>

                <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400 text-[11px]">Transcript Stored:</div>
                  <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">
                    NO (Ephemeral buffer)
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950/60 p-4 border border-zinc-800 rounded-xl space-y-2 text-[11px] text-zinc-400">
                <div className="font-semibold text-zinc-200">Security Guarantees</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Zero advertising trackers, marketing analytics, or telemetry.</li>
                  <li>No keylogger: Global shortcut listens exclusively for the configured key combination.</li>
                  <li>Microphone audio stream is immediately discarded from memory once transcribed.</li>
                  <li>API credentials never exposed to frontend code or client bundles.</li>
                  <li>Does NOT require Windows Administrator privileges for standard operation.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB: WINDOWS NATIVE APP */}
          {activeTab === "windows" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">
                  Windows 11 Native Architecture & Installer
                </h3>
                <p className="text-zinc-400 text-xs">
                  Real Windows desktop binary specifications (Tauri v2 + Rust + Win32 APIs).
                </p>
              </div>

              <div className="bg-zinc-950/60 p-4 border border-zinc-800 rounded-xl space-y-3">
                <div className="font-medium text-zinc-200">Production Build Artifacts</div>
                <div className="font-mono text-[11px] text-zinc-300 space-y-1 bg-zinc-900 p-3 rounded border border-zinc-800">
                  <div>VoiceFlow.exe (Standalone executable)</div>
                  <div>VoiceFlow_1.0.0_x64-setup.exe (NSIS Installer)</div>
                  <div>VoiceFlow_1.0.0_x64_en-US.msi (Windows Installer)</div>
                </div>

                <div className="pt-2">
                  <div className="font-medium text-zinc-200 mb-1">To Compile on Windows:</div>
                  <pre className="bg-zinc-900 p-3 rounded border border-zinc-800 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`# 1. Clone repository or extract files
# 2. Run automated builder:
.\\scripts\\build-windows.bat

# Or manual Tauri command:
npx tauri build`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500">
            VoiceFlow v1.0.0 · Windows 11 Desktop Edition
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
