import { AudioUtils, TextHighlighter } from '../shared/utils.js';

export class AudioPlayer {
    constructor(options) {
        this.onPlayStateChange = options.onPlayStateChange;
        this.onError = options.onError;
        
        this.isPlaying = false;
        this.currentAudio = null;
        this.audioContext = null;
        this.audioSource = null;
        this.animationFrameId = null;
        this.hasUserInteracted = false;
        this.wordTimings = null;
        this.highlightedWords = null;
        this.currentWordIndex = -1;
        this.startTime = 0;
        this.playbackSpeed = 1.0;

        // Debug elements
        this.debugPanel = document.getElementById('debugPanel');
        this.debugTime = document.getElementById('debugTime');
        this.debugSpeed = document.getElementById('debugSpeed');
        this.debugWord = document.getElementById('debugWord');
        this.debugTimings = document.getElementById('debugTimings');

        // Setup debug toggle
        const debugToggle = document.getElementById('debugToggle');
        if (debugToggle) {
            debugToggle.addEventListener('click', () => {
                document.body.classList.toggle('debug');
            });
        }

        // Initialize Web Audio Context
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (e) {
            console.error('Web Audio API not supported:', e);
        }
    }

    async playAudio(audioData, text, options = {}) {
        const {
            volume = 1.0,
            speed = 1.0,
            highlightedTextContainer = null,
            autoPlay = false
        } = options;

        if (this.isPlaying) {
            this.stop();
            return;
        }

        try {
            // Handle new response format that includes word timings
            const audioBase64 = typeof audioData === 'string' ? audioData : audioData.audio;
            this.wordTimings = typeof audioData === 'string' ? null : audioData.word_timings;

            console.log('Received audio data:', { 
                hasAudio: !!audioBase64, 
                wordTimings: this.wordTimings 
            });

            const audioBlob = AudioUtils.base64ToBlob(audioBase64);
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Decode audio data
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Create source node
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = audioBuffer;
            
            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;
            
            // Connect nodes
            this.audioSource.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Set playback speed
            this.playbackSpeed = speed;
            this.audioSource.playbackRate.value = speed;

            // Setup event listeners
            this.audioSource.onended = () => {
                console.log('Audio playback ended');
                this.stop();
            };

            // Create word spans if container provided
            if (highlightedTextContainer && text && this.wordTimings) {
                // Create spans using the actual words from word timings
                const words = this.wordTimings.map(t => t.word);
                highlightedTextContainer.innerHTML = words.map((word, i) => 
                    `<span class="word" data-index="${i}">${word}</span>`
                ).join(' ');
                
                this.highlightedWords = Array.from(highlightedTextContainer.getElementsByClassName('word'));
                
                console.log('Created word elements:', {
                    count: this.highlightedWords.length,
                    words: this.highlightedWords.map(w => w.textContent)
                });
            }

            // Start playback
            this.startTime = this.audioContext.currentTime;
            this.audioSource.start();
            this.isPlaying = true;
            this.hasUserInteracted = true;
            this.onPlayStateChange(true);

            // Start highlighting animation
            this.updateHighlighting();

        } catch (error) {
            console.error('Audio setup error:', error);
            this.stop();
            
            if (error.name === 'NotAllowedError') {
                this.onError('Please click the play button to start audio playback');
            } else {
                this.onError(`Error playing audio: ${error.message}`);
            }
        }
    }

    stop() {
        if (this.audioSource) {
            try {
                this.audioSource.stop();
            } catch (e) {
                // Ignore errors if already stopped
            }
            this.audioSource = null;
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Clear highlights
        if (this.highlightedWords) {
            TextHighlighter.clearHighlights(this.highlightedWords);
            this.highlightedWords = null;
        }

        this.wordTimings = null;
        this.currentWordIndex = -1;
        this.isPlaying = false;
        this.onPlayStateChange(false);
    }

    setVolume(volume) {
        if (this.audioContext && this.audioSource) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;
            this.audioSource.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
        }
    }

    setSpeed(speed) {
        if (this.audioSource) {
            this.playbackSpeed = speed;
            this.audioSource.playbackRate.value = speed;
            if (this.debugSpeed) {
                this.debugSpeed.textContent = speed;
            }
        }
    }

    updateHighlighting() {
        if (!this.isPlaying || !this.audioSource || !this.wordTimings || !this.highlightedWords) {
            return;
        }

        const elapsedTime = (this.audioContext.currentTime - this.startTime) * this.playbackSpeed;

        // Update debug info
        if (this.debugTime) {
            this.debugTime.textContent = elapsedTime.toFixed(3);
        }
        if (this.debugSpeed) {
            this.debugSpeed.textContent = this.playbackSpeed.toFixed(2);
        }

        // Clear previous highlights
        TextHighlighter.clearHighlights(this.highlightedWords);

        // Find and highlight current word
        let foundWord = false;
        for (let i = 0; i < Math.min(this.wordTimings.length, this.highlightedWords.length); i++) {
            const timing = this.wordTimings[i];
            // Add a small offset to compensate for any delay
            const start = timing.start - 0.05;
            const end = timing.end - 0.05;

            if (elapsedTime >= start && elapsedTime <= end) {
                this.highlightedWords[i].classList.add('highlighted');
                foundWord = true;

                // Update debug info
                if (this.debugWord) {
                    this.debugWord.textContent = `${timing.word} [${start.toFixed(3)}-${end.toFixed(3)}] at ${elapsedTime.toFixed(3)}s`;
                }

                console.log('Highlighting:', {
                    word: timing.word,
                    index: i,
                    elapsedTime,
                    range: `${start}-${end}`,
                    speed: this.playbackSpeed
                });
                break;
            }
        }

        if (!foundWord && this.debugWord) {
            this.debugWord.textContent = 'none';
        }

        // Schedule next update
        this.animationFrameId = requestAnimationFrame(() => this.updateHighlighting());
    }
}
