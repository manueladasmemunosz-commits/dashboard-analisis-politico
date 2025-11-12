// Dashboard Core - Sistema principal optimizado
class DashboardCore {
    constructor() {
        this.data = {
            raw: [],
            processed: [],
            filtered: []
        };
        this.currentView = 'analytics';
        this.charts = {};
        this.isLoading = false;

        // Configuración optimizada
        this.config = {
            debounceTime: 300,
            maxDataPoints: 5000,
            chunkSize: 100
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeModules();
        console.log('Dashboard Core inicializado');
    }

    bindEvents() {
        // File upload
        const fileInput = document.getElementById('csvFile');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Export buttons
        document.getElementById('exportCSV')?.addEventListener('click', () => this.exportData('csv'));
        document.getElementById('exportJSON')?.addEventListener('click', () => this.exportData('json'));

        // Time filter
        document.getElementById('timeFilter')?.addEventListener('change', (e) => {
            this.debounce(() => this.applyTimeFilter(e.target.value), this.config.debounceTime)();
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validar tamaño de archivo
        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showError('Archivo demasiado grande. Máximo 10MB.');
            return;
        }

        this.setLoading(true, 'Cargando archivo...');

        try {
            // Mostrar info del archivo inmediatamente
            this.showFileInfo(file);

            // Procesar CSV de forma rápida y optimizada
            const csvData = await this.parseCSVFast(file);

            if (!csvData || csvData.length === 0) {
                throw new Error('El archivo está vacío o no tiene formato CSV válido');
            }

            this.setLoading(true, 'Procesando datos...');

            // Procesar datos de forma síncrona pero rápida
            this.processDataFast(csvData);

            this.setLoading(true, 'Actualizando interfaz...');

            // Actualizar UI
            this.updateQuickStats();
            this.showExportSection();

            // Inicializar módulos con datos usando requestAnimationFrame
            requestAnimationFrame(() => {
                if (window.AnalyticsModule) {
                    window.AnalyticsModule.updateData(this.data.processed);
                }
                if (window.WordcloudModule) {
                    window.WordcloudModule.updateData(this.data.processed);
                }
            });

            console.log(`Archivo procesado exitosamente: ${csvData.length} filas`);

        } catch (error) {
            console.error('Error procesando archivo:', error);
            this.showError(`Error: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }

    parseCSVFast(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;

                    // Parse rápido con PapaParse - sin chunks para archivos pequeños
                    Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true,
                        dynamicTyping: false, // Más rápido sin conversión automática
                        complete: (results) => {
                            if (results.errors.length > 0) {
                                console.warn('Advertencias en CSV:', results.errors.slice(0, 3)); // Solo primeros 3 errores
                            }

                            // Limitar datos si es necesario
                            let data = results.data;
                            if (data.length > this.config.maxDataPoints) {
                                console.warn(`Datos limitados a ${this.config.maxDataPoints} filas para optimizar rendimiento`);
                                data = data.slice(0, this.config.maxDataPoints);
                            }

                            resolve(data);
                        },
                        error: (error) => reject(new Error(`Error parseando CSV: ${error.message}`))
                    });
                } catch (error) {
                    reject(new Error(`Error leyendo archivo: ${error.message}`));
                }
            };

            reader.onerror = () => reject(new Error('Error leyendo el archivo'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    processDataFast(rawData) {
        this.data.raw = rawData;

        // Procesar datos de forma síncrona y rápida
        this.data.processed = rawData.map(row => this.processDataRow(row))
            .filter(row => row !== null); // Filtrar filas inválidas

        this.data.filtered = [...this.data.processed];

        console.log(`Procesados ${this.data.processed.length} registros válidos de ${rawData.length} totales`);
    }

    processDataRow(row) {
        // Validar que la fila tenga datos mínimos requeridos
        if (!row || (!row.likes && !row.replies && !row.text)) {
            return null; // Fila inválida
        }

        // Conversión rápida de tipos usando + en lugar de parseInt
        const likes = +(row.likes) || 0;
        const replies = +(row.replies) || 0;
        const text = (row.text || row.content || '').trim();

        // Validar que haya contenido de texto para word cloud
        if (!text && likes === 0 && replies === 0) {
            return null; // Fila sin datos útiles
        }

        return {
            likes,
            replies,
            text,
            date: row.date || new Date().toISOString().split('T')[0],
            engagement: likes + replies
        };
    }

    createChunks(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        if (fileInfo) {
            fileInfo.innerHTML = `
                <strong>${file.name}</strong><br>
                ${this.formatFileSize(file.size)} • ${new Date().toLocaleString()}
            `;
            fileInfo.style.display = 'block';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateQuickStats() {
        const stats = this.calculateStats();

        document.getElementById('totalPosts').textContent = stats.totalPosts;
        document.getElementById('engagementRate').textContent = stats.engagementRate + '%';
        document.getElementById('totalPostsMain').textContent = stats.totalPosts;
        document.getElementById('totalLikes').textContent = stats.totalLikes;
        document.getElementById('totalReplies').textContent = stats.totalReplies;
        document.getElementById('avgEngagement').textContent = stats.avgEngagement;

        document.getElementById('quickStats').style.display = 'block';
    }

    calculateStats() {
        const data = this.data.filtered;
        const totalPosts = data.length;
        const totalLikes = data.reduce((sum, item) => sum + item.likes, 0);
        const totalReplies = data.reduce((sum, item) => sum + item.replies, 0);
        const totalEngagement = totalLikes + totalReplies;

        return {
            totalPosts,
            totalLikes,
            totalReplies,
            totalEngagement,
            avgEngagement: totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0,
            engagementRate: totalPosts > 0 ? ((totalEngagement / totalPosts) * 100).toFixed(1) : '0.0'
        };
    }

    switchView(viewName) {
        if (this.isLoading) return;

        this.currentView = viewName;

        // Actualizar UI
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === viewName);
        });

        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}-view`);
        });

        // Notificar a módulos
        if (viewName === 'analytics' && window.AnalyticsModule) {
            window.AnalyticsModule.onViewActivated();
        } else if (viewName === 'wordcloud' && window.WordcloudModule) {
            window.WordcloudModule.onViewActivated();
        }
    }

    applyTimeFilter(filterValue) {
        if (!this.data.processed.length) return;

        let filteredData = [...this.data.processed];

        if (filterValue !== 'all') {
            const now = new Date();
            const filterDate = new Date();

            if (filterValue === 'week') {
                filterDate.setDate(now.getDate() - 7);
            } else if (filterValue === 'month') {
                filterDate.setMonth(now.getMonth() - 1);
            }

            filteredData = this.data.processed.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= filterDate;
            });
        }

        this.data.filtered = filteredData;
        this.updateQuickStats();

        // Notificar a módulos
        if (window.AnalyticsModule) {
            window.AnalyticsModule.updateData(filteredData);
        }
        if (window.WordcloudModule) {
            window.WordcloudModule.updateData(filteredData);
        }
    }

    showExportSection() {
        document.getElementById('exportSection').style.display = 'block';
    }

    exportData(format) {
        if (!this.data.processed.length) {
            this.showError('No hay datos para exportar');
            return;
        }

        try {
            const generator = new ReportGenerator();
            const report = generator.generateReport(this.data.processed, { format });
            this.downloadReport(report);
        } catch (error) {
            console.error('Error exportando:', error);
            this.showError('Error al generar el reporte');
        }
    }

    downloadReport(reportResult) {
        const blob = new Blob([reportResult.data], {
            type: reportResult.format === 'json' ? 'application/json' : 'text/csv'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = reportResult.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    setLoading(isLoading, message = 'Cargando...') {
        this.isLoading = isLoading;

        // Actualizar cursor
        document.body.style.cursor = isLoading ? 'wait' : 'default';

        // Mostrar/ocultar loading indicator
        this.updateLoadingUI(isLoading, message);
    }

    updateLoadingUI(isLoading, message) {
        let loadingEl = document.getElementById('loadingIndicator');

        if (isLoading) {
            if (!loadingEl) {
                loadingEl = document.createElement('div');
                loadingEl.id = 'loadingIndicator';
                loadingEl.className = 'loading-indicator';
                loadingEl.innerHTML = `
                    <div class="spinner"></div>
                    <span id="loadingMessage">${message}</span>
                `;
                document.querySelector('.sidebar').appendChild(loadingEl);
            } else {
                document.getElementById('loadingMessage').textContent = message;
            }
            loadingEl.style.display = 'flex';
        } else {
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
    }

    showError(message) {
        console.error(message);
        // Aquí podrías mostrar un toast o modal de error
        alert(message); // Temporal
    }

    initializeModules() {
        // Se ejecutará cuando los módulos estén cargados
        document.addEventListener('modulesLoaded', () => {
            console.log('Todos los módulos cargados');
        });
    }

    // Utility: debounce
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // API pública para otros módulos
    getData() {
        return this.data.filtered;
    }

    getConfig() {
        return this.config;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.DashboardCore = new DashboardCore();
});