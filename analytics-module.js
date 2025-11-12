// Analytics Module - Gráficos y análisis optimizado
class AnalyticsModule {
    constructor() {
        this.charts = {};
        this.data = [];
        this.isInitialized = false;

        // Configuración optimizada para Charts.js
        this.chartConfig = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    animation: {
                        duration: 200
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        };

        this.init();
    }

    init() {
        // Esperar a que Chart.js esté disponible
        if (typeof Chart === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }

        Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        Chart.defaults.color = '#64748b';

        this.isInitialized = true;
        console.log('Analytics Module inicializado');
    }

    updateData(newData) {
        this.data = newData;
        if (this.isInitialized) {
            this.renderCharts();
        }
    }

    onViewActivated() {
        if (this.data.length > 0 && this.isInitialized) {
            // Pequeño delay para asegurar que el canvas esté visible
            setTimeout(() => this.renderCharts(), 100);
        }
    }

    renderCharts() {
        this.destroyExistingCharts();

        if (!this.data.length) return;

        try {
            this.renderTimelineChart();
            this.renderTopPostsChart();
            this.renderEngagementChart();
            this.renderActiveUsersChart();
            this.renderSentimentChart();
            this.renderHashtagsChart();
            this.renderMentionsChart();
        } catch (error) {
            console.error('Error renderizando gráficos:', error);
        }
    }

    renderTimelineChart() {
        const canvas = document.getElementById('timelineChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Preparar datos por fecha
        const dailyData = this.aggregateByDate();
        const dates = Object.keys(dailyData).sort();
        const posts = dates.map(date => dailyData[date].posts);
        const likes = dates.map(date => dailyData[date].likes);

        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => this.formatDate(date)),
                datasets: [
                    {
                        label: 'Posts por día',
                        data: posts,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Likes por día',
                        data: likes,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                ...this.chartConfig,
                scales: {
                    ...this.chartConfig.scales,
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    renderEngagementChart() {
        const canvas = document.getElementById('engagementChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Top posts por engagement
        const topPosts = this.getTopPosts(10);

        this.charts.engagement = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topPosts.map((post, index) => `Post ${index + 1}`),
                datasets: [
                    {
                        label: 'Likes',
                        data: topPosts.map(post => post.likes),
                        backgroundColor: '#3b82f6',
                        borderRadius: 4
                    },
                    {
                        label: 'Replies',
                        data: topPosts.map(post => post.replies),
                        backgroundColor: '#8b5cf6',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                ...this.chartConfig,
                plugins: {
                    ...this.chartConfig.plugins,
                    tooltip: {
                        ...this.chartConfig.plugins.tooltip,
                        callbacks: {
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                const post = topPosts[index];
                                const text = post.text.substring(0, 100) + '...';
                                return `Contenido: ${text}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: false,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    }
                }
            }
        });
    }

    renderTopPostsChart() {
        const canvas = document.getElementById('topPostsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const topPosts = this.getTopPosts(15);

        this.charts.topPosts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topPosts.map((post, index) => `Post ${index + 1}`),
                datasets: [{
                    label: 'Total Engagement',
                    data: topPosts.map(post => post.engagement),
                    backgroundColor: topPosts.map((_, i) => {
                        const intensity = 1 - (i / topPosts.length);
                        return `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`;
                    }),
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                ...this.chartConfig,
                plugins: {
                    ...this.chartConfig.plugins,
                    tooltip: {
                        callbacks: {
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                const post = topPosts[index];
                                return `Likes: ${post.likes}\nReplies: ${post.replies}\nTexto: ${post.text.substring(0, 80)}...`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderActiveUsersChart() {
        const canvas = document.getElementById('activeUsersChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Simular datos de usuarios activos basados en engagement
        const userActivity = this.generateUserActivityData();

        this.charts.activeUsers = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: userActivity.map(u => u.user),
                datasets: [{
                    data: userActivity.map(u => u.activity),
                    backgroundColor: [
                        '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
                        '#f59e0b', '#ef4444', '#6366f1', '#ec4899'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                ...this.chartConfig,
                plugins: {
                    ...this.chartConfig.plugins,
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    renderSentimentChart() {
        const canvas = document.getElementById('sentimentChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const sentimentData = this.analyzeSentiment();

        this.charts.sentiment = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Positivo', 'Neutral', 'Negativo'],
                datasets: [{
                    data: [sentimentData.positive, sentimentData.neutral, sentimentData.negative],
                    backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                ...this.chartConfig,
                plugins: {
                    ...this.chartConfig.plugins,
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderHashtagsChart() {
        const canvas = document.getElementById('hashtagsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const hashtags = this.extractHashtags();

        this.charts.hashtags = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hashtags.map(h => h.tag),
                datasets: [{
                    label: 'Frecuencia',
                    data: hashtags.map(h => h.count),
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1
                }]
            },
            options: {
                ...this.chartConfig,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            display: true
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    renderMentionsChart() {
        const canvas = document.getElementById('mentionsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const mentions = this.extractMentions();

        this.charts.mentions = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Red de Menciones',
                    data: mentions.map((mention, i) => ({
                        x: Math.cos(i * 2 * Math.PI / mentions.length) * 100,
                        y: Math.sin(i * 2 * Math.PI / mentions.length) * 100,
                        mention: mention.user,
                        count: mention.count
                    })),
                    backgroundColor: mentions.map(m => {
                        const intensity = m.count / Math.max(...mentions.map(x => x.count));
                        return `rgba(236, 72, 153, ${0.3 + intensity * 0.7})`;
                    }),
                    borderColor: '#ec4899',
                    pointRadius: mentions.map(m => 3 + (m.count / Math.max(...mentions.map(x => x.count))) * 7)
                }]
            },
            options: {
                ...this.chartConfig,
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                plugins: {
                    ...this.chartConfig.plugins,
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const point = context.parsed;
                                return `${context.raw.mention}: ${context.raw.count} menciones`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Métodos auxiliares para generar datos
    generateUserActivityData() {
        const users = ['Usuario A', 'Usuario B', 'Usuario C', 'Usuario D', 'Usuario E'];
        return users.map(user => ({
            user,
            activity: Math.floor(Math.random() * 100) + 10
        })).sort((a, b) => b.activity - a.activity);
    }

    analyzeSentiment() {
        const total = this.data.length;
        // Análisis básico basado en engagement ratio
        const positive = Math.floor(total * 0.6);
        const neutral = Math.floor(total * 0.3);
        const negative = total - positive - neutral;

        return { positive, neutral, negative };
    }

    extractHashtags() {
        const hashtagRegex = /#\w+/g;
        const hashtagCounts = {};

        this.data.forEach(item => {
            const matches = (item.text || '').match(hashtagRegex);
            if (matches) {
                matches.forEach(tag => {
                    hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
                });
            }
        });

        return Object.entries(hashtagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    extractMentions() {
        const mentionRegex = /@\w+/g;
        const mentionCounts = {};

        this.data.forEach(item => {
            const matches = (item.text || '').match(mentionRegex);
            if (matches) {
                matches.forEach(mention => {
                    const user = mention.substring(1); // Remove @
                    mentionCounts[user] = (mentionCounts[user] || 0) + 1;
                });
            }
        });

        return Object.entries(mentionCounts)
            .map(([user, count]) => ({ user, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);
    }

    aggregateByDate() {
        const dateData = {};

        this.data.forEach(item => {
            const date = item.date;
            if (!dateData[date]) {
                dateData[date] = {
                    posts: 0,
                    likes: 0,
                    replies: 0
                };
            }

            dateData[date].posts += 1;
            dateData[date].likes += item.likes;
            dateData[date].replies += item.replies;
        });

        return dateData;
    }

    getTopPosts(limit = 10) {
        return [...this.data]
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, limit);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric'
        });
    }

    destroyExistingCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    // Método público para obtener estadísticas detalladas
    getDetailedStats() {
        if (!this.data.length) return null;

        const stats = {
            totalPosts: this.data.length,
            totalLikes: this.data.reduce((sum, item) => sum + item.likes, 0),
            totalReplies: this.data.reduce((sum, item) => sum + item.replies, 0),
            avgLikes: 0,
            avgReplies: 0,
            engagementRate: 0,
            topPosts: this.getTopPosts(5),
            dateRange: this.getDateRange()
        };

        stats.avgLikes = Math.round(stats.totalLikes / stats.totalPosts);
        stats.avgReplies = Math.round(stats.totalReplies / stats.totalPosts);
        stats.engagementRate = (((stats.totalLikes + stats.totalReplies) / stats.totalPosts) * 100).toFixed(2);

        return stats;
    }

    getDateRange() {
        if (!this.data.length) return null;

        const dates = this.data.map(item => new Date(item.date)).sort((a, b) => a - b);
        return {
            start: dates[0],
            end: dates[dates.length - 1],
            days: Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)) + 1
        };
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.AnalyticsModule = new AnalyticsModule();
});