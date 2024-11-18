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
        // Split text into words, preserving punctuation
        const words = text.split(/\s+/).filter(word => word.trim());
        
        // Create spans for each word
        const spans = words.map((word, index) => 
            `<span class="word" data-index="${index}">${word}</span>`
        );
        
        // Join spans with spaces
        container.innerHTML = spans.join(' ');
        
        console.log('Created word spans:', {
            originalText: text,
            wordCount: words.length,
            spans: container.getElementsByClassName('word')
        });
    },

    clearHighlights(words) {
        if (Array.isArray(words)) {
            words.forEach(word => {
                if (word && word.classList) {
                    word.classList.remove('highlighted');
                }
            });
        }
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
        console.log('Synthesizing speech:', { text, voice, speed });
        
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

        const result = await response.json();
        
        // Log the response data
        console.log('Synthesis response:', {
            success: result.success,
            hasAudio: !!result.data?.audio,
            wordTimings: result.data?.word_timings,
            timingsLength: result.data?.word_timings?.length
        });

        // Validate word timings
        if (result.data?.word_timings) {
            result.data.word_timings.forEach((timing, index) => {
                console.log(`Word timing ${index}:`, timing);
                if (!timing.word || typeof timing.start !== 'number' || typeof timing.end !== 'number') {
                    console.error('Invalid word timing:', timing);
                }
            });
        }

        return result;
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

        const result = await response.json();
        
        // Log the response data
        console.log('Process audio response:', {
            success: result.success,
            hasAudio: !!result.data?.audio,
            wordTimings: result.data?.word_timings,
            timingsLength: result.data?.word_timings?.length
        });

        return result;
    }
};
