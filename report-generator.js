// Sistema de Generación de Reportes Optimizado - Dashboard Pro
// Módulo escalable y eficiente para generar reportes automatizados

class ReportGenerator {
    constructor(config = {}) {
        this.config = {
            format: 'pdf',
            includeCharts: true,
            includeWordcloud: true,
            branding: true,
            ...config
        };
    }

    // Generar reporte completo
    async generateReport(data, options = {}) {
        const reportData = this.prepareReportData(data);
        const format = options.format || this.config.format;

        switch (format) {
            case 'pdf':
                return this.generatePDFReport(reportData, options);
            case 'csv':
                return this.generateCSVReport(reportData, options);
            case 'json':
                return this.generateJSONReport(reportData, options);
            default:
                throw new Error(`Formato no soportado: ${format}`);
        }
    }

    // Preparar datos para el reporte
    prepareReportData(rawData) {
        const analytics = this.processAnalyticsData(rawData);
        const wordcloud = this.processWordcloudData(rawData);

        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                dataPoints: rawData.length,
                version: '1.0.0'
            },
            summary: this.generateSummary(analytics),
            analytics,
            wordcloud,
            insights: this.generateInsights(analytics, wordcloud)
        };
    }

    // Procesar datos de analytics
    processAnalyticsData(data) {
        const totalLikes = data.reduce((sum, item) => sum + (item.likes || 0), 0);
        const totalReplies = data.reduce((sum, item) => sum + (item.replies || 0), 0);
        const totalPosts = data.length;

        return {
            totalPosts,
            totalLikes,
            totalReplies,
            averageLikes: Math.round(totalLikes / totalPosts),
            averageReplies: Math.round(totalReplies / totalPosts),
            engagementRate: ((totalLikes + totalReplies) / totalPosts * 100).toFixed(2),
            topPosts: this.getTopPosts(data, 10),
            dailyActivity: this.getDailyActivity(data)
        };
    }

    // Procesar datos de nube de palabras
    processWordcloudData(data) {
        const words = this.extractWords(data);
        const wordCount = this.countWords(words);

        return {
            totalWords: words.length,
            uniqueWords: Object.keys(wordCount).length,
            topWords: Object.entries(wordCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 50)
                .map(([word, count]) => ({ word, count })),
            wordFrequency: wordCount
        };
    }

    // Generar resumen ejecutivo
    generateSummary(analytics) {
        return {
            overview: `Análisis de ${analytics.totalPosts} posts con un engagement promedio de ${analytics.engagementRate}%`,
            keyMetrics: [
                `${analytics.totalLikes} likes totales`,
                `${analytics.totalReplies} respuestas totales`,
                `${analytics.averageLikes} likes promedio por post`,
                `${analytics.averageReplies} respuestas promedio por post`
            ],
            period: this.getAnalysisPeriod(analytics.dailyActivity)
        };
    }

    // Generar insights automáticos
    generateInsights(analytics, wordcloud) {
        const insights = [];

        // Insight de engagement
        if (analytics.engagementRate > 10) {
            insights.push({
                type: 'positive',
                category: 'engagement',
                message: `Alto nivel de engagement (${analytics.engagementRate}%) - Por encima del promedio de la industria`
            });
        }

        // Insight de palabras más utilizadas
        if (wordcloud.topWords.length > 0) {
            const topWord = wordcloud.topWords[0];
            insights.push({
                type: 'info',
                category: 'content',
                message: `La palabra más utilizada es "${topWord.word}" con ${topWord.count} menciones`
            });
        }

        // Insight de actividad
        const peakDay = this.getPeakActivityDay(analytics.dailyActivity);
        if (peakDay) {
            insights.push({
                type: 'info',
                category: 'activity',
                message: `Mayor actividad registrada el ${peakDay.day} con ${peakDay.count} posts`
            });
        }

        return insights;
    }

    // Generar reporte PDF (placeholder para implementación futura)
    async generatePDFReport(data, options) {
        return {
            format: 'pdf',
            data: data,
            url: '#', // Se implementaría con una biblioteca PDF
            message: 'Funcionalidad PDF en desarrollo - usar CSV o JSON por ahora'
        };
    }

    // Generar reporte CSV
    generateCSVReport(data, options) {
        let csv = 'Métrica,Valor\n';

        // Métricas básicas
        csv += `Total Posts,${data.analytics.totalPosts}\n`;
        csv += `Total Likes,${data.analytics.totalLikes}\n`;
        csv += `Total Replies,${data.analytics.totalReplies}\n`;
        csv += `Engagement Rate,${data.analytics.engagementRate}%\n`;
        csv += `Palabras Únicas,${data.wordcloud.uniqueWords}\n`;

        // Top posts
        csv += '\nTop Posts\n';
        csv += 'Ranking,Likes,Replies,Texto\n';
        data.analytics.topPosts.forEach((post, index) => {
            const text = (post.text || '').replace(/"/g, '""').substring(0, 100);
            csv += `${index + 1},${post.likes},${post.replies},"${text}"\n`;
        });

        // Top palabras
        csv += '\nTop Palabras\n';
        csv += 'Palabra,Frecuencia\n';
        data.wordcloud.topWords.slice(0, 20).forEach(word => {
            csv += `${word.word},${word.count}\n`;
        });

        return {
            format: 'csv',
            data: csv,
            filename: `dashboard-report-${new Date().toISOString().split('T')[0]}.csv`
        };
    }

    // Generar reporte JSON
    generateJSONReport(data, options) {
        return {
            format: 'json',
            data: JSON.stringify(data, null, 2),
            filename: `dashboard-report-${new Date().toISOString().split('T')[0]}.json`
        };
    }

    // Métodos auxiliares
    getTopPosts(data, limit = 10) {
        return data
            .sort((a, b) => (b.likes + b.replies) - (a.likes + a.replies))
            .slice(0, limit)
            .map(post => ({
                likes: post.likes || 0,
                replies: post.replies || 0,
                text: post.text || post.content || '',
                engagement: (post.likes || 0) + (post.replies || 0)
            }));
    }

    getDailyActivity(data) {
        const dailyCount = {};
        data.forEach(item => {
            const date = item.date || new Date().toISOString().split('T')[0];
            dailyCount[date] = (dailyCount[date] || 0) + 1;
        });
        return dailyCount;
    }

    getPeakActivityDay(dailyActivity) {
        const entries = Object.entries(dailyActivity);
        if (entries.length === 0) return null;

        return entries.reduce((peak, [day, count]) =>
            count > peak.count ? { day, count } : peak
        , { day: '', count: 0 });
    }

    getAnalysisPeriod(dailyActivity) {
        const days = Object.keys(dailyActivity).sort();
        if (days.length === 0) return 'Sin datos de fecha disponibles';

        return `${days[0]} - ${days[days.length - 1]}`;
    }

    extractWords(data) {
        const allText = data
            .map(item => item.text || item.content || '')
            .join(' ')
            .toLowerCase();

        return allText.match(/\b\w+\b/g) || [];
    }

    countWords(words) {
        const count = {};
        words.forEach(word => {
            if (word.length > 2) { // Filtrar palabras muy cortas
                count[word] = (count[word] || 0) + 1;
            }
        });
        return count;
    }
}

// Función helper para descargar reportes
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

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReportGenerator, downloadReport };
} else {
    window.ReportGenerator = ReportGenerator;
    window.downloadReport = downloadReport;
}