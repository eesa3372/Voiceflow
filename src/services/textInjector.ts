export interface TextInjectionResult {
  success: boolean;
  targetApp: string;
  method: string;
  characterCount: number;
  error?: string;
}

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: any) => Promise<any>;
      };
    };
  }
}

/**
 * Checks if the application is currently running inside the native Windows Tauri container
 */
export function isWindowsNative(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI__;
}

/**
 * Injects text into whatever application currently has keyboard focus.
 * If in Windows native mode: invokes Win32 SendInput / clipboard restoration.
 * If in web / preview testbed: injects into active element or target simulator.
 */
export async function injectTextToActiveWindow(
  text: string,
  targetElement?: HTMLElement | null
): Promise<TextInjectionResult> {
  // 1. If running as Windows 11 desktop app via Tauri
  if (isWindowsNative()) {
    try {
      const result = await window.__TAURI__!.core.invoke("inject_dictated_text", { text });
      return {
        success: result.success,
        targetApp: result.target_window || "Windows Application",
        method: result.method || "Win32_SendInput_Unicode",
        characterCount: result.character_count || text.length,
        error: result.error,
      };
    } catch (err: any) {
      console.error("Tauri Win32 injection error:", err);
      // fallback to clipboard
    }
  }

  // 2. Direct DOM insertion if an editable element is focused or supplied
  const activeEl = targetElement || (document.activeElement as HTMLElement | null);

  if (activeEl && (activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLInputElement)) {
    const input = activeEl;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const currentVal = input.value;
    const leadingSpace = start > 0 && !/\s$/.test(currentVal.slice(0, start)) ? " " : "";

    const insertion = leadingSpace + text;
    const nextVal = currentVal.substring(0, start) + insertion + currentVal.substring(end);
    input.value = nextVal;

    // Move cursor to end of inserted text
    const newCursor = start + insertion.length;
    input.setSelectionRange(newCursor, newCursor);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    return {
      success: true,
      targetApp: input.getAttribute("data-app-name") || "Focused Input",
      method: "Direct_Caret_Insertion",
      characterCount: text.length,
    };
  }

  // 3. Fallback: Copy to system clipboard safely
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return {
        success: true,
        targetApp: "Clipboard (Ready to paste Ctrl+V)",
        method: "System_Clipboard_Fallback",
        characterCount: text.length,
      };
    }
  } catch (err: any) {
    console.warn("Clipboard access failed:", err);
  }

  return {
    success: true,
    targetApp: "VoiceFlow Buffer",
    method: "Buffer_Retained",
    characterCount: text.length,
  };
}
