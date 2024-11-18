import { DarkMode, API } from '../shared/utils.js';
import { AudioPlayer } from './audio-player.js';

class StudentApp {
    constructor(studentCode, teacherCode) {
        this.studentCode = studentCode;
        this.teacherCode = teacherCode;
        console.log('Initializing StudentApp with teacher code:', teacherCode);
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
        this.downloadButton = document.getElementById('downloadButton');

        // Initialize dark mode
        DarkMode.init(this.darkModeToggle);
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
    }

    setupBroadcastChannel() {
        console.log('Setting up broadcast channel with teacher code:', this.teacherCode);
        this.broadcastChannel = new BroadcastChannel('lucy-v4-channel');
        this.broadcastChannel.onmessage = (event) => {
            console.log('Received broadcast message:', event.data);
            
            // Only process messages from our teacher's session
            if (event.data.teacherCode === this.teacherCode) {
                console.log('Processing message from teacher');
                if (event.data.type === 'translation') {
                    // Update transcription if provided
                    if (event.data.transcription !== undefined) {
                        requestAnimationFrame(() => {
                            // Handle empty string case
                            this.transcriptionText.textContent = event.data.transcription || '';
                            this.transcriptionText.scrollTop = this.transcriptionText.scrollHeight;
                        });
                    }
                    
                    // Update translation if provided
                    if (event.data.text !== undefined) {
                        requestAnimationFrame(() => {
                            // Handle empty string case
                            this.incomingText.textContent = event.data.text || '';
                            this.incomingText.scrollTop = this.incomingText.scrollHeight;
                            
                            // Only synthesize if there's new text
                            if (event.data.text.trim()) {
                                this.synthesizeAndPlay(event.data.text, true);
                            }
                        });
                    }
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

// Initialize the application when the page loads
window.addEventListener('load', async () => {
    // Get student code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const studentCode = urlParams.get('code');
    
    // Redirect to session page if no code
    if (!studentCode) {
        window.location.href = '/';
    }

    // Display student code
    document.getElementById('studentCodeDisplay').textContent = studentCode;
    
    // Validate session and initialize app
    try {
        const response = await fetch('/api/v1/validate_student_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ student_code: studentCode })
        });
        const data = await response.json();
        
        if (!data.success || !data.data.valid) {
            window.location.href = '/';
        } else {
            console.log('Session validated, teacher code:', data.data.teacher_code);
            // Initialize app with student code and teacher code
            const app = new StudentApp(studentCode, data.data.teacher_code);
            
            // Set initial content
            if (data.data.transcription) {
                app.transcriptionText.textContent = data.data.transcription;
            }
            if (data.data.translation) {
                app.incomingText.textContent = data.data.translation;
            }
        }
    } catch (error) {
        console.error('Failed to validate session:', error);
        window.location.href = '/';
    }
});
