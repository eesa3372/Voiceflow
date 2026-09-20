import React, { useState, useRef, useEffect } from "react";
import { Code, FileText, Terminal, AlignLeft, Check, Sparkles } from "lucide-react";

interface TargetAppSimulatorProps {
  onRegisterActiveInput: (element: HTMLTextAreaElement | null) => void;
  lastDictationText?: string;
}

export const TargetAppSimulator: React.FC<TargetAppSimulatorProps> = ({
  onRegisterActiveInput,
  lastDictationText,
}) => {
  const [activeTab, setActiveTab] = useState<"vscode" | "notepad" | "terminal" | "word">("vscode");
  const [vscodeText, setVscodeText] = useState(
    `# VS Code - chemistry_pipeline.py\n# Position cursor below and press Ctrl+Space to dictate:\n\nimport numpy as np\n\ndef run_synthesis():\n    `
  );
  const [notepadText, setNotepadText] = useState(
    `Meeting Notes - Synthesis Lab\nDate: September 19, 2026\n\nNotes from discussion:\n`
  );
  const [terminalText, setTerminalText] = useState(
    `PS C:\\Users\\Scientist\\Project> python -m `
  );
  const [wordText, setWordText] = useState(
    `Abstract\n\nRecent investigations into cross-coupling methods demonstrate high efficiency with `
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      onRegisterActiveInput(textareaRef.current);
    }
  }, [activeTab, onRegisterActiveInput]);

  const currentText =
    activeTab === "vscode"
      ? vscodeText
      : activeTab === "notepad"
      ? notepadText
      : activeTab === "terminal"
      ? terminalText
      : wordText;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (activeTab === "vscode") setVscodeText(val);
    else if (activeTab === "notepad") setNotepadText(val);
    else if (activeTab === "terminal") setTerminalText(val);
    else setWordText(val);
  };

  const getAppName = () => {
    switch (activeTab) {
      case "vscode":
        return "Visual Studio Code";
      case "notepad":
        return "Notepad";
      case "terminal":
        return "Windows Terminal";
      case "word":
        return "Microsoft Word";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
      {/* App Header & Switcher */}
      <div className="bg-zinc-950 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1">
          <button
            id="tab-vscode"
            onClick={() => setActiveTab("vscode")}
            className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeTab === "vscode"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>VS Code</span>
          </button>

          <button
            id="tab-notepad"
            onClick={() => setActiveTab("notepad")}
            className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeTab === "notepad"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notepad</span>
          </button>

          <button
            id="tab-terminal"
            onClick={() => setActiveTab("terminal")}
            className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeTab === "terminal"
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            id="tab-word"
            onClick={() => setActiveTab("word")}
            className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeTab === "word"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Word</span>
          </button>
        </div>

        <div className="flex items-center space-x-1 text-[11px] text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Target: {getAppName()}</span>
        </div>
      </div>

      {/* Editor Surface */}
      <div className="p-3 bg-zinc-950/60 relative">
        <textarea
          id="target-simulator-input"
          ref={textareaRef}
          data-app-name={getAppName()}
          value={currentText}
          onChange={handleTextChange}
          onFocus={() => {
            if (textareaRef.current) {
              onRegisterActiveInput(textareaRef.current);
            }
          }}
          className={`w-full h-44 p-3 bg-zinc-900/90 text-zinc-200 text-xs rounded-lg border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-none leading-relaxed ${
            activeTab === "terminal" ? "text-emerald-400 bg-black/90" : ""
          }`}
          placeholder="Click here, then press Ctrl + Space to dictate directly into this active window..."
        />

        {/* Floating Quick Suggestion */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Try saying:</span>
            <span className="text-zinc-300 font-mono italic">
              "Create a Python function using LiHMDS and DIBAL-H for cross-coupling"
            </span>
          </div>

          <div className="text-[10px] text-zinc-500">
            Caret auto-insertion ready
          </div>
        </div>
      </div>
    </div>
  );
};
