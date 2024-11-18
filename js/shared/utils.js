// Dark mode management
export const DarkMode = {
    init(toggleButton) {
        toggleButton.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            toggleButton.querySelector('.toggle-icon').textContent = 
                document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
        });
    }
};

// Status message management
export const StatusMessage = {
    createStatusElement(container) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'status-message';
        container.appendChild(statusDiv);
        return statusDiv;
    },

    show(message, type, statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        statusDiv.style.opacity = '1';
        
        // Clear previous timeout
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        
        // Auto-hide after 5 seconds for success/info messages
        if (type !== 'error') {
            this.timeout = setTimeout(() => {
                statusDiv.style.opacity = '0';
            }, 5000);
        }
    }
};

// Text highlighting utilities
export const TextHighlighter = {
    clearHighlights(elements) {
        if (elements) {
            elements.forEach(element => {
                element.classList.remove('highlighted');
            });
        }
    }
};

// Audio utilities
export const AudioUtils = {
    base64ToBlob(base64) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'audio/wav' });
    }
};

// API endpoint prefix
const API_PREFIX = '/api/v1';

// API utilities
export const API = {
    async fetchLanguages() {
        try {
            const response = await fetch(`${API_PREFIX}/languages`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching languages:', error);
            return { success: false, error: error.message };
        }
    },

    async processAudio(audioData, fromCode, toCode, teacherCode) {
        try {
            const response = await fetch(`${API_PREFIX}/process_audio`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    audio: audioData,
                    from_code: fromCode,
                    to_code: toCode,
                    teacher_code: teacherCode
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Error processing audio:', error);
            return { success: false, error: error.message };
        }
    },

    async synthesizeSpeech(text, voice, speed) {
        try {
            const response = await fetch(`${API_PREFIX}/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice: voice,
                    speed: speed
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Error synthesizing speech:', error);
            return { success: false, error: error.message };
        }
    }
};
