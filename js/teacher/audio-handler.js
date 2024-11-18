import { StatusMessage, API } from '../shared/utils.js';

export class AudioHandler {
    constructor(options) {
        this.onTranscriptionUpdate = options.onTranscriptionUpdate;
        this.onTranslationUpdate = options.onTranslationUpdate;
        this.onStatusChange = options.onStatusChange;
        this.broadcastChannel = new BroadcastChannel('lucy-v4-channel');
        
        this.audioContext = null;
        this.microphone = null;
        this.myvad = null;
        this.vadInitialized = false;
    }

    async initVAD() {
        if (this.vadInitialized) {
            console.log('VAD already initialized');
            return true;
        }

        try {
            console.log('Checking VAD dependencies...');
            if (typeof vad === 'undefined') {
                throw new Error('Silero VAD library not loaded');
            }

            // Create a temporary audio context to ensure worklet is loaded
            const tempContext = new (window.AudioContext || window.webkitAudioContext)();
            await tempContext.audioWorklet.addModule(window.WEBVAD_WORKER_PATH);
            tempContext.close();

            console.log('Creating VAD instance...');
            this.myvad = await vad.MicVAD.new({
                onSpeechStart: () => {
                    console.log('VAD: Speech started');
                    this.onStatusChange('Listening...', 'info');
                },
                onSpeechEnd: (audio) => {
                    console.log('VAD: Speech ended');
                    this.onStatusChange('Processing...', 'info');
                    this.processAudio(audio);
                },
                onVADMisfire: () => {
                    console.log('VAD: Misfire');
                    this.onStatusChange('Ready', 'success');
                }
            });

            console.log('Silero VAD initialized successfully');
            this.vadInitialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing VAD:', error);
            this.onStatusChange(`Error initializing voice detection: ${error.message}`, 'error');
            return false;
        }
    }

    async startListening(fromLanguage, toLanguage) {
        console.log('Starting listening process...');
        
        try {
            // Initialize audio context if needed
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                await this.audioContext.resume();
                console.log('Audio context initialized');
            }

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Initialize VAD if needed
            if (!this.vadInitialized) {
                console.log('Initializing VAD...');
                const success = await this.initVAD();
                if (!success) {
                    this.onStatusChange('Error initializing voice detection', 'error');
                    return false;
                }
            }

            // Start VAD
            console.log('Starting VAD...');
            await this.myvad.start();
            console.log('Started listening');
            this.onStatusChange('Ready', 'success');
            return true;
        } catch (error) {
            console.error('Error starting audio:', error);
            this.onStatusChange(`Error starting voice detection: ${error.message}`, 'error');
            return false;
        }
    }

    async stopListening() {
        if (this.myvad) {
            this.myvad.pause();
            console.log('Stopped listening');
            this.onStatusChange('Stopped', 'info');
            return true;
        }
        return false;
    }

    async processAudio(audio) {
        console.log('Converting audio data...');
        const audioData = new Int16Array(audio.map(x => Math.max(-32768, Math.min(32767, Math.round(x * 32767)))));
        console.log('Audio data converted, samples:', audioData.length);

        // Convert audio data to base64
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData.buffer)));
        
        try {
            const response = await API.processAudio(
                base64Audio,
                this.fromLanguage,
                this.toLanguage,
                this.toLanguage.toUpperCase()
            );

            if (response.success) {
                this.displayResults(response.data);
            } else {
                throw new Error(response.error || 'Failed to process audio');
            }
        } catch (error) {
            console.error('Error sending audio data:', error);
            this.onStatusChange('Error processing audio', 'error');
        }
    }

    displayResults(data) {
        console.log('Displaying results:', data);
        
        if (data.transcription) {
            this.onTranscriptionUpdate(data.transcription);
        }
        
        if (data.translation) {
            this.onTranslationUpdate(data.translation);
            this.broadcastResults(data.translation);
        }
        
        this.onStatusChange('Ready', 'success');
    }

    broadcastResults(translation) {
        this.broadcastChannel.postMessage({
            type: 'translation',
            text: translation,
            fromLang: this.fromLanguage,
            toLang: this.toLanguage
        });
    }

    setLanguages(fromLang, toLang) {
        this.fromLanguage = fromLang;
        this.toLanguage = toLang;
    }
}
