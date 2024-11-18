import { DarkMode, API } from '../shared/utils.js';
import { AudioPlayer } from './audio-player.js';

class StudentApp {
    constructor() {
        this.initElements();
        this.initAudioPlayer();
        this.setupEventListeners();
        this.setupBroadcastChannel();
        this.pendingAudio = null;
        this.loadStoredContent();
    }

    initElements() {
        // UI Elements
        this.transcriptionText = document.getElementById('transcriptionText');
        this.incomingText = document.getElementById('incomingText');
        this.playButton = document.getElementById('playButton');
        this.volumeControl = document.getElementById('volumeControl');
        this.speedControl = document.getElementById('speedControl');
        this.voiceSelect = document.getElementById('voiceSelect');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.downloadButton = document.getElementById('downloadButton');

        // Initialize dark mode
        DarkMode.init(this.darkModeToggle);
    }

    loadStoredContent() {
        // Load stored content from localStorage
        const storedTranscription = localStorage.getItem('transcriptionText');
        const storedTranslation = localStorage.getItem('incomingText');

        if (storedTranscription) {
            this.transcriptionText.textContent = storedTranscription;
        }
        if (storedTranslation) {
            this.incomingText.textContent = storedTranslation;
        }
    }

    saveContent() {
        localStorage.setItem('transcriptionText', this.transcriptionText.textContent);
        localStorage.setItem('incomingText', this.incomingText.textContent);
    }

    downloadSession() {
        const transcription = this.transcriptionText.textContent.trim();
        const translation = this.incomingText.textContent.trim();
        
        const content = `Original Text:\n\n${transcription}\n\n\nTranslation:\n\n${translation}`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/[/,: ]/g, '-');
        
        a.href = url;
        a.download = `conversation-session-${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    initAudioPlayer() {
        this.audioPlayer = new AudioPlayer({
            onPlayStateChange: (isPlaying) => {
                this.playButton.querySelector('.btn-icon').textContent = 
                    isPlaying ? '⏹' : '▶';
            },
            onError: (error) => {
                let errorElement = document.getElementById('audioError');
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.id = 'audioError';
                    errorElement.className = 'error-message';
                    this.incomingText.parentNode.insertBefore(errorElement, this.incomingText);
                }
                errorElement.textContent = error;
                
                setTimeout(() => {
                    errorElement.style.opacity = '0';
                    setTimeout(() => {
                        if (errorElement.parentNode) {
                            errorElement.parentNode.removeChild(errorElement);
                        }
                    }, 300);
                }, 5000);
            }
        });
    }

    setupEventListeners() {
        this.playButton.addEventListener('click', () => this.handlePlayClick());

        this.volumeControl.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            this.audioPlayer.setVolume(volume);
        });

        this.speedControl.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.audioPlayer.setSpeed(speed);
        });

        this.downloadButton.addEventListener('click', () => this.downloadSession());

        const observeTextBox = (element) => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        element.scrollTop = element.scrollHeight;
                    }
                });
            });

            observer.observe(element, {
                childList: true,
                subtree: true
            });
        };

        observeTextBox(this.transcriptionText);
        observeTextBox(this.incomingText);
    }

    setupBroadcastChannel() {
        this.broadcastChannel = new BroadcastChannel('lucy-v4-channel');
        this.broadcastChannel.onmessage = (event) => {
            if (event.data.type === 'translation') {
                const transcription = event.data.transcription || '';
                const translation = event.data.text || '';
                
                if (transcription) {
                    this.transcriptionText.textContent += transcription + ' ';
                }
                
                if (translation) {
                    // Store the plain text
                    const currentText = this.incomingText.textContent;
                    const newText = currentText ? currentText + ' ' + translation : translation;
                    this.incomingText.textContent = newText;
                    
                    // Synthesize and play the new text
                    this.synthesizeAndPlay(translation, true);
                }
                
                this.saveContent();
            }
        };
    }

    async handlePlayClick() {
        const text = this.incomingText.textContent.trim();
        if (!text) {
            console.log('No text to speak');
            return;
        }

        try {
            console.log('Synthesizing speech for text:', text);
            const response = await API.synthesizeSpeech(
                text,
                this.voiceSelect.value,
                parseFloat(this.speedControl.value)
            );

            console.log('API Response:', response);

            if (response.success && response.data) {
                await this.audioPlayer.playAudio(
                    response.data,
                    text,
                    {
                        volume: parseFloat(this.volumeControl.value),
                        speed: parseFloat(this.speedControl.value),
                        highlightedTextContainer: this.incomingText,
                        autoPlay: false
                    }
                );
            } else {
                throw new Error(response.error || 'Failed to synthesize speech');
            }
        } catch (error) {
            console.error('Error:', error);
            this.audioPlayer.onError(`Error synthesizing speech: ${error.message}`);
        }
    }

    async synthesizeAndPlay(text, autoPlay = false) {
        try {
            console.log('Auto-synthesizing speech for text:', text);
            const response = await API.synthesizeSpeech(
                text,
                this.voiceSelect.value,
                parseFloat(this.speedControl.value)
            );

            console.log('Auto-play API Response:', response);

            if (response.success && response.data) {
                await this.audioPlayer.playAudio(
                    response.data,
                    text,
                    {
                        volume: parseFloat(this.volumeControl.value),
                        speed: parseFloat(this.speedControl.value),
                        highlightedTextContainer: this.incomingText,
                        autoPlay
                    }
                );
            }
        } catch (error) {
            console.error('Auto-play error:', error);
            if (!autoPlay) {
                this.audioPlayer.onError(`Error synthesizing speech: ${error.message}`);
            }
        }
    }
}

window.addEventListener('load', () => {
    new StudentApp();
});
