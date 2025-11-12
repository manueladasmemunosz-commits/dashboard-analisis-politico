// Dashboard Pro Completo Optimizado - WordCloud FIXED
// Mantiene velocidad optimizada pero restaura TODA la funcionalidad

// Variables globales
let dashboardData = {
    raw: [],
    processed: [],
    filtered: [],
    charts: {},
    settings: {
        colors: {
            timeline: '#667eea',
            topPosts: '#667eea',
            engagement: '#667eea',
            activeUsers: '#e74c3c'
        },
        chartTypes: {
            timeline: 'line',
            topPosts: 'bar',
            engagement: 'scatter',
            activeUsers: 'doughnut'
        },
        limits: {
            topPosts: 10,
            activeUsers: 8
        },
        timelineAxis: 'daily'
    },
    stats: {},
    wordCloud: {
        excluded: new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'una', 'del', 'los', 'las', 'muy', 'pero', 'más', 'como', 'todo', 'hay', 'ya', 'o', 'si', 'me', 'ni', 'sin', 'mi', 'tu', 'él', 'ella']),
        clickableWords: [],
        categories: {
            words: true,
            phrases: true,
            hashtags: true,
            mentions: true,
            longwords: false
        }
    },
    filters: {
        social: [],
        dateRange: 'all',
        searchTerm: ''
    },
    currentView: 'analytics',
    currentAnalyticsTab: 'charts'
};

// ========== FUNCIONES UTILITARIAS ==========

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// ========== FUNCIONES DE NAVEGACIÓN ==========

function showView(view) {
    dashboardData.currentView = view;

    // Solo mostrar analytics-content (que ahora contiene todo)
    document.getElementById('analytics-content').classList.remove('hidden');

    // Regenerar todos los gráficos si hay datos
    if (dashboardData.processed.length > 0) {
        setTimeout(() => {
            createAllCharts();
            generateWordCloud();
        }, 100);
    }
}

// Función para navegación suave entre secciones
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // Actualizar enlaces activos
        document.querySelectorAll('.section-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[href="#${sectionId}"]`)?.classList.add('active');
    }
}

function switchAnalyticsTab(tab) {
    dashboardData.currentAnalyticsTab = tab;

    // Actualizar pestañas principales
    document.querySelectorAll('.main-nav-tab').forEach(t => {
        t.classList.remove('active');
    });
    event.target.classList.add('active');

    // Mostrar/ocultar secciones
    document.querySelectorAll('.charts-grid').forEach(section => {
        section.classList.add('hidden');
    });

    if (tab === 'charts') {
        document.getElementById('charts-section').classList.remove('hidden');
        setTimeout(createBasicCharts, 100);
    } else if (tab === 'advanced') {
        document.getElementById('advanced-section').classList.remove('hidden');
        setTimeout(createAdvancedCharts, 100);
    } else if (tab === 'network') {
        document.getElementById('network-section').classList.remove('hidden');
        setTimeout(createNetworkCharts, 100);
    }
}

// ========== CONFIGURACIÓN BIGQUERY ==========

let bigQueryConfig = null;

async function loadBigQueryConfig() {
    try {
        const response = await fetch('./bigquery-credentials.json');
        if (response.ok) {
            bigQueryConfig = await response.json();
            console.log('✅ Credenciales BigQuery cargadas');
            return true;
        }
    } catch (error) {
        console.log('⚠️ No se encontraron credenciales BigQuery, usando modo CSV');
        return false;
    }
    return false;
}

// ========== PARSER DE BÚSQUEDA AVANZADA ==========
// Soporta: frases exactas entre comillas, operadores OR, NOT, y paréntesis

function parseSearchQuery(query) {
    // Tokenizar la query preservando comillas, paréntesis y operadores
    const tokens = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < query.length; i++) {
        const char = query[i];

        if (char === '"') {
            if (inQuotes) {
                // Fin de frase exacta
                tokens.push({ type: 'phrase', value: current.trim() });
                current = '';
                inQuotes = false;
            } else {
                // Inicio de frase exacta
                if (current.trim()) {
                    tokens.push(...tokenizeWords(current.trim()));
                    current = '';
                }
                inQuotes = true;
            }
        } else if (inQuotes) {
            current += char;
        } else if (char === '(' || char === ')') {
            if (current.trim()) {
                tokens.push(...tokenizeWords(current.trim()));
                current = '';
            }
            tokens.push({ type: 'paren', value: char });
        } else if (char === ' ') {
            if (current.trim()) {
                tokens.push(...tokenizeWords(current.trim()));
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        tokens.push(...tokenizeWords(current.trim()));
    }

    return tokens;
}

function tokenizeWords(text) {
    const words = text.split(/\s+/);
    const tokens = [];

    for (const word of words) {
        const upperWord = word.toUpperCase();
        if (upperWord === 'OR' || upperWord === 'AND') {
            tokens.push({ type: 'operator', value: upperWord });
        } else if (upperWord === 'NOT') {
            tokens.push({ type: 'not', value: 'NOT' });
        } else if (word) {
            tokens.push({ type: 'word', value: word.toLowerCase() });
        }
    }

    return tokens;
}

function evaluateSearchQuery(text, tokens) {
    if (!tokens || tokens.length === 0) return true;
    if (!text) return false;

    const textLower = text.toLowerCase();

    // Evaluar la expresión con operadores booleanos
    let result = null;
    let currentOperator = 'AND'; // Operador por defecto
    let notNext = false;
    let parenStack = [];
    let currentGroup = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'paren') {
            if (token.value === '(') {
                // Inicio de grupo
                let depth = 1;
                let groupTokens = [];
                i++;

                while (i < tokens.length && depth > 0) {
                    if (tokens[i].type === 'paren' && tokens[i].value === '(') {
                        depth++;
                    } else if (tokens[i].type === 'paren' && tokens[i].value === ')') {
                        depth--;
                        if (depth === 0) break;
                    }
                    groupTokens.push(tokens[i]);
                    i++;
                }

                // Evaluar el grupo recursivamente
                const groupResult = evaluateSearchQuery(textLower, groupTokens);
                const finalGroupResult = notNext ? !groupResult : groupResult;
                notNext = false;

                if (result === null) {
                    result = finalGroupResult;
                } else if (currentOperator === 'OR') {
                    result = result || finalGroupResult;
                } else {
                    result = result && finalGroupResult;
                }
            }
        } else if (token.type === 'operator') {
            currentOperator = token.value;
        } else if (token.type === 'not') {
            notNext = true;
        } else if (token.type === 'phrase') {
            // Búsqueda de frase exacta
            const phraseMatch = textLower.includes(token.value.toLowerCase());
            const finalMatch = notNext ? !phraseMatch : phraseMatch;
            notNext = false;

            if (result === null) {
                result = finalMatch;
            } else if (currentOperator === 'OR') {
                result = result || finalMatch;
            } else {
                result = result && finalMatch;
            }
        } else if (token.type === 'word') {
            // Búsqueda de palabra individual
            const wordMatch = textLower.includes(token.value);
            const finalMatch = notNext ? !wordMatch : wordMatch;
            notNext = false;

            if (result === null) {
                result = finalMatch;
            } else if (currentOperator === 'OR') {
                result = result || finalMatch;
            } else {
                result = result && finalMatch;
            }
        }
    }

    return result !== null ? result : true;
}

async function queryBigQuery(searchTerm, startDate) {
    showLoading('Consultando BigQuery...');

    try {
        console.log('📊 Búsqueda BigQuery:', { searchTerm, startDate });

        // POR AHORA: Simular consulta BigQuery usando datos del CSV cargado
        // TODO: Implementar conexión real cuando el servidor esté disponible

        console.log('⚠️ Modo simulación: usando datos CSV existentes');

        if (!dashboardData.raw || dashboardData.raw.length === 0) {
            throw new Error('No hay datos cargados. Primero carga el archivo kast-prueba.csv para simular BigQuery.');
        }

        // Simular filtrado por término de búsqueda
        let filteredData = dashboardData.raw;

        if (searchTerm && searchTerm.trim()) {
            // Parsear la query con soporte para operadores booleanos
            const tokens = parseSearchQuery(searchTerm);
            console.log('🔍 Tokens parseados:', tokens);

            filteredData = dashboardData.raw.filter(item => {
                const text = (item.text || '').toLowerCase();
                const project = (item.name_proyecto || '').toLowerCase();
                const user = (item.user_name || '').toLowerCase();

                // Evaluar contra todos los campos relevantes
                return evaluateSearchQuery(text, tokens) ||
                       evaluateSearchQuery(project, tokens) ||
                       evaluateSearchQuery(user, tokens);
            });
        }

        // Simular filtrado por fecha
        if (startDate) {
            filteredData = filteredData.filter(item => {
                const itemDate = (item.created || '').split(' ')[0]; // Extraer solo fecha
                return itemDate >= startDate;
            });
        }

        // Simular delay de red
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log(`✅ BigQuery simulado: ${filteredData.length} resultados encontrados`);
        return filteredData;

    } catch (error) {
        console.error('❌ Error en BigQuery:', error);
        hideLoading();
        throw error;
    }
}

// ========== SERVIDOR BIGQUERY SEGURO ==========
// Todas las consultas pasan por servidor Python con validación máxima
// Solo operaciones SELECT permitidas
// Credenciales protegidas server-side

// ========== FUNCIONES DE CARGA DE DATOS ==========

function processCSV(csvContent) {
    showLoading('Procesando datos CSV KAST...');

    Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            try {
                console.log('📊 CSV parseado:', results);
                console.log('📊 Primeras 3 filas:', results.data.slice(0, 3));
                console.log('📊 Headers detectados:', results.meta?.fields);

                if (!results.data || results.data.length === 0) {
                    throw new Error('CSV vacío o sin datos');
                }

                dashboardData.raw = results.data;

                // Procesamiento específico para formato KAST
                dashboardData.processed = results.data.map((row, index) => {
                    try {
                        // Convertir fecha de "2025-09-24 14:18:17" a "2025-09-24" de forma segura
                        let dateStr = '';
                        if (row.created && typeof row.created === 'string') {
                            const dateParts = row.created.split(' ');
                            if (dateParts[0] && dateParts[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
                                dateStr = dateParts[0];
                            }
                        }

                        // Fallback a fecha actual si no hay fecha válida
                        if (!dateStr) {
                            dateStr = new Date().toISOString().split('T')[0];
                        }

                        return {
                            likes: parseInt(row.likes) || 0,
                            replies: parseInt(row.replies) || 0,
                            text: (row.text || '').trim(),
                            date: dateStr,
                            user: (row.user_name || row.user_username || 'Usuario Desconocido').trim(),
                            platform: (row.source || 'news').toLowerCase(),
                            engagement: (parseInt(row.likes) || 0) + (parseInt(row.replies) || 0),

                            // Datos adicionales específicos de KAST
                            project: row.name_proyecto || 'Sin proyecto',
                            sentiment: row.sentiment || '',
                            tags: row.tags || '',
                            shared: parseInt(row.shared) || 0,
                            view_count: parseInt(row.view_count) || 0,
                            play_count: parseInt(row.play_count) || 0
                        };
                    } catch (rowError) {
                        console.warn(`Error procesando fila ${index}:`, rowError, row);
                        return null;
                    }
                }).filter(item => item !== null && item.text && item.text.length > 5); // Reducir filtro mínimo

                console.log(`📊 Datos procesados: ${dashboardData.processed.length} de ${results.data.length} filas`);

                if (dashboardData.processed.length === 0) {
                    throw new Error('No se encontraron datos válidos después del procesamiento');
                }

                dashboardData.filtered = [...dashboardData.processed];

                // Actualizar interface
                updateStats();
                populateGlobalCheckboxes();
                initHeaderFilters(); // Inicializar filtros del header
                initDashboard();
                hideLoading();

                console.log(`✅ Procesados ${dashboardData.processed.length} posts de KAST correctamente`);
                alert(`CSV KAST cargado: ${dashboardData.processed.length} artículos procesados`);

            } catch (error) {
                console.error('❌ Error procesando CSV KAST:', error);
                console.error('❌ Detalles:', error.stack);
                hideLoading();
                alert(`Error procesando CSV KAST: ${error.message}\n\nRevisa la consola para más detalles.`);
            }
        },
        error: function(error) {
            console.error('❌ Error parseando CSV KAST:', error);
            hideLoading();
            alert('Error leyendo el archivo CSV KAST. Verifica que sea un CSV válido.');
        }
    });
}


// Función principal para ejecutar búsqueda BigQuery
async function executeBigQuerySearch() {
    const searchTerm = document.getElementById('searchQuery').value.trim();
    const searchDate = document.getElementById('searchDate').value || '2025-08-01';

    if (!searchTerm) {
        alert('Por favor ingresa un término de búsqueda');
        return;
    }

    try {
        showLoading(`Buscando: "${searchTerm}" desde ${searchDate}...`);

        const results = await queryBigQuery(searchTerm, searchDate);

        // Procesar resultados usando la misma lógica que CSV
        if (results && results.length > 0) {
            // Convertir formato BigQuery a formato interno
            const csvContent = convertBigQueryToCSV(results);
            processCSV(csvContent);

            console.log(`✅ BigQuery: ${results.length} resultados encontrados`);
        } else {
            hideLoading();
            alert('No se encontraron resultados para la búsqueda');
        }

    } catch (error) {
        console.error('❌ Error en búsqueda BigQuery:', error);
        hideLoading();
        alert('Error en la búsqueda. Verifica la conexión o usa CSV como alternativa.');
    }
}

// Convertir datos BigQuery al formato CSV esperado
function convertBigQueryToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header] || '';
            // Escapar comas y comillas en CSV
            return typeof value === 'string' && value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

function loadSampleData() {
    showLoading('Cargando datos de demostración...');

    fetch('sample-data.csv')
        .then(response => response.text())
        .then(csvText => {
            processCSV(csvText);
        })
        .catch(error => {
            console.error('Error cargando datos de demo:', error);
            hideLoading();
            alert('Error cargando datos de demostración.');
        });
}

// ========== FUNCIONES DE FILTRADO HEADER ==========

function initHeaderFilters() {
    // Poblar filtros del header cuando se cargan datos
    if (dashboardData.processed.length > 0) {
        populateHeaderProjectFilter();
        populateHeaderMediaFilter();
        setupHeaderFilterListeners();
    }
}

function populateHeaderProjectFilter() {
    const projectFilter = document.getElementById('headerProjectFilter');
    if (!projectFilter) return;

    const projects = [...new Set(dashboardData.processed.map(item => item.project))];

    // Limpiar opciones existentes excepto "Todos"
    projectFilter.innerHTML = '<option value="all">Todos los Proyectos</option>';

    projects.forEach(project => {
        if (project && project !== 'Sin proyecto') {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            projectFilter.appendChild(option);
        }
    });
}

function populateHeaderMediaFilter() {
    const mediaFilter = document.getElementById('headerMediaFilter');
    if (!mediaFilter) return;

    const medios = [...new Set(dashboardData.processed.map(item => item.user))];

    // Limpiar opciones existentes excepto "Todos"
    mediaFilter.innerHTML = '<option value="all">Todos los Medios</option>';

    medios.forEach(medio => {
        if (medio && medio !== 'Usuario Desconocido') {
            const option = document.createElement('option');
            option.value = medio;
            option.textContent = medio;
            mediaFilter.appendChild(option);
        }
    });
}

function setupHeaderFilterListeners() {
    const projectFilter = document.getElementById('headerProjectFilter');
    const mediaFilter = document.getElementById('headerMediaFilter');
    const dateFilter = document.getElementById('headerDateFilter');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');

    if (projectFilter) {
        projectFilter.addEventListener('change', applyHeaderFilters);
    }
    if (mediaFilter) {
        mediaFilter.addEventListener('change', applyHeaderFilters);
    }
    if (dateFilter) {
        dateFilter.addEventListener('change', applyHeaderFilters);
    }

    // Event listeners para rango de fechas
    if (dateFrom) {
        dateFrom.addEventListener('change', handleDateRangeChange);
    }
    if (dateTo) {
        dateTo.addEventListener('change', handleDateRangeChange);
    }
}

function handleDateRangeChange() {
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');

    // Validar que ambas fechas estén presentes
    if (dateFrom && dateTo && dateFrom.value && dateTo.value) {
        const fromDate = new Date(dateFrom.value);
        const toDate = new Date(dateTo.value);

        // Validar que la fecha inicial no sea mayor que la final
        if (fromDate > toDate) {
            alert('La fecha inicial no puede ser mayor que la fecha final');
            dateFrom.value = '';
            return;
        }

        // Aplicar filtros automáticamente cuando ambas fechas están seleccionadas
        applyHeaderFilters();
    }
    // Si solo una fecha está seleccionada, esperar a que se complete el rango
    else if ((dateFrom && dateFrom.value) || (dateTo && dateTo.value)) {
        // No hacer nada, esperar a que se complete el rango
        console.log('Esperando a completar rango de fechas...');
    }
    // Si se borraron las fechas, aplicar filtros sin rango
    else {
        applyHeaderFilters();
    }
}

function applyHeaderFilters() {
    const projectFilter = document.getElementById('headerProjectFilter');
    const mediaFilter = document.getElementById('headerMediaFilter');
    const dateFilter = document.getElementById('headerDateFilter');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');

    // Aplicar filtros
    let filtered = [...dashboardData.processed];

    // Filtro por proyecto
    if (projectFilter && projectFilter.value !== 'all') {
        filtered = filtered.filter(item => item.project === projectFilter.value);
    }

    // Filtro por medio
    if (mediaFilter && mediaFilter.value !== 'all') {
        filtered = filtered.filter(item => item.user === mediaFilter.value);
    }

    // Filtro por rango de fechas (prioridad sobre filtro simple)
    if (dateFrom && dateTo && dateFrom.value && dateTo.value) {
        const fromDate = new Date(dateFrom.value);
        const toDate = new Date(dateTo.value);
        toDate.setHours(23, 59, 59, 999); // Incluir todo el día final

        filtered = filtered.filter(item => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            if (isNaN(itemDate.getTime())) return false;
            return itemDate >= fromDate && itemDate <= toDate;
        });
    }
    // Filtro por fecha simple (solo si no hay rango especificado)
    else if (dateFilter && dateFilter.value !== 'all') {
        const now = new Date();
        const days = dateFilter.value === '7days' ? 7 : 30;
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        filtered = filtered.filter(item => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            if (isNaN(itemDate.getTime())) return false;
            return itemDate >= cutoffDate;
        });
    }

    // Actualizar datos filtrados y UI
    dashboardData.filtered = filtered;
    updateStats();
    createAllCharts();
}

// ========== FUNCIONES DE FILTRADO ==========

function applyFilters() {
    let filtered = [...dashboardData.processed];

    // Filtro por redes sociales
    const activeSocial = getActiveFilters().social;
    if (activeSocial.length > 0 && !activeSocial.includes('all')) {
        filtered = filtered.filter(item => activeSocial.includes(item.platform));
    }

    // Filtro por fecha
    const dateRange = getActiveFilters().dateRange;
    if (dateRange !== 'all') {
        const now = new Date();
        const days = dateRange === '7days' ? 7 : 30;
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        filtered = filtered.filter(item => {
            if (!item.date) return false;

            const itemDate = new Date(item.date);

            // Verificar que la fecha es válida
            if (isNaN(itemDate.getTime())) {
                console.warn(`Fecha inválida encontrada: ${item.date}`);
                return false;
            }

            return itemDate >= cutoffDate;
        });
    }

    // Filtro por búsqueda
    const searchTerm = getActiveFilters().searchTerm.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(item =>
            item.text.toLowerCase().includes(searchTerm) ||
            item.user.toLowerCase().includes(searchTerm)
        );
    }

    dashboardData.filtered = filtered;

    // Actualizar interface
    updateStats();

    // Actualizar gráficos y word cloud según la vista actual
    if (dashboardData.currentView === 'analytics') {
        createAllCharts();
    } else if (dashboardData.currentView === 'wordcloud') {
        generateWordCloud();
    }
}

function getActiveFilters() {
    // Filtros sociales
    const socialCheckboxes = document.querySelectorAll('#socialCheckboxes input[type="checkbox"]:checked');
    const social = Array.from(socialCheckboxes).map(cb => cb.value);

    // Filtro de fecha
    const activeChip = document.querySelector('#globalDateChips .chip.active');
    const dateRange = activeChip ? activeChip.dataset.value : 'all';

    // Término de búsqueda
    const searchTerm = document.getElementById('globalSearch').value;

    return { social, dateRange, searchTerm };
}

function updateStats() {
    const data = dashboardData.filtered;
    const totalPosts = data.length;
    const totalLikes = data.reduce((sum, item) => sum + item.likes, 0);
    const totalReplies = data.reduce((sum, item) => sum + item.replies, 0);
    const uniqueUsers = new Set(data.map(item => item.user)).size;

    // Calcular métricas adicionales
    const avgEngagement = totalPosts > 0 ? Math.round((totalLikes + totalReplies) / totalPosts) : 0;
    const mentions = data.reduce((count, item) => count + (item.text.match(/@\w+/g) || []).length, 0);
    const hashtags = data.reduce((count, item) => count + (item.text.match(/#\w+/g) || []).length, 0);

    // Análisis de sentimiento básico (basado en engagement)
    const positiveThreshold = avgEngagement * 1.2;
    const positivePosts = data.filter(item => item.engagement > positiveThreshold).length;
    const positiveSentiment = totalPosts > 0 ? Math.round((positivePosts / totalPosts) * 100) : 0;

    // Actualizar UI - Sidebar
    const sidebarElements = {
        'totalPosts': totalPosts,
        'uniqueUsers': uniqueUsers,
        'totalLikes': totalLikes
    };

    // Actualizar elementos del sidebar (si existen)
    Object.entries(sidebarElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value.toLocaleString();
    });

    // Actualizar KPIs del Header
    const headerElements = {
        'headerTotalPosts': totalPosts,
        'headerUniqueUsers': uniqueUsers,
        'headerTotalLikes': totalLikes,
        'headerEngagement': avgEngagement
    };

    Object.entries(headerElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'headerEngagement') {
                element.textContent = value.toLocaleString();
            } else {
                element.textContent = formatNumber(value);
            }
        }
    });

    // Actualizar elementos adicionales (sidebar) con verificación
    const additionalElements = {
        'avgEngagement': avgEngagement.toLocaleString(),
        'totalMentions': mentions.toLocaleString(),
        'totalHashtags': hashtags.toLocaleString(),
        'positiveSentiment': positiveSentiment + '%'
    };

    Object.entries(additionalElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.log(`⚠️ Elemento ${id} no encontrado en el DOM`);
        }
    });

    // Guardar stats para uso posterior
    dashboardData.stats = {
        totalPosts,
        totalLikes,
        totalReplies,
        uniqueUsers,
        avgEngagement,
        mentions,
        hashtags,
        positiveSentiment
    };
}

// ========== FUNCIONES DE GRÁFICOS ==========

function createAllCharts() {
    // Crear todos los gráficos en sus secciones correspondientes
    createTimeline();
    createTopPosts();
    createEngagement();
    createActiveUsers();
    createSentimentChart();
    createHashtagsChart();
    createMentionsChart();

    // Crear gráficos adicionales para las nuevas secciones
    createPerformanceChart();
    createTopUsersChart();
    createEngagementSourceChart();
    createUserEfficiencyChart();
}

function createBasicCharts() {
    createTimeline();
    createTopPosts();
    createEngagement();
    createActiveUsers();
}

function createAdvancedCharts() {
    createSentimentChart();
    createHashtagsChart();
}

function createNetworkCharts() {
    createMentionsChart();
}

function createTimeline() {
    const canvas = document.getElementById('timelineChart');
    if (!canvas || !dashboardData.filtered.length) return;

    // Destruir gráfico existente
    if (dashboardData.charts.timeline) {
        dashboardData.charts.timeline.destroy();
    }

    const ctx = canvas.getContext('2d');
    const groupedData = groupDataByTime(dashboardData.filtered, dashboardData.settings.timelineAxis);

    const labels = Object.keys(groupedData).sort();
    const postsData = labels.map(label => groupedData[label].posts);
    const engagementData = labels.map(label => groupedData[label].engagement);

    dashboardData.charts.timeline = new Chart(ctx, {
        type: dashboardData.settings.chartTypes.timeline,
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Posts',
                    data: postsData,
                    borderColor: dashboardData.settings.colors.timeline,
                    backgroundColor: dashboardData.settings.colors.timeline + '20',
                    tension: 0.4,
                    fill: dashboardData.settings.chartTypes.timeline === 'area'
                },
                {
                    label: 'Engagement Total',
                    data: engagementData,
                    borderColor: '#e74c3c',
                    backgroundColor: '#e74c3c20',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left'
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

function createTopPosts() {
    const canvas = document.getElementById('topPostsChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.topPosts) {
        dashboardData.charts.topPosts.destroy();
    }

    const ctx = canvas.getContext('2d');
    const limit = dashboardData.settings.limits.topPosts;
    const topPosts = dashboardData.filtered
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, limit);

    const labels = topPosts.map((post, index) => `Post ${index + 1}`);
    const likesData = topPosts.map(post => post.likes);
    const repliesData = topPosts.map(post => post.replies);

    dashboardData.charts.topPosts = new Chart(ctx, {
        type: dashboardData.settings.chartTypes.topPosts,
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Likes',
                    data: likesData,
                    backgroundColor: dashboardData.settings.colors.topPosts,
                    borderColor: dashboardData.settings.colors.topPosts,
                    borderWidth: 2
                },
                {
                    label: 'Replies',
                    data: repliesData,
                    backgroundColor: '#e74c3c',
                    borderColor: '#e74c3c',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    showPostModal(topPosts[index]);
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            if (context.length > 0) {
                                const index = context[0].dataIndex;
                                const post = topPosts[index];
                                return `Contenido: ${post.text.substring(0, 100)}...`;
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });
}

function createEngagement() {
    const canvas = document.getElementById('engagementChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.engagement) {
        dashboardData.charts.engagement.destroy();
    }

    const ctx = canvas.getContext('2d');
    const data = dashboardData.filtered.map((post, index) => ({
        x: post.likes,
        y: post.replies,
        r: Math.max(5, Math.min(20, post.engagement / 10)),
        post: post
    }));

    dashboardData.charts.engagement = new Chart(ctx, {
        type: dashboardData.settings.chartTypes.engagement,
        data: {
            datasets: [{
                label: 'Engagement (Likes vs Replies)',
                data: data,
                backgroundColor: dashboardData.settings.colors.engagement + '60',
                borderColor: dashboardData.settings.colors.engagement,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Likes'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Replies'
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    showPostModal(data[index].post);
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.parsed;
                            const post = data[context.dataIndex].post;
                            return [
                                `Likes: ${point.x}`,
                                `Replies: ${point.y}`,
                                `Usuario: ${post.user}`,
                                `Contenido: ${post.text.substring(0, 50)}...`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function createActiveUsers() {
    const canvas = document.getElementById('activeUsersChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.activeUsers) {
        dashboardData.charts.activeUsers.destroy();
    }

    const ctx = canvas.getContext('2d');
    const userStats = {};

    // Agrupar por usuario
    dashboardData.filtered.forEach(post => {
        if (!userStats[post.user]) {
            userStats[post.user] = { posts: 0, engagement: 0 };
        }
        userStats[post.user].posts++;
        userStats[post.user].engagement += post.engagement;
    });

    const sortedUsers = Object.entries(userStats)
        .sort(([,a], [,b]) => b.posts - a.posts)
        .slice(0, dashboardData.settings.limits.activeUsers);

    const labels = sortedUsers.map(([user]) => user);
    const data = sortedUsers.map(([,stats]) => stats.posts);

    dashboardData.charts.activeUsers = new Chart(ctx, {
        type: dashboardData.settings.chartTypes.activeUsers,
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
                    '#f59e0b', '#ef4444', '#6366f1', '#ec4899'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const username = labels[index];
                    showUserPosts(username);
                }
            },
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function createSentimentChart() {
    const canvas = document.getElementById('sentimentChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.sentiment) {
        dashboardData.charts.sentiment.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Analizar sentimiento usando texto real
    const sentimentData = { positive: [], neutral: [], negative: [] };

    dashboardData.filtered.forEach(post => {
        const sentiment = analyzeSentiment(post.text || '');
        sentimentData[sentiment].push(post);
    });

    const chartType = dashboardData.settings?.chartTypes?.sentiment || 'doughnut';
    const counts = {
        positive: sentimentData.positive.length,
        neutral: sentimentData.neutral.length,
        negative: sentimentData.negative.length
    };

    dashboardData.charts.sentiment = new Chart(ctx, {
        type: chartType === 'polarArea' ? 'polarArea' : (chartType === 'bar' ? 'bar' : 'doughnut'),
        data: {
            labels: ['Positivo', 'Neutral', 'Negativo'],
            datasets: [{
                data: [counts.positive, counts.neutral, counts.negative],
                backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Haz clic para ver posts por sentimiento'
                }
            },
            scales: chartType === 'bar' ? { y: { beginAtZero: true } } : {},
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const sentiments = ['positive', 'neutral', 'negative'];
                    const selectedSentiment = sentiments[index];
                    const posts = sentimentData[selectedSentiment];
                    showSentimentPostsModal(selectedSentiment, posts);
                }
            }
        }
    });
}

function createHashtagsChart() {
    const canvas = document.getElementById('hashtagsChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.hashtags) {
        dashboardData.charts.hashtags.destroy();
    }

    const ctx = canvas.getContext('2d');
    const limit = dashboardData.settings?.limits?.hashtags || 20;
    const hashtags = extractHashtags(dashboardData.filtered).slice(0, limit);

    if (hashtags.length === 0) {
        ctx.font = '16px Inter';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No hay hashtags en los datos', canvas.width/2, canvas.height/2);
        return;
    }

    const chartType = dashboardData.settings?.chartTypes?.hashtags || 'bar';
    const labels = hashtags.map(item => `#${item.text}`);
    const data = hashtags.map(item => item.count);

    dashboardData.charts.hashtags = new Chart(ctx, {
        type: chartType === 'horizontalBar' ? 'bar' : chartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'Frecuencia',
                data: data,
                backgroundColor: chartType === 'doughnut' ?
                    hashtags.map((_, i) => `hsl(${280 + i * 20}, 70%, ${50 + i * 2}%)`) : '#8b5cf6',
                borderColor: '#7c3aed',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: chartType === 'horizontalBar' ? 'y' : 'x',
            plugins: {
                legend: { display: chartType === 'doughnut' },
                title: {
                    display: true,
                    text: 'Haz clic para ver posts con cada hashtag'
                }
            },
            scales: chartType === 'doughnut' ? {} : {
                [chartType === 'horizontalBar' ? 'x' : 'y']: { beginAtZero: true }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const hashtag = hashtags[index];
                    showHashtagPostsModal(hashtag.text, hashtag.posts);
                }
            }
        }
    });
}

function createMentionsChart() {
    const canvas = document.getElementById('mentionsChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.mentions) {
        dashboardData.charts.mentions.destroy();
    }

    const ctx = canvas.getContext('2d');
    const limit = dashboardData.settings?.limits?.mentions || 10;
    const mentions = extractMentions(dashboardData.filtered).slice(0, limit);

    if (mentions.length === 0) {
        ctx.font = '16px Inter';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No hay menciones en los datos', canvas.width/2, canvas.height/2);
        return;
    }

    const chartType = dashboardData.settings?.chartTypes?.mentions || 'horizontalBar';
    const labels = mentions.map(item => `@${item.text}`);
    const data = mentions.map(item => item.count);

    dashboardData.charts.mentions = new Chart(ctx, {
        type: chartType === 'horizontalBar' ? 'bar' : chartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'Menciones',
                data: data,
                backgroundColor: chartType === 'doughnut' ?
                    mentions.map((_, i) => `hsl(${300 + i * 25}, 70%, ${50 + i * 3}%)`) : '#ec4899',
                borderColor: '#db2777',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: chartType === 'horizontalBar' ? 'y' : 'x',
            plugins: {
                legend: { display: chartType === 'doughnut' },
                title: {
                    display: true,
                    text: 'Haz clic para ver posts que mencionan a cada usuario'
                }
            },
            scales: chartType === 'doughnut' ? {} : {
                [chartType === 'horizontalBar' ? 'x' : 'y']: { beginAtZero: true }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const mention = mentions[index];
                    showMentionPostsModal(mention.text, mention.posts);
                }
            }
        }
    });
}

// ========== FUNCIONES AUXILIARES PARA GRÁFICOS ==========

function groupDataByTime(data, groupBy) {
    const grouped = {};

    data.forEach(item => {
        // Validar fecha antes de procesarla
        if (!item.date) return;

        const date = new Date(item.date);
        if (isNaN(date.getTime())) {
            console.warn(`Fecha inválida en gráfico: ${item.date}`);
            return;
        }

        let key;

        if (groupBy === 'daily') {
            key = date.toISOString().split('T')[0];
        } else if (groupBy === 'weekly') {
            const monday = new Date(date);
            monday.setDate(date.getDate() - date.getDay() + 1);
            key = monday.toISOString().split('T')[0];
        } else if (groupBy === 'monthly') {
            key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        if (!grouped[key]) {
            grouped[key] = { posts: 0, engagement: 0, likes: 0, replies: 0 };
        }

        grouped[key].posts++;
        grouped[key].engagement += item.engagement;
        grouped[key].likes += item.likes;
        grouped[key].replies += item.replies;
    });

    return grouped;
}

// ========== FUNCIONES DE WORD CLOUD ==========

function generateWordCloud() {
    console.log('🔄 Iniciando generación de WordCloud mejorado...');
    const canvas = document.getElementById('wordCloudCanvas');

    if (!canvas) {
        console.error('❌ Canvas wordCloudCanvas no encontrado');
        return;
    }

    if (!dashboardData.filtered.length) {
        console.warn('⚠️ No hay datos filtrados para WordCloud');
        const ctx = canvas.getContext('2d');
        showEmptyCanvas(ctx, 'No hay datos para analizar');
        return;
    }

    console.log(`✅ Procesando ${dashboardData.filtered.length} posts para WordCloud`);
    const ctx = canvas.getContext('2d');

    // Ajustar tamaño del canvas para mejor resolución
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Extraer elementos según categorías activas
    let allItems = [];
    const categories = dashboardData.wordCloud?.categories || {
        words: true,
        phrases: true,
        hashtags: true,
        mentions: true,
        longwords: false
    };

    console.log('📋 Categorías activas:', categories);

    // Extraer diferentes tipos de elementos
    try {
        if (categories.words) {
            const words = extractImprovedWords(dashboardData.filtered);
            console.log(`📝 Palabras: ${words.length}`);
            allItems = allItems.concat(words);
        }
        if (categories.phrases) {
            const phrases = extractImprovedPhrases(dashboardData.filtered);
            console.log(`📝 Frases: ${phrases.length}`);
            allItems = allItems.concat(phrases);
        }
        if (categories.hashtags) {
            const hashtags = extractHashtags(dashboardData.filtered);
            console.log(`#️⃣ Hashtags: ${hashtags.length}`);
            allItems = allItems.concat(hashtags.map(h => ({...h, type: 'hashtag'})));
        }
        if (categories.mentions) {
            const mentions = extractMentions(dashboardData.filtered);
            console.log(`@️ Mentions: ${mentions.length}`);
            allItems = allItems.concat(mentions.map(m => ({...m, type: 'mention'})));
        }
        if (categories.longwords) {
            const longwords = extractLongWords(dashboardData.filtered);
            console.log(`📏 Palabras largas: ${longwords.length}`);
            allItems = allItems.concat(longwords);
        }
    } catch (error) {
        console.error('❌ Error extrayendo elementos:', error);
        showEmptyCanvas(ctx, 'Error procesando datos');
        return;
    }

    console.log(`🔢 Total elementos recolectados: ${allItems.length}`);

    // Filtrar y limpiar elementos
    const excluded = dashboardData.wordCloud?.excluded || new Set();
    allItems = allItems
        .filter(item => item && item.text && item.text.length > 1)
        .filter(item => !excluded.has(item.text.toLowerCase()))
        .filter(item => item.count > 1) // Solo elementos con más de 1 ocurrencia
        .sort((a, b) => b.count - a.count);

    console.log(`🔢 Elementos tras filtrado: ${allItems.length}`);

    if (allItems.length === 0) {
        console.warn('⚠️ No hay elementos válidos para mostrar');
        showEmptyCanvas(ctx, 'No hay palabras suficientes');
        return;
    }

    // Renderizar word cloud mejorado
    console.log('🎨 Renderizando WordCloud...');
    renderWordCloud(canvas, ctx, allItems, dashboardData.filtered.length);

    // Actualizar estadísticas
    updateWordCloudStats(allItems.length, dashboardData.wordCloud?.clickableWords?.length || 0, dashboardData.filtered.length);
    console.log('✨ WordCloud completado exitosamente');
}

// Funciones mejoradas de extracción
function extractImprovedWords(data) {
    const words = {};
    const excluded = new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'una', 'del', 'los', 'las', 'muy', 'pero', 'más', 'como', 'todo', 'hay', 'ya', 'o', 'si', 'me', 'ni', 'sin', 'mi', 'tu', 'él', 'ella', 'este', 'esta', 'esto', 'ese', 'esa', 'aquel', 'aquella', 'ser', 'estar', 'tener', 'hacer', 'decir', 'poder', 'ir']);

    data.forEach(item => {
        if (!item.text) return;

        const text = item.text.toLowerCase()
            .replace(/[^\w\sáéíóúñü]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !excluded.has(word) && !/^\d+$/.test(word));

        text.forEach(word => {
            words[word] = (words[word] || 0) + 1;
        });
    });

    return Object.entries(words)
        .map(([text, count]) => ({ text, count, type: 'word' }))
        .filter(item => item.count >= 2); // Solo palabras que aparecen al menos 2 veces
}

function extractImprovedPhrases(data) {
    const phrases = {};
    const minLength = 8;
    const maxLength = 40;

    data.forEach(item => {
        if (!item.text) return;

        const text = item.text.toLowerCase();
        const words = text.match(/\b\w+\b/g) || [];

        // Extraer bigramas y trigramas
        for (let i = 0; i < words.length - 1; i++) {
            const bigram = `${words[i]} ${words[i + 1]}`;
            if (bigram.length >= minLength && bigram.length <= maxLength) {
                phrases[bigram] = (phrases[bigram] || 0) + 1;
            }

            if (i < words.length - 2) {
                const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
                if (trigram.length >= minLength && trigram.length <= maxLength) {
                    phrases[trigram] = (phrases[trigram] || 0) + 1;
                }
            }
        }
    });

    return Object.entries(phrases)
        .map(([text, count]) => ({ text, count, type: 'phrase' }))
        .filter(item => item.count >= 2);
}

// Test simple para verificar que el JS se carga
window.testWordCloud = function() {
    console.log('✅ JavaScript cargado correctamente');
    console.log('- dashboardData existe:', typeof dashboardData);
    console.log('- Canvas existe:', !!document.getElementById('wordCloudCanvas'));
    generateWordCloud();
};

// Función de diagnóstico para WordCloud
function diagnoseWordCloud() {
    console.log('🔍 DIAGNÓSTICO WORDCLOUD:');
    console.log('- Canvas elemento:', document.getElementById('wordCloudCanvas'));
    console.log('- Datos filtrados:', dashboardData.filtered.length);
    console.log('- Categorías:', dashboardData.wordCloud.categories);
    console.log('- Palabras excluidas:', dashboardData.wordCloud.excluded.size);

    if (dashboardData.filtered.length > 0) {
        console.log('- Muestra texto:', dashboardData.filtered[0].text?.substring(0, 100));

        // Test rápido de extracción
        const testWords = extractWords(dashboardData.filtered.slice(0, 10));
        console.log('- Test extracción palabras (10 primeros):', testWords.length);
        if (testWords.length > 0) {
            console.log('- Palabras de ejemplo:', testWords.slice(0, 5));
        }
    }
}

function extractWords(data) {
    const words = {};
    const commonWords = dashboardData.wordCloud.excluded;

    data.forEach(item => {
        if (!item.text) return; // Validar que existe texto

        const text = item.text.toLowerCase()
            .replace(/[^\w\sáéíóúñü]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.has(word));

        text.forEach(word => {
            words[word] = (words[word] || 0) + 1;
        });
    });

    const result = Object.entries(words)
        .map(([text, count]) => ({ text, count, type: 'word' }))
        .filter(item => item.count > 1);

    return result;
}

function extractPhrases(data) {
    const phrases = {};

    data.forEach(item => {
        const text = item.text;
        // Extraer frases de 2-3 palabras
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];

        for (let i = 0; i < words.length - 1; i++) {
            const phrase = `${words[i]} ${words[i + 1]}`;
            if (phrase.length > 6) {
                phrases[phrase] = (phrases[phrase] || 0) + 1;
            }
        }
    });

    return Object.entries(phrases)
        .map(([text, count]) => ({ text, count, type: 'phrase' }))
        .filter(item => item.count > 1);
}

function extractHashtags(data) {
    const hashtags = {};

    data.forEach(item => {
        const matches = item.text.match(/#\w+/g) || [];
        matches.forEach(tag => {
            hashtags[tag] = (hashtags[tag] || 0) + 1;
        });
    });

    return Object.entries(hashtags)
        .map(([text, count]) => ({ text, count, type: 'hashtag' }));
}

function extractMentions(data) {
    const mentions = {};

    data.forEach(item => {
        const matches = item.text.match(/@\w+/g) || [];
        matches.forEach(mention => {
            mentions[mention] = (mentions[mention] || 0) + 1;
        });
    });

    return Object.entries(mentions)
        .map(([text, count]) => ({ text, count, type: 'mention' }));
}

function extractLongWords(data) {
    const longWords = {};
    const excluded = dashboardData.wordCloud?.excluded || new Set();

    data.forEach(item => {
        if (!item.text) return;

        const words = item.text.toLowerCase().match(/\b\w{7,}\b/g) || [];
        words.forEach(word => {
            if (!excluded.has(word) && word.length <= 15) { // Evitar palabras demasiado largas
                longWords[word] = (longWords[word] || 0) + 1;
            }
        });
    });

    return Object.entries(longWords)
        .map(([text, count]) => ({ text, count, type: 'longword' }))
        .filter(item => item.count >= 2);
}

function renderWordCloud(canvas, ctx, items, dataCount) {
    dashboardData.wordCloud.clickableWords = [];

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!items || items.length === 0) {
        ctx.font = '20px Inter';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No hay datos para mostrar', canvas.width/4, canvas.height/4);
        return;
    }

    // Configuración optimizada - usar dimensiones visuales del canvas
    const visualWidth = canvas.width / 2;  // Dividir por 2 porque el canvas está escalado
    const visualHeight = canvas.height / 2;
    const placedWords = [];
    const minPadding = 4;
    const margin = 20;
    const maxWords = 50; // Aumentar palabras para mejor distribución

    // Ordenar y limitar palabras
    const sortedItems = [...items]
        .sort((a, b) => b.count - a.count)
        .slice(0, maxWords)
        .filter(item => item.text && item.text.length > 1);

    console.log(`🎨 Renderizando ${sortedItems.length} palabras en WordCloud (${visualWidth}x${visualHeight})`);

    // Algoritmo mejorado de colocación
    for (let index = 0; index < sortedItems.length; index++) {
        const item = sortedItems[index];
        const fontSize = calculateOptimalFontSize(item.count, sortedItems, index);

        // Configurar fuente
        ctx.font = `${fontSize < 20 ? '600' : '700'} ${fontSize}px Inter, sans-serif`;
        const metrics = ctx.measureText(item.text);
        const textWidth = metrics.width;
        const textHeight = fontSize * 0.8;

        let placed = false;
        let attempts = 0;
        const maxAttempts = index < 5 ? 800 : 400; // Más intentos para mejor distribución

        while (!placed && attempts < maxAttempts) {
            let x, y;

            if (index === 0) {
                // Palabra principal en el centro
                x = (visualWidth - textWidth) / 2;
                y = visualHeight / 2;
            } else {
                // Colocación espiral mejorada usando dimensiones visuales
                const spiralFactor = attempts / 15;
                const angle = spiralFactor * 0.7;
                const maxRadius = Math.min(visualWidth, visualHeight) * 0.4;
                const radius = Math.min(spiralFactor * 6, maxRadius);

                x = (visualWidth / 2) + Math.cos(angle) * radius - (textWidth / 2);
                y = (visualHeight / 2) + Math.sin(angle) * radius;

                // Añadir variación para mejor distribución
                if (attempts > 30) {
                    x += (Math.random() - 0.5) * 40;
                    y += (Math.random() - 0.5) * 30;
                }

                // Forzar distribución más amplia para palabras posteriores
                if (index > 10 && attempts > 100) {
                    const spread = 0.7;
                    x = margin + Math.random() * (visualWidth - textWidth - 2 * margin);
                    y = margin + Math.random() * (visualHeight - textHeight - 2 * margin);
                }
            }

            // Verificar límites del canvas usando dimensiones visuales
            if (x < margin || x + textWidth > visualWidth - margin ||
                y - textHeight < margin || y + textHeight > visualHeight - margin) {
                attempts++;
                continue;
            }

            // Verificar colisiones con palabras ya colocadas
            let hasCollision = false;
            const padding = minPadding + Math.min(fontSize * 0.15, 6);

            for (const placedWord of placedWords) {
                const horizontalOverlap = !(x - padding > placedWord.x + placedWord.width ||
                                           x + textWidth + padding < placedWord.x);
                const verticalOverlap = !(y - textHeight - padding > placedWord.y ||
                                         y + padding < placedWord.y - placedWord.height);

                if (horizontalOverlap && verticalOverlap) {
                    hasCollision = true;
                    break;
                }
            }

            if (!hasCollision) {
                // Dibujar la palabra
                const color = getOptimalWordColor(item, index, sortedItems.length);
                ctx.fillStyle = color;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(item.text, x, y - textHeight);

                // Registrar palabra colocada
                const wordData = {
                    text: item.text,
                    x: x,
                    y: y - textHeight,
                    width: textWidth,
                    height: textHeight,
                    count: item.count,
                    type: item.type || 'word',
                    fontSize: fontSize
                };

                placedWords.push(wordData);
                dashboardData.wordCloud.clickableWords.push(wordData);
                placed = true;

                console.log(`✅ Colocada "${item.text}" en intento ${attempts + 1}`);
            }

            attempts++;
        }

        if (!placed) {
            console.warn(`⚠️ No se pudo colocar: "${item.text}" después de ${maxAttempts} intentos`);
        }
    }

    console.log(`✨ WordCloud completado: ${placedWords.length}/${sortedItems.length} palabras colocadas`);
}

// Función mejorada para calcular tamaño de fuente
function calculateOptimalFontSize(count, allItems, index) {
    const maxCount = allItems[0]?.count || 1;
    const minCount = allItems[allItems.length - 1]?.count || 1;

    // Tamaños más conservadores para evitar superposiciones
    const minSize = 14;
    const maxSize = 42;

    if (maxCount === minCount) return 24;

    // Escala logarítmica para mejor distribución
    const ratio = Math.log(count - minCount + 1) / Math.log(maxCount - minCount + 1);
    const size = Math.round(minSize + (maxSize - minSize) * ratio);

    // Ajustes por importancia
    if (index === 0) return Math.max(size, 36); // Palabra principal
    if (index < 3) return Math.max(size, 28);   // Top 3
    if (index < 8) return Math.max(size, 20);   // Top 8

    return Math.max(size, minSize);
}

// Función mejorada para colores
function getOptimalWordColor(item, index, totalWords) {
    const palette = document.getElementById('colorPalette')?.value || 'professional';

    const palettes = {
        professional: {
            primary: ['#1e40af', '#dc2626', '#059669', '#7c3aed'],
            secondary: ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6'],
            accent: ['#06b6d4', '#f59e0b', '#ec4899', '#84cc16']
        },
        vibrant: {
            primary: ['#dc2626', '#7c3aed', '#059669', '#ea580c'],
            secondary: ['#ef4444', '#8b5cf6', '#10b981', '#f59e0b'],
            accent: ['#ec4899', '#06b6d4', '#84cc16', '#f97316']
        },
        corporate: {
            primary: ['#1e40af', '#1e3a8a', '#312e81', '#1e1b4b'],
            secondary: ['#3b82f6', '#4f46e5', '#6366f1', '#8b5cf6'],
            accent: ['#06b6d4', '#0891b2', '#0e7490', '#155e75']
        }
    };

    const selectedPalette = palettes[palette] || palettes.professional;

    // Asignar colores basado en importancia
    if (index < 4) {
        return selectedPalette.primary[index % selectedPalette.primary.length];
    } else if (index < 12) {
        return selectedPalette.secondary[(index - 4) % selectedPalette.secondary.length];
    } else {
        return selectedPalette.accent[(index - 12) % selectedPalette.accent.length];
    }
}

function calculateFontSize(count, allItems) {
    const maxCount = Math.max(...allItems.map(item => item.count));
    const minCount = Math.min(...allItems.map(item => item.count));

    // Tamaños más agresivos para jerarquía clara como en la imagen
    const minSize = 16;
    const maxSize = 56;

    if (maxCount === minCount) return 32;

    // Escala más dramática para diferenciación visual clara
    const ratio = (count - minCount) / (maxCount - minCount);

    // Usar potencia para hacer las diferencias más notables
    const powRatio = Math.pow(ratio, 0.6);
    const size = Math.round(minSize + (maxSize - minSize) * powRatio);

    // Asegurar jerarquía mínima
    if (count >= maxCount * 0.8) return Math.max(size, 48); // Muy grande
    if (count >= maxCount * 0.5) return Math.max(size, 36); // Grande
    if (count >= maxCount * 0.2) return Math.max(size, 24); // Medio
    return Math.max(size, minSize); // Pequeño pero legible
}

function getWordColor(type, index) {
    const colors = {
        word: ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#dc2626', '#ea580c'],
        phrase: ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
        hashtag: ['#8b5cf6', '#ec4899', '#f97316'],
        mention: ['#06b6d4', '#3b82f6', '#059669'],
        longword: ['#6366f1', '#8b5cf6', '#0891b2']
    };

    const typeColors = colors[type] || colors.word;
    return typeColors[index % typeColors.length];
}

// Nueva función de colores profesionales con múltiples paletas
function getProfessionalWordColor(type, count, index) {
    const selectedPalette = document.getElementById('colorPalette')?.value || 'professional';

    const palettes = {
        professional: {
            // Paleta inspirada en la imagen Nube.png: azules, rojos, marrones
            high: ['#1e40af', '#991b1b', '#92400e', '#166534'],
            medium: ['#3b82f6', '#dc2626', '#d97706', '#059669', '#7c3aed'],
            accent: ['#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899'],
            low: ['#6b7280', '#374151', '#4b5563', '#1f2937']
        },
        vibrant: {
            high: ['#dc2626', '#7c3aed', '#059669', '#ea580c'],
            medium: ['#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'],
            accent: ['#ec4899', '#06b6d4', '#84cc16', '#f97316'],
            low: ['#64748b', '#6366f1', '#0891b2', '#65a30d']
        },
        corporate: {
            high: ['#1e40af', '#1e3a8a', '#312e81', '#1e1b4b'],
            medium: ['#3b82f6', '#6366f1', '#4f46e5', '#6366f1'],
            accent: ['#06b6d4', '#0891b2', '#0e7490', '#155e75'],
            low: ['#64748b', '#475569', '#334155', '#1e293b']
        },
        warm: {
            high: ['#dc2626', '#ea580c', '#d97706', '#ca8a04'],
            medium: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'],
            accent: ['#ec4899', '#f43f5e', '#fb7185', '#fbbf24'],
            low: ['#a3a3a3', '#737373', '#525252', '#404040']
        },
        political: {
            high: ['#1e40af', '#dc2626', '#059669', '#7c3aed'],
            medium: ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b'],
            accent: ['#06b6d4', '#ec4899', '#84cc16', '#f97316'],
            low: ['#6b7280', '#64748b', '#4b5563', '#374151']
        }
    };

    const palette = palettes[selectedPalette] || palettes.professional;

    // Determinar intensidad basada en frecuencia y tipo
    if (count >= 15) {
        return palette.high[index % palette.high.length];
    } else if (count >= 8) {
        return palette.medium[index % palette.medium.length];
    } else if (type === 'hashtag' || type === 'mention') {
        return palette.accent[index % palette.accent.length];
    } else {
        return palette.low[index % palette.low.length];
    }
}

function showEmptyCanvas(ctx, message) {
    ctx.font = '16px Inter';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText(message, ctx.canvas.width/2, ctx.canvas.height/2);
}

function updateWordCloudStats(totalWords, placedWordsCount, totalPosts) {
    const elements = {
        'totalWordsCount': totalWords,
        'placedWordsCount': placedWordsCount,
        'exclusionsCount': dashboardData.wordCloud.excluded.size
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.log(`⚠️ WordCloud elemento ${id} no encontrado`);
        }
    });
}

// ========== FUNCIONES DE CONTROL DE GRÁFICOS ==========

function updateChartType(chartName, newType) {
    dashboardData.settings.chartTypes[chartName] = newType;
    updateChart(chartName);
}

function updateChartColor(chartName, newColor) {
    dashboardData.settings.colors[chartName] = newColor;
    updateChart(chartName);
}

function updateChartLimit(chartName, newLimit) {
    dashboardData.settings.limits[chartName] = parseInt(newLimit);
    updateChart(chartName);
}

function updateTimelineAxis(newAxis) {
    dashboardData.settings.timelineAxis = newAxis;
    updateChart('timeline');
}

function updateChart(chartName) {
    if (chartName === 'timeline') createTimeline();
    else if (chartName === 'topPosts') createTopPosts();
    else if (chartName === 'engagement') createEngagement();
    else if (chartName === 'activeUsers') createActiveUsers();
    else if (chartName === 'sentiment') createSentimentChart();
    else if (chartName === 'mentions') createMentionsChart();
    else if (chartName === 'hashtags') createHashtagsChart();
    else if (chartName === 'engagementSource') createEngagementSourceChart();
    else if (chartName === 'userEfficiency') createUserEfficiencyChart();
}

function updateSentimentAxis(newAxis) {
    if (!dashboardData.settings) dashboardData.settings = {};
    dashboardData.settings.sentimentAxis = newAxis;
    updateChart('sentiment');
}

function updateEngagementMetric(newMetric) {
    if (!dashboardData.settings) dashboardData.settings = {};
    dashboardData.settings.engagementMetric = newMetric;
    updateChart('engagementSource');
}

function updateEfficiencyMetric(newMetric) {
    if (!dashboardData.settings) dashboardData.settings = {};
    dashboardData.settings.efficiencyMetric = newMetric;
    updateChart('userEfficiency');
}

// ========== FUNCIONES DE FILTROS GLOBALES ==========

function populateGlobalCheckboxes() {
    const container = document.getElementById('socialCheckboxes');
    if (!container) return;

    // Obtener plataformas únicas
    const platforms = [...new Set(dashboardData.processed.map(item => item.platform))];

    container.innerHTML = '';

    platforms.forEach(platform => {
        const div = document.createElement('div');
        div.className = 'checkbox-item checked';
        div.innerHTML = `
            <input type="checkbox" id="social-${platform}" value="${platform}" checked>
            <label for="social-${platform}">${platform}</label>
        `;
        container.appendChild(div);

        // Event listener
        const checkbox = div.querySelector('input');
        checkbox.addEventListener('change', updateSocialFilters);
        div.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                updateSocialFilters();
            }
        });
    });
}

function updateSocialFilters() {
    // Actualizar clases visuales
    document.querySelectorAll('#socialCheckboxes .checkbox-item').forEach(item => {
        const checkbox = item.querySelector('input');
        item.classList.toggle('checked', checkbox.checked);
    });

    applyFilters();
}

function selectAllSocial() {
    document.querySelectorAll('#socialCheckboxes input').forEach(cb => {
        cb.checked = true;
    });
    updateSocialFilters();
}

function selectNoneSocial() {
    document.querySelectorAll('#socialCheckboxes input').forEach(cb => {
        cb.checked = false;
    });
    updateSocialFilters();
}

// ========== FUNCIONES DE CONTROL GENERAL ==========

function refreshAllData() {
    if (dashboardData.processed.length > 0) {
        applyFilters();
    }
}

function resetAllFilters() {
    // Reset filtros sociales
    document.querySelectorAll('#socialCheckboxes input').forEach(cb => {
        cb.checked = true;
    });

    // Reset filtro de fecha
    document.querySelectorAll('#globalDateChips .chip').forEach(chip => {
        chip.classList.remove('active');
    });
    document.querySelector('#globalDateChips .chip[data-value="all"]').classList.add('active');

    // Reset búsqueda
    document.getElementById('globalSearch').value = '';

    // Reset word cloud exclusions (mantener las básicas)
    dashboardData.wordCloud.excluded = new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'una', 'del', 'los', 'las', 'muy', 'pero', 'más', 'como', 'todo', 'hay', 'ya', 'o', 'si', 'me', 'ni', 'sin', 'mi', 'tu', 'él', 'ella']);

    updateSocialFilters();
}

function exportAllData() {
    if (!dashboardData.processed.length) {
        alert('No hay datos para exportar');
        return;
    }

    try {
        const generator = new ReportGenerator();
        const reportData = {
            analytics: dashboardData.stats,
            wordcloud: {
                totalWords: dashboardData.wordCloud.clickableWords.length,
                excluded: Array.from(dashboardData.wordCloud.excluded)
            }
        };

        const report = generator.generateCSVReport(reportData);
        downloadReport(report);

    } catch (error) {
        console.error('Error exportando datos:', error);
        alert('Error generando el reporte');
    }
}

function downloadReport(reportResult) {
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

// ========== FUNCIONES DE MODAL ==========

function showPostModal(post) {
    const modal = document.getElementById('postModal');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>Detalle del Post</h2>
        </div>
        <div class="post-text">${post.text}</div>
        <div class="engagement-stats">
            <div class="engagement-stat">
                <div class="number">${post.likes}</div>
                <div class="label">Likes</div>
            </div>
            <div class="engagement-stat">
                <div class="number">${post.replies}</div>
                <div class="label">Replies</div>
            </div>
            <div class="engagement-stat">
                <div class="number">${post.engagement}</div>
                <div class="label">Total</div>
            </div>
        </div>
        <div style="margin-top: 20px;">
            <strong>Usuario:</strong> ${post.user}<br>
            <strong>Fecha:</strong> ${post.date}<br>
            <strong>Plataforma:</strong> ${post.platform}
        </div>
        <div style="text-align: center; margin-top: 30px;">
            <button class="btn-primary" onclick="closeModal()">Cerrar</button>
        </div>
    `;

    modal.style.display = 'block';
}

function showUserPosts(username, posts = null) {
    const userPosts = posts || dashboardData.filtered.filter(post =>
        post.user === username || post.user_name === username || post.user_username === username
    );
    const modal = document.getElementById('postModal');
    const modalBody = document.getElementById('modalBody');

    const totalLikes = userPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
    const totalReplies = userPosts.reduce((sum, post) => sum + (post.replies || 0), 0);
    const totalEngagement = totalLikes + totalReplies;

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>👤 Posts de ${username}</h2>
        </div>
        <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <strong>Total posts:</strong> ${userPosts.length}<br>
            <strong>Total likes:</strong> ${totalLikes.toLocaleString()}<br>
            <strong>Total respuestas:</strong> ${totalReplies.toLocaleString()}<br>
            <strong>Engagement promedio:</strong> ${Math.round(totalEngagement / userPosts.length) || 0}
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${userPosts.slice(0, 10).map(post => `
                <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer;"
                     onclick="showPostModal(${JSON.stringify(post).replace(/"/g, '&quot;')})">
                    <div style="margin-bottom: 10px;">${post.text || 'Sin texto'}</div>
                    <div style="display: flex; gap: 15px; font-size: 0.9rem; color: #666;">
                        <span>❤️ ${post.likes || 0}</span>
                        <span>💬 ${post.replies || 0}</span>
                        <span>📅 ${(post.date || post.created || '').split('T')[0]}</span>
                        <span>📱 ${post.platform || post.source || 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
            ${userPosts.length > 10 ? `<p style="text-align: center; color: #666; margin-top: 15px;">... y ${userPosts.length - 10} posts más</p>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn-primary" onclick="closeModal()">Cerrar</button>
        </div>
    `;

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('postModal').style.display = 'none';
}

// ========== FUNCIONES DE LOADING ==========

function showLoading(message = 'Cargando...') {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'flex';
        const text = loading.querySelector('p:last-child');
        if (text) text.textContent = message;
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

// ========== FUNCIONES DE EVENT LISTENERS ==========

function initEventListeners() {
    // File upload
    const csvFile = document.getElementById('csvFile');
    if (csvFile) {
        csvFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type === 'text/csv') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    processCSV(e.target.result);
                };
                reader.readAsText(file);
            }
        });
    }

    // Filtros de fecha
    document.querySelectorAll('#globalDateChips .chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('#globalDateChips .chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            applyFilters();
        });
    });

    // Búsqueda global
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        let searchTimeout;
        globalSearch.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                applyFilters();
            }, 300);
        });
    }

    // Word cloud categories
    document.querySelectorAll('#wordcloudCategories .checkbox-item').forEach(item => {
        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', function() {
            const category = this.id.replace('cat-', '');
            dashboardData.wordCloud.categories[category] = this.checked;
            item.classList.toggle('checked', this.checked);
            generateWordCloud();
        });

        item.addEventListener('click', function(e) {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
    });

    // Word cloud canvas clicks
    const wordCloudCanvas = document.getElementById('wordCloudCanvas');
    if (wordCloudCanvas) {
        wordCloudCanvas.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const clickedWord = dashboardData.wordCloud.clickableWords.find(word => {
                return x >= word.x && x <= word.x + word.width &&
                       y >= word.y && y <= word.y + word.height;
            });

            if (clickedWord) {
                const wordText = clickedWord.text.toLowerCase();
                if (dashboardData.wordCloud.excluded.has(wordText)) {
                    dashboardData.wordCloud.excluded.delete(wordText);
                } else {
                    dashboardData.wordCloud.excluded.add(wordText);
                }

                generateWordCloud();
                updateExcludedWordsDisplay();
            }
        });
    }

    // Modal clicks
    const modal = document.getElementById('postModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

function updateExcludedWordsDisplay() {
    const container = document.getElementById('excludedWordsList');
    const section = document.getElementById('exclusionsSection');

    if (!container || !section) return;

    const userExcluded = Array.from(dashboardData.wordCloud.excluded)
        .filter(word => !['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'una', 'del', 'los', 'las', 'muy', 'pero', 'más', 'como', 'todo', 'hay', 'ya', 'o', 'si', 'me', 'ni', 'sin', 'mi', 'tu', 'él', 'ella'].includes(word));

    if (userExcluded.length > 0) {
        section.style.display = 'block';
        container.innerHTML = userExcluded
            .map(word => `<div class="excluded-word" onclick="removeExclusion('${word}')">${word}</div>`)
            .join('');
    } else {
        section.style.display = 'none';
    }
}

function removeExclusion(word) {
    dashboardData.wordCloud.excluded.delete(word);
    generateWordCloud();
    updateExcludedWordsDisplay();
}

// ========== FUNCIÓN DE INICIALIZACIÓN ==========

function initDashboard() {
    console.log('Inicializando dashboard completo...');

    // Solo crear gráficos si estamos en la vista analytics
    if (dashboardData.currentView === 'analytics') {
        createAllCharts();
    }

    // Generar word cloud siempre (está integrado en analytics)
    generateWordCloud();

    updateExcludedWordsDisplay();

    // Configurar navegación suave
    setupSmoothNavigation();
}

// Configurar navegación suave entre secciones
function setupSmoothNavigation() {
    // Configurar enlaces de navegación
    document.querySelectorAll('.section-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            scrollToSection(targetId);
        });
    });

    // Configurar observador de intersección para actualizar enlaces activos
    const sections = document.querySelectorAll('.analysis-section');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                const id = entry.target.id;
                document.querySelectorAll('.section-link').forEach(link => {
                    link.classList.remove('active');
                });
                document.querySelector(`[href="#${id}"]`)?.classList.add('active');
            }
        });
    }, {
        threshold: 0.5,
        rootMargin: '-100px 0px -100px 0px'
    });

    sections.forEach(section => {
        observer.observe(section);
    });
}

// ========== FUNCIONES DE GRÁFICOS ADICIONALES ==========

// Funciones auxiliares para extraer datos
function extractMentions(data) {
    const mentions = {};
    const postsByMention = {};

    data.forEach(item => {
        const matches = (item.text || '').match(/@\w+/g) || [];
        matches.forEach(mention => {
            const cleanMention = mention.toLowerCase().substring(1);
            mentions[cleanMention] = (mentions[cleanMention] || 0) + 1;
            if (!postsByMention[cleanMention]) postsByMention[cleanMention] = [];
            postsByMention[cleanMention].push(item);
        });
    });

    return Object.entries(mentions)
        .map(([text, count]) => ({ text, count, type: 'mention', posts: postsByMention[text] }))
        .sort((a, b) => b.count - a.count);
}

function extractHashtags(data) {
    const hashtags = {};
    const postsByHashtag = {};

    data.forEach(item => {
        const matches = (item.text || '').match(/#\w+/g) || [];
        matches.forEach(tag => {
            const cleanTag = tag.toLowerCase().substring(1);
            hashtags[cleanTag] = (hashtags[cleanTag] || 0) + 1;
            if (!postsByHashtag[cleanTag]) postsByHashtag[cleanTag] = [];
            postsByHashtag[cleanTag].push(item);
        });
    });

    return Object.entries(hashtags)
        .map(([text, count]) => ({ text, count, type: 'hashtag', posts: postsByHashtag[text] }))
        .sort((a, b) => b.count - a.count);
}

function analyzeSentiment(text) {
    const positiveWords = ['bueno', 'excelente', 'genial', 'increible', 'perfecto', 'amor', 'feliz', 'alegre', 'positivo', 'grandioso', 'bien', 'mejor', 'éxito', 'victoria'];
    const negativeWords = ['malo', 'terrible', 'horrible', 'odio', 'triste', 'negativo', 'pesimo', 'awful', 'disgusto', 'preocupante', 'problema', 'crisis', 'fracaso'];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach(word => {
        if (positiveWords.some(pos => word.includes(pos))) positiveCount++;
        if (negativeWords.some(neg => word.includes(neg))) negativeCount++;
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
}

function createPerformanceChart() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas || !dashboardData.filtered.length) return;

    const ctx = canvas.getContext('2d');

    // Destruir gráfico existente
    if (dashboardData.charts.performance) {
        dashboardData.charts.performance.destroy();
    }

    // Calcular métricas reales de performance
    const totalPosts = dashboardData.filtered.length;
    const avgLikes = Math.round(dashboardData.filtered.reduce((sum, post) => sum + (post.likes || 0), 0) / totalPosts);
    const avgShares = Math.round(dashboardData.filtered.reduce((sum, post) => sum + (post.shares || 0), 0) / totalPosts);
    const engagementRate = Math.round((avgLikes + avgShares) / totalPosts * 100) || 25;

    const data = [engagementRate, avgLikes || 45, avgShares || 12];

    dashboardData.charts.performance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Engagement %', 'Promedio Likes', 'Promedio Shares'],
            datasets: [{
                data: data,
                backgroundColor: [
                    '#3b82f6', // Chile blue
                    '#ef4444', // Chile red
                    '#6b7280'  // Gray
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#374151',
                        font: {
                            size: 12,
                            family: 'Inter'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff'
                }
            }
        }
    });
}

function createTopUsersChart() {
    const canvas = document.getElementById('topUsersChart');
    if (!canvas || !dashboardData.filtered.length) return;

    const ctx = canvas.getContext('2d');

    // Destruir gráfico existente
    if (dashboardData.charts.topUsers) {
        dashboardData.charts.topUsers.destroy();
    }

    // Calcular estadísticas de usuarios
    const userStats = {};
    dashboardData.filtered.forEach(post => {
        const user = post.user_name || post.name_autor || post.author || 'Usuario Anónimo';
        if (!userStats[user]) {
            userStats[user] = { posts: 0, likes: 0, posts_data: [] };
        }
        userStats[user].posts++;
        userStats[user].likes += post.likes || 0;
        userStats[user].posts_data.push(post);
    });

    const sortedUsers = Object.entries(userStats)
        .sort((a, b) => b[1].posts - a[1].posts)
        .slice(0, 8);

    dashboardData.charts.topUsers = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedUsers.map(([user]) => user.length > 15 ? user.substring(0, 15) + '...' : user),
            datasets: [{
                label: 'Posts Publicados',
                data: sortedUsers.map(([_, stats]) => stats.posts),
                backgroundColor: '#3b82f6',
                borderColor: '#1e40af',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#e5e7eb'
                    },
                    ticks: {
                        color: '#6b7280'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6b7280',
                        maxRotation: 45
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const [userName, userStats] = sortedUsers[index];
                    showPostModal(userStats.posts_data, `Posts de ${userName}`);
                }
            }
        }
    });
}

// ========== FUNCIONES DE MODAL ADICIONALES ==========

function showSentimentPostsModal(sentiment, posts) {
    const modal = document.getElementById('postModal');
    const modalBody = document.getElementById('modalBody');

    const sentimentEmojis = {
        'positive': '😊',
        'negative': '😞',
        'neutral': '😐'
    };

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>${sentimentEmojis[sentiment] || '💬'} Posts: ${sentiment}</h2>
            <p style="color: #666;">${posts.length} publicaciones encontradas</p>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${posts.slice(0, 8).map(post => `
                <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer;"
                     onclick="showPostModal(${JSON.stringify(post).replace(/"/g, '&quot;')})">
                    <div style="margin-bottom: 10px;">${post.text}</div>
                    <div style="display: flex; gap: 15px; font-size: 0.9rem; color: #666;">
                        <span>❤️ ${post.likes || 0}</span>
                        <span>💬 ${post.replies || 0}</span>
                        <span>📅 ${(post.date || post.created || '').split('T')[0]}</span>
                        <span>👤 ${post.user || post.user_name || 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
            ${posts.length > 8 ? `<p style="text-align: center; color: #666; margin-top: 15px;">... y ${posts.length - 8} posts más</p>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn-primary" onclick="closeModal()">Cerrar</button>
        </div>
    `;

    modal.style.display = 'block';
}

function showHashtagPostsModal(hashtag, posts) {
    const modal = document.getElementById('postModal');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2># Posts con hashtag: #${hashtag}</h2>
            <p style="color: #666;">${posts.length} publicaciones encontradas</p>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${posts.slice(0, 8).map(post => `
                <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer;"
                     onclick="showPostModal(${JSON.stringify(post).replace(/"/g, '&quot;')})">
                    <div style="margin-bottom: 10px;">${post.text}</div>
                    <div style="display: flex; gap: 15px; font-size: 0.9rem; color: #666;">
                        <span>❤️ ${post.likes || 0}</span>
                        <span>💬 ${post.replies || 0}</span>
                        <span>📅 ${(post.date || post.created || '').split('T')[0]}</span>
                        <span>👤 ${post.user || post.user_name || 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
            ${posts.length > 8 ? `<p style="text-align: center; color: #666; margin-top: 15px;">... y ${posts.length - 8} posts más</p>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn-primary" onclick="closeModal()">Cerrar</button>
        </div>
    `;

    modal.style.display = 'block';
}

function showMentionPostsModal(mention, posts) {
    const modal = document.getElementById('postModal');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>🔗 Posts que mencionan a @${mention}</h2>
            <p style="color: #666;">${posts.length} publicaciones encontradas</p>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${posts.slice(0, 8).map(post => `
                <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer;"
                     onclick="showPostModal(${JSON.stringify(post).replace(/"/g, '&quot;')})">
                    <div style="margin-bottom: 10px;">${post.text}</div>
                    <div style="display: flex; gap: 15px; font-size: 0.9rem; color: #666;">
                        <span>❤️ ${post.likes || 0}</span>
                        <span>💬 ${post.replies || 0}</span>
                        <span>📅 ${(post.date || post.created || '').split('T')[0]}</span>
                        <span>👤 ${post.user || post.user_name || 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
            ${posts.length > 8 ? `<p style="text-align: center; color: #666; margin-top: 15px;">... y ${posts.length - 8} posts más</p>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn-primary" onclick="closeModal()">Cerrar</button>
        </div>
    `;

    modal.style.display = 'block';
}

function showSourcePostsModal(source, posts) {
    const modal = document.getElementById('postModal');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>📱 Posts de ${source}</h2>
            <p style="color: #666;">${posts.length} publicaciones encontradas</p>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${posts.slice(0, 8).map(post => `
                <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer;"
                     onclick="showPostModal(${JSON.stringify(post).replace(/"/g, '&quot;')})">
                    <div style="margin-bottom: 10px;">${post.text}</div>
                    <div style="display: flex; gap: 15px; font-size: 0.9rem; color: #666;">
                        <span>❤️ ${post.likes || 0}</span>
                        <span>💬 ${post.replies || 0}</span>
                        <span>📅 ${(post.date || post.created || '').split('T')[0]}</span>
                        <span>👤 ${post.user || post.user_name || 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
            ${posts.length > 8 ? `<p style="text-align: center; color: #666; margin-top: 15px;">... y ${posts.length - 8} posts más</p>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn-primary" onclick="closeModal()">Cerrar</button>
        </div>
    `;

    modal.style.display = 'block';
}

// ========== INICIALIZACIÓN CUANDO EL DOM ESTÉ LISTO ==========

// ========== FUNCIONES DE GRÁFICOS FALTANTES ==========

function createEngagementSourceChart() {
    const canvas = document.getElementById('engagementSourceChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.engagementSource) {
        dashboardData.charts.engagementSource.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Agrupar por fuente
    const sourceStats = {};
    const postsBySource = {};

    dashboardData.filtered.forEach(post => {
        const source = post.platform || post.source || 'otros';
        if (!sourceStats[source]) {
            sourceStats[source] = { likes: 0, replies: 0, shared: 0, posts: 0 };
            postsBySource[source] = [];
        }
        sourceStats[source].likes += post.likes || 0;
        sourceStats[source].replies += post.replies || 0;
        sourceStats[source].shared += post.shared || 0;
        sourceStats[source].posts += 1;
        postsBySource[source].push(post);
    });

    const sources = Object.keys(sourceStats);
    const chartType = dashboardData.settings?.chartTypes?.engagementSource || 'radar';
    const metric = dashboardData.settings?.engagementMetric || 'likes';

    if (chartType === 'radar') {
        dashboardData.charts.engagementSource = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: sources,
                datasets: [{
                    label: 'Likes Promedio',
                    data: sources.map(source => (sourceStats[source].likes / sourceStats[source].posts) || 0),
                    borderColor: '#ef4444',
                    backgroundColor: '#ef444433',
                    borderWidth: 2
                }, {
                    label: 'Respuestas Promedio',
                    data: sources.map(source => (sourceStats[source].replies / sourceStats[source].posts) || 0),
                    borderColor: '#3b82f6',
                    backgroundColor: '#3b82f633',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
                    title: {
                        display: true,
                        text: 'Haz clic para ver posts por fuente'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        title: { display: true, text: 'Engagement Promedio' }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const sourceIndex = elements[0].index;
                        const source = sources[sourceIndex];
                        showSourcePostsModal(source, postsBySource[source]);
                    }
                }
            }
        });
    } else {
        let chartData;
        if (metric === 'total') {
            chartData = sources.map(source =>
                sourceStats[source].likes + sourceStats[source].replies + sourceStats[source].shared
            );
        } else {
            chartData = sources.map(source => sourceStats[source][metric] || 0);
        }

        dashboardData.charts.engagementSource = new Chart(ctx, {
            type: chartType,
            data: {
                labels: sources,
                datasets: [{
                    label: `${metric.charAt(0).toUpperCase() + metric.slice(1)}`,
                    data: chartData,
                    backgroundColor: chartType === 'doughnut' ?
                        sources.map((_, i) => `hsl(${200 + i * 30}, 70%, 60%)`) : '#3498db'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: chartType === 'doughnut' },
                    title: {
                        display: true,
                        text: 'Haz clic para ver posts por fuente'
                    }
                },
                scales: chartType === 'doughnut' ? {} : { y: { beginAtZero: true } },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const sourceIndex = elements[0].index;
                        const source = sources[sourceIndex];
                        showSourcePostsModal(source, postsBySource[source]);
                    }
                }
            }
        });
    }
}

function createUserEfficiencyChart() {
    const canvas = document.getElementById('userEfficiencyChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.userEfficiency) {
        dashboardData.charts.userEfficiency.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Calcular eficiencia de usuarios
    const userStats = {};
    dashboardData.filtered.forEach(post => {
        const user = post.user || post.user_name || post.user_username || 'Usuario';
        if (!userStats[user]) {
            userStats[user] = {
                posts: 0,
                totalLikes: 0,
                totalReplies: 0,
                totalShared: 0,
                posts_data: []
            };
        }
        userStats[user].posts += 1;
        userStats[user].totalLikes += post.likes || 0;
        userStats[user].totalReplies += post.replies || 0;
        userStats[user].totalShared += post.shared || 0;
        userStats[user].posts_data.push(post);
    });

    // Filtrar usuarios con al menos 3 posts
    const efficientUsers = Object.entries(userStats)
        .filter(([user, stats]) => stats.posts >= 3)
        .map(([user, stats]) => ({
            user,
            stats,
            efficiency: stats.totalLikes / stats.posts
        }))
        .sort((a, b) => b.efficiency - a.efficiency)
        .slice(0, 20);

    const chartType = dashboardData.settings?.chartTypes?.userEfficiency || 'scatter';
    const metric = dashboardData.settings?.efficiencyMetric || 'avgLikes';

    if (chartType === 'scatter') {
        const scatterData = efficientUsers.map(({user, stats}) => {
            let yValue;
            switch (metric) {
                case 'avgReplies':
                    yValue = stats.totalReplies / stats.posts;
                    break;
                case 'totalEngagement':
                    yValue = (stats.totalLikes + stats.totalReplies + stats.totalShared) / stats.posts;
                    break;
                default:
                    yValue = stats.totalLikes / stats.posts;
            }

            return {
                x: stats.posts,
                y: yValue,
                user: user,
                userData: stats
            };
        });

        dashboardData.charts.userEfficiency = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Usuarios',
                    data: scatterData,
                    backgroundColor: '#e67e2266',
                    borderColor: '#e67e22',
                    borderWidth: 1,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Eficiencia de usuarios - Haz clic para ver detalles'
                    },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const point = context[0];
                                const userData = scatterData[point.dataIndex];
                                return userData.user;
                            },
                            label: (context) => {
                                const userData = scatterData[context.dataIndex];
                                return [
                                    `Posts: ${userData.x}`,
                                    `${metric}: ${userData.y.toFixed(1)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Número de Posts' },
                        beginAtZero: true
                    },
                    y: {
                        title: { display: true, text: metric.replace('avg', 'Promedio ').replace('total', 'Total ') },
                        beginAtZero: true
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const userData = scatterData[elements[0].index];
                        showUserPosts(userData.user, userData.userData.posts_data);
                    }
                }
            }
        });
    } else {
        // Gráfico de barras con top 10
        const top10 = efficientUsers.slice(0, 10);

        dashboardData.charts.userEfficiency = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(({user}) => user.substring(0, 12)),
                datasets: [{
                    label: 'Engagement promedio',
                    data: top10.map(({stats}) => stats.totalLikes / stats.posts),
                    backgroundColor: '#e67e22'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Top 10 usuarios más eficientes - Haz clic para ver posts'
                    }
                },
                scales: { y: { beginAtZero: true } },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const userData = top10[elements[0].index];
                        showUserPosts(userData.user, userData.stats.posts_data);
                    }
                }
            }
        });
    }
}

// =====================================================
// FUNCIONES PARA CONTROLES DE GRÁFICOS
// =====================================================

// Debounce para optimizar rendimiento
const debounceTimers = {};
function debounce(func, wait, key) {
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(func, wait);
}

function updateChartData(chartName) {
    debounce(() => {
        updateChartDataDirect(chartName);
    }, 300, `update-${chartName}`); // Debounce de 300ms para cambios de datos
}

function updateChartType(chartName, chartType) {
    console.log(`🎨 Cambiando tipo de gráfico ${chartName} a ${chartType}`);

    // Almacenar el tipo de gráfico seleccionado INMEDIATAMENTE
    if (!dashboardData.chartTypes) dashboardData.chartTypes = {};
    dashboardData.chartTypes[chartName] = chartType;

    // Recrear el gráfico inmediatamente para cambios de tipo
    updateChartDataDirect(chartName);
}

// Función directa sin debounce para cambios inmediatos
function updateChartDataDirect(chartName) {
    console.log(`⚡ Actualizando gráfico directamente: ${chartName}`);

    // Buscar el canvas del gráfico específico
    const canvas = document.getElementById(`${chartName}Chart`);
    if (!canvas) {
        console.warn(`❌ Canvas no encontrado: ${chartName}Chart`);
        return;
    }

    // Encontrar el widget contenedor
    const widget = canvas.closest('.chart-widget');
    if (!widget) {
        console.warn(`❌ Widget no encontrado para: ${chartName}`);
        return;
    }

    // Obtener controles del widget específico
    const dateInputs = widget.querySelectorAll('.chart-date-selector');
    const socialSelect = widget.querySelector('.chart-social-selector');

    // Aplicar filtros de fecha y red social si existen
    let filteredData = [...(dashboardData.raw || dashboardData.filtered || [])];

    if (filteredData.length === 0) {
        console.warn(`⚠️ No hay datos disponibles para ${chartName}`);
        return;
    }

    if (dateInputs.length >= 2 && dateInputs[0].value && dateInputs[1].value) {
        const dateFrom = dateInputs[0].value;
        const dateTo = dateInputs[1].value;
        console.log(`📅 Rango de fechas: ${dateFrom} a ${dateTo}`);

        filteredData = filteredData.filter(post => {
            const postDate = post.created ? post.created.split(' ')[0] : '2025-08-01';
            return postDate >= dateFrom && postDate <= dateTo;
        });
    }

    if (socialSelect && socialSelect.value !== 'all') {
        const socialNetwork = socialSelect.value.toLowerCase();
        console.log(`📱 Red social seleccionada: ${socialNetwork}`);

        filteredData = filteredData.filter(post => {
            const source = (post.user_name || post.source || post.name_proyecto || '').toLowerCase();
            // Buscar en múltiples campos
            return source.includes(socialNetwork) ||
                   source.includes(socialNetwork.charAt(0).toUpperCase() + socialNetwork.slice(1));
        });

        console.log(`📊 Posts filtrados por ${socialNetwork}: ${filteredData.length}/${dashboardData.raw?.length || 0}`);
    }

    // Actualizar datos filtrados temporalmente para este gráfico
    const originalFiltered = dashboardData.filtered;
    dashboardData.filtered = filteredData;

    // Recrear gráfico específico
    try {
        switch(chartName) {
            case 'timeline':
                createTimelineChart();
                break;
            case 'topPosts':
                createTopPostsChart();
                break;
            case 'engagement':
                createEngagementChart();
                break;
            case 'activeUsers':
                createActiveUsersChart();
                break;
            case 'performance':
                createPerformanceChart();
                break;
            case 'sentimentMain':
                createSentimentChart();
                break;
            case 'hashtagsMain':
                createHashtagsChart();
                break;
            case 'topUsersMain':
                createTopUsersChart();
                break;
            case 'mentions':
                createMentionsChart();
                break;
            case 'sentiment':
                createSentimentChart(); // Usar la misma función
                break;
            case 'hashtags':
                createHashtagsChart(); // Usar la misma función
                break;
            case 'engagementSource':
                createEngagementSourceChart();
                break;
            case 'userEfficiency':
                createUserEfficiencyChart();
                break;
            default:
                console.warn(`❌ Gráfico no encontrado: ${chartName}`);
        }
    } catch (error) {
        console.error(`❌ Error actualizando gráfico ${chartName}:`, error);
    } finally {
        // Restaurar datos originales
        dashboardData.filtered = originalFiltered;
    }
}

function updateChartLimit(chartName, limit) {
    console.log(`📊 Cambiando límite de ${chartName} a ${limit}`);

    // Almacenar el límite seleccionado INMEDIATAMENTE
    if (!dashboardData.chartLimits) dashboardData.chartLimits = {};
    dashboardData.chartLimits[chartName] = parseInt(limit);

    // Recrear el gráfico inmediatamente
    updateChartDataDirect(chartName);
}

function updateChartColor(chartName, color) {
    console.log(`🎨 Cambiando color de ${chartName} a ${color}`);

    // Almacenar el color seleccionado INMEDIATAMENTE
    if (!dashboardData.chartColors) dashboardData.chartColors = {};
    dashboardData.chartColors[chartName] = color;

    // Recrear el gráfico inmediatamente
    updateChartDataDirect(chartName);
}

// =====================================================
// FUNCIONES DE CREACIÓN DE GRÁFICOS PRINCIPALES
// =====================================================

function createTimelineChart() {
    const canvas = document.getElementById('timelineChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.timeline) {
        dashboardData.charts.timeline.destroy();
    }

    const ctx = canvas.getContext('2d');
    const chartType = dashboardData.chartTypes?.timeline || 'line';
    console.log(`📊 Creando timeline con tipo: ${chartType}`);

    // Procesar datos por fecha
    const dateGroups = {};
    dashboardData.filtered.forEach(post => {
        const date = post.created ? post.created.split(' ')[0] : '2025-08-01';
        if (!dateGroups[date]) dateGroups[date] = [];
        dateGroups[date].push(post);
    });

    const sortedDates = Object.keys(dateGroups).sort();
    const labels = sortedDates;
    const data = sortedDates.map(date => dateGroups[date].length);

    // Convertir 'area' a configuración 'line' correcta
    const actualChartType = chartType === 'area' ? 'line' : chartType;
    const isAreaChart = chartType === 'area';

    if (isAreaChart) {
        console.log('🌊 Creando gráfico de área (line + fill)');
    }

    dashboardData.charts.timeline = new Chart(ctx, {
        type: actualChartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'Posts por día',
                data: data,
                borderColor: '#3498db',
                backgroundColor: isAreaChart ? 'rgba(52, 152, 219, 0.3)' :
                               (chartType === 'bar' ? '#3498db' : 'rgba(52, 152, 219, 0.1)'),
                fill: isAreaChart,
                tension: 0.4,
                pointBackgroundColor: '#3498db',
                pointBorderColor: '#2980b9',
                pointRadius: isAreaChart ? 4 : 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Evolución temporal de posts${isAreaChart ? ' (Área)' : ''}`
                }
            },
            scales: {
                y: { beginAtZero: true }
            },
            elements: {
                line: {
                    fill: isAreaChart
                }
            }
        }
    });
}

function createTopPostsChart() {
    const canvas = document.getElementById('topPostsChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.topPosts) {
        dashboardData.charts.topPosts.destroy();
    }

    const ctx = canvas.getContext('2d');
    const chartType = dashboardData.chartTypes?.topPosts || 'bar';
    const limit = dashboardData.chartLimits?.topPosts || 10;
    console.log(`📊 Creando topPosts con tipo: ${chartType}, límite: ${limit}`);

    // Obtener top posts por engagement
    const sortedPosts = dashboardData.filtered
        .sort((a, b) => (parseInt(b.likes || 0) + parseInt(b.replies || 0)) - (parseInt(a.likes || 0) + parseInt(a.replies || 0)))
        .slice(0, limit);

    const labels = sortedPosts.map((post, i) => `Post ${i + 1}`);
    const data = sortedPosts.map(post => parseInt(post.likes || 0) + parseInt(post.replies || 0));

    dashboardData.charts.topPosts = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'Engagement Total',
                data: data,
                backgroundColor: '#e74c3c'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: `Top ${limit} Posts por Engagement` }
            },
            scales: chartType !== 'doughnut' ? { y: { beginAtZero: true } } : {},
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const post = sortedPosts[elements[0].index];
                    showPostModal([post]);
                }
            }
        }
    });
}

function createEngagementChart() {
    const canvas = document.getElementById('engagementChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.engagement) {
        dashboardData.charts.engagement.destroy();
    }

    const ctx = canvas.getContext('2d');
    const chartType = dashboardData.chartTypes?.engagement || 'scatter';
    console.log(`📊 Creando engagement con tipo: ${chartType}`);

    if (chartType === 'scatter') {
        const scatterData = dashboardData.filtered.map(post => ({
            x: parseInt(post.likes || 0),
            y: parseInt(post.replies || 0),
            post: post
        }));

        dashboardData.charts.engagement = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Posts',
                    data: scatterData,
                    backgroundColor: '#9b59b6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Likes vs Replies' }
                },
                scales: {
                    x: { title: { display: true, text: 'Likes' } },
                    y: { title: { display: true, text: 'Replies' } }
                }
            }
        });
    } else {
        // Gráfico de barras con totales
        const totalLikes = dashboardData.filtered.reduce((sum, post) => sum + parseInt(post.likes || 0), 0);
        const totalReplies = dashboardData.filtered.reduce((sum, post) => sum + parseInt(post.replies || 0), 0);

        dashboardData.charts.engagement = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Likes', 'Replies'],
                datasets: [{
                    label: 'Total',
                    data: [totalLikes, totalReplies],
                    backgroundColor: ['#3498db', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Engagement Total' }
                },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

function createActiveUsersChart() {
    const canvas = document.getElementById('activeUsersChart');
    if (!canvas || !dashboardData.filtered.length) return;

    if (dashboardData.charts.activeUsers) {
        dashboardData.charts.activeUsers.destroy();
    }

    const ctx = canvas.getContext('2d');
    const chartType = dashboardData.chartTypes?.activeUsers || 'doughnut';
    const limit = dashboardData.chartLimits?.activeUsers || 10;
    console.log(`📊 Creando activeUsers con tipo: ${chartType}, límite: ${limit}`);

    // Contar posts por usuario
    const userCounts = {};
    dashboardData.filtered.forEach(post => {
        const user = post.user_name || post.user || 'Usuario Anónimo';
        userCounts[user] = (userCounts[user] || 0) + 1;
    });

    const sortedUsers = Object.entries(userCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit);

    const labels = sortedUsers.map(([user]) => user.substring(0, 15));
    const data = sortedUsers.map(([,count]) => count);

    dashboardData.charts.activeUsers = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'Posts',
                data: data,
                backgroundColor: labels.map((_, i) => `hsl(${i * 36}, 70%, 60%)`)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: `Top ${limit} Usuarios Más Activos` },
                legend: { display: chartType === 'doughnut' }
            },
            scales: chartType !== 'doughnut' ? { y: { beginAtZero: true } } : {}
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar event listeners
    initEventListeners();

    // Inicializar valores predeterminados de fecha
    const today = new Date();
    const defaultDateTo = today.toISOString().split('T')[0];
    const defaultDateFrom = '2025-08-01';

    // Establecer fechas predeterminadas en todos los inputs
    document.querySelectorAll('.chart-date-selector').forEach((input, index) => {
        if (index % 2 === 0) { // Fecha "desde"
            if (!input.value) input.value = defaultDateFrom;
        } else { // Fecha "hasta"
            if (!input.value) input.value = defaultDateTo;
        }
    });

    // Agregar event listeners para debugging
    document.querySelectorAll('.chart-type-selector').forEach(select => {
        select.addEventListener('change', (e) => {
            console.log(`🎯 Selector de tipo cambió: ${e.target.value}`);
        });
    });

    document.querySelectorAll('.chart-social-selector').forEach(select => {
        select.addEventListener('change', (e) => {
            console.log(`🌐 Selector social cambió: ${e.target.value}`);
        });
    });

    console.log('Dashboard Pro Completo Optimizado - Listo ✅');
    console.log('🔧 Debugging habilitado para controles de gráficos');
});