// Dark mode management
export const DarkMode = {
    toggle(body, toggleButton) {
        body.classList.toggle('dark-mode');
        toggleButton.querySelector('.toggle-icon').textContent = 
            body.classList.contains('dark-mode') ? '☀️' : '🌙';
        localStorage.setItem('darkMode', body.classList.contains('dark-mode'));
    },

    init(toggleButton) {
        toggleButton.addEventListener('click', () => {
            this.toggle(document.body, toggleButton);
        });
    }
};

// Status message handling
export const StatusMessage = {
    show(message, type = 'info', statusDiv) {
        console.log('Status:', message, '(', type, ')');
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
    },

    createStatusElement(container) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'status-message';
        container.appendChild(statusDiv);
        return statusDiv;
    }
};

// Audio utilities
export const AudioUtils = {
    base64ToBlob(base64, type = 'audio/wav') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type });
    },

    async createAudioElement(audioBlob, volume = 1.0) {
        if (audioBlob.size === 0) {
            throw new Error('Received empty audio data');
        }

        const audio = new Audio();
        audio.volume = volume;
        
        return new Promise((resolve, reject) => {
            audio.addEventListener('error', (e) => {
                console.error('Audio error:', e);
                reject(new Error('Error loading audio'));
            });

            audio.addEventListener('loadedmetadata', () => {
                resolve(audio);
            });

            audio.src = URL.createObjectURL(audioBlob);
        });
    }
};

// Text highlighting
export const TextHighlighter = {
    createWordSpans(text, container) {
        container.innerHTML = text.split(' ').map(word => 
            `<span class="word">${word}</span>`
        ).join(' ');
    },

    highlightWords(words, duration, onComplete) {
        if (words.length === 0) return;

        const timePerWord = duration / words.length;
        let currentWordIndex = 0;
        
        const interval = setInterval(() => {
            // Remove previous highlight
            if (currentWordIndex > 0) {
                words[currentWordIndex - 1].classList.remove('highlighted');
            }
            
            // Add new highlight
            words[currentWordIndex].classList.add('highlighted');
            currentWordIndex++;

            if (currentWordIndex >= words.length) {
                clearInterval(interval);
                if (onComplete) onComplete();
            }
        }, timePerWord);

        return interval;
    },

    clearHighlights(words) {
        words.forEach(word => word.classList.remove('highlighted'));
    }
};

// API communication
export const API = {
    async fetchLanguages() {
        const response = await fetch('/api/v1/languages');
        if (!response.ok) {
            throw new Error(`Failed to fetch languages: ${response.statusText}`);
        }
        return response.json();
    },

    async fetchVoices() {
        const response = await fetch('/api/v1/voices');
        if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.statusText}`);
        }
        return response.json();
    },

    async synthesizeSpeech(text, voice, speed) {
        const response = await fetch('/api/v1/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, voice, speed })
        });

        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error;
            } catch {
                errorMessage = `Server returned ${response.status}`;
            }
            throw new Error(errorMessage);
        }

        return response.json();
    },

    async processAudio(audioData, fromCode, toCode, voice) {
        const response = await fetch('/api/v1/process_audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audio: audioData,
                from_code: fromCode,
                to_code: toCode,
                voice: voice
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to process audio: ${response.statusText}`);
        }

        return response.json();
    }
};
