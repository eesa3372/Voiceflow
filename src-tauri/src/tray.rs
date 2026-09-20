//! Windows 11 System Tray Manager
//!
//! Provides the primary background presence for VoiceFlow in the Windows
//! taskbar notification area. The user can start/stop dictation, open settings,
//! change microphone/mode, and exit the application cleanly.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager, Wry,
};

pub fn setup_system_tray(app: &AppHandle) -> Result<TrayIcon<Wry>, tauri::Error> {
    let start_item = MenuItem::with_id(app, "toggle_dictate", "Start Dictation (Ctrl+Space)", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "Settings", true, None::<&str>)?;
    let privacy_item = MenuItem::with_id(app, "privacy_info", "Privacy & Security", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Exit VoiceFlow", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&start_item, &settings_item, &privacy_item, &quit_item],
    )?;

    let tray = TrayIconBuilder::new()
        .tooltip("VoiceFlow - Windows Voice Dictation (Ctrl + Space)")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle_dictate" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("tray-toggle-dictate", ());
                }
            }
            "open_settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-settings", ());
                }
            }
            "privacy_info" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.emit("open-privacy", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(tray)
}
