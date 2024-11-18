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
        this.incomingText = document.getElementById('incomingText');
        this.playButton = document.getElementById('playButton');
        this.volumeControl = document.getElementById('volumeControl');
        this.speedControl = document.getElementById('speedControl');
        this.voiceSelect = document.getElementById('voiceSelect');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.highlightedText = document.getElementById('highlightedText');

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
                    this.highlightedText.parentNode.insertBefore(errorElement, this.highlightedText);
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
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    this.incomingText.scrollTop = this.incomingText.scrollHeight;
                }
            });
        });

        observer.observe(this.incomingText, {
            childList: true,
            subtree: true
        });

        // Add styles for error message
        const style = document.createElement('style');
        style.textContent = `
            .error-message {
                background-color: var(--error-color);
                color: white;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                opacity: 1;
                transition: opacity 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }

    setupBroadcastChannel() {
        this.broadcastChannel = new BroadcastChannel('lucy-v4-channel');
        this.broadcastChannel.onmessage = (event) => {
            if (event.data.type === 'translation') {
                const newText = event.data.text;
                this.incomingText.innerHTML += newText + '<br><br>';
                this.highlightedText.textContent = newText;
                this.synthesizeAndPlay(newText, true);
            }
        };
    }

    async handlePlayClick() {
        const text = this.highlightedText.textContent.trim();
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
                        highlightedTextContainer: this.highlightedText,
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
                        highlightedTextContainer: this.highlightedText,
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
