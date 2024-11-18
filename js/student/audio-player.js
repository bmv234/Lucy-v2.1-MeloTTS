import { AudioUtils, TextHighlighter } from '../shared/utils.js';

export class AudioPlayer {
    constructor(options) {
        this.onPlayStateChange = options.onPlayStateChange;
        this.onError = options.onError;
        
        this.isPlaying = false;
        this.currentAudio = null;
        this.highlightInterval = null;
        this.hasUserInteracted = false;
    }

    async playAudio(audioBase64, text, options = {}) {
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
            const audioBlob = AudioUtils.base64ToBlob(audioBase64);
            this.currentAudio = await AudioUtils.createAudioElement(audioBlob, volume);
            
            // Set up event listeners
            this.currentAudio.addEventListener('error', (e) => {
                console.error('Audio error:', e);
                this.stop();
                // More user-friendly error message
                if (!this.hasUserInteracted && autoPlay) {
                    this.onError('Please click the play button to start audio playback');
                } else {
                    this.onError('Error playing audio. Please try again.');
                }
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('Audio playback ended');
                this.stop();
            });

            // Set playback speed
            this.currentAudio.playbackRate = speed;

            // Start playback
            try {
                await this.currentAudio.play();
                this.isPlaying = true;
                this.hasUserInteracted = true;
                this.onPlayStateChange(true);

                // Handle text highlighting if container is provided
                if (highlightedTextContainer && text) {
                    this.setupTextHighlighting(text, highlightedTextContainer);
                }
            } catch (playError) {
                console.error('Playback error:', playError);
                
                if (!this.hasUserInteracted && autoPlay) {
                    // Don't show error for autoplay restriction
                    console.log('Autoplay restricted, waiting for user interaction');
                } else {
                    throw playError;
                }
            }

        } catch (error) {
            console.error('Audio setup error:', error);
            this.stop();
            
            // More specific error messages
            if (error.name === 'NotAllowedError') {
                this.onError('Please click the play button to start audio playback');
            } else {
                this.onError(`Error playing audio: ${error.message}`);
            }
        }
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            URL.revokeObjectURL(this.currentAudio.src);
            this.currentAudio = null;
        }

        if (this.highlightInterval) {
            clearInterval(this.highlightInterval);
            this.highlightInterval = null;
        }

        this.isPlaying = false;
        this.onPlayStateChange(false);
    }

    setVolume(volume) {
        if (this.currentAudio) {
            this.currentAudio.volume = volume;
        }
    }

    setSpeed(speed) {
        if (this.currentAudio) {
            this.currentAudio.playbackRate = speed;
        }
    }

    setupTextHighlighting(text, container) {
        // Clear any existing highlights
        TextHighlighter.clearHighlights(
            Array.from(container.getElementsByClassName('word'))
        );

        // Create word spans
        TextHighlighter.createWordSpans(text, container);

        // Start highlighting words
        const words = Array.from(container.getElementsByClassName('word'));
        if (words.length > 0 && this.currentAudio) {
            this.highlightInterval = TextHighlighter.highlightWords(
                words,
                this.currentAudio.duration * 1000,
                () => {
                    // Cleanup when highlighting is complete
                    this.highlightInterval = null;
                }
            );

            // Clear interval if audio ends early
            this.currentAudio.addEventListener('ended', () => {
                if (this.highlightInterval) {
                    clearInterval(this.highlightInterval);
                    this.highlightInterval = null;
                }
            });
        }
    }
}
