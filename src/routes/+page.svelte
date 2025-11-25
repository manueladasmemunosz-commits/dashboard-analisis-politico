<script>
	import { onMount } from 'svelte';
	import { rawData, filteredData, dataFilteredByDatesOnly, loadCsvData, processWordCloudData, updateFilters } from '$lib/stores/dashboard.js';

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
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ProyectosView from '$lib/components/ProyectosView.svelte';
	import ProjectComparisonView from '$lib/components/ProjectComparisonView.svelte';
	import MediaListView from '$lib/components/MediaListView.svelte';
	import UserTimelineView from '$lib/components/UserTimelineView.svelte';
	import Papa from 'papaparse';

	let totalPosts = 0;
	let filteredPosts = 0;
	let totalEngagement = 0;

	// Fecha actual para inicializar configuraciones
	const today = new Date().toISOString().split('T')[0];

	// Estado de configuraciones de gráficos
	let timelineConfig = {
		type: 'line',
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		granularity: 'day',
		heatmapMetric: 'posts', // 'posts' o 'engagement'
		comparativeEnabled: false,
		dateFromB: today,
		dateToB: today,
		// Comparación de proyectos
		projectComparisonEnabled: false,
		selectedProjectIds: [],
		projectsData: {} // { projectId: [posts...] }
	};

	let topPostsConfig = {
		type: 'bar',
		limit: 10,
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let activeUsersConfig = {
		type: 'doughnut',
		limit: 10,
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all'],
		colorPalette: 'extended', // Paleta extendida con 40 colores para evitar repeticiones
		metric: 'posts'
	};

	let engagementScatterConfig = {
		type: 'scatter',
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all'],
		visualizationMode: 'likes-vs-replies'
	};

	let hashtagsConfig = {
		type: 'bar',
		limit: 20,
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let sentimentConfig = {
		type: 'doughnut',
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let performanceConfig = {
		type: 'line',
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	let mentionsConfig = {
		type: 'bar',
		limit: 20,
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};


	let wordCloudConfig = {
		limit: 80,  // Default 80 palabras para nube muy densa y compacta
		dateFrom: today,
		dateTo: today,
		socialNetwork: 'all',
		selectedNetworks: ['all']
	};

	// Configuraciones para gráficos de Medios
	let mediosTimelineConfig = {
		type: 'line',
		dateFrom: today,
		dateTo: today,
		granularity: 'day',
		// Comparación de proyectos
		projectComparisonEnabled: false,
		selectedProjectIds: [],
		projectsData: {} // { projectId: [posts...] }
	};

	let mediosWordCloudConfig = {
		limit: 80,
		dateFrom: today,
		dateTo: today
	};

	// Estado de Word Cloud (carga diferida)
	let wordCloudEnabled = false;
	let mediosWordCloudEnabled = true;

	// Actualizar Word Cloud automáticamente cuando cambien los filtros (si está habilitado)
	$: if (wordCloudEnabled && socialMediaPosts) {
		processWordCloudData(socialMediaPosts);
	}

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

	// Estado de loading de BigQuery
	let isLoadingBigQuery = false;
	let loadingStep = 1;
	let loadingStepText = '';

	// Estado para proyectos
	let allProyectos = [];
	let selectedProyectoIds = [];
	let comparisonData = [];

	// Estado de pestaña activa
	let activeTab = 'main';

	// Clasificación de medios por región
	let mediosClassification = {};

	function handleTabChange(event) {
		activeTab = event.detail.tab;
		console.log('📑 Pestaña activa:', activeTab);
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

	// Separar datos de RRSS vs Medios
	$: socialMediaPosts = $filteredData.filter(post => {
		const source = (post.source || '').toLowerCase();
		return ['twitter', 'instagram', 'facebook', 'tiktok'].includes(source);
	});

	$: newsPosts = $filteredData.filter(post => {
		const source = (post.source || '').toLowerCase();
		return source === 'news';
	});

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
			// Mostrar loading overlay con paso 1
			isLoadingBigQuery = true;
			loadingStep = 1;
			loadingStepText = 'Conectando con BigQuery...';
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

			// Paso 2: Procesando respuesta
			loadingStep = 2;
			loadingStepText = 'Descargando datos...';

			const result = await response.json();

			if (result.success) {
				console.log('✅ Datos obtenidos de BigQuery:', result.count, 'registros');
				console.log('📊 Metadata:', result.metadata);

				// Paso 3: Procesando datos
				loadingStep = 3;
				loadingStepText = 'Procesando datos y generando gráficos...';

				// Pequeño delay para que la UI se actualice
				await new Promise(resolve => setTimeout(resolve, 100));

				// Cargar datos en el store
				loadCsvData(result.data);

				// Otro delay para que el store se actualice antes de quitar el loading
				await new Promise(resolve => setTimeout(resolve, 200));

				// IMPORTANTE: NO volver a filtrar por searchTerm en el cliente
				// BigQuery ya hizo el filtro (aunque sea aproximado), aplicarlo de nuevo eliminaría posts
				// Solo actualizamos las fechas para que otros filtros (redes sociales) funcionen
				updateFilters({
					searchTerm: '', // ← Vacío porque BigQuery ya filtró
					dateFrom,
					dateTo
				});

				console.log('✅ Datos cargados y filtros aplicados');

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
		} finally {
			// Ocultar loading overlay
			isLoadingBigQuery = false;
		}
	}

	async function handleAplicarProyecto(event) {
		const { proyecto } = event.detail;
		console.log('📁 Aplicando proyecto:', proyecto.nombre);

		// Cambiar a la pestaña Principal
		activeTab = 'main';

		// Aplicar los filtros del proyecto al dashboard principal
		await handleSearch({ detail: proyecto.query });

		// Scroll a la sección principal
		const element = document.getElementById('main-section');
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	async function handleCompararProyectos(event) {
		const { proyectos } = event.detail;
		console.log('📊 Comparando proyectos:', proyectos.map(p => p.nombre));

		// Cambiar a la pestaña de Comparación
		activeTab = 'comparacion';

		// Ejecutar las queries para cada proyecto
		await handleUpdateComparison({ detail: { proyectos } });

		// Scroll a la sección de comparación (después de un pequeño delay para que se renderice)
		setTimeout(() => {
			const element = document.getElementById('project-comparison-section');
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}, 100);
	}

	function handleProjectComparisonToggle(event) {
		const { enabled, chartName } = event.detail;
		console.log(`📊 Modo comparación de proyectos ${enabled ? 'activado' : 'desactivado'} en ${chartName}`);

		if (chartName === 'timeline') {
			timelineConfig.projectComparisonEnabled = enabled;

			// Si se desactiva, limpiar los datos de proyectos
			if (!enabled) {
				timelineConfig.projectsData = {};
				timelineConfig.selectedProjectIds = [];
			}
		} else if (chartName === 'mediosTimeline') {
			mediosTimelineConfig.projectComparisonEnabled = enabled;

			// Si se desactiva, limpiar los datos de proyectos
			if (!enabled) {
				mediosTimelineConfig.projectsData = {};
				mediosTimelineConfig.selectedProjectIds = [];
			}
		}
	}

	async function handleProjectSelectionChanged(event) {
		const { projectIds, chartName } = event.detail;
		console.log(`📁 Proyectos seleccionados en ${chartName}:`, projectIds);

		if (chartName === 'timeline') {
			timelineConfig.selectedProjectIds = projectIds;

			// Cargar datos para los proyectos seleccionados
			await loadProjectsData(projectIds, 'timeline');
		} else if (chartName === 'mediosTimeline') {
			mediosTimelineConfig.selectedProjectIds = projectIds;

			// Cargar datos para los proyectos seleccionados
			await loadProjectsData(projectIds, 'mediosTimeline');
		}
	}

	// IMPORTANTE: Esta función usa las fechas del Timeline (timelineConfig.dateFrom/dateTo o mediosTimelineConfig.dateFrom/dateTo)
	// en lugar de las fechas guardadas en cada proyecto. Esto permite ajustar
	// dinámicamente el rango de fechas sin tener que editar cada proyecto guardado.
	async function loadProjectsData(projectIds, chartName = 'timeline') {
		if (projectIds.length === 0) {
			if (chartName === 'timeline') {
				timelineConfig.projectsData = {};
			} else if (chartName === 'mediosTimeline') {
				mediosTimelineConfig.projectsData = {};
			}
			return;
		}

		console.log(`🔄 Cargando datos para ${projectIds.length} proyectos en ${chartName}...`);
		isLoadingBigQuery = true;

		try {
			const newProjectsData = {};
			const config = chartName === 'mediosTimeline' ? mediosTimelineConfig : timelineConfig;

			for (let i = 0; i < projectIds.length; i++) {
				const projectId = projectIds[i];
				const proyecto = allProyectos.find(p => p.id === projectId);

				if (!proyecto) {
					console.warn(`⚠️ Proyecto ${projectId} no encontrado`);
					continue;
				}

				console.log(`📥 Cargando datos para: ${proyecto.nombre} (${i + 1}/${projectIds.length})`);
				console.log(`   📅 Fechas del Timeline: ${config.dateFrom} → ${config.dateTo}`);
				console.log(`   🔍 SearchTerm: "${proyecto.query.searchTerm}"`);

				const response = await fetch('/api/bigquery', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						searchTerm: proyecto.query.searchTerm,
						dateFrom: config.dateFrom,
						dateTo: config.dateTo
					})
				});

				const result = await response.json();

				if (result.success) {
					newProjectsData[projectId] = result.data;
					console.log(`✅ ${proyecto.nombre}: ${result.data.length} posts cargados`);
				} else {
					console.error(`❌ Error cargando ${proyecto.nombre}:`, result.error);
					newProjectsData[projectId] = [];
				}
			}

			if (chartName === 'timeline') {
				timelineConfig.projectsData = newProjectsData;
			} else if (chartName === 'mediosTimeline') {
				mediosTimelineConfig.projectsData = newProjectsData;
			}
			console.log('✅ Todos los datos de proyectos cargados');

		} catch (error) {
			console.error('❌ Error cargando datos de proyectos:', error);
			alert('Error al cargar datos de proyectos:\n' + error.message);
		} finally {
			isLoadingBigQuery = false;
		}
	}

	async function handleUpdateComparison(event) {
		const { proyectos } = event.detail;
		console.log('🔄 Actualizando comparación para proyectos:', proyectos);

		// Ejecutar query de BigQuery para cada proyecto
		const comparisonResults = [];
		const totalProyectos = proyectos.length;

		for (let i = 0; i < proyectos.length; i++) {
			const proyecto = proyectos[i];
			try {
				console.log(`📥 Obteniendo datos para: ${proyecto.nombre} (${i + 1}/${totalProyectos})`);

				const response = await fetch('/api/bigquery', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						searchTerm: proyecto.query.searchTerm,
						dateFrom: proyecto.query.dateFrom,
						dateTo: proyecto.query.dateTo
					})
				});

				const result = await response.json();
				if (result.success) {
					comparisonResults.push({
						proyecto,
						data: result.data,
						stats: {
							totalPosts: result.count,
							totalEngagement: 0,
							totalLikes: 0,
							totalReplies: 0,
							totalShares: 0,
							avgEngagement: 0
						}
					});
				}
			} catch (error) {
				console.error(`❌ Error obteniendo datos para ${proyecto.nombre}:`, error);
			}
		}

		comparisonData = comparisonResults;
		console.log('✅ Comparación actualizada con', comparisonData.length, 'proyectos');
	}

	onMount(async () => {
		console.log('🚀 Dashboard Svelte iniciado');
		console.log('☁️ El botón "Buscar" consulta BigQuery automáticamente');
		console.log('📄 Usa "Cargar CSV Local" solo si quieres analizar un archivo local');

		// Cargar clasificación de medios desde mediosporregion.csv
		try {
			const response = await fetch('/mediosporregion.csv');
			const text = await response.text();
			const lines = text.split('\n');

			// Saltar el header
			for (let i = 1; i < lines.length; i++) {
				const line = lines[i].trim();
				if (!line) continue;

				const parts = line.split(',');
				if (parts.length >= 5) {
					const medio = parts[0].toLowerCase();
					const region = parts[2];
					const ciudad = parts[3];
					const tipo = parts[4];

					mediosClassification[medio] = {
						region: region,
						ciudad: ciudad,
						tipo: tipo  // 'Nacional' o 'Regional'
					};
				}
			}
			console.log('✅ Clasificación de medios cargada:', Object.keys(mediosClassification).length, 'medios');
		} catch (error) {
			console.error('❌ Error cargando clasificación de medios:', error);
		}

		// Cargar proyectos guardados al inicio
		try {
			const response = await fetch('/api/proyectos');
			if (response.ok) {
				allProyectos = await response.json();
				console.log('✅ Proyectos cargados en +page.svelte:', allProyectos.length);
			}
		} catch (error) {
			console.error('❌ Error cargando proyectos:', error);
		}

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
		on:tabChange={handleTabChange}
	/>

	<!-- PESTAÑA RRSS -->
	{#if activeTab === 'main'}

	<!-- Sección de Comparación de Proyectos -->
	{#if allProyectos.length > 0}
	<div class="project-comparison-banner">
		<div class="banner-content">
			<div class="banner-header">
				<h3>📊 Comparación de Proyectos</h3>
				<p>Compara hasta 6 proyectos guardados en un mismo gráfico</p>
			</div>
			{#if !timelineConfig.projectComparisonEnabled}
				<button class="activate-comparison-btn" on:click={() => {
					timelineConfig.projectComparisonEnabled = true;
					// Scroll al gráfico
					setTimeout(() => {
						document.getElementById('timeline-section')?.scrollIntoView({ behavior: 'smooth' });
					}, 100);
				}}>
					🚀 Activar Comparación
				</button>
			{:else}
				<div class="comparison-active-info">
					✓ Modo comparación activo - Ve al gráfico Timeline para seleccionar proyectos
				</div>
			{/if}
		</div>
	</div>
	{/if}

	<!-- Sección Word Cloud (Feature Destacada) - CARGA DIFERIDA -->
	<div id="wordcloud-section" class="analysis-section featured-section">
		<div class="section-header">
			<h2 class="section-title">☁️ Nube de Palabras (RRSS)</h2>
			<p class="section-description">Palabras más frecuentes en redes sociales (excluye stopwords)</p>
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
						<button class="load-wordcloud-btn" on:click={() => { wordCloudEnabled = true; processWordCloudData(socialMediaPosts); }}>
							☁️ Cargar Word Cloud
						</button>
						<p class="placeholder-hint">Palabras de redes sociales (Twitter, Instagram, Facebook, TikTok)</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Sección Principal de Análisis -->
	<div id="main-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">📱 Análisis de Redes Sociales</h2>
			<p class="section-description">Métricas clave y tendencias en Twitter, Instagram, Facebook y TikTok</p>
		</div>

		<!-- Empty State cuando no hay datos -->
		{#if socialMediaPosts.length === 0 && !isLoadingBigQuery}
			<EmptyState
				icon="🔍"
				title="No hay datos de redes sociales para mostrar"
				description="Realiza una búsqueda para comenzar a visualizar datos"
				suggestions={[
					'Usa el botón "Buscar" para consultar datos de BigQuery',
					'Amplía el rango de fechas si no encuentras resultados',
					'Prueba términos de búsqueda menos específicos',
					'Verifica los filtros de red social',
					'Puedes cargar un archivo CSV local como alternativa'
				]}
			/>
		{/if}

		<!-- Gráficos (solo mostrar si hay datos) -->
		<div class="charts-row" id="timeline-section">
			<!-- Timeline Analytics - Siempre visible para permitir comparación de proyectos -->
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
				showProjectComparison={true}
				bind:projectComparisonEnabled={timelineConfig.projectComparisonEnabled}
				bind:selectedProjectIds={timelineConfig.selectedProjectIds}
				availableProjects={allProyectos}
				on:projectComparisonToggle={handleProjectComparisonToggle}
				on:projectSelectionChanged={handleProjectSelectionChanged}
			>
				<TimelineChart
					data={timelineConfig.type === 'heatmap' ? $rawData : socialMediaPosts}
					dataB={filteredDataB}
					chartType={timelineConfig.type}
					granularity={timelineConfig.granularity}
					heatmapMetric={timelineConfig.heatmapMetric}
					comparativeEnabled={timelineConfig.comparativeEnabled && timelineConfig.type !== 'heatmap'}
					projectComparisonEnabled={timelineConfig.projectComparisonEnabled}
					projectsData={timelineConfig.projectsData}
					projects={allProyectos}
				/>
			</ChartWidget>
		</div>

		<!-- Gráficos adicionales (solo si hay datos) -->
		{#if socialMediaPosts.length > 0}
		<div class="charts-row">
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
					data={socialMediaPosts}
					chartType={topPostsConfig.type}
					limit={topPostsConfig.limit}
				/>
			</ChartWidget>
		</div>
		{/if}
	</div>

	<!--  Sección de Comparación de Redes -->
	<div id="network-comparison-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">🔀 Comparación de Redes Sociales</h2>
			<p class="section-description">Compara el volumen de actividad entre Twitter, Instagram, Facebook y TikTok</p>
		</div>
		<NetworkComparisonWidget data={socialMediaPosts} />
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
						data={socialMediaPosts}
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
						<svelte:component this={module.default} data={socialMediaPosts} chartType={engagementScatterConfig.type} visualizationMode={engagementScatterConfig.visualizationMode} />
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
							<p class="placeholder-hint">Con {socialMediaPosts.length.toLocaleString()} posts de RRSS</p>
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
						data={socialMediaPosts}
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

			<!-- Sentiment - COMENTADO (modelo no entrenado) -->
			<!--
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
						data={socialMediaPosts}
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
			-->
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
						data={socialMediaPosts}
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
						data={socialMediaPosts}
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
	{/if}

	<!-- PESTAÑA PROYECTOS -->
	{#if activeTab === 'proyectos'}
	<!-- Sección de Proyectos -->
	<div id="proyectos-section" class="analysis-section">
		<ProyectosView
			bind:allProyectos
			bind:selectedProyectoIds
			on:aplicarProyecto={handleAplicarProyecto}
			on:compararProyectos={handleCompararProyectos}
			on:proyectosUpdated={(e) => { allProyectos = e.detail.proyectos; }}
		/>
	</div>
	{/if}

	<!-- PESTAÑA MEDIOS -->
	{#if activeTab === 'medios'}
	<!-- Lista de Medios (Protagonista) -->
	<div id="medios-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">📰 Medios de Comunicación</h2>
			<p class="section-description">Publicaciones de medios nacionales y regionales</p>
		</div>
		<MediaListView posts={newsPosts} />
	</div>

	<!-- Gráficos de Análisis de Medios -->
	<div id="medios-analytics-section" class="analysis-section">
		<div class="section-header">
			<h2 class="section-title">📊 Análisis de Medios</h2>
			<p class="section-description">Visualización de volumen y distribución de publicaciones</p>
		</div>

		<div class="charts-row">
			<!-- Timeline Analytics para Medios -->
			<ChartWidget
				title="📅 Timeline de Medios"
				chartName="mediosTimeline"
				bind:chartType={mediosTimelineConfig.type}
				bind:dateFrom={mediosTimelineConfig.dateFrom}
				bind:dateTo={mediosTimelineConfig.dateTo}
				bind:granularity={mediosTimelineConfig.granularity}
				chartTypes={['line', 'bar', 'area', 'areaSmooth']}
				showLimitControls={false}
				showGranularityControls={true}
				showSocialControls={false}
				showComparativeMode={false}
				showProjectComparison={true}
				bind:projectComparisonEnabled={mediosTimelineConfig.projectComparisonEnabled}
				bind:selectedProjectIds={mediosTimelineConfig.selectedProjectIds}
				availableProjects={allProyectos}
				on:projectComparisonToggle={handleProjectComparisonToggle}
				on:projectSelectionChanged={handleProjectSelectionChanged}
			>
				<TimelineChart
					data={newsPosts}
					chartType={mediosTimelineConfig.type}
					granularity={mediosTimelineConfig.granularity}
					comparativeEnabled={false}
					projectComparisonEnabled={mediosTimelineConfig.projectComparisonEnabled}
					projectsData={mediosTimelineConfig.projectsData}
					projects={allProyectos}
				/>
			</ChartWidget>

		</div>

		<div class="charts-row">
				<!-- Word Cloud para Medios -->
		<ChartWidget
				title="☁️ Nube de Palabras - Medios"
				chartName="mediosWordCloud"
				bind:limit={mediosWordCloudConfig.limit}
				showLimitControls={true}
				showDateControls={false}
				showSocialControls={false}
				showChartTypeControls={false}
			>
				{#if mediosWordCloudEnabled}
					{#await import('$lib/components/charts/WordCloudChart.svelte')}
						<div class="loading-placeholder">Cargando Word Cloud...</div>
					{:then module}
						<svelte:component this={module.default} limit={mediosWordCloudConfig.limit} />
					{/await}
				{:else}
					<div class="wordcloud-placeholder">
						<div class="placeholder-content">
							<h3>⚠️ Word Cloud - Carga Manual</h3>
							<p>Click para cargar la nube de palabras de medios:</p>
							<button class="load-wordcloud-btn" on:click={() => { mediosWordCloudEnabled = true; processWordCloudData(newsPosts); }}>
								☁️ Cargar Word Cloud
							</button>
							<p class="placeholder-hint">Palabras de {newsPosts.length.toLocaleString()} publicaciones de medios</p>
						</div>
					</div>
				{/if}
			</ChartWidget>
		</div>
	</div>
	{/if}

	<!-- PESTAÑA USUARIOS -->
	{#if activeTab === 'usuarios'}
		<div id="users-timeline-section" class="analysis-section">
			<UserTimelineView posts={$rawData} />
		</div>
	{/if}

	<!-- Loading overlay mejorado con pasos -->
	{#if isLoadingBigQuery}
		<div class="loading-overlay">
			<div class="loading-content">
				<div class="loading-icon">🔍</div>
				<h2>Consultando BigQuery...</h2>
				<div class="loading-steps">
					<div class="step" class:active={loadingStep === 1} class:completed={loadingStep > 1}>
						<div class="step-number">1</div>
						<div class="step-text">Conectando</div>
					</div>
					<div class="step-line" class:completed={loadingStep > 1}></div>
					<div class="step" class:active={loadingStep === 2} class:completed={loadingStep > 2}>
						<div class="step-number">2</div>
						<div class="step-text">Descargando</div>
					</div>
					<div class="step-line" class:completed={loadingStep > 2}></div>
					<div class="step" class:active={loadingStep === 3} class:completed={loadingStep > 3}>
						<div class="step-number">3</div>
						<div class="step-text">Procesando</div>
					</div>
				</div>
				<p class="loading-step-text">{loadingStepText}</p>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Project Comparison Banner */
	.project-comparison-banner {
		margin: 1.5rem 0;
		padding: 1.5rem;
		background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
		border: 2px solid #0ea5e9;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(14, 165, 233, 0.1);
	}

	.banner-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
	}

	.banner-header h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: #0369a1;
	}

	.banner-header p {
		margin: 0;
		color: #0c4a6e;
		font-size: 0.9rem;
	}

	.activate-comparison-btn {
		padding: 0.75rem 2rem;
		background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);
		white-space: nowrap;
	}

	.activate-comparison-btn:hover {
		background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
		box-shadow: 0 6px 12px rgba(14, 165, 233, 0.4);
		transform: translateY(-2px);
	}

	.activate-comparison-btn:active {
		transform: translateY(0);
	}

	.comparison-active-info {
		padding: 0.75rem 1.5rem;
		background: #ecfdf5;
		color: #065f46;
		border-radius: 8px;
		font-weight: 500;
		border: 2px solid #10b981;
	}

	/* Loading overlay styles */
	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		backdrop-filter: blur(4px);
	}

	.loading-content {
		background: white;
		padding: 3rem;
		border-radius: 16px;
		text-align: center;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		max-width: 500px;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.loading-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	.loading-content h2 {
		margin: 0 0 2rem 0;
		color: #333;
		font-size: 1.5rem;
	}

	.loading-steps {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.step-number {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #e0e0e0;
		color: #999;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		transition: all 0.3s ease;
	}

	.step.active .step-number {
		background: #3b82f6;
		color: white;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.step.completed .step-number {
		background: #10b981;
		color: white;
	}

	.step-text {
		font-size: 0.85rem;
		color: #666;
		transition: all 0.3s ease;
	}

	.step.active .step-text {
		color: #3b82f6;
		font-weight: 600;
	}

	.step.completed .step-text {
		color: #10b981;
	}

	.step-line {
		width: 60px;
		height: 2px;
		background: #e0e0e0;
		margin: 0 0.5rem;
		margin-bottom: 2rem;
		transition: all 0.3s ease;
	}

	.step-line.completed {
		background: #10b981;
	}

	.loading-step-text {
		margin: 0;
		color: #666;
		font-size: 0.95rem;
		min-height: 24px;
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