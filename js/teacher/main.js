import { DarkMode, StatusMessage, API } from '../shared/utils.js';
import { AudioHandler } from './audio-handler.js';

class TeacherApp {
    constructor() {
        this.initElements();
        this.initAudioHandler();
        this.setupEventListeners();
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

    downloadSession() {
        const transcription = this.transcriptionText.value.trim();
        const translation = this.translationText.value.trim();
        
        const content = `Original Text:\n\n${transcription}\n\n\nTranslation:\n\n${translation}`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // Create timestamp in local timezone with simpler format
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
                this.transcriptionText.value += `${text}\n\n`;
                this.transcriptionText.scrollTop = this.transcriptionText.scrollHeight;
                // Store in localStorage for student page
                const storedTranscription = localStorage.getItem('transcriptionText') || '';
                localStorage.setItem('transcriptionText', storedTranscription + text + '\n\n');
            },
            onTranslationUpdate: (text) => {
                this.translationText.value += `${text}\n\n`;
                this.translationText.scrollTop = this.translationText.scrollHeight;
                // Store in localStorage for student page
                const storedTranslation = localStorage.getItem('incomingText') || '';
                localStorage.setItem('incomingText', storedTranslation + text + '\n\n');
            },
            onStatusChange: (message, type) => {
                StatusMessage.show(message, type, this.statusDiv);
            }
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

    clearResults() {
        this.transcriptionText.value = '';
        this.translationText.value = '';
        // Clear localStorage as well
        localStorage.setItem('transcriptionText', '');
        localStorage.setItem('incomingText', '');
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    new TeacherApp();
});
