<script>
	import { onMount, afterUpdate } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		LineController,
		LineElement,
		PointElement,
		DoughnutController,
		PieController,
		ArcElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';

	// Registrar componentes de Chart.js
	Chart.register(
		BarController,
		BarElement,
		LineController,
		LineElement,
		PointElement,
		DoughnutController,
		PieController,
		ArcElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend
	);

	const dispatch = createEventDispatcher();

	export let comparisonData = []; // Array de { proyecto, data, stats }
	export let allProyectos = []; // Lista completa de proyectos disponibles
	export let selectedProyectoIds = []; // IDs de proyectos seleccionados

	// Parámetros de comparación (para BigQuery)
	const today = new Date().toISOString().split('T')[0];
	let comparisonDateFrom = today;
	let comparisonDateTo = today;

	// Estado de carga
	let isLoading = false;
	let loadingMessage = '';
	let loadingProgress = 0;

	// Controles de visualización (filtran datos ya cargados)
	let selectedNetworks = ['all'];
	let granularity = 'day'; // day, week, month
	let chartType = 'bar'; // bar, line

	// Referencias a los canvas y charts
	let volumeCanvas, engagementCanvas, avgEngagementCanvas, timelineCanvas;
	let volumeChart, engagementChart, avgEngagementChart, timelineChart;

	// Configuración de colores para los proyectos
	const projectColors = [
		'#FF6384', // Rosa
		'#36A2EB', // Azul
		'#FFCE56', // Amarillo
		'#4BC0C0', // Turquesa
		'#9966FF', // Púrpura
		'#FF9F40', // Naranja
		'#FF6384', // Rosa (repetir si hay más de 6)
		'#C9CBCF'  // Gris
	];

	// Datos filtrados solo por red social (las fechas ya vienen filtradas de BigQuery)
	$: filteredComparisonData = filterComparisonData(comparisonData, selectedNetworks);

	// Métricas calculadas
	$: comparisonTable = calculateComparisonTable(filteredComparisonData);

	// Desactivar loading cuando lleguen datos
	$: if (comparisonData && comparisonData.length > 0 && isLoading) {
		isLoading = false;
		loadingMessage = '';
		console.log('✅ Comparación completada');
	}

	function filterComparisonData(data, networks) {
		if (!data || data.length === 0) return data;

		console.log(`🔍 Filtrando datos por red social:`, networks.join(', '));

		return data.map(d => {
			const filteredPosts = d.data.filter(post => {
				// Filtro solo por red social (las fechas ya vienen filtradas de BigQuery)
				// Buscar en múltiples campos posibles: source (BigQuery), social_network, network
				const source = (post.source || '').toLowerCase();
				const postNetwork = (post.social_network || post.network || source).toLowerCase();
				const link = (post.link || '').toLowerCase();

				// Si es 'all', pasar todos
				if (networks.includes('all')) {
					return true;
				}

				// Verificar cada red seleccionada
				const inNetwork = networks.some(net => {
					const networkName = net.toLowerCase();

					// Mapear nombres de redes a patrones (igual que en dashboard.js)
					const patterns = {
						'twitter': {
							source: ['twitter'],
							link: ['twitter.com', 't.co', 'x.com']
						},
						'news': {
							source: ['news'],
							link: ['news.google.com']
						},
						'tiktok': {
							source: ['tiktok'],
							link: ['tiktok.com']
						},
						'instagram': {
							source: ['instagram'],
							link: ['instagram.com']
						},
						'facebook': {
							source: ['facebook'],
							link: ['facebook.com', 'fb.com', 'fb.watch']
						},
						'other': {
							source: ['other', 'corporate'],
							link: []
						},
						'undefined': {
							source: ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
							link: []
						}
					};

					const networkPatterns = patterns[networkName];
					if (!networkPatterns) return false;

					// Verificar en source (campo principal)
					if (networkPatterns.source.some(pattern => {
						return source === pattern || source.startsWith(pattern + ' ');
					})) {
						return true;
					}

					// Verificar en link/URL
					if (networkPatterns.link.length > 0 && networkPatterns.link.some(pattern => link.includes(pattern))) {
						return true;
					}

					// Caso especial: "Sin fuente"
					if (networkName === 'undefined') {
						return !source || source.trim() === '' || /^\d+$/.test(source.trim());
					}

					return false;
				});

				return inNetwork;
			});

			// Recalcular stats con datos filtrados
			const getLikes = (post) => parseInt(post.likes_count || post.likes || 0);
			const getReplies = (post) => parseInt(post.replies_count || post.replies || 0);
			const getShares = (post) => parseInt(post.shares_count || post.shares || 0);

			const stats = {
				totalPosts: filteredPosts.length,
				totalEngagement: filteredPosts.reduce((sum, post) => sum + getLikes(post) + getReplies(post) + getShares(post), 0),
				totalLikes: filteredPosts.reduce((sum, post) => sum + getLikes(post), 0),
				totalReplies: filteredPosts.reduce((sum, post) => sum + getReplies(post), 0),
				totalShares: filteredPosts.reduce((sum, post) => sum + getShares(post), 0),
				avgEngagement: 0
			};
			stats.avgEngagement = stats.totalPosts > 0 ? stats.totalEngagement / stats.totalPosts : 0;

			console.log(`  ✅ ${d.proyecto.nombre}: ${d.data.length} posts → ${filteredPosts.length} después del filtro`);

			return {
				...d,
				data: filteredPosts,
				stats
			};
		});
	}

	function calculateComparisonTable(data) {
		if (!data || data.length === 0) return [];

		return data.map((d, i) => {
			const stats = d.stats;
			return {
				color: projectColors[i % projectColors.length],
				nombre: d.proyecto.nombre,
				posts: stats.totalPosts,
				engagement: stats.totalEngagement,
				avgEngagement: stats.avgEngagement.toFixed(2),
				likes: stats.totalLikes,
				replies: stats.totalReplies,
				shares: stats.totalShares,
				dateRange: `${d.proyecto.query.dateFrom} - ${d.proyecto.query.dateTo}`,
				searchTerm: d.proyecto.query.searchTerm || 'Todos'
			};
		});
	}

	function formatNumber(num) {
		return num.toLocaleString('es-CL');
	}

	function toggleProyecto(proyectoId) {
		const index = selectedProyectoIds.indexOf(proyectoId);
		if (index > -1) {
			selectedProyectoIds = selectedProyectoIds.filter(id => id !== proyectoId);
		} else {
			selectedProyectoIds = [...selectedProyectoIds, proyectoId];
		}
	}

	function handleComparar() {
		if (selectedProyectoIds.length < 2) {
			alert('⚠️ Selecciona al menos 2 proyectos para comparar');
			return;
		}

		if (!comparisonDateFrom || !comparisonDateTo) {
			alert('⚠️ Selecciona un rango de fechas para la comparación');
			return;
		}

		console.log('🔄 Ejecutando comparación con fechas:', {
			comparisonDateFrom,
			comparisonDateTo,
			proyectos: selectedProyectoIds
		});

		console.log('📋 allProyectos disponibles:', allProyectos);

		// Activar estado de carga
		isLoading = true;
		loadingProgress = 0;
		loadingMessage = 'Preparando comparación...';

		// Obtener proyectos seleccionados y actualizar sus fechas de query
		const proyectosSeleccionados = allProyectos
			.filter(p => selectedProyectoIds.includes(p.id))
			.map(p => ({
				...p,
				query: {
					...p.query,
					dateFrom: comparisonDateFrom,
					dateTo: comparisonDateTo
				}
			}));

		console.log('📤 Despachando evento updateComparison con proyectos COMPLETOS:', proyectosSeleccionados);

		// Disparar evento para que el padre ejecute las queries de BigQuery
		dispatch('updateComparison', { proyectos: proyectosSeleccionados });
	}

	function isProyectoSelected(proyectoId) {
		return selectedProyectoIds.includes(proyectoId);
	}

	function getProyectoColor(proyectoId) {
		const index = comparisonData.findIndex(d => d.proyecto.id === proyectoId);
		return index >= 0 ? projectColors[index % projectColors.length] : '#ccc';
	}

	function destroyCharts() {
		if (volumeChart) volumeChart.destroy();
		if (engagementChart) engagementChart.destroy();
		if (avgEngagementChart) avgEngagementChart.destroy();
		if (timelineChart) timelineChart.destroy();
	}

	function createCharts() {
		if (filteredComparisonData.length === 0) return;

		console.log('📊 Creando gráficos de comparación con datos filtrados:', filteredComparisonData);
		console.log('📊 Stats por proyecto:');
		filteredComparisonData.forEach(d => {
			console.log(`  - ${d.proyecto.nombre}:`, {
				totalPosts: d.stats.totalPosts,
				totalEngagement: d.stats.totalEngagement,
				avgEngagement: d.stats.avgEngagement,
				dataLength: d.data.length
			});
		});

		destroyCharts();

		// Convertir chartType para Chart.js v3+
		const actualChartType = chartType === 'horizontalBar' ? 'bar' : chartType;
		const chartOptions = getChartOptions();

		// Gráfico de Volumen
		const volumeCtx = volumeCanvas.getContext('2d');
		volumeChart = new Chart(volumeCtx, {
			type: actualChartType,
			data: {
				labels: filteredComparisonData.map(d => d.proyecto.nombre),
				datasets: [{
					label: 'Volumen de Publicaciones',
					data: filteredComparisonData.map(d => d.stats.totalPosts),
					backgroundColor: filteredComparisonData.map((_, i) => projectColors[i % projectColors.length]),
					borderColor: filteredComparisonData.map((_, i) => projectColors[i % projectColors.length]),
					borderWidth: 2,
					fill: false
				}]
			},
			options: chartOptions
		});

		// Gráfico de Engagement Total
		const engagementCtx = engagementCanvas.getContext('2d');
		engagementChart = new Chart(engagementCtx, {
			type: actualChartType,
			data: {
				labels: filteredComparisonData.map(d => d.proyecto.nombre),
				datasets: [{
					label: 'Engagement Total',
					data: filteredComparisonData.map(d => d.stats.totalEngagement),
					backgroundColor: filteredComparisonData.map((_, i) => projectColors[i % projectColors.length]),
					borderColor: filteredComparisonData.map((_, i) => projectColors[i % projectColors.length]),
					borderWidth: 2,
					fill: false
				}]
			},
			options: chartOptions
		});

		// Gráfico de Engagement Promedio
		const avgEngagementCtx = avgEngagementCanvas.getContext('2d');
		avgEngagementChart = new Chart(avgEngagementCtx, {
			type: actualChartType,
			data: {
				labels: filteredComparisonData.map(d => d.proyecto.nombre),
				datasets: [{
					label: 'Engagement Promedio por Post',
					data: filteredComparisonData.map(d => d.stats.avgEngagement),
					backgroundColor: filteredComparisonData.map((_, i) => projectColors[i % projectColors.length]),
					borderColor: filteredComparisonData.map((_, i) => projectColors[i % projectColors.length]),
					borderWidth: 2,
					fill: false
				}]
			},
			options: chartOptions
		});

		// Gráfico de Timeline
		const timelineData = calculateTimelineData();
		const timelineCtx = timelineCanvas.getContext('2d');
		timelineChart = new Chart(timelineCtx, {
			type: 'line',
			data: timelineData,
			options: getTimelineOptions()
		});
	}

	function calculateTimelineData() {
		// Función para obtener la clave de agrupación según granularidad
		const getDateKey = (dateStr) => {
			const date = new Date(dateStr);
			if (granularity === 'hour') {
				// Formato: YYYY-MM-DD HH:00
				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, '0');
				const day = String(date.getDate()).padStart(2, '0');
				const hour = String(date.getHours()).padStart(2, '0');
				return `${year}-${month}-${day} ${hour}:00`;
			} else if (granularity === 'day') {
				return date.toISOString().split('T')[0];
			} else if (granularity === 'week') {
				// ISO week (semana que empieza en lunes)
				const tempDate = new Date(date);
				const dayOfWeek = tempDate.getDay() || 7; // Domingo = 7
				tempDate.setDate(tempDate.getDate() - dayOfWeek + 1);
				return `Semana ${tempDate.toISOString().split('T')[0]}`;
			} else if (granularity === 'month') {
				return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			}
		};

		// Obtener todas las fechas únicas
		const allDates = new Set();
		filteredComparisonData.forEach(d => {
			d.data.forEach(post => {
				const dateKey = getDateKey(post.created);
				allDates.add(dateKey);
			});
		});

		const sortedDates = Array.from(allDates).sort();

		if (sortedDates.length === 0) {
			console.warn('⚠️ No hay datos para mostrar en el timeline después del filtro');
			return {
				labels: [],
				datasets: []
			};
		}

		console.log(`📅 Timeline (${granularity}): ${sortedDates.length} períodos desde ${sortedDates[0]} hasta ${sortedDates[sortedDates.length - 1]}`);

		// Crear datasets para cada proyecto
		const datasets = filteredComparisonData.map((d, i) => {
			// Agrupar posts por período
			const postsByPeriod = {};
			d.data.forEach(post => {
				const dateKey = getDateKey(post.created);
				postsByPeriod[dateKey] = (postsByPeriod[dateKey] || 0) + 1;
			});

			// Crear array de valores para todos los períodos
			const values = sortedDates.map(date => postsByPeriod[date] || 0);

			// Log del rango de fechas con datos para cada proyecto
			const datesWithData = Object.keys(postsByPeriod).sort();
			if (datesWithData.length > 0) {
				console.log(`  📊 ${d.proyecto.nombre}: ${datesWithData.length} períodos con datos (${datesWithData[0]} a ${datesWithData[datesWithData.length - 1]})`);
				console.log(`     Total posts: ${d.data.length}, máximo por período: ${Math.max(...values)}`);
			} else {
				console.log(`  📊 ${d.proyecto.nombre}: Sin datos después del filtro`);
			}

			return {
				label: d.proyecto.nombre,
				data: values,
				borderColor: projectColors[i % projectColors.length],
				backgroundColor: projectColors[i % projectColors.length] + '40', // 40 = transparencia
				borderWidth: 2,
				fill: false,
				tension: 0.1
			};
		});

		return {
			labels: sortedDates,
			datasets
		};
	}

	function getChartOptions() {
		const options = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					position: 'top',
				},
				tooltip: {
					callbacks: {
						label: function(context) {
							let label = context.dataset.label || '';
							if (label) {
								label += ': ';
							}
							// Para horizontal bar, el valor está en context.parsed.x
							const value = chartType === 'horizontalBar' ? context.parsed.x : context.parsed.y;
							label += value.toLocaleString();
							return label;
						}
					}
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						callback: function(value) {
							return value.toLocaleString();
						}
					}
				}
			}
		};

		// Para barras horizontales, agregar indexAxis
		if (chartType === 'horizontalBar') {
			options.indexAxis = 'y';
			// Intercambiar las escalas para horizontal
			options.scales = {
				x: {
					beginAtZero: true,
					ticks: {
						callback: function(value) {
							return value.toLocaleString();
						}
					}
				},
				y: {
					ticks: {
						autoSkip: false
					}
				}
			};
		}

		return options;
	}

	function getTimelineOptions() {
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					position: 'top',
					labels: {
						usePointStyle: true
					}
				},
				tooltip: {
					callbacks: {
						label: function(context) {
							let label = context.dataset.label || '';
							if (label) {
								label += ': ';
							}
							label += context.parsed.y.toLocaleString();
							return label;
						}
					}
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						callback: function(value) {
							return value.toLocaleString();
						}
					}
				}
			}
		};
	}

	afterUpdate(() => {
		if (filteredComparisonData.length > 0 && volumeCanvas && engagementCanvas && avgEngagementCanvas && timelineCanvas) {
			createCharts();
		}
	});

	onMount(() => {
		return () => {
			destroyCharts();
		};
	});
</script>

<div class="comparison-container">
	<div class="comparison-header">
		<h2>📊 Comparación de Proyectos</h2>
		<p class="subtitle">Comparando {comparisonData.length} proyecto{comparisonData.length !== 1 ? 's' : ''}</p>
	</div>

	<!-- Selector de Proyectos y Parámetros de Comparación -->
	{#if allProyectos.length > 0}
		<div class="proyecto-selector">
			<h3>📁 Configuración de Comparación</h3>
			<p class="selector-hint">Selecciona los proyectos y el rango de fechas para comparar</p>

			<!-- Proyectos disponibles -->
			<div class="proyectos-grid-compact">
				{#each allProyectos as proyecto}
					<label class="proyecto-checkbox-card" class:selected={isProyectoSelected(proyecto.id)}>
						<input
							type="checkbox"
							checked={isProyectoSelected(proyecto.id)}
							on:change={() => toggleProyecto(proyecto.id)}
						/>
						<div class="checkbox-indicator" style="background-color: {getProyectoColor(proyecto.id)}"></div>
						<div class="proyecto-info">
							<span class="proyecto-name">{proyecto.nombre}</span>
							<span class="proyecto-query">{proyecto.query.searchTerm || 'Todos'}</span>
						</div>
					</label>
				{/each}
			</div>

			<!-- Parámetros de comparación -->
			<div class="comparison-params">
				<div class="param-group">
					<label>📅 Rango de Fechas para Comparación</label>
					<div class="date-inputs">
						<input type="date" bind:value={comparisonDateFrom} class="param-input">
						<span class="date-separator">→</span>
						<input type="date" bind:value={comparisonDateTo} class="param-input">
					</div>
				</div>

				<button class="compare-btn" on:click={handleComparar}>
					🔍 Comparar Proyectos
				</button>
			</div>
		</div>
	{/if}

	<!-- Controles de Visualización (solo si hay datos cargados) -->
	{#if comparisonData.length > 0}
		<div class="comparison-controls">
			<h3>⚙️ Filtros de Visualización</h3>
			<p class="controls-hint">Ajusta cómo se muestran los datos ya cargados</p>

			<div class="controls-grid">
				<!-- Selector de Redes Sociales -->
				<div class="control-group">
					<label>🌐 Filtrar por Red Social</label>
					<div class="network-checkboxes">
						<label class="network-checkbox">
							<input type="checkbox" value="all" bind:group={selectedNetworks}>
							Todas
						</label>
						<label class="network-checkbox">
							<input type="checkbox" value="twitter" bind:group={selectedNetworks}>
							Twitter
						</label>
						<label class="network-checkbox">
							<input type="checkbox" value="facebook" bind:group={selectedNetworks}>
							Facebook
						</label>
						<label class="network-checkbox">
							<input type="checkbox" value="instagram" bind:group={selectedNetworks}>
							Instagram
						</label>
						<label class="network-checkbox">
							<input type="checkbox" value="tiktok" bind:group={selectedNetworks}>
							TikTok
						</label>
						<label class="network-checkbox">
							<input type="checkbox" value="news" bind:group={selectedNetworks}>
							News
						</label>
					</div>
				</div>

				<!-- Granularidad del Timeline -->
				<div class="control-group">
					<label>📊 Granularidad Timeline</label>
					<select bind:value={granularity} class="control-select">
						<option value="hour">Por Hora</option>
						<option value="day">Por Día</option>
						<option value="week">Por Semana</option>
						<option value="month">Por Mes</option>
					</select>
				</div>

				<!-- Tipo de Gráfico -->
				<div class="control-group">
					<label>📈 Tipo de Gráfico</label>
					<select bind:value={chartType} class="control-select">
						<option value="bar">Barras Verticales</option>
						<option value="horizontalBar">Barras Horizontales</option>
						<option value="line">Líneas</option>
						<option value="doughnut">Dona</option>
						<option value="pie">Pastel</option>
					</select>
				</div>

				<!-- Botón Aplicar -->
				<div class="control-group">
					<button class="apply-filters-btn" on:click={() => createCharts()}>
						🔄 Actualizar Visualización
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Loading Overlay -->
	{#if isLoading}
		<div class="loading-overlay">
			<div class="loading-content">
				<div class="loading-spinner"></div>
				<h3>Cargando comparación...</h3>
				<p>{loadingMessage}</p>
				<div class="loading-bar">
					<div class="loading-bar-fill" style="width: {loadingProgress}%"></div>
				</div>
			</div>
		</div>
	{/if}

	{#if comparisonData.length === 0}
		<div class="empty-state">
			<div class="empty-icon">📊</div>
			<h3>No hay proyectos seleccionados para comparar</h3>
			<p>Selecciona 2 o más proyectos desde la pestaña "Proyectos" para comenzar la comparación</p>
		</div>
	{:else}
		<!-- Tabla Comparativa -->
		<div class="comparison-section">
			<h3>📋 Tabla Comparativa</h3>
			<div class="table-container">
				<table class="comparison-table">
					<thead>
						<tr>
							<th></th>
							<th>Proyecto</th>
							<th>Posts</th>
							<th>Engagement</th>
							<th>Promedio</th>
							<th>Likes</th>
							<th>Replies</th>
							<th>Shares</th>
							<th>Rango de Fechas</th>
							<th>Búsqueda</th>
						</tr>
					</thead>
					<tbody>
						{#each comparisonTable as row}
							<tr>
								<td><div class="color-indicator" style="background-color: {row.color}"></div></td>
								<td class="proyecto-name">{row.nombre}</td>
								<td>{formatNumber(row.posts)}</td>
								<td>{formatNumber(row.engagement)}</td>
								<td>{row.avgEngagement}</td>
								<td>{formatNumber(row.likes)}</td>
								<td>{formatNumber(row.replies)}</td>
								<td>{formatNumber(row.shares)}</td>
								<td class="date-range">{row.dateRange}</td>
								<td class="search-term">{row.searchTerm}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Gráficos de Comparación -->
		<div class="charts-grid">
			<!-- Volumen de Publicaciones -->
			<div class="chart-card">
				<h3>📈 Volumen de Publicaciones</h3>
				<div class="chart-wrapper">
					<canvas bind:this={volumeCanvas}></canvas>
				</div>
			</div>

			<!-- Engagement Total -->
			<div class="chart-card">
				<h3>💬 Engagement Total</h3>
				<div class="chart-wrapper">
					<canvas bind:this={engagementCanvas}></canvas>
				</div>
			</div>

			<!-- Engagement Promedio -->
			<div class="chart-card">
				<h3>📊 Engagement Promedio</h3>
				<div class="chart-wrapper">
					<canvas bind:this={avgEngagementCanvas}></canvas>
				</div>
			</div>
		</div>

		<!-- Timeline Comparativo -->
		<div class="comparison-section">
			<h3>📅 Evolución Temporal</h3>
			<div class="timeline-chart">
				<canvas bind:this={timelineCanvas}></canvas>
			</div>
		</div>
	{/if}
</div>

<style>
	.comparison-container {
		padding: 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		min-height: 100vh;
	}

	.comparison-header {
		text-align: center;
		margin-bottom: 2rem;
		color: white;
	}

	.comparison-header h2 {
		font-size: 2.5rem;
		margin: 0;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
	}

	.subtitle {
		font-size: 1.1rem;
		opacity: 0.9;
		margin: 0.5rem 0 0 0;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.empty-icon {
		font-size: 5rem;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		color: #333;
		margin: 1rem 0;
	}

	.empty-state p {
		color: #666;
		font-size: 1.1rem;
	}

	.comparison-section {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.comparison-section h3 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1.5rem;
	}

	.table-container {
		overflow-x: auto;
	}

	.comparison-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	.comparison-table thead {
		background: #f8f9fa;
		position: sticky;
		top: 0;
	}

	.comparison-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #555;
		border-bottom: 2px solid #dee2e6;
	}

	.comparison-table td {
		padding: 1rem;
		border-bottom: 1px solid #e9ecef;
	}

	.comparison-table tbody tr:hover {
		background: #f8f9fa;
	}

	.color-indicator {
		width: 20px;
		height: 20px;
		border-radius: 4px;
		display: inline-block;
	}

	.proyecto-name {
		font-weight: 600;
		color: #333;
	}

	.date-range {
		font-size: 0.85rem;
		color: #666;
	}

	.search-term {
		font-size: 0.85rem;
		color: #666;
		font-style: italic;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 2rem;
		margin-bottom: 2rem;
	}

	.chart-card {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.chart-card h3 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1.3rem;
	}

	.chart-wrapper {
		height: 300px;
		position: relative;
	}

	.timeline-chart {
		height: 400px;
		position: relative;
	}

	.proyecto-selector {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.proyecto-selector h3 {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1.3rem;
	}

	.selector-hint {
		color: #666;
		font-size: 0.9rem;
		margin: 0 0 1rem 0;
	}

	.proyectos-grid-compact {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1rem;
	}

	.proyecto-checkbox-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border: 2px solid #e9ecef;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		background: white;
	}

	.proyecto-checkbox-card:hover {
		border-color: #667eea;
		background: #f8f9ff;
	}

	.proyecto-checkbox-card.selected {
		border-color: #667eea;
		background: #f0f2ff;
		box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
	}

	.proyecto-checkbox-card input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.checkbox-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.proyecto-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.proyecto-info .proyecto-name {
		font-weight: 600;
		color: #333;
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.proyecto-info .proyecto-query {
		font-size: 0.8rem;
		color: #666;
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 768px) {
		.comparison-container {
			padding: 1rem;
		}

		.charts-grid {
			grid-template-columns: 1fr;
		}

		.comparison-table {
			font-size: 0.85rem;
		}

		.comparison-table th,
		.comparison-table td {
			padding: 0.5rem;
		}

		.proyectos-grid-compact {
			grid-template-columns: 1fr;
		}

		.controls-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Estilos para Controles de Comparación */
	.comparison-controls {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.comparison-controls h3 {
		color: #333;
		font-size: 1.2rem;
		margin-bottom: 1.5rem;
	}

	.controls-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		align-items: end;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-group label {
		font-weight: 600;
		color: #555;
		font-size: 0.9rem;
	}

	.date-inputs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.date-separator {
		color: #667eea;
		font-weight: bold;
		font-size: 1.2rem;
	}

	.control-input,
	.control-select {
		padding: 0.6rem;
		border: 2px solid #e9ecef;
		border-radius: 6px;
		font-size: 0.9rem;
		transition: all 0.2s ease;
		background: white;
	}

	.control-input:focus,
	.control-select:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.network-checkboxes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.network-checkbox {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.8rem;
		border: 2px solid #e9ecef;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		background: white;
		font-size: 0.85rem;
		font-weight: normal;
	}

	.network-checkbox:hover {
		border-color: #667eea;
		background: #f8f9ff;
	}

	.network-checkbox input[type="checkbox"] {
		cursor: pointer;
	}

	.apply-filters-btn {
		padding: 0.8rem 1.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
	}

	.apply-filters-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
	}

	.apply-filters-btn:active {
		transform: translateY(0);
	}

	/* Estilos para Parámetros de Comparación */
	.comparison-params {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 2px solid #e9ecef;
		display: flex;
		gap: 1.5rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.param-group {
		flex: 1;
		min-width: 300px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.param-group label {
		font-weight: 600;
		color: #555;
		font-size: 0.95rem;
	}

	.param-input {
		padding: 0.7rem;
		border: 2px solid #e9ecef;
		border-radius: 6px;
		font-size: 0.95rem;
		transition: all 0.2s ease;
		background: white;
	}

	.param-input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.compare-btn {
		padding: 1rem 2.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 1.1rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
		min-width: 220px;
	}

	.compare-btn:hover {
		transform: translateY(-3px);
		box-shadow: 0 10px 20px rgba(102, 126, 234, 0.5);
	}

	.compare-btn:active {
		transform: translateY(0);
	}

	.controls-hint {
		color: #666;
		font-size: 0.85rem;
		margin: -0.5rem 0 1rem 0;
		font-style: italic;
	}

	.control-hint {
		font-size: 0.75rem;
		color: #999;
		margin-top: 0.25rem;
	}

	@media (max-width: 768px) {
		.comparison-params {
			flex-direction: column;
			align-items: stretch;
		}

		.param-group {
			min-width: 100%;
		}

		.compare-btn {
			width: 100%;
		}
	}

	/* Loading Overlay */
	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		backdrop-filter: blur(4px);
	}

	.loading-content {
		background: white;
		padding: 3rem;
		border-radius: 16px;
		text-align: center;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		max-width: 400px;
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

	.loading-spinner {
		width: 60px;
		height: 60px;
		border: 5px solid rgba(102, 126, 234, 0.2);
		border-top-color: #667eea;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1.5rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-content h3 {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1.5rem;
	}

	.loading-content p {
		margin: 0 0 1.5rem 0;
		color: #666;
		font-size: 1rem;
	}

	.loading-bar {
		width: 100%;
		height: 8px;
		background-color: rgba(102, 126, 234, 0.2);
		border-radius: 4px;
		overflow: hidden;
	}

	.loading-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
		transition: width 0.3s ease;
		border-radius: 4px;
	}
</style>
