import { DarkMode, StatusMessage, API } from '../shared/utils.js';
import { AudioHandler } from './audio-handler.js';

class TeacherApp {
    constructor(teacherCode) {
        this.teacherCode = teacherCode;
        console.log('Initializing TeacherApp with code:', teacherCode);
        this.initElements();
        this.initAudioHandler();
        this.setupEventListeners();
        this.setupBroadcastChannel();
        this.initialize();
    }

    initElements() {
        // UI elements
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.clearButton = document.getElementById('clearButton');
        this.fromLanguage = document.getElementById('fromLanguage');
        this.toLanguage = document.getElementById('toLanguage');
        this.transcriptionText = document.getElementById('transcriptionText');
        this.translationText = document.getElementById('translationText');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.downloadButton = document.getElementById('downloadButton');
        
        // Create status element
        this.statusDiv = StatusMessage.createStatusElement(
            document.querySelector('.recording-controls')
        );

        // Language data - updated to match supported languages in config.py
        this.languageNames = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'zh': 'Chinese',
            'ja': 'Japanese'
        };
        
        this.languagePairs = {};
    }

    setupBroadcastChannel() {
        console.log('Setting up broadcast channel');
        this.broadcastChannel = new BroadcastChannel('lucy-v4-channel');
    }

    broadcastUpdate() {
        // Send full content to student
        console.log('Broadcasting update');
        const message = {
            type: 'translation',
            transcription: this.transcriptionText.value,
            text: this.translationText.value,
            teacherCode: this.teacherCode
        };
        console.log('Broadcast message:', message);
        this.broadcastChannel.postMessage(message);
    }

    downloadSession() {
        const transcription = this.transcriptionText.value.trim();
        const translation = this.translationText.value.trim();
        
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

    initAudioHandler() {
        this.audioHandler = new AudioHandler({
            onTranscriptionUpdate: (text) => {
                requestAnimationFrame(() => {
                    this.transcriptionText.value += `${text} `;
                    this.transcriptionText.scrollTop = this.transcriptionText.scrollHeight;
                    // Broadcast full content update
                    this.broadcastUpdate();
                });
            },
            onTranslationUpdate: (text) => {
                requestAnimationFrame(() => {
                    this.translationText.value += `${text} `;
                    this.translationText.scrollTop = this.translationText.scrollHeight;
                    // Broadcast full content update
                    this.broadcastUpdate();
                });
            },
            onStatusChange: (message, type) => {
                StatusMessage.show(message, type, this.statusDiv);
            },
            teacherCode: this.teacherCode  // Pass teacher code to AudioHandler
        });
    }

    setupEventListeners() {
        // Button controls
        this.startButton.addEventListener('click', () => this.startListening());
        this.stopButton.addEventListener('click', () => this.stopListening());
        this.clearButton.addEventListener('click', () => this.clearResults());
        this.downloadButton.addEventListener('click', () => this.downloadSession());
        
        // Language selection
        this.fromLanguage.addEventListener('change', () => this.updateToLanguages());
        this.toLanguage.addEventListener('change', () => {
            // Update audio handler when target language changes
            this.audioHandler.setLanguages(this.fromLanguage.value, this.toLanguage.value);
        });
        
        // Dark mode
        DarkMode.init(this.darkModeToggle);

        // Monitor text changes
        ['input', 'change'].forEach(event => {
            this.transcriptionText.addEventListener(event, () => this.broadcastUpdate());
            this.translationText.addEventListener(event, () => this.broadcastUpdate());
        });
    }

    async initialize() {
        this.stopButton.disabled = true;
        this.startButton.disabled = true;

        try {
            await this.initLanguages();
            console.log('Initializing VAD on page load...');
            await this.audioHandler.initVAD();
        } catch (error) {
            console.error('Failed to initialize:', error);
            StatusMessage.show('Failed to initialize application', 'error', this.statusDiv);
        }
    }

    async initLanguages() {
        try {
            const response = await API.fetchLanguages();
            if (response.success) {
                this.languagePairs = this.filterLanguagePairs(response.data.language_pairs);
                this.populateLanguageDropdowns();
                this.startButton.disabled = false;
                StatusMessage.show('Ready', 'success', this.statusDiv);
            } else {
                throw new Error('Failed to fetch language data');
            }
        } catch (error) {
            console.error('Error fetching languages:', error);
            StatusMessage.show('Error loading languages', 'error', this.statusDiv);
        }
    }

    filterLanguagePairs(pairs) {
        const filteredPairs = {};
        for (const [fromLang, toLangs] of Object.entries(pairs)) {
            if (this.languageNames[fromLang]) {
                filteredPairs[fromLang] = toLangs.filter(lang => this.languageNames[lang]);
            }
        }
        return filteredPairs;
    }

    populateLanguageDropdowns() {
        this.fromLanguage.innerHTML = Object.keys(this.languagePairs)
            .filter(lang => this.languagePairs[lang].length > 0)
            .map(lang => `<option value="${lang}">${this.languageNames[lang]}</option>`)
            .join('');

        this.fromLanguage.value = this.languagePairs['en'] ? 'en' : this.fromLanguage.options[0].value;
        this.updateToLanguages();
    }

    updateToLanguages() {
        const fromLang = this.fromLanguage.value;
        const toLanguages = this.languagePairs[fromLang] || [];

        this.toLanguage.innerHTML = toLanguages
            .map(lang => `<option value="${lang}">${this.languageNames[lang]}</option>`)
            .join('');

        if (toLanguages.length > 0) {
            // Set Spanish as default if available, otherwise use first available language
            if (toLanguages.includes('es')) {
                this.toLanguage.value = 'es';
            } else {
                this.toLanguage.value = toLanguages[0];
            }
        }

        // Update audio handler with new language settings
        this.audioHandler.setLanguages(this.fromLanguage.value, this.toLanguage.value);
    }

    async startListening() {
        const success = await this.audioHandler.startListening();
        if (success) {
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
        }
    }

    async stopListening() {
        const success = await this.audioHandler.stopListening();
        if (success) {
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
        }
    }

    async clearResults() {
        this.transcriptionText.value = '';
        this.translationText.value = '';
        
        // Clear session data in database
        try {
            const response = await fetch('/api/v1/clear_session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ teacher_code: this.teacherCode })
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to clear session data');
            }
            // Broadcast clear event
            this.broadcastUpdate();
        } catch (error) {
            console.error('Error clearing session:', error);
            StatusMessage.show('Error clearing session data', 'error', this.statusDiv);
        }
    }
}

// Initialize the application when the page loads
window.addEventListener('load', async () => {
    // Get teacher code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const teacherCode = urlParams.get('code');
    
    // Redirect to session page if no code
    if (!teacherCode) {
        window.location.href = '/';
    }

    // Display teacher code
    document.getElementById('teacherCodeDisplay').textContent = teacherCode;
    
    // Validate session code
    try {
        const response = await fetch('/api/v1/validate_teacher_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ teacher_code: teacherCode })
        });
        const data = await response.json();
        
        if (!data.success || !data.data.valid) {
            window.location.href = '/';
        } else {
            // Display student code
            document.getElementById('studentCodeDisplay').textContent = data.data.student_code;
            
            // Initialize app with teacher code and session data
            const app = new TeacherApp(teacherCode);
            if (data.data.transcription) {
                app.transcriptionText.value = data.data.transcription;
            }
            if (data.data.translation) {
                app.translationText.value = data.data.translation;
            }
            // Broadcast initial content
            app.broadcastUpdate();
        }
    } catch (error) {
        console.error('Failed to validate session:', error);
        window.location.href = '/';
    }
});
