import { DarkMode, API } from '../shared/utils.js';
import { AudioPlayer } from './audio-player.js';

class StudentApp {
    constructor() {
        this.initElements();
        this.initAudioPlayer();
        this.setupEventListeners();
        this.setupBroadcastChannel();
        this.pendingAudio = null;
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

        // Initialize dark mode
        DarkMode.init(this.darkModeToggle);
    }

    initAudioPlayer() {
        this.audioPlayer = new AudioPlayer({
            onPlayStateChange: (isPlaying) => {
                this.playButton.querySelector('.btn-icon').textContent = 
                    isPlaying ? '⏹' : '▶';
            },
            onError: (error) => {
                // Create or update error message element
                let errorElement = document.getElementById('audioError');
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.id = 'audioError';
                    errorElement.className = 'error-message';
                    this.incomingText.parentNode.insertBefore(errorElement, this.incomingText);
                }
                errorElement.textContent = error;
                
                // Auto-hide error after 5 seconds
                setTimeout(() => {
                    errorElement.style.opacity = '0';
                    setTimeout(() => {
                        if (errorElement.parentNode) {
                            errorElement.parentNode.removeChild(errorElement);
                        }
                    }, 300); // Remove after fade out
                }, 5000);
            }
        });
    }

    setupEventListeners() {
        // Play button
        this.playButton.addEventListener('click', () => this.handlePlayClick());

        // Volume control
        this.volumeControl.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            this.audioPlayer.setVolume(volume);
        });

        // Speed control
        this.speedControl.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.audioPlayer.setSpeed(speed);
        });

        // Auto-scroll when new content is added
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
                
                // Update transcription box
                if (transcription) {
                    this.transcriptionText.innerHTML += transcription + '<br><br>';
                }
                
                // Update translation box
                if (translation) {
                    // Create word spans for highlighting
                    const words = translation.split(' ').map(word => 
                        `<span class="word">${word}</span>`
                    ).join(' ');
                    this.incomingText.innerHTML += words + '<br><br>';
                    this.synthesizeAndPlay(translation, true);
                }
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
            const response = await API.synthesizeSpeech(
                text,
                this.voiceSelect.value,
                parseFloat(this.speedControl.value)
            );

            if (response.success && response.data.audio) {
                await this.audioPlayer.playAudio(
                    response.data.audio,
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
            const response = await API.synthesizeSpeech(
                text,
                this.voiceSelect.value,
                parseFloat(this.speedControl.value)
            );

            if (response.success && response.data.audio) {
                await this.audioPlayer.playAudio(
                    response.data.audio,
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
            // Don't show error for auto-play attempts
            if (!autoPlay) {
                this.audioPlayer.onError(`Error synthesizing speech: ${error.message}`);
            }
        }
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    new StudentApp();
});
