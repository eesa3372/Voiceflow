import React, { useState, useEffect, useRef, useCallback } from "react";
import { VoiceFlowMain } from "./components/VoiceFlowMain";
import { SettingsModal } from "./components/SettingsModal";
import { TargetAppSimulator } from "./components/TargetAppSimulator";
import { FloatingPill } from "./components/FloatingPill";
import {
  DictationStatus,
  DictationMode,
  SpeechProviderType,
  VocabularyItem,
  HotkeyConfig,
  AudioDevice,
  PrivacyMetrics,
} from "./types";
import { SpeechAudioEngine } from "./services/speechProvider";
import {
  fetchVocabulary,
  saveVocabularyTerm,
  deleteVocabularyTerm,
  DEFAULT_VOCABULARY,
} from "./services/vocabularyStore";
import { injectTextToActiveWindow } from "./services/textInjector";
import {
  Mic,
  Monitor,
  Keyboard,
  ShieldCheck,
  Radio,
  Wifi,
  Volume2,
  Terminal,
  HelpCircle,
} from "lucide-react";

export default function App() {
  const [status, setStatus] = useState<DictationStatus>("ready");
  const [mode, setMode] = useState<DictationMode>("push-to-talk");
  const [speechProvider, setSpeechProvider] = useState<SpeechProviderType>("cloud");
  const [hotkeyConfig, setHotkeyConfig] = useState<HotkeyConfig>({
    key: "Space",
    ctrl: true,
    alt: false,
    shift: false,
    win: false,
  });

  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(DEFAULT_VOCABULARY);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [lastTargetApp, setLastTargetApp] = useState<string>("Visual Studio Code");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [privacyMetrics, setPrivacyMetrics] = useState<PrivacyMetrics>({
    microphoneActive: false,
    currentlyRecording: false,
    audioUploaded: false,
    transcriptPersisted: false,
    telemetryTrackers: 0,
  });

  const activeTargetInputRef = useRef<HTMLTextAreaElement | null>(null);
  const audioEngineRef = useRef<SpeechAudioEngine | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const modeRef = useRef<DictationMode>(mode);
  const vocabularyRef = useRef<VocabularyItem[]>(vocabulary);

  modeRef.current = mode;
  vocabularyRef.current = vocabulary;

  // Initialize Speech Audio Engine and load Vocabulary & Audio Devices
  useEffect(() => {
    audioEngineRef.current = new SpeechAudioEngine();

    fetchVocabulary().then((items) => {
      setVocabulary(items);
    });

    audioEngineRef.current.getAudioDevices().then((devices) => {
      if (devices.length > 0) {
        const formatted = devices.map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
        }));
        setAudioDevices(formatted);
        setSelectedMic(formatted[0].deviceId);
      } else {
        setAudioDevices([{ deviceId: "default", label: "Default System Microphone" }]);
        setSelectedMic("default");
      }
    });
  }, []);

  // START RECORDING
  const handleStartRecording = useCallback(async () => {
    if (isListeningRef.current) return;
    isListeningRef.current = true;
    setStatus("listening");
    setErrorMessage("");

    setPrivacyMetrics((prev) => ({
      ...prev,
      microphoneActive: true,
      currentlyRecording: true,
    }));

    if (!audioEngineRef.current) {
      audioEngineRef.current = new SpeechAudioEngine();
    }

    const started = await audioEngineRef.current.startRecording(selectedMic, (level) => {
      setAudioLevel(level);
    });

    if (!started) {
      isListeningRef.current = false;
      setStatus("error");
      setErrorMessage("Microphone permission denied or device busy.");
      setPrivacyMetrics((prev) => ({
        ...prev,
        microphoneActive: false,
        currentlyRecording: false,
      }));
    }
  }, [selectedMic]);

  // STOP RECORDING & INJECT TEXT
  const handleStopRecording = useCallback(async () => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    setStatus("processing");
    setAudioLevel(0);

    setPrivacyMetrics((prev) => ({
      ...prev,
      currentlyRecording: false,
      audioUploaded: true,
    }));

    try {
      if (!audioEngineRef.current) return;

      const { audioBlob, liveTranscript } = await audioEngineRef.current.stopRecording();

      // Send to server pipeline (Gemini audio transcribe + grammar cleaner + technical vocabulary)
      const result = await audioEngineRef.current.processDictation(
        audioBlob,
        liveTranscript,
        vocabularyRef.current
      );

      const finalCleaned = result.finalText || liveTranscript.trim();

      if (finalCleaned) {
        setLastTranscript(finalCleaned);

        // Inject into current active window / simulator element
        const injection = await injectTextToActiveWindow(
          finalCleaned,
          activeTargetInputRef.current
        );

        setLastTargetApp(injection.targetApp);
        setStatus("done");
      } else {
        setStatus("ready");
      }
    } catch (err: any) {
      console.error("Dictation processing error:", err);
      setStatus("error");
      setErrorMessage(err.message || "Speech transcription failed.");
    } finally {
      setPrivacyMetrics((prev) => ({
        ...prev,
        microphoneActive: false,
        audioUploaded: false,
      }));

      // Return to ready state after brief feedback
      setTimeout(() => {
        setStatus((s) => (s === "done" || s === "error" ? "ready" : s));
      }, 3500);
    }
  }, []);

  // GLOBAL HOTKEY LISTENER (Ctrl + Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid interference if user is modifying hotkey in settings modal
      if (isSettingsOpen) return;

      const matchesCtrl = hotkeyConfig.ctrl ? e.ctrlKey : !e.ctrlKey;
      const matchesKey = e.code === "Space" || e.key === " ";

      if (matchesCtrl && matchesKey) {
        // Prevent default browser scroll or page jump on Ctrl+Space
        e.preventDefault();

        if (modeRef.current === "push-to-talk") {
          if (!isListeningRef.current) {
            handleStartRecording();
          }
        } else if (modeRef.current === "toggle") {
          if (isListeningRef.current) {
            handleStopRecording();
          } else {
            handleStartRecording();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isSettingsOpen) return;

      if (modeRef.current === "push-to-talk" && isListeningRef.current) {
        // In push-to-talk mode, releasing Ctrl OR Space finishes recording
        if (e.key === "Control" || e.code === "Space" || e.key === " ") {
          e.preventDefault();
          handleStopRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [hotkeyConfig, isSettingsOpen, handleStartRecording, handleStopRecording]);

  const handleAddVocabulary = async (term: Omit<VocabularyItem, "id">) => {
    const saved = await saveVocabularyTerm(term);
    setVocabulary((prev) => [...prev, saved]);
  };

  const handleDeleteVocabulary = async (id: string) => {
    await deleteVocabularyTerm(id);
    setVocabulary((prev) => prev.filter((v) => v.id !== id));
  };

  const shortcutDisplay = `${hotkeyConfig.ctrl ? "Ctrl + " : ""}${hotkeyConfig.key}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-indigo-500/30 font-sans">
      {/* Top Windows 11 Desktop Bar */}
      <header className="px-6 py-3 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold text-zinc-200">VoiceFlow</span>
            <span className="text-[10px] text-zinc-400 font-mono">v1.0.0</span>
          </div>
          <span className="text-zinc-500 hidden sm:inline">|</span>
          <span className="text-zinc-400 hidden sm:inline">Windows 11 Voice Dictation Engine</span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-[11px] text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Shortcut: <strong className="text-zinc-200">{shortcutDisplay}</strong></span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded text-xs transition-colors"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center">
        {/* Quick Instructions Banner */}
        <div className="w-full max-w-sm mb-4 text-center">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-300">
            <Keyboard className="w-3 h-3" />
            <span>
              {mode === "push-to-talk" ? "Hold" : "Press"}{" "}
              <kbd className="font-mono font-semibold bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-100 border border-zinc-700">
                {shortcutDisplay}
              </kbd>{" "}
              to speak
            </span>
          </div>
        </div>

        {/* Minimal Core UI (Section 11 Spec) */}
        <VoiceFlowMain
          status={status}
          mode={mode}
          shortcutDisplay={shortcutDisplay}
          selectedMic={selectedMic}
          audioDevices={audioDevices}
          audioLevel={audioLevel}
          lastTranscript={lastTranscript}
          lastTargetApp={lastTargetApp}
          errorMessage={errorMessage}
          onToggleMode={() => setMode(mode === "push-to-talk" ? "toggle" : "push-to-talk")}
          onSelectMic={(id) => setSelectedMic(id)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />

        {/* Windows Target Application Testbed (Simulates VS Code, Notepad, Terminal, Word) */}
        <div className="w-full">
          <TargetAppSimulator
            onRegisterActiveInput={(el) => {
              activeTargetInputRef.current = el;
            }}
            lastDictationText={lastTranscript}
          />
        </div>
      </main>

      {/* Discrete Floating Windows 11 Dictation Pill */}
      <FloatingPill
        status={status}
        audioLevel={audioLevel}
        lastTranscript={lastTranscript}
        onStop={handleStopRecording}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode={mode}
        onModeChange={(m) => setMode(m)}
        hotkeyConfig={hotkeyConfig}
        onHotkeyChange={(c) => setHotkeyConfig(c)}
        speechProvider={speechProvider}
        onSpeechProviderChange={(p) => setSpeechProvider(p)}
        vocabulary={vocabulary}
        onAddVocabulary={handleAddVocabulary}
        onDeleteVocabulary={handleDeleteVocabulary}
        privacyMetrics={privacyMetrics}
      />

      {/* Simulated Windows 11 Taskbar & System Tray */}
      <footer className="h-10 bg-zinc-950/90 border-t border-zinc-900 px-4 flex items-center justify-between text-xs text-zinc-400 select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-zinc-400">
            <Monitor className="w-3.5 h-3.5" />
            <span className="text-[11px]">Win32 SendInput Target: Active Window</span>
          </div>
        </div>

        {/* Windows System Tray icons */}
        <div className="flex items-center space-x-3 text-[11px]">
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
            <Mic className={`w-3 h-3 ${status === "listening" ? "text-rose-400 animate-pulse" : "text-zinc-400"}`} />
            <span className="font-mono text-[10px]">
              {status === "listening" ? "ACTIVE" : "STANDBY"}
            </span>
          </div>

          <div className="flex items-center space-x-1 text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Secured</span>
          </div>

          <div className="text-zinc-500 hidden sm:inline">|</div>

          <div className="text-zinc-400 font-mono text-[11px]">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </footer>
    </div>
  );
}
