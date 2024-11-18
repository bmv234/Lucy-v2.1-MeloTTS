import { API } from '../shared/utils.js';

export class AudioHandler {
    constructor(options) {
        this.onTranscriptionUpdate = options.onTranscriptionUpdate;
        this.onTranslationUpdate = options.onTranslationUpdate;
        this.onStatusChange = options.onStatusChange;
        this.teacherCode = options.teacherCode;
        
        this.fromLanguage = 'en';
        this.toLanguage = 'es';
        this.isListening = false;
        this.muted = false;
        this.vad = null;
        this.audioContext = null;
        this.audioStream = null;
    }

    async initVAD() {
        try {
            // Create VAD instance
            this.vad = await window.vad.MicVAD.new({
                onSpeechStart: () => {
                    console.log('Speech start detected');
                    this.onStatusChange('Speech detected', 'info');
                },
                onSpeechEnd: async (audio) => {
                    console.log('Speech end detected');
                    this.onStatusChange('Processing speech...', 'info');
                    await this.processAudio(audio);
                },
                onVADMisfire: () => {
                    console.log('VAD misfire');
                    this.onStatusChange('Ready', 'success');
                }
            });
            console.log('VAD initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize VAD:', error);
            this.onStatusChange('Failed to initialize speech detection', 'error');
            return false;
        }
    }

    async startListening() {
        if (!this.vad) {
            console.error('VAD not initialized');
            this.onStatusChange('Speech detection not initialized', 'error');
            return false;
        }

        try {
            // Request microphone permission and start VAD
            await this.vad.start();
            this.isListening = true;
            this.onStatusChange('Listening...', 'success');
            return true;
        } catch (error) {
            console.error('Failed to start listening:', error);
            this.onStatusChange('Failed to start listening', 'error');
            return false;
        }
    }

    async stopListening() {
        if (!this.vad) {
            console.error('VAD not initialized');
            return false;
        }

        try {
            // Stop VAD and clean up
            await this.vad.pause();
            this.isListening = false;
            this.onStatusChange('Stopped listening', 'info');
            return true;
        } catch (error) {
            console.error('Failed to stop listening:', error);
            this.onStatusChange('Failed to stop listening', 'error');
            return false;
        }
    }

    async processAudio(audio) {
        try {
            // Convert audio to base64
            const audioData = this.float32ArrayToBase64(audio);
            
            // Process audio through API
            const response = await API.processAudio(
                audioData,
                this.fromLanguage,
                this.toLanguage,
                this.teacherCode
            );
            
            if (response.success) {
                // Update transcription and translation
                if (response.data.transcription) {
                    this.onTranscriptionUpdate(response.data.transcription);
                }
                if (response.data.translation) {
                    this.onTranslationUpdate(response.data.translation);
                }
                this.onStatusChange('Ready', 'success');
            } else {
                throw new Error(response.error || 'Failed to process audio');
            }
        } catch (error) {
            console.error('Error processing audio:', error);
            this.onStatusChange('Error processing speech', 'error');
        }
    }

    setLanguages(fromLang, toLang) {
        this.fromLanguage = fromLang;
        this.toLanguage = toLang;
    }

    float32ArrayToBase64(float32Array) {
        // Convert Float32Array to Int16Array
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert Int16Array to Base64
        const buffer = new ArrayBuffer(int16Array.length * 2);
        new Int16Array(buffer).set(int16Array);
        const binary = new Uint8Array(buffer);
        const bytes = Array.from(binary).map(byte => String.fromCharCode(byte)).join('');
        return btoa(bytes);
    }
}
