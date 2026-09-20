import { VocabularyItem } from "../types";

export interface DictateResponse {
  rawTranscript: string;
  finalText: string;
  charCount: number;
  wordCount: number;
  error?: string;
}

export class SpeechAudioEngine {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private onAudioLevelCallback?: (level: number) => void;
  private webSpeechRecognition: any = null;
  private liveTranscriptBuffer: string = "";

  constructor() {
    this.initWebSpeech();
  }

  private initWebSpeech() {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          this.webSpeechRecognition = new SpeechRecognition();
          this.webSpeechRecognition.continuous = true;
          this.webSpeechRecognition.interimResults = true;
          this.webSpeechRecognition.lang = "en-US";

          this.webSpeechRecognition.onresult = (event: any) => {
            let finalResult = "";
            let interimResult = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalResult += event.results[i][0].transcript;
              } else {
                interimResult += event.results[i][0].transcript;
              }
            }
            if (finalResult) {
              this.liveTranscriptBuffer += " " + finalResult;
            }
          };

          this.webSpeechRecognition.onerror = (e: any) => {
            console.warn("WebSpeech recognition warning:", e);
          };
        } catch (err) {
          console.warn("WebSpeech could not be initialized:", err);
        }
      }
    }
  }

  public async startRecording(
    deviceId?: string,
    onAudioLevel?: (level: number) => void
  ): Promise<boolean> {
    this.audioChunks = [];
    this.liveTranscriptBuffer = "";
    this.onAudioLevelCallback = onAudioLevel;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Set up Web Audio Analyser for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const checkLevel = () => {
          if (this.analyser && this.onAudioLevelCallback) {
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            this.onAudioLevelCallback(avg / 255);
            this.animationFrameId = requestAnimationFrame(checkLevel);
          }
        };
        checkLevel();
      } catch (err) {
        console.warn("Audio visualizer setup skipped:", err);
      }

      // Start MediaRecorder for high-fidelity audio capture
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(250); // 250ms chunks for streaming capability

      // Also run browser speech recognition in parallel for instant phrase hints
      if (this.webSpeechRecognition) {
        try {
          this.webSpeechRecognition.start();
        } catch {
          // May already be active
        }
      }

      return true;
    } catch (err) {
      console.error("Microphone activation failed:", err);
      return false;
    }
  }

  public async stopRecording(): Promise<{ audioBlob: Blob | null; liveTranscript: string }> {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.webSpeechRecognition) {
      try {
        this.webSpeechRecognition.stop();
      } catch {}
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        this.cleanupStream();
        resolve({ audioBlob: null, liveTranscript: this.liveTranscriptBuffer.trim() });
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob =
          this.audioChunks.length > 0
            ? new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || "audio/webm" })
            : null;
        this.cleanupStream();
        resolve({ audioBlob, liveTranscript: this.liveTranscriptBuffer.trim() });
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanupStream();
        resolve({ audioBlob: null, liveTranscript: this.liveTranscriptBuffer.trim() });
      }
    });
  }

  private cleanupStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
  }

  /**
   * Dispatches speech audio or transcript through the VoiceFlow grammar & cleanup pipeline
   */
  public async processDictation(
    audioBlob: Blob | null,
    liveTranscript: string,
    vocabulary: VocabularyItem[]
  ): Promise<DictateResponse> {
    try {
      let audioBase64: string | undefined = undefined;

      if (audioBlob && audioBlob.size > 0) {
        audioBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      const res = await fetch("/api/dictate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData: audioBase64,
          rawTranscriptText: liveTranscript,
          customTerms: vocabulary,
        }),
      });

      if (res.ok) {
        return await res.json();
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.warn("Backend dictate call failed, running safe client fallback:", err);

      // Deterministic offline fallback: apply vocabulary + capitalize + punctuation
      let text = liveTranscript.trim();
      if (!text) {
        return { rawTranscript: "", finalText: "", charCount: 0, wordCount: 0 };
      }

      // Apply vocabulary
      for (const item of vocabulary) {
        for (const alt of item.alternatives) {
          const re = new RegExp(`\\b${alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
          text = text.replace(re, item.term);
        }
      }

      text = text.charAt(0).toUpperCase() + text.slice(1);
      if (!/[.?!]$/.test(text)) {
        text += ".";
      }

      return {
        rawTranscript: liveTranscript,
        finalText: text,
        charCount: text.length,
        wordCount: text.split(/\s+/).length,
      };
    }
  }

  public async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput");
    } catch {
      return [];
    }
  }
}
