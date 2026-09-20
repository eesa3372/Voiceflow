//! Windows 11 Global Hotkey Manager
//!
//! Implements a true system-wide global shortcut on Windows using `RegisterHotKey`
//! and low-level keyboard hook `WH_KEYBOARD_LL` to reliably support both
//! Push-to-talk (hold key -> record, release key -> insert) and Toggle modes,
//! even when VoiceFlow is minimized or hidden in the Windows notification area.

use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DictationMode {
    PushToTalk,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HotkeyAction {
    StartRecording,
    StopRecording,
    ToggleRecording,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub key: String,       // e.g. "Space"
    pub ctrl: bool,        // e.g. true
    pub alt: bool,
    pub shift: bool,
    pub win: bool,
    pub mode: DictationMode,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            key: "Space".to_string(),
            ctrl: true,
            alt: false,
            shift: false,
            win: false,
            mode: DictationMode::PushToTalk,
        }
    }
}

pub type HotkeyCallback = Arc<dyn Fn(HotkeyAction) + Send + Sync + 'static>;

pub struct GlobalHotkeyManager {
    config: Arc<Mutex<HotkeyConfig>>,
    is_recording: Arc<AtomicBool>,
    hook_thread_running: Arc<AtomicBool>,
    callback: Arc<Mutex<Option<HotkeyCallback>>>,
    #[cfg(windows)]
    hook_thread_id: Arc<std::sync::atomic::AtomicU32>,
}

impl GlobalHotkeyManager {
    pub fn new(config: HotkeyConfig) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
            is_recording: Arc::new(AtomicBool::new(false)),
            hook_thread_running: Arc::new(AtomicBool::new(false)),
            callback: Arc::new(Mutex::new(None)),
            #[cfg(windows)]
            hook_thread_id: Arc::new(std::sync::atomic::AtomicU32::new(0)),
        }
    }

    pub fn set_callback<F>(&self, callback: F)
    where
        F: Fn(HotkeyAction) + Send + Sync + 'static,
    {
        let mut cb_guard = self.callback.lock().unwrap();
        *cb_guard = Some(Arc::new(callback));
    }

    pub fn get_config(&self) -> HotkeyConfig {
        self.config.lock().unwrap().clone()
    }

    pub fn update_config(&self, new_config: HotkeyConfig) {
        info!("Updating hotkey configuration to: {:?} (mode: {:?})", new_config, new_config.mode);
        let mut guard = self.config.lock().unwrap();
        *guard = new_config;
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn set_recording(&self, state: bool) {
        self.is_recording.store(state, Ordering::SeqCst);
    }

    /// Starts the low-level Windows keyboard hook WH_KEYBOARD_LL on a dedicated background thread.
    /// This intercepts key presses and releases globally across all Windows applications.
    #[cfg(windows)]
    pub fn start_low_level_keyboard_hook(&self) -> Result<(), String> {
        if self.hook_thread_running.load(Ordering::SeqCst) {
            info!("Low-level keyboard hook is already running.");
            return Ok(());
        }

        use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
        use windows::Win32::System::Threading::GetCurrentThreadId;
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetAsyncKeyState, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_MENU,
            VK_RCONTROL, VK_RMENU, VK_RSHIFT, VK_RWIN, VK_SHIFT, VK_SPACE,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW,
            UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN,
            WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
        };

        // Static references for the C hook callback
        static mut GLOBAL_HOOK: Option<HHOOK> = None;
        static mut HOOK_CONFIG: Option<Arc<Mutex<HotkeyConfig>>> = None;
        static mut HOOK_RECORDING: Option<Arc<AtomicBool>> = None;
        static mut HOOK_CALLBACK: Option<Arc<Mutex<Option<HotkeyCallback>>>> = None;

        unsafe {
            HOOK_CONFIG = Some(Arc::clone(&self.config));
            HOOK_RECORDING = Some(Arc::clone(&self.is_recording));
            HOOK_CALLBACK = Some(Arc::clone(&self.callback));
        }

        unsafe extern "system" fn low_level_keyboard_proc(
            n_code: i32,
            w_param: WPARAM,
            l_param: LPARAM,
        ) -> LRESULT {
            if n_code >= 0 {
                let kb_struct = *(l_param.0 as *const KBDLLHOOKSTRUCT);
                let vk_code = kb_struct.vkCode;
                let is_key_down = w_param.0 as u32 == WM_KEYDOWN || w_param.0 as u32 == WM_SYSKEYDOWN;
                let is_key_up = w_param.0 as u32 == WM_KEYUP || w_param.0 as u32 == WM_SYSKEYUP;

                // Inspect active config
                if let Some(ref config_arc) = HOOK_CONFIG {
                    if let Ok(cfg) = config_arc.lock() {
                        let ctrl_down = (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(VK_LCONTROL.0 as i32) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(VK_RCONTROL.0 as i32) as u16 & 0x8000 != 0);

                        let alt_down = (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(VK_LMENU.0 as i32) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(VK_RMENU.0 as i32) as u16 & 0x8000 != 0);

                        let shift_down = (GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(VK_LSHIFT.0 as i32) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(VK_RSHIFT.0 as i32) as u16 & 0x8000 != 0);

                        let win_down = (GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000 != 0);

                        let target_vk = if cfg.key.eq_ignore_ascii_case("Space") {
                            VK_SPACE.0 as u32
                        } else {
                            VK_SPACE.0 as u32
                        };

                        let modifiers_match = (!cfg.ctrl || ctrl_down)
                            && (!cfg.alt || alt_down)
                            && (!cfg.shift || shift_down)
                            && (!cfg.win || win_down);

                        if vk_code == target_vk && modifiers_match {
                            if let Some(ref rec_arc) = HOOK_RECORDING {
                                let currently_rec = rec_arc.load(Ordering::SeqCst);

                                match cfg.mode {
                                    DictationMode::PushToTalk => {
                                        if is_key_down && !currently_rec {
                                            rec_arc.store(true, Ordering::SeqCst);
                                            if let Some(ref cb_arc) = HOOK_CALLBACK {
                                                if let Ok(cb_guard) = cb_arc.lock() {
                                                    if let Some(ref cb) = *cb_guard {
                                                        cb(HotkeyAction::StartRecording);
                                                    }
                                                }
                                            }
                                            return LRESULT(1); // Consume trigger keystroke
                                        } else if is_key_up && currently_rec {
                                            rec_arc.store(false, Ordering::SeqCst);
                                            if let Some(ref cb_arc) = HOOK_CALLBACK {
                                                if let Ok(cb_guard) = cb_arc.lock() {
                                                    if let Some(ref cb) = *cb_guard {
                                                        cb(HotkeyAction::StopRecording);
                                                    }
                                                }
                                            }
                                            return LRESULT(1); // Consume release
                                        }
                                    }
                                    DictationMode::Toggle => {
                                        if is_key_down {
                                            let next_state = !currently_rec;
                                            rec_arc.store(next_state, Ordering::SeqCst);
                                            if let Some(ref cb_arc) = HOOK_CALLBACK {
                                                if let Ok(cb_guard) = cb_arc.lock() {
                                                    if let Some(ref cb) = *cb_guard {
                                                        cb(if next_state {
                                                            HotkeyAction::StartRecording
                                                        } else {
                                                            HotkeyAction::StopRecording
                                                        });
                                                    }
                                                }
                                            }
                                            return LRESULT(1); // Consume toggle trigger
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            CallNextHookEx(GLOBAL_HOOK, n_code, w_param, l_param)
        }

        let is_running = Arc::clone(&self.hook_thread_running);
        let thread_id_store = Arc::clone(&self.hook_thread_id);

        is_running.store(true, Ordering::SeqCst);

        std::thread::spawn(move || {
            unsafe {
                let tid = GetCurrentThreadId();
                thread_id_store.store(tid, Ordering::SeqCst);

                let hook = SetWindowsHookExW(
                    WH_KEYBOARD_LL,
                    Some(low_level_keyboard_proc),
                    HINSTANCE(std::ptr::null_mut()),
                    0,
                );

                match hook {
                    Ok(h) => {
                        GLOBAL_HOOK = Some(h);
                        info!("WH_KEYBOARD_LL low-level Windows keyboard hook installed successfully.");

                        // Windows standard message pump required for WH_KEYBOARD_LL
                        let mut msg = MSG::default();
                        while GetMessageW(&mut msg, HWND(std::ptr::null_mut()), 0, 0).as_bool() {
                            let _ = DispatchMessageW(&msg);
                        }

                        if let Some(h) = GLOBAL_HOOK.take() {
                            let _ = UnhookWindowsHookEx(h);
                            info!("WH_KEYBOARD_LL hook cleanly unhooked.");
                        }
                    }
                    Err(e) => {
                        error!("Failed to install WH_KEYBOARD_LL hook: {:?}", e);
                    }
                }

                is_running.store(false, Ordering::SeqCst);
            }
        });

        Ok(())
    }

    /// Windows RegisterHotKey integration (for basic window message loop)
    #[cfg(windows)]
    pub fn register_windows_hotkey(&self, hwnd: isize) -> Result<(), String> {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            RegisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, MOD_WIN, VK_SPACE,
        };

        let cfg = self.config.lock().unwrap();
        let mut modifiers = MOD_NOREPEAT;
        if cfg.ctrl {
            modifiers |= MOD_CONTROL;
        }
        if cfg.alt {
            modifiers |= MOD_ALT;
        }
        if cfg.shift {
            modifiers |= MOD_SHIFT;
        }
        if cfg.win {
            modifiers |= MOD_WIN;
        }

        unsafe {
            let ok = RegisterHotKey(
                HWND(hwnd as *mut _),
                1001, // hotkey identifier
                modifiers,
                VK_SPACE.0 as u32,
            );
            if ok.as_bool() {
                info!("Successfully registered global hotkey with HWND {:?}", hwnd);
                Ok(())
            } else {
                Err("Failed to register Windows global hotkey. Another application may have claimed the shortcut.".to_string())
            }
        }
    }

    #[cfg(not(windows))]
    pub fn start_low_level_keyboard_hook(&self) -> Result<(), String> {
        info!("Low-level keyboard hook simulated for non-Windows host.");
        Ok(())
    }

    #[cfg(not(windows))]
    pub fn register_windows_hotkey(&self, _hwnd: isize) -> Result<(), String> {
        info!("RegisterHotKey simulated for non-Windows host.");
        Ok(())
    }
}
