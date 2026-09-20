// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod hotkey;
mod injector;
mod speech;
mod tray;
mod vocabulary;

use injector::{InjectionResult, TextInjector};
use std::sync::Mutex;
use tauri::{Manager, State};
use vocabulary::{VocabularyEngine, VocabularyTerm};

struct AppState {
    injector: TextInjector,
    vocabulary: Mutex<VocabularyEngine>,
}

#[tauri::command]
fn inject_dictated_text(text: String, state: State<'_, AppState>) -> InjectionResult {
    state.injector.inject_text(&text)
}

#[tauri::command]
fn get_active_window_title(state: State<'_, AppState>) -> String {
    state.injector.get_active_window_title()
}

#[tauri::command]
fn get_vocabulary_terms(state: State<'_, AppState>) -> Vec<VocabularyTerm> {
    state.vocabulary.lock().unwrap().get_terms()
}

#[tauri::command]
fn add_vocabulary_term(term: VocabularyTerm, state: State<'_, AppState>) -> Vec<VocabularyTerm> {
    let mut engine = state.vocabulary.lock().unwrap();
    engine.add_term(term);
    engine.get_terms()
}

#[tauri::command]
fn delete_vocabulary_term(id: String, state: State<'_, AppState>) -> Vec<VocabularyTerm> {
    let mut engine = state.vocabulary.lock().unwrap();
    engine.delete_term(&id);
    engine.get_terms()
}

#[tauri::command]
fn clean_with_vocabulary(text: String, state: State<'_, AppState>) -> String {
    state.vocabulary.lock().unwrap().apply_vocabulary(&text)
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .manage(AppState {
            injector: TextInjector::new(),
            vocabulary: Mutex::new(VocabularyEngine::new()),
        })
        .setup(|app| {
            let _tray = tray::setup_system_tray(app.handle())?;
            log::info!("VoiceFlow Windows Native Core initialized successfully.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            inject_dictated_text,
            get_active_window_title,
            get_vocabulary_terms,
            add_vocabulary_term,
            delete_vocabulary_term,
            clean_with_vocabulary
        ])
        .run(tauri::generate_context!())
        .expect("error while running VoiceFlow Windows application");
}
