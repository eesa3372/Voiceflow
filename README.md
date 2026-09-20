# VoiceFlow ⚡

> **Windows 11 Native Voice Dictation & Text Injection Engine**

VoiceFlow is a high-performance desktop dictation assistant designed for fast, accurate voice-to-text input across any active application on Windows 11. Powered by **Gemini 2.5 Flash** for natural language post-processing and custom vocabulary handling, VoiceFlow natively injects transcribed text directly into active windows using low-level system input APIs.

---

## ✨ Features

- **Windows 11 Native Injection**: Uses `SendInput` (`KEYEVENTF_UNICODE`) to stream structured, formatted text directly into target applications (e.g., VS Code, ChemDraw, Slack, Notion, Word) with an automatic clipboard fallback.
- **Technical Vocabulary Engine**: Built-in support for specialized domain terms, maintaining precise capitalization and formatting for scientific/chemistry terms (e.g., `LiHMDS`, `DIBAL-H`, `Suzuki coupling`, `RDKit`, `ChemDraw`).
- **Flexible Dictation Modes**:
  - **Push-to-Talk**: Hold to record, release to transcribe and inject.
  - **Toggle Mode**: Click once to start, click again to stop.
- **Real-Time Audio Waveform**: Live amplitude level feedback while listening.
- **Microphone Selection**: Switch active input devices directly within the UI.
- **System Tray Integration**: Quietly runs in the background with customizable global hotkeys.

---

## 🛠️ Architecture Overview
