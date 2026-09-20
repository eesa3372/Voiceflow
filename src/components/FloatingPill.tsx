import React from "react";
import { Mic, Check, AlertCircle, Zap } from "lucide-react";
import { DictationStatus } from "../types";

interface FloatingPillProps {
  status: DictationStatus;
  audioLevel: number;
  lastTranscript?: string;
  onStop: () => void;
}

export const FloatingPill: React.FC<FloatingPillProps> = ({
  status,
  audioLevel,
  lastTranscript,
  onStop,
}) => {
  if (status === "ready") return null;

  return (
    <div
      id="voiceflow-floating-pill"
      className="fixed bottom-6 right-6 z-40 bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/80 rounded-full shadow-2xl px-4 py-2 flex items-center space-x-3 text-zinc-100 transition-all transform animate-bounce-subtle"
    >
      <div className="flex items-center space-x-2">
        {status === "listening" && (
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span className="text-xs font-medium text-rose-400">Listening</span>
            <div className="flex items-center space-x-0.5 ml-1.5 h-3">
              {[0.4, 0.9, 1.4, 0.7, 1.1].map((f, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-rose-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, Math.min(12, audioLevel * 70 * f))}px` }}
                />
              ))}
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="flex items-center space-x-1.5 text-xs text-amber-400">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full"></span>
            <span>Cleaning grammar...</span>
          </div>
        )}

        {status === "done" && (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
            <Check className="w-3.5 h-3.5" />
            <span>Inserted</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center space-x-1.5 text-xs text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </div>
        )}
      </div>

      {status === "listening" && (
        <button
          onClick={onStop}
          className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700"
        >
          Done
        </button>
      )}
    </div>
  );
};
