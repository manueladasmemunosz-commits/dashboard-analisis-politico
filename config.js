// Configuration for Dashboard Pro Integrado
// Este archivo define la configuración escalable para el sistema de reportes

const DashboardConfig = {
    // Configuración de módulos
    modules: {
        analytics: {
            enabled: true,
            charts: ['timeline', 'scatter', 'bar', 'doughnut'],
            metrics: ['likes', 'replies', 'engagement', 'reach']
        },
        wordcloud: {
            enabled: true,
            maxWords: 100,
            exclusionSystem: true,
            interactivity: true
        },
        reports: {
            enabled: true,
            formats: ['pdf', 'csv', 'json'],
            scheduling: false // Para futuras implementaciones
        }
    },

    // Configuración de datos
    data: {
        sources: ['csv', 'json', 'api'], // Preparado para múltiples fuentes
        processing: {
            batchSize: 1000,
            cacheEnabled: true,
            realTimeUpdates: false
        }
    },

    // Configuración visual
    theme: {
        colors: {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#f093fb',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        },
        charts: {
            responsive: true,
            animation: true,
            borderWidth: 2
        }
    },

    // Configuración de exportación
    export: {
        defaultFormat: 'pdf',
        includeCharts: true,
        includeWordcloud: true,
        branding: true
    },

    // Configuración de rendimiento
    performance: {
        lazyLoading: true,
        debounceTime: 300,
        maxDataPoints: 10000
    }
};

// Función para obtener configuración por módulo
function getModuleConfig(moduleName) {
    return DashboardConfig.modules[moduleName] || {};
}

// Función para validar configuración
function validateConfig() {
    const required = ['modules', 'data', 'theme'];
    return required.every(key => key in DashboardConfig);
}

// Exportar configuración para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardConfig;
} else {
    window.DashboardConfig = DashboardConfig;
}