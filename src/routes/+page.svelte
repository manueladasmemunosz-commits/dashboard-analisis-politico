<script>
	import { onMount } from 'svelte';
	import { rawData, filteredData, loadCsvData, processWordCloudData } from '$lib/stores/dashboard.js';

	// NO activar automáticamente el Word Cloud - solo cuando el usuario haga click
	import UnifiedHeader from '$lib/components/UnifiedHeader.svelte';
	import ChartWidget from '$lib/components/ChartWidget.svelte';
	import TimelineChart from '$lib/components/charts/TimelineChart.svelte';
	import TopPostsChart from '$lib/components/charts/TopPostsChart.svelte';
	import ActiveUsersChart from '$lib/components/charts/ActiveUsersChart.svelte';
	import HashtagsChart from '$lib/components/charts/HashtagsChart.svelte';
	import SentimentChart from '$lib/components/charts/SentimentChart.svelte';
	import PerformanceChart from '$lib/components/charts/PerformanceChart.svelte';
	import MentionsChart from '$lib/components/charts/MentionsChart.svelte';
	import NetworkComparisonWidget from '$lib/components/NetworkComparisonWidget.svelte';
	import Papa from 'papaparse';

	let totalPosts = 0;
	let filteredPosts = 0;
	let totalEngagement = 0;

	// Estado de configuraciones de gráficos
	let timelineConfig = {
		type: 'line',
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		granularity: 'day',
		heatmapMetric: 'posts', // 'posts' o 'engagement'
		comparativeEnabled: false,
		dateFromB: '2025-01-01',
		dateToB: '2025-12-12'
	};

	let topPostsConfig = {
		type: 'bar',
		limit: 10,
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let activeUsersConfig = {
		type: 'doughnut',
		limit: 10,
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all'],
		colorPalette: 'chilean',
		metric: 'posts'
	};

	let engagementScatterConfig = {
		type: 'scatter',
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all'],
		visualizationMode: 'likes-vs-replies'
	};

	let hashtagsConfig = {
		type: 'bar',
		limit: 20,
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let sentimentConfig = {
		type: 'doughnut',
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let performanceConfig = {
		type: 'line',
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let mentionsConfig = {
		type: 'bar',
		limit: 20,
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};


	let wordCloudConfig = {
		limit: 80,  // Default 80 palabras para nube muy densa y compacta
		dateFrom: '2025-01-01',
		dateTo: '2025-12-12',
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	// Estado de Word Cloud (carga diferida)
	let wordCloudEnabled = false;

	// Estado de Scatter Chart (carga diferida)
	let scatterChartEnabled = false;

	// Estados de lazy loading para gráficos
	let chartLoadingStates = {
		// Tier 1: Crítico - se cargan inmediatamente
		timeline: true,
		topPosts: true,
		networkComparison: true,

		// Tier 2: Lazy loading - se cargan al entrar en vista
		activeUsers: false,
		hashtags: false,
		sentiment: false,
		mentions: false,
		performance: false
	};

	// Función para activar carga de un gráfico
	function enableChart(chartName) {
		chartLoadingStates[chartName] = true;
		chartLoadingStates = chartLoadingStates; // Trigger reactivity
	}

	// Acción de Svelte para Intersection Observer
	function lazyLoad(node, chartName) {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !chartLoadingStates[chartName]) {
						console.log(`📊 Lazy loading: ${chartName} entró en vista`);
						enableChart(chartName);
						observer.unobserve(node); // Ya no necesitamos observar más
					}
				});
			},
			{
				rootMargin: '200px', // Empezar a cargar 200px antes de que sea visible
				threshold: 0.1
			}
		);

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	// Reactividad para actualizar estadísticas
	// OPTIMIZACIÓN: Usar un flag para evitar recalcular engagement innecesariamente
	let lastRawDataLength = 0;

	$: if ($rawData) {
		totalPosts = $rawData.length;

		// Solo recalcular engagement si los datos cambiaron de tamaño
		if ($rawData.length !== lastRawDataLength) {
			totalEngagement = $rawData.reduce((sum, post) =>
				sum + parseInt(post.likes || 0) + parseInt(post.replies || 0), 0
			);
			lastRawDataLength = $rawData.length;
		}
	}

	$: if ($filteredData) {
		filteredPosts = $filteredData.length;
	}

	// Filtrar datos del período B para modo comparativo
	// OPTIMIZACIÓN: Solo calcular cuando comparativeEnabled === true
	$: filteredDataB = timelineConfig.comparativeEnabled ?
		$rawData.filter(post => {
			const rawDate = post.created ? post.created.split(' ')[0] : null;
			const isValidDate = rawDate && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate);
			if (!isValidDate) return true;
			const postDate = rawDate.replace(/\//g, '-');
			return postDate >= timelineConfig.dateFromB && postDate <= timelineConfig.dateToB;
		}) : [];

	// Actualizar estadísticas en el DOM
	$: updateStats(totalPosts, filteredPosts, totalEngagement);

	function updateStats(total, filtered, engagement) {
		if (typeof document !== 'undefined') {
			const totalEl = document.getElementById('total-posts');
			const filteredEl = document.getElementById('filtered-posts');
			const engagementEl = document.getElementById('total-engagement');

			if (totalEl) totalEl.textContent = total.toLocaleString();
			if (filteredEl) filteredEl.textContent = filtered.toLocaleString();
			if (engagementEl) engagementEl.textContent = engagement.toLocaleString();
		}
	}

	function handleCsvUpload(event) {
		const file = event.detail.file;

		console.log('📄 Iniciando carga de CSV con PapaParse...');
		console.log('📄 Archivo:', file.name, 'Tamaño:', (file.size / 1024 / 1024).toFixed(2), 'MB');

		Papa.parse(file, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: false,
			encoding: 'UTF-8',
			complete: function(results) {
				console.log('✅ CSV parseado:', results.data.length, 'registros');
				console.log('📊 Columnas:', results.meta.fields.join(', '));

				if (results.errors.length > 0) {
					console.warn('⚠️ Errores de parsing:', results.errors.length);
				}

				// Intentar corregir encoding corrupto en campos de texto
				const cleanedData = results.data.map(row => {
					if (row.text) {
						row.text = fixEncoding(row.text);
					}
					if (row.user_name) {
						row.user_name = fixEncoding(row.user_name);
					}
					return row;
				});

				loadCsvData(cleanedData);
				console.log('✅ Datos cargados en el store (con corrección de encoding)');
			},
			error: function(error) {
				console.error('❌ Error en PapaParse:', error);
				alert('❌ Error procesando el archivo CSV: ' + error.message);
			}
		});
	}

	// Función para intentar corregir encoding corrupto
	function fixEncoding(text) {
		if (!text) return text;

		// PRIMERO: Eliminar el carácter ° que aparece entre letras
		let fixed = text.replace(/°/g, '');

		// Mapeo de otras corrupciones comunes
		const fixes = {
			'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
			'Ã±': 'ñ', 'ÃÑ': 'Ñ', 'Ã¼': 'ü',
			'Â¿': '¿', 'Â¡': '¡'
		};

		for (const [wrong, correct] of Object.entries(fixes)) {
			fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
		}

		return fixed;
	}

	async function handleSearch(event) {
		console.log('🔍 Search:', event.detail);
		const { searchTerm, dateFrom, dateTo } = event.detail;

		// Validar que las fechas estén definidas
		if (!dateFrom || !dateTo) {
			alert('⚠️ Por favor selecciona un rango de fechas para buscar en BigQuery');
			return;
		}

		try {
			console.log('🔄 Consultando BigQuery...');

			const response = await fetch('/api/bigquery', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					searchTerm: searchTerm || '',
					dateFrom,
					dateTo
				})
			});

			const result = await response.json();

			if (result.success) {
				console.log('✅ Datos obtenidos de BigQuery:', result.count, 'registros');
				console.log('📊 Metadata:', result.metadata);

				// Cargar datos en el store
				loadCsvData(result.data);

				alert(`✅ ${result.count} registros cargados desde BigQuery\n` +
				      `📅 Rango: ${result.metadata.rangeDays} días\n` +
				      `🔍 Búsqueda: "${searchTerm || 'todos'}"`);
			} else {
				console.error('❌ Error en BigQuery:', result.error);
				alert('❌ Error al consultar BigQuery:\n' + result.error);
			}

		} catch (error) {
			console.error('❌ Error de red:', error);
			alert('❌ Error al conectar con BigQuery:\n' + error.message);
		}
	}

	onMount(() => {
		console.log('🚀 Dashboard Svelte iniciado');
		console.log('☁️ El botón "Buscar" consulta BigQuery automáticamente');
		console.log('📄 Usa "Cargar CSV Local" solo si quieres analizar un archivo local');

		// Auto-carga de demo data DESHABILITADA para evitar problemas de performance
		// El usuario debe usar BigQuery o cargar manualmente su CSV
	});
</script>

<svelte:head>
	<title>Dashboard Chileno KAST</title>
	<meta name="description" content="Dashboard de análisis político chileno" />
</svelte:head>

<div class="dashboard-container">
	<UnifiedHeader
		on:csvUpload={handleCsvUpload}
		on:search={handleSearch}
	/>

	<!-- Sección Word Cloud (Feature Destacada) - CARGA DIFERIDA -->
	<div id="wordcloud-section" class="analysis-section featured-section">
		<div class="section-header">
			<h2 class="section-title">☁️ Nube de Palabras</h2>
			<p class="section-description">Palabras más frecuentes en los posts (excluye stopwords)</p>
		</div>
		<div class="charts-row single-chart">
			{#if wordCloudEnabled}
				<ChartWidget
					title="☁️ Word Cloud Interactivo"
					chartName="wordCloud"
					bind:dateFrom={wordCloudConfig.dateFrom}
					bind:dateTo={wordCloudConfig.dateTo}
					bind:socialNetwork={wordCloudConfig.socialNetwork}
					bind:selectedNetworks={wordCloudConfig.selectedNetworks}
					showDateControls={true}
					showSocialControls={true}
					showLimitControls={false}
					showChartTypeControls={false}
				>
					{#await import('$lib/components/charts/WordCloudChart.svelte')}
						<div class="loading-placeholder">Cargando Word Cloud...</div>
					{:then module}
						<svelte:component this={module.default} limit={wordCloudConfig.limit} />
					{/await}
				</ChartWidget>
			{:else}
				<div class="wordcloud-placeholder">
					<div class="placeholder-content">
						<h3>⚠️ Word Cloud - Carga Manual</h3>
						<p>Esta visualización procesa grandes cantidades de texto.</p>
						<p>Click para cargar la nube de palabras:</p>
						<button class="load-wordcloud-btn" on:click={() => { wordCloudEnabled = true; processWordCloudData($filteredData); }}>
							☁️ Cargar Word Cloud
						</button>
						<p class="placeholder-hint">Recomendado después de cargar tus datos CSV</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Sección Principal de Análisis -->
	<div id="main-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">📊 Análisis Principal</h2>
			<p class="section-description">Métricas clave y tendencias temporales</p>
		</div>
		<div class="charts-row">
			<!-- Timeline Analytics -->
			<ChartWidget
				title="📅 Timeline Analytics"
				chartName="timeline"
				bind:chartType={timelineConfig.type}
				bind:dateFrom={timelineConfig.dateFrom}
				bind:dateTo={timelineConfig.dateTo}
				bind:socialNetwork={timelineConfig.socialNetwork}
				bind:granularity={timelineConfig.granularity}
				bind:heatmapMetric={timelineConfig.heatmapMetric}
				bind:comparativeEnabled={timelineConfig.comparativeEnabled}
				bind:dateFromB={timelineConfig.dateFromB}
				bind:dateToB={timelineConfig.dateToB}
				chartTypes={['line', 'bar', 'area', 'areaSmooth', 'heatmap']}
				showLimitControls={false}
				showGranularityControls={true}
				showComparativeMode={timelineConfig.type !== 'heatmap'}
			>
				<TimelineChart
					data={timelineConfig.type === 'heatmap' ? $rawData : $filteredData}
					dataB={filteredDataB}
					chartType={timelineConfig.type}
					granularity={timelineConfig.granularity}
					heatmapMetric={timelineConfig.heatmapMetric}
					comparativeEnabled={timelineConfig.comparativeEnabled && timelineConfig.type !== 'heatmap'}
				/>
			</ChartWidget>

			<!-- Top Posts -->
			<ChartWidget
				title="🏆 Top Posts"
				chartName="topPosts"
				bind:chartType={topPostsConfig.type}
				bind:limit={topPostsConfig.limit}
				bind:dateFrom={topPostsConfig.dateFrom}
				bind:dateTo={topPostsConfig.dateTo}
				bind:socialNetwork={topPostsConfig.socialNetwork}
				bind:selectedNetworks={topPostsConfig.selectedNetworks}
				chartTypes={['bar', 'horizontalBar']}
				showDateControls={true}
				showSocialControls={true}
				showLimitControls={true}
			>
				<TopPostsChart
					data={$filteredData}
					chartType={topPostsConfig.type}
					limit={topPostsConfig.limit}
				/>
			</ChartWidget>
		</div>
	</div>

	<!-- Sección de Comparación de Redes -->
	<div id="network-comparison-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">🔀 Comparación de Redes Sociales</h2>
			<p class="section-description">Compara el volumen de actividad entre diferentes redes o grupos de redes</p>
		</div>
		<NetworkComparisonWidget data={$filteredData} />
	</div>

	<!-- Sección de Análisis de Usuarios -->
	<div id="users-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">👥 Análisis de Usuarios</h2>
			<p class="section-description">Usuarios más activos y patrones de engagement</p>
		</div>
		<div class="charts-row">
			<!-- Active Users - LAZY LOADING -->
			{#if chartLoadingStates.activeUsers}
				<ChartWidget
					title="👤 Usuarios Más Activos"
					chartName="activeUsers"
					bind:chartType={activeUsersConfig.type}
					bind:limit={activeUsersConfig.limit}
					bind:dateFrom={activeUsersConfig.dateFrom}
					bind:dateTo={activeUsersConfig.dateTo}
					bind:socialNetwork={activeUsersConfig.socialNetwork}
					bind:selectedNetworks={activeUsersConfig.selectedNetworks}
					bind:colorPalette={activeUsersConfig.colorPalette}
					bind:heatmapMetric={activeUsersConfig.metric}
					chartTypes={['doughnut', 'pie', 'bar', 'horizontalBar']}
					showDateControls={true}
					showSocialControls={true}
					showLimitControls={true}
					showColorPaletteControls={true}
				>
					<ActiveUsersChart
						data={$filteredData}
						chartType={activeUsersConfig.type}
						limit={activeUsersConfig.limit}
						colorPalette={activeUsersConfig.colorPalette}
						metric={activeUsersConfig.metric}
					/>
				</ChartWidget>
			{:else}
				<div use:lazyLoad={'activeUsers'} class="chart-skeleton">
					<div class="skeleton-content">
						<div class="skeleton-icon">👤</div>
						<h3>Usuarios Más Activos</h3>
						<p>Cargando al hacer scroll...</p>
						<div class="skeleton-spinner"></div>
					</div>
				</div>
			{/if}

			<!-- Engagement Scatter -->
			<ChartWidget
				title="💬 Engagement Distribution"
				chartName="engagementScatter"
				bind:chartType={engagementScatterConfig.type}
				bind:dateFrom={engagementScatterConfig.dateFrom}
				bind:dateTo={engagementScatterConfig.dateTo}
				bind:socialNetwork={engagementScatterConfig.socialNetwork}
				bind:selectedNetworks={engagementScatterConfig.selectedNetworks}
				bind:visualizationMode={engagementScatterConfig.visualizationMode}
				chartTypes={['scatter', 'bubble', 'violin', '3d']}
				showDateControls={true}
				showSocialControls={true}
				showLimitControls={false}
				showVisualizationModeControls={true}
			>
				{#if scatterChartEnabled}
					{#await import('$lib/components/charts/EngagementScatterChart.svelte')}
						<div class="loading-placeholder">Cargando Scatter Plot...</div>
					{:then module}
						<svelte:component this={module.default} data={$filteredData} chartType={engagementScatterConfig.type} visualizationMode={engagementScatterConfig.visualizationMode} />
					{/await}
				{:else}
					<div class="scatterplot-placeholder">
						<div class="placeholder-content">
							<h3>⚠️ Scatter Plot - Carga Manual</h3>
							<p>Esta visualización puede procesar grandes cantidades de datos.</p>
							<p>Click para cargar el gráfico de dispersión:</p>
							<button class="load-scatter-btn" on:click={() => scatterChartEnabled = true}>
								📊 Cargar Scatter Plot
							</button>
							<p class="placeholder-hint">Con {$filteredData.length.toLocaleString()} posts filtrados</p>
						</div>
					</div>
				{/if}
			</ChartWidget>
		</div>
	</div>

	<!-- Sección de Análisis de Contenido -->
	<div id="content-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">📝 Análisis de Contenido</h2>
			<p class="section-description">Hashtags, menciones y sentimientos en los posts</p>
		</div>
		<div class="charts-row">
			<!-- Hashtags - LAZY LOADING -->
			{#if chartLoadingStates.hashtags}
				<ChartWidget
					title="#️⃣ Hashtags Más Usados"
					chartName="hashtags"
					bind:chartType={hashtagsConfig.type}
					bind:limit={hashtagsConfig.limit}
					bind:dateFrom={hashtagsConfig.dateFrom}
					bind:dateTo={hashtagsConfig.dateTo}
					bind:socialNetwork={hashtagsConfig.socialNetwork}
					bind:selectedNetworks={hashtagsConfig.selectedNetworks}
					chartTypes={['bar', 'horizontalBar', 'doughnut', 'pie']}
					showDateControls={true}
					showSocialControls={true}
					showLimitControls={true}
				>
					<HashtagsChart
						data={$filteredData}
						chartType={hashtagsConfig.type}
						limit={hashtagsConfig.limit}
					/>
				</ChartWidget>
			{:else}
				<div use:lazyLoad={'hashtags'} class="chart-skeleton">
					<div class="skeleton-content">
						<div class="skeleton-icon">#️⃣</div>
						<h3>Hashtags Más Usados</h3>
						<p>Cargando al hacer scroll...</p>
						<div class="skeleton-spinner"></div>
					</div>
				</div>
			{/if}

			<!-- Sentiment - LAZY LOADING -->
			{#if chartLoadingStates.sentiment}
				<ChartWidget
					title="😊 Análisis de Sentimientos"
					chartName="sentiment"
					bind:chartType={sentimentConfig.type}
					bind:dateFrom={sentimentConfig.dateFrom}
					bind:dateTo={sentimentConfig.dateTo}
					bind:socialNetwork={sentimentConfig.socialNetwork}
					bind:selectedNetworks={sentimentConfig.selectedNetworks}
					chartTypes={['doughnut', 'pie', 'bar', 'horizontalBar']}
					showDateControls={true}
					showSocialControls={true}
					showLimitControls={false}
				>
					<SentimentChart
						data={$filteredData}
						chartType={sentimentConfig.type}
					/>
				</ChartWidget>
			{:else}
				<div use:lazyLoad={'sentiment'} class="chart-skeleton">
					<div class="skeleton-content">
						<div class="skeleton-icon">😊</div>
						<h3>Análisis de Sentimientos</h3>
						<p>Cargando al hacer scroll...</p>
						<div class="skeleton-spinner"></div>
					</div>
				</div>
			{/if}
		</div>

		<div class="charts-row">
			<!-- Mentions - LAZY LOADING -->
			{#if chartLoadingStates.mentions}
				<ChartWidget
					title="@ Usuarios Más Mencionados"
					chartName="mentions"
					bind:chartType={mentionsConfig.type}
					bind:limit={mentionsConfig.limit}
					bind:dateFrom={mentionsConfig.dateFrom}
					bind:dateTo={mentionsConfig.dateTo}
					bind:socialNetwork={mentionsConfig.socialNetwork}
					bind:selectedNetworks={mentionsConfig.selectedNetworks}
					chartTypes={['bar', 'horizontalBar', 'doughnut', 'pie']}
					showDateControls={true}
					showSocialControls={true}
					showLimitControls={true}
				>
					<MentionsChart
						data={$filteredData}
						chartType={mentionsConfig.type}
						limit={mentionsConfig.limit}
					/>
				</ChartWidget>
			{:else}
				<div use:lazyLoad={'mentions'} class="chart-skeleton">
					<div class="skeleton-content">
						<div class="skeleton-icon">@</div>
						<h3>Usuarios Más Mencionados</h3>
						<p>Cargando al hacer scroll...</p>
						<div class="skeleton-spinner"></div>
					</div>
				</div>
			{/if}

			<!-- Performance - LAZY LOADING -->
			{#if chartLoadingStates.performance}
				<ChartWidget
					title="📈 Performance: Engagement Rate"
					chartName="performance"
					bind:chartType={performanceConfig.type}
					bind:dateFrom={performanceConfig.dateFrom}
					bind:dateTo={performanceConfig.dateTo}
					bind:socialNetwork={performanceConfig.socialNetwork}
					bind:selectedNetworks={performanceConfig.selectedNetworks}
					chartTypes={['line', 'bar', 'area', 'areaSmooth']}
					showDateControls={true}
					showSocialControls={true}
					showLimitControls={false}
				>
					<PerformanceChart
						data={$filteredData}
						chartType={performanceConfig.type}
					/>
				</ChartWidget>
			{:else}
				<div use:lazyLoad={'performance'} class="chart-skeleton">
					<div class="skeleton-content">
						<div class="skeleton-icon">📈</div>
						<h3>Performance: Engagement Rate</h3>
						<p>Cargando al hacer scroll...</p>
						<div class="skeleton-spinner"></div>
					</div>
				</div>
			{/if}
		</div>
	</div>


	<!-- Status del dashboard -->
	<div class="dashboard-status">
		<p>
			📊 Posts: <strong>{totalPosts}</strong>
			| 🔍 Filtrados: <strong>{filteredPosts}</strong>
			| 💬 Engagement: <strong>{totalEngagement.toLocaleString()}</strong>
		</p>
	</div>
</div>

<style>
	.dashboard-status {
		position: fixed;
		bottom: 20px;
		right: 20px;
		background: var(--chile-blue-600);
		color: white;
		padding: 0.5rem 1rem;
		border-radius: var(--border-radius);
		font-size: 0.8rem;
		box-shadow: var(--shadow-lg);
		z-index: 1000;
	}

	.featured-section {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 2rem;
		border-radius: 12px;
		margin-bottom: 2rem;
	}

	.featured-section .section-header {
		color: white;
	}

	.featured-section .section-title {
		color: white;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
	}

	.featured-section .section-description {
		color: rgba(255, 255, 255, 0.9);
	}

	.single-chart {
		max-width: 100%;
	}

	.wordcloud-placeholder {
		background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
		border: 2px solid rgba(102, 126, 234, 0.3);
		border-radius: 8px;
		padding: 3rem;
		text-align: center;
		min-height: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.placeholder-content {
		text-align: center;
		color: #1e40af;
	}

	.placeholder-content h3 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
		color: #dc2626;
	}

	.placeholder-content p {
		margin: 0.5rem 0;
		font-size: 1rem;
	}

	.placeholder-hint {
		font-size: 0.85rem;
		color: #64748b;
		font-style: italic;
		margin-top: 1rem;
	}

	.load-wordcloud-btn {
		margin: 1.5rem 0;
		padding: 1rem 2rem;
		font-size: 1.2rem;
		font-weight: 600;
		background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.load-wordcloud-btn:hover {
		background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(220, 38, 38, 0.4);
	}

	.load-wordcloud-btn:active {
		transform: translateY(0);
	}

	/* Estilos para scatter plot placeholder */
	.scatterplot-placeholder {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%);
		border: 2px solid rgba(59, 130, 246, 0.3);
		border-radius: 8px;
		padding: 3rem;
		text-align: center;
		min-height: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.load-scatter-btn {
		margin: 1.5rem 0;
		padding: 1rem 2rem;
		font-size: 1.2rem;
		font-weight: 600;
		background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.load-scatter-btn:hover {
		background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%);
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(37, 99, 235, 0.4);
	}

	.load-scatter-btn:active {
		transform: translateY(0);
	}

	.loading-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		font-size: 1.2rem;
		color: #666;
		font-weight: 500;
	}

	/* Estilos para skeleton loader (lazy loading) */
	.chart-skeleton {
		background: linear-gradient(135deg, rgba(241, 245, 249, 0.8) 0%, rgba(226, 232, 240, 0.8) 100%);
		border: 2px dashed rgba(148, 163, 184, 0.4);
		border-radius: 8px;
		padding: 2rem;
		min-height: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: skeleton-pulse 2s ease-in-out infinite;
	}

	.skeleton-content {
		text-align: center;
		color: #64748b;
	}

	.skeleton-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
		opacity: 0.5;
		animation: skeleton-float 3s ease-in-out infinite;
	}

	.skeleton-content h3 {
		font-size: 1.3rem;
		margin-bottom: 0.5rem;
		color: #475569;
		font-weight: 600;
	}

	.skeleton-content p {
		font-size: 0.95rem;
		color: #94a3b8;
		margin-bottom: 1.5rem;
	}

	.skeleton-spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto;
		border: 4px solid rgba(59, 130, 246, 0.2);
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: skeleton-spin 1s linear infinite;
	}

	@keyframes skeleton-pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	@keyframes skeleton-float {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	@keyframes skeleton-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>