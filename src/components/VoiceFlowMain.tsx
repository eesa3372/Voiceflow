import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Settings,
  Sliders,
  Check,
  AlertCircle,
  Volume2,
  ChevronDown,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { DictationStatus, DictationMode, AudioDevice } from "../types";

interface VoiceFlowMainProps {
  status: DictationStatus;
  mode: DictationMode;
  shortcutDisplay: string;
  selectedMic: string;
  audioDevices: AudioDevice[];
  audioLevel: number;
  lastTranscript?: string;
  lastTargetApp?: string;
  errorMessage?: string;
  onToggleMode: () => void;
  onSelectMic: (deviceId: string) => void;
  onOpenSettings: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const VoiceFlowMain: React.FC<VoiceFlowMainProps> = ({
  status,
  mode,
  shortcutDisplay,
  selectedMic,
  audioDevices,
  audioLevel,
  lastTranscript,
  lastTargetApp,
  errorMessage,
  onToggleMode,
  onSelectMic,
  onOpenSettings,
  onStartRecording,
  onStopRecording,
}) => {
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const isListening = status === "listening";
  const isProcessing = status === "processing";
  const isDone = status === "done";
  const isError = status === "error";

  const selectedDevice = audioDevices.find((d) => d.deviceId === selectedMic);
  const micLabel = selectedDevice?.label || "Default Microphone";

  return (
    <div
      id="voiceflow-main-container"
      className="w-full max-w-sm mx-auto bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl p-6 text-zinc-100 select-none font-sans"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 mb-5">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wider text-zinc-100">VOICEFLOW</h1>
            <div className="text-[10px] text-zinc-400 font-mono tracking-tight">WINDOWS 11 NATIVE</div>
          </div>
        </div>

        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          title="Open Settings & Vocabulary"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Status Banner (Section 11 Spec) */}
      <div className="bg-zinc-950/70 border border-zinc-800/60 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {isListening && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            )}
            {isProcessing && (
              <span className="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
            )}
            {isDone && (
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
            {status === "ready" && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            )}
            {isError && (
              <span className="w-3 h-3 rounded-full bg-rose-500 flex items-center justify-center text-[9px] font-bold">!</span>
            )}

            <span className="text-sm font-medium tracking-wide">
              {isListening && <span className="text-rose-400 font-semibold">Listening...</span>}
              {isProcessing && <span className="text-amber-400">Processing...</span>}
              {isDone && <span className="text-emerald-400 font-semibold">Done</span>}
              {status === "ready" && <span className="text-zinc-200">Ready</span>}
              {isError && <span className="text-rose-400">Error occurred</span>}
            </span>
          </div>

          {/* Quick Push-To-Talk / Toggle Trigger Button */}
          <button
            id="btn-voiceflow-trigger"
            onMouseDown={() => {
              if (mode === "push-to-talk" && !isListening) {
                onStartRecording();
              }
            }}
            onMouseUp={() => {
              if (mode === "push-to-talk" && isListening) {
                onStopRecording();
              }
            }}
            onClick={() => {
              if (mode === "toggle") {
                if (isListening) onStopRecording();
                else onStartRecording();
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm ${
              isListening
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white"
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>{mode === "push-to-talk" ? "Hold" : "Start"}</span>
              </>
            )}
          </button>
        </div>

        {/* Live Audio Amplitude Waveform Bar */}
        {isListening && (
          <div className="mt-3 pt-3 border-t border-zinc-800/40">
            <div className="flex items-center space-x-1 h-3 justify-center">
              {[0.4, 0.8, 1.2, 0.6, 1.4, 0.9, 0.5, 1.1, 0.7].map((factor, idx) => {
                const height = Math.max(3, Math.min(18, audioLevel * 100 * factor));
                return (
                  <div
                    key={idx}
                    className="w-1 bg-rose-500/80 rounded-full transition-all duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
            <div className="text-[10px] text-center text-zinc-400 mt-1">
              Speak naturally into your microphone
            </div>
          </div>
        )}

        {/* Status Confirmation feedback */}
        {isDone && lastTranscript && (
          <div className="mt-2.5 pt-2 border-t border-zinc-800/50 text-[11px] text-zinc-400">
            <div className="text-zinc-300 line-clamp-2 italic">"{lastTranscript}"</div>
            {lastTargetApp && (
              <div className="text-[10px] text-emerald-400/90 mt-1 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Injected into {lastTargetApp}</span>
              </div>
            )}
          </div>
        )}

        {isError && errorMessage && (
          <div className="mt-2 text-[11px] text-rose-400 flex items-start space-x-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Specifications list matching Section 11 */}
      <div className="space-y-3.5 text-xs text-zinc-400">
        {/* Shortcut */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Shortcut:</span>
          <span className="font-mono text-zinc-200 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60 text-[11px]">
            {shortcutDisplay}
          </span>
        </div>

        {/* Microphone */}
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Microphone:</span>
            <button
              id="btn-select-mic-dropdown"
              onClick={() => setShowMicDropdown(!showMicDropdown)}
              className="text-zinc-200 hover:text-white flex items-center space-x-1 max-w-[180px] truncate text-right text-[11px] bg-zinc-800/40 hover:bg-zinc-800/80 px-2 py-1 rounded transition-colors"
            >
              <span className="truncate">{micLabel}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
            </button>
          </div>

          {showMicDropdown && audioDevices.length > 0 && (
            <div className="absolute right-0 top-7 z-20 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 text-xs">
              {audioDevices.map((device) => (
                <button
                  key={device.deviceId}
                  onClick={() => {
                    onSelectMic(device.deviceId);
                    setShowMicDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center justify-between truncate ${
                    device.deviceId === selectedMic ? "text-indigo-400 font-medium" : "text-zinc-300"
                  }`}
                >
                  <span className="truncate">{device.label || "Microphone"}</span>
                  {device.deviceId === selectedMic && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mode */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Mode:</span>
          <button
            id="btn-toggle-dictation-mode"
            onClick={onToggleMode}
            className="text-zinc-200 hover:text-white capitalize flex items-center space-x-1 bg-zinc-800/50 hover:bg-zinc-800 px-2 py-1 rounded transition-colors text-[11px]"
          >
            <span>{mode === "push-to-talk" ? "Push-to-talk" : "Toggle"}</span>
            <Sliders className="w-2.5 h-2.5 text-zinc-400" />
          </button>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Language:</span>
          <span className="text-zinc-200 font-medium">English</span>
        </div>
      </div>

      {/* Settings CTA Button */}
      <div className="mt-5 pt-4 border-t border-zinc-800/60 flex items-center justify-between">
        <button
          id="btn-open-settings-bottom"
          onClick={onOpenSettings}
          className="w-full py-2 px-3 bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-200 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-1.5"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>[Settings]</span>
        </button>
      </div>

      {/* Privacy Guarantee Footer */}
      <div className="mt-3 flex items-center justify-center space-x-1.5 text-[10px] text-zinc-500">
        <ShieldCheck className="w-3 h-3 text-emerald-500/80" />
        <span>Zero audio retention · Local dictionary active</span>
      </div>
    </div>
  );
};
