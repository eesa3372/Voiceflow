//! Windows 11 System-Wide Text Injection Engine
//!
//! Uses native Win32 `SendInput` with `KEYEVENTF_UNICODE` for direct injection
//! into focused applications (VS Code, Word, Notepad, Chrome, Windows Terminal).
//! Where direct text injection is constrained, provides an automatic secure
//! clipboard-based fallback that captures and subsequently restores the user's
//! previous clipboard contents.

use log::{error, info, warn};
use std::thread;
use std::time::Duration;

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    VIRTUAL_KEY, VK_CONTROL, VK_V,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

/// Result of a text injection operation
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct InjectionResult {
    pub success: bool,
    pub target_window: String,
    pub method: String,
    pub character_count: usize,
    pub error: Option<String>,
}

pub struct TextInjector {
    use_clipboard_fallback: bool,
    restore_clipboard_delay_ms: u64,
}

impl TextInjector {
    pub fn new() -> Self {
        Self {
            use_clipboard_fallback: true,
            restore_clipboard_delay_ms: 150,
        }
    }

    /// Retrieve the title of the current foreground window on Windows
    pub fn get_active_window_title(&self) -> String {
        #[cfg(windows)]
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0 == 0 {
                return "Unknown / Desktop".to_string();
            }
            let mut buffer = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buffer);
            if len > 0 {
                String::from_utf16_lossy(&buffer[..len as usize])
            } else {
                "Active Application".to_string()
            }
        }
        #[cfg(not(windows))]
        {
            "Desktop Target (Non-Windows Host)".to_string()
        }
    }

    /// Injects text directly into the foreground window using Win32 SendInput (Unicode)
    pub fn inject_text(&self, text: &str) -> InjectionResult {
        let active_window = self.get_active_window_title();
        info!("Injecting {} characters into target window: '{}'", text.len(), active_window);

        #[cfg(windows)]
        {
            // Attempt primary direct Win32 SendInput injection
            match self.inject_via_send_input(text) {
                Ok(_) => InjectionResult {
                    success: true,
                    target_window: active_window,
                    method: "Win32_SendInput_Unicode".to_string(),
                    character_count: text.chars().count(),
                    error: None,
                },
                Err(err) => {
                    warn!("SendInput failed ({}). Attempting safe clipboard fallback...", err);
                    if self.use_clipboard_fallback {
                        self.inject_via_clipboard_fallback(text, &active_window)
                    } else {
                        InjectionResult {
                            success: false,
                            target_window: active_window,
                            method: "Failed_SendInput".to_string(),
                            character_count: 0,
                            error: Some(err),
                        }
                    }
                }
            }
        }

        #[cfg(not(windows))]
        {
            // Cross-platform mock fallback for development
            InjectionResult {
                success: true,
                target_window: active_window,
                method: "Simulated_CrossPlatform_Injector".to_string(),
                character_count: text.chars().count(),
                error: None,
            }
        }
    }

    #[cfg(windows)]
    fn inject_via_send_input(&self, text: &str) -> Result<(), String> {
        let mut inputs = Vec::new();

        for ch in text.chars() {
            let mut utf16_buf = [0u16; 2];
            let encoded = ch.encode_utf16(&mut utf16_buf);

            for &code_unit in encoded.iter() {
                // Key down event
                inputs.push(INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: VIRTUAL_KEY(0),
                            wScan: code_unit,
                            dwFlags: KEYEVENTF_UNICODE,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                });

                // Key up event
                inputs.push(INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: VIRTUAL_KEY(0),
                            wScan: code_unit,
                            dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                });
            }
        }

        unsafe {
            let sent = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            if sent as usize == inputs.len() {
                Ok(())
            } else {
                Err(format!("SendInput only dispatched {} of {} events", sent, inputs.len()))
            }
        }
    }

    /// Safe clipboard fallback:
    /// 1. Backs up user's current clipboard text
    /// 2. Sets clipboard to dictated text
    /// 3. Sends synthetic Ctrl + V via SendInput
    /// 4. Restores previous clipboard text after short delay
    pub fn inject_via_clipboard_fallback(&self, text: &str, target_window: &str) -> InjectionResult {
        let mut clipboard = match arboard::Clipboard::new() {
            Ok(cb) => cb,
            Err(e) => {
                return InjectionResult {
                    success: false,
                    target_window: target_window.to_string(),
                    method: "Clipboard_Fallback_Failed".to_string(),
                    character_count: 0,
                    error: Some(format!("Could not open clipboard: {}", e)),
                }
            }
        };

        // 1. Backup previous clipboard
        let previous_text = clipboard.get_text().ok();

        // 2. Set new dictated text
        if let Err(e) = clipboard.set_text(text) {
            return InjectionResult {
                success: false,
                target_window: target_window.to_string(),
                method: "Clipboard_Set_Failed".to_string(),
                character_count: 0,
                error: Some(format!("Failed to write to clipboard: {}", e)),
            };
        }

        // 3. Send Ctrl + V
        #[cfg(windows)]
        unsafe {
            let ctrl_down = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };
            let v_down = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_V,
                        wScan: 0,
                        dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };
            let v_up = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_V,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };
            let ctrl_up = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };

            let paste_sequence = [ctrl_down, v_down, v_up, ctrl_up];
            SendInput(&paste_sequence, std::mem::size_of::<INPUT>() as i32);
        }

        // 4. Restore original clipboard asynchronously without blocking UI
        let delay_ms = self.restore_clipboard_delay_ms;
        if let Some(prev) = previous_text {
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                if let Ok(mut cb) = arboard::Clipboard::new() {
                    let _ = cb.set_text(&prev);
                }
            });
        }

        InjectionResult {
            success: true,
            target_window: target_window.to_string(),
            method: "Clipboard_Restoration_Fallback".to_string(),
            character_count: text.chars().count(),
            error: None,
        }
    }
}
