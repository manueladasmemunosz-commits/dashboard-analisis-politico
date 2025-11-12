// WordCloud Module - Nube de palabras optimizada
class WordcloudModule {
    constructor() {
        this.data = [];
        this.excludedWords = new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'una', 'del', 'los', 'las', 'muy', 'pero', 'más', 'como', 'todo', 'hay', 'ya', 'o', 'si', 'me', 'ni', 'sin', 'mi', 'tu', 'él', 'ella']);
        this.wordData = [];
        this.canvas = null;
        this.ctx = null;
        this.isRendering = false;

        // Configuración optimizada
        this.config = {
            maxWords: 50,
            minFontSize: 12,
            maxFontSize: 48,
            fontFamily: 'Inter, sans-serif',
            colors: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
            padding: 2,
            maxAttempts: 1000
        };

        this.init();
    }

    init() {
        this.canvas = document.getElementById('wordcloudCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.bindEvents();
        }
        console.log('WordCloud Module inicializado');
    }

    bindEvents() {
        // Regenerar cloud
        document.getElementById('regenerateCloud')?.addEventListener('click', () => {
            this.renderWordCloud();
        });

        // Max words input
        document.getElementById('maxWords')?.addEventListener('change', (e) => {
            this.config.maxWords = parseInt(e.target.value) || 50;
            this.renderWordCloud();
        });

        // Click en canvas para excluir palabras
        if (this.canvas) {
            this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            this.canvas.style.cursor = 'pointer';
        }
    }

    updateData(newData) {
        this.data = newData;
        this.processWords();
        if (this.canvas) {
            this.renderWordCloud();
        }
    }

    onViewActivated() {
        if (this.data.length > 0) {
            setTimeout(() => this.renderWordCloud(), 100);
        }
    }

    processWords() {
        if (!this.data.length) return;

        // Extraer todas las palabras del texto
        const allText = this.data
            .map(item => item.text || '')
            .join(' ')
            .toLowerCase()
            .replace(/[^\w\sáéíóúñü]/g, ' ') // Mantener caracteres especiales del español
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.excludedWords.has(word));

        // Contar frecuencias
        const wordCount = {};
        allText.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        // Convertir a array y ordenar por frecuencia
        this.wordData = Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, this.config.maxWords)
            .map(([word, count], index) => ({
                text: word,
                size: this.calculateFontSize(count, wordCount),
                count: count,
                color: this.config.colors[index % this.config.colors.length],
                x: 0,
                y: 0,
                width: 0,
                height: 0
            }));
    }

    calculateFontSize(count, allCounts) {
        const maxCount = Math.max(...Object.values(allCounts));
        const minCount = Math.min(...Object.values(allCounts));

        if (maxCount === minCount) return this.config.maxFontSize;

        const ratio = (count - minCount) / (maxCount - minCount);
        return Math.round(this.config.minFontSize + (this.config.maxFontSize - this.config.minFontSize) * ratio);
    }

    async renderWordCloud() {
        if (this.isRendering || !this.wordData.length || !this.canvas) return;

        this.isRendering = true;

        try {
            // Limpiar canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Calcular dimensiones de palabras
            this.calculateWordDimensions();

            // Posicionar palabras usando algoritmo optimizado
            await this.positionWords();

            // Renderizar palabras
            this.drawWords();

            // Actualizar UI de exclusiones
            this.updateExcludedWordsUI();

        } catch (error) {
            console.error('Error renderizando word cloud:', error);
        } finally {
            this.isRendering = false;
        }
    }

    calculateWordDimensions() {
        this.wordData.forEach(word => {
            this.ctx.font = `${word.size}px ${this.config.fontFamily}`;
            const metrics = this.ctx.measureText(word.text);
            word.width = metrics.width + this.config.padding * 2;
            word.height = word.size + this.config.padding * 2;
        });
    }

    async positionWords() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const placedWords = [];

        for (let i = 0; i < this.wordData.length; i++) {
            const word = this.wordData[i];
            let placed = false;
            let attempts = 0;

            // Intentar colocar la palabra
            while (!placed && attempts < this.config.maxAttempts) {
                const angle = (attempts / this.config.maxAttempts) * Math.PI * 2;
                const radius = Math.sqrt(attempts) * 5;

                word.x = centerX + Math.cos(angle) * radius - word.width / 2;
                word.y = centerY + Math.sin(angle) * radius - word.height / 2;

                // Verificar límites del canvas
                if (word.x < 0 || word.x + word.width > this.canvas.width ||
                    word.y < 0 || word.y + word.height > this.canvas.height) {
                    attempts++;
                    continue;
                }

                // Verificar colisiones
                const hasCollision = placedWords.some(placedWord =>
                    this.checkCollision(word, placedWord)
                );

                if (!hasCollision) {
                    placed = true;
                    placedWords.push(word);
                }

                attempts++;
            }

            // Si no se pudo colocar, reducir el tamaño de fuente
            if (!placed && word.size > this.config.minFontSize) {
                word.size = Math.max(this.config.minFontSize, word.size - 2);
                this.ctx.font = `${word.size}px ${this.config.fontFamily}`;
                const metrics = this.ctx.measureText(word.text);
                word.width = metrics.width + this.config.padding * 2;
                word.height = word.size + this.config.padding * 2;
                i--; // Reintentar con el nuevo tamaño
            }

            // Yield control ocasionalmente para no bloquear UI
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    checkCollision(word1, word2) {
        return !(word1.x + word1.width < word2.x ||
                word2.x + word2.width < word1.x ||
                word1.y + word1.height < word2.y ||
                word2.y + word2.height < word1.y);
    }

    drawWords() {
        this.wordData.forEach(word => {
            if (word.x !== 0 || word.y !== 0) { // Solo dibujar palabras posicionadas
                this.ctx.fillStyle = word.color;
                this.ctx.font = `${word.size}px ${this.config.fontFamily}`;
                this.ctx.textBaseline = 'top';
                this.ctx.fillText(word.text, word.x + this.config.padding, word.y + this.config.padding);
            }
        });
    }

    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Buscar palabra en la posición del click
        const clickedWord = this.wordData.find(word => {
            return x >= word.x && x <= word.x + word.width &&
                   y >= word.y && y <= word.y + word.height;
        });

        if (clickedWord) {
            this.toggleWordExclusion(clickedWord.text);
        }
    }

    toggleWordExclusion(word) {
        if (this.excludedWords.has(word)) {
            this.excludedWords.delete(word);
        } else {
            this.excludedWords.add(word);
        }

        // Reprocesar y renderizar
        this.processWords();
        this.renderWordCloud();
    }

    updateExcludedWordsUI() {
        const excludedContainer = document.getElementById('excludedWords');
        const excludedTags = document.getElementById('excludedTags');

        if (!excludedContainer || !excludedTags) return;

        const userExcludedWords = [...this.excludedWords].filter(word =>
            !['el', 'la', 'de', 'que', 'y', 'a', 'en'].includes(word)
        );

        if (userExcludedWords.length > 0) {
            excludedContainer.style.display = 'block';
            excludedTags.innerHTML = userExcludedWords
                .map(word => `<span class="word-tag" onclick="window.WordcloudModule.toggleWordExclusion('${word}')">${word}</span>`)
                .join('');
        } else {
            excludedContainer.style.display = 'none';
        }
    }

    // Métodos públicos para análisis
    getWordStats() {
        return {
            totalWords: this.wordData.length,
            excludedCount: this.excludedWords.size,
            topWords: this.wordData.slice(0, 10).map(w => ({
                word: w.text,
                count: w.count,
                frequency: ((w.count / this.data.length) * 100).toFixed(2) + '%'
            }))
        };
    }

    exportWordData() {
        return {
            words: this.wordData.map(w => ({
                text: w.text,
                count: w.count,
                size: w.size
            })),
            excluded: [...this.excludedWords],
            stats: this.getWordStats()
        };
    }

    // Resize canvas when window resizes
    resize() {
        if (this.canvas && this.data.length > 0) {
            setTimeout(() => this.renderWordCloud(), 100);
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.WordcloudModule = new WordcloudModule();

    // Manejar resize de ventana
    window.addEventListener('resize', () => {
        if (window.WordcloudModule) {
            window.WordcloudModule.resize();
        }
    });
});