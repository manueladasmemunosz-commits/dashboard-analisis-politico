<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';
	import HeatmapCalendarChart from './HeatmapCalendarChart.svelte';

	export let data = [];
	export let chartType = 'line';
	export let granularity = 'day'; // 'hour', 'day', 'week', 'month'
	export let heatmapMetric = 'posts'; // 'posts' o 'engagement' para heatmap
	export let comparativeEnabled = false;
	export let dataB = []; // Datos del período B para comparación

	let canvas;
	let chartInstance;
	let mounted = false;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedDate = '';

	// Web Worker state
	let worker = null;
	let isProcessing = false;
	let processingProgress = 0;
	let dateGroupsA = {};
	let dateGroupsB = {};

	// Variables para onClick handler (necesitan estar en component scope)
	let sortedKeys = [];
	let sortedKeysB = [];
	let currentDateGroups = {};
	let currentDateGroupsB = {};

	// Verificar si es heatmap
	$: isHeatmap = chartType === 'heatmap';

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	$: if (mounted && data.length > 0 && !isHeatmap) {
		processDataWithWorker();
	}

	$: if (mounted && canvas && Object.keys(dateGroupsA).length > 0 && !isHeatmap && (chartType || granularity || heatmapMetric)) {
		createChart();
	}

	function processDataWithWorker() {
		if (!worker || !data || data.length === 0) return;

		console.log(`🔧 Iniciando procesamiento de ${data.length} posts con Worker...`);
		isProcessing = true;
		processingProgress = 0;

		worker.postMessage({
			posts: data,
			granularity: granularity,
			comparativeEnabled: comparativeEnabled,
			dataB: dataB,
			chunkSize: 10000
		});
	}

	// Función para obtener clave de agrupación según granularidad
	function getGroupKey(dateStr, timeStr, gran) {
		if (gran === 'hour') {
			// Para hora: agrupar por fecha Y hora específica (YYYY-MM-DD HH)
			if (!timeStr) return null;
			const hour = parseInt(timeStr.split(':')[0]);
			if (isNaN(hour) || hour < 0 || hour > 23) return null;
			return `${dateStr} ${hour.toString().padStart(2, '0')}`;
		}

		const date = new Date(dateStr);

		if (gran === 'day') {
			// Formato: YYYY-MM-DD
			return dateStr;
		} else if (gran === 'week') {
			// Formato: YYYY-WW (año-semana)
			const oneJan = new Date(date.getFullYear(), 0, 1);
			const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
			const weekNum = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
			return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
		} else if (gran === 'month') {
			// Formato: YYYY-MM
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			return `${date.getFullYear()}-${month}`;
		}
		return dateStr; // fallback
	}

	// Función para formatear label según granularidad
	function formatLabel(groupKey, gran, previousKey = null) {
		if (gran === 'hour') {
			// Para hora: formato "YYYY-MM-DD HH"
			const [dateStr, hourStr] = groupKey.split(' ');

			// Validación defensiva: si no hay hourStr, usar '00'
			if (!hourStr) {
				console.warn('⚠️ groupKey sin hora:', groupKey);
				return groupKey;
			}

			const dateObj = new Date(dateStr);
			const hour = hourStr.padStart(2, '0');

			// Determinar si debemos mostrar la fecha (cuando cambia el día o es el primero)
			let showDate = !previousKey; // Mostrar siempre en el primer elemento

			if (previousKey) {
				const [prevDateStr] = previousKey.split(' ');
				showDate = dateStr !== prevDateStr; // Mostrar cuando cambia la fecha
			}

			if (showDate) {
				const dayMonth = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
				return `${dayMonth} ${hour}:00`;
			} else {
				return `${hour}:00`;
			}
		} else if (gran === 'day') {
			const dateObj = new Date(groupKey);
			return dateObj.toLocaleDateString('es-CL', { month: 'short', day: 'numeric' });
		} else if (gran === 'week') {
			const [year, week] = groupKey.split('-W');
			return `Sem ${week}, ${year}`;
		} else if (gran === 'month') {
			const [year, month] = groupKey.split('-');
			const dateObj = new Date(year, parseInt(month) - 1, 1);
			return dateObj.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
		}
		return groupKey;
	}

	// Función auxiliar para procesar un conjunto de datos
	function processDataset(dataset, label) {
		const dateGroups = {};
		let invalidDates = 0;

		dataset.forEach((post, index) => {
			if (!post.created) {
				invalidDates++;
				return;
			}

			const parts = post.created.split(' ');
			const rawDate = parts[0];
			const timeStr = parts[1] || null;

			if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate)) {
				if (invalidDates < 5) {
					console.warn(`📅 Fecha inválida en post ${index}:`, post.created);
				}
				invalidDates++;
				return;
			}

			const date = rawDate.replace(/\//g, '-');
			const groupKey = getGroupKey(date, timeStr, granularity);

			if (groupKey === null) {
				invalidDates++;
				return;
			}

			if (!dateGroups[groupKey]) dateGroups[groupKey] = [];
			dateGroups[groupKey].push(post);
		});

		console.log(`📊 ${label}: ${dataset.length - invalidDates} posts válidos, ${invalidDates} inválidos`);
		return { dateGroups, invalidDates };
	}

	// Función para alinear períodos comparativos
	function alignComparativePeriods(groupsA, groupsB) {
		const keysA = Object.keys(groupsA).sort();
		const keysB = Object.keys(groupsB).sort();

		// Determinar la longitud del período más corto
		const minLength = Math.min(keysA.length, keysB.length);

		// Función auxiliar para calcular métrica
		function calculateMetric(posts) {
			if (heatmapMetric === 'engagement') {
				return posts.reduce((sum, post) => {
					return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
				}, 0);
			}
			return posts.length; // 'posts' por defecto
		}

		// Crear labels relativos (Día 1, Día 2, etc.)
		const alignedLabels = [];
		const alignedDataA = [];
		const alignedDataB = [];
		const originalKeysA = [];
		const originalKeysB = [];

		for (let i = 0; i < minLength; i++) {
			const keyA = keysA[i];
			const keyB = keysB[i];

			// Etiqueta relativa
			let label;
			if (granularity === 'hour') {
				label = `Hora ${i + 1}`;
			} else if (granularity === 'day') {
				label = `Día ${i + 1}`;
			} else if (granularity === 'week') {
				label = `Sem ${i + 1}`;
			} else if (granularity === 'month') {
				label = `Mes ${i + 1}`;
			}

			alignedLabels.push(label);
			alignedDataA.push(calculateMetric(groupsA[keyA]));
			alignedDataB.push(calculateMetric(groupsB[keyB]));
			originalKeysA.push(keyA);
			originalKeysB.push(keyB);
		}

		return {
			labels: alignedLabels,
			dataA: alignedDataA,
			dataB: alignedDataB,
			keysA: originalKeysA,
			keysB: originalKeysB,
			groupsA,
			groupsB
		};
	}

	function createChart() {
		if (!canvas) return;
		if (!comparativeEnabled && Object.keys(dateGroupsA).length === 0) return;
		if (comparativeEnabled && (Object.keys(dateGroupsA).length === 0 || Object.keys(dateGroupsB).length === 0)) return;

		// Destruir gráfico existente
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		console.log(`📊 Renderizando timeline (granularidad: ${granularity}, métrica: ${heatmapMetric}, comparativo: ${comparativeEnabled})...`);

		// Función auxiliar para calcular métrica de un grupo de posts
		function calculateMetric(posts) {
			if (heatmapMetric === 'engagement') {
				return posts.reduce((sum, post) => {
					return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
				}, 0);
			}
			return posts.length; // 'posts' por defecto
		}

		let labels, chartData;
		let chartDataB;

		if (comparativeEnabled) {
			// Modo comparativo: usar datos procesados por el worker
			const aligned = alignComparativePeriods(dateGroupsA, dateGroupsB);

			labels = aligned.labels;
			chartData = aligned.dataA;
			chartDataB = aligned.dataB;

			// Asignar a variables de componente para onClick
			sortedKeys = aligned.keysA;
			sortedKeysB = aligned.keysB;
			currentDateGroups = aligned.groupsA;
			currentDateGroupsB = aligned.groupsB;

			console.log(`📊 Períodos alineados: ${labels.length} puntos de comparación`);
		} else {
			// Modo normal: usar datos procesados por el worker
			currentDateGroups = dateGroupsA;

			sortedKeys = Object.keys(currentDateGroups).sort();
			console.log('📊 Grupos procesados:', sortedKeys.slice(0, 5), '... total:', sortedKeys.length);

			// Crear etiquetas según granularidad
			labels = sortedKeys.map((key, index) => {
				const previousKey = index > 0 ? sortedKeys[index - 1] : null;
				return formatLabel(key, granularity, previousKey);
			});

			// Calcular métrica según heatmapMetric
			chartData = sortedKeys.map(key => calculateMetric(currentDateGroups[key]));
		}

		// Convertir 'area' y 'areaSmooth' a configuración 'line' correcta
		const actualChartType = (chartType === 'area' || chartType === 'areaSmooth') ? 'line' : chartType;
		const isAreaChart = chartType === 'area' || chartType === 'areaSmooth';
		const isAreaSmooth = chartType === 'areaSmooth';

		if (isAreaChart) {
			console.log(`🌊 Creando gráfico de área (line + fill)${isAreaSmooth ? ' - Área Suave' : ''}`);
		}

		// Obtener label de granularidad para UI
		const granularityLabels = {
			'hour': 'por hora',
			'day': 'por día',
			'week': 'por semana',
			'month': 'por mes'
		};

		// Crear datasets
		const datasets = [];

		// Colores tema chileno
		const chileColors = [
			{ bg: '#3b82f6', border: '#1e40af' },  // Azul Chile
			{ bg: '#ef4444', border: '#dc2626' }   // Rojo Chile
		];

		if (comparativeEnabled) {
			// Para areaSmooth: ordenar por volumen (menor abajo, mayor arriba)
			const series = [
				{ label: 'Período A', data: chartData, totalVolume: chartData.reduce((sum, val) => sum + val, 0), colorIndex: 0 },
				{ label: 'Período B', data: chartDataB, totalVolume: chartDataB.reduce((sum, val) => sum + val, 0), colorIndex: 1 }
			];

			if (isAreaSmooth) {
				series.sort((a, b) => a.totalVolume - b.totalVolume);
			}

			series.forEach((serie, index) => {
				const colorIdx = isAreaSmooth ? index : serie.colorIndex;

				datasets.push({
					label: serie.label,
					data: serie.data,
					borderColor: isAreaSmooth ? chileColors[colorIdx].border :
								(colorIdx === 0 ? '#3498db' : '#e74c3c'),
					borderWidth: isAreaSmooth ? 0 : 2,
					backgroundColor: isAreaSmooth ? chileColors[colorIdx].bg :
								   isAreaChart ? (colorIdx === 0 ? 'rgba(52, 152, 219, 0.3)' : 'rgba(231, 76, 60, 0.3)') :
								   (chartType === 'bar' ? (colorIdx === 0 ? '#3498db' : '#e74c3c') :
								   (colorIdx === 0 ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)')),
					fill: isAreaChart ? (isAreaSmooth ? 'origin' : true) : false,
					tension: 0.4,
					pointBackgroundColor: colorIdx === 0 ? '#3498db' : '#e74c3c',
					pointBorderColor: colorIdx === 0 ? '#2980b9' : '#c0392b',
					pointRadius: isAreaSmooth ? 0 : (isAreaChart ? 4 : 3),
					pointHoverRadius: isAreaSmooth ? 0 : 6,
					stack: isAreaSmooth ? 'stacked' : undefined
				});
			});
		} else {
			// Dataset normal (un solo período)
			const metricLabel = heatmapMetric === 'engagement' ? 'Engagement' : 'Posts';
			datasets.push({
				label: `${metricLabel} ${granularityLabels[granularity]}`,
				data: chartData,
				borderColor: isAreaSmooth ? chileColors[0].border : '#3498db',
				borderWidth: isAreaSmooth ? 0 : 2,
				backgroundColor: isAreaSmooth ? chileColors[0].bg :
							   isAreaChart ? 'rgba(52, 152, 219, 0.3)' :
							   (chartType === 'bar' ? '#3498db' : 'rgba(52, 152, 219, 0.1)'),
				fill: isAreaChart,
				tension: 0.4,
				pointBackgroundColor: '#3498db',
				pointBorderColor: '#2980b9',
				pointRadius: isAreaSmooth ? 0 : (isAreaChart ? 4 : 3),
				pointHoverRadius: isAreaSmooth ? 0 : 6,
				stack: isAreaSmooth ? 'stacked' : undefined
			});
		}

		chartInstance = new Chart(ctx, {
			type: actualChartType,
			data: {
				labels: labels,
				datasets: datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const datasetIndex = elements[0].datasetIndex;
						const index = elements[0].index;

						let clickedKey, postsForGroup, period;

						if (comparativeEnabled) {
							// En modo comparativo, determinar qué período fue clickeado
							if (datasetIndex === 0) {
								clickedKey = sortedKeys[index];
								postsForGroup = currentDateGroups[clickedKey] || [];
								period = 'A';
							} else {
								clickedKey = sortedKeysB[index];
								postsForGroup = currentDateGroupsB[clickedKey] || [];
								period = 'B';
							}

							if (postsForGroup.length > 0) {
								selectedDate = `Período ${period} - ${formatLabel(clickedKey, granularity)}`;
								selectedPosts = postsForGroup;
								showModal = true;

								console.log(`📊 Click en Período ${period}:`, clickedKey, '- Posts:', postsForGroup.length);
							}
						} else {
							// Modo normal
							clickedKey = sortedKeys[index];
							postsForGroup = currentDateGroups[clickedKey] || [];

							if (postsForGroup.length > 0) {
								if (granularity === 'hour') {
									const [dateStr, hourStr] = clickedKey.split(' ');
									if (hourStr) {
										const dateObj = new Date(dateStr);
										const dayMonth = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
										selectedDate = `Posts publicados el ${dayMonth} a las ${hourStr}:00`;
									} else {
										selectedDate = formatLabel(clickedKey, granularity);
									}
								} else {
									selectedDate = formatLabel(clickedKey, granularity);
								}
								selectedPosts = postsForGroup;
								showModal = true;

								console.log('📊 Click en grupo:', clickedKey, '- Posts:', postsForGroup.length);
							}
						}
					}
				},
				plugins: {
					title: {
						display: true,
						text: comparativeEnabled ?
							`Comparación A/B - ${heatmapMetric === 'engagement' ? 'Engagement' : 'Posts'} ${granularityLabels[granularity]}${isAreaChart ? ' (Área)' : ''}` :
							`Evolución temporal de ${heatmapMetric === 'engagement' ? 'engagement' : 'posts'} ${granularityLabels[granularity]}${isAreaChart ? ' (Área)' : ''}`
					},
					tooltip: {
						callbacks: {
							title: function(context) {
								const index = context[0].dataIndex;
								const key = sortedKeys[index];
								// Para tooltip siempre mostrar fecha completa en granularidad hora
								if (granularity === 'hour') {
									const [dateStr, hourStr] = key.split(' ');
									if (!hourStr) return key; // Validación defensiva
									const dateObj = new Date(dateStr);
									const dayMonth = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
									return `${dayMonth} ${hourStr}:00`;
								}
								return formatLabel(key, granularity);
							},
							label: function(context) {
								const count = context.parsed.y;
								const metricLabel = heatmapMetric === 'engagement' ? 'Engagement' : 'Posts';
								return `${metricLabel}: ${count.toLocaleString()} (Click para ver detalles)`;
							}
						}
					}
				},
				scales: {
					x: {
						stacked: isAreaSmooth,
						title: {
							display: true,
							text: granularity === 'hour' ? 'Hora del día' : 'Fecha'
						},
						ticks: {
							padding: 10,
							maxRotation: 45,
							minRotation: 0
						}
					},
					y: {
						beginAtZero: true,
						stacked: isAreaSmooth,
						title: {
							display: true,
							text: heatmapMetric === 'engagement' ? 'Engagement Total' : 'Cantidad de Posts'
						}
					}
				},
				elements: {
					line: {
						fill: isAreaChart
					}
				},
				interaction: {
					mode: 'nearest',
					intersect: true
				}
			}
		});

		console.log('📊 Timeline chart created with type:', chartType);
	}

	onMount(() => {
		mounted = true;
		console.log('📊 TimelineChart montado, datos:', data.length);

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/timeline.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					dateGroupsA = workerData.dateGroupsA;
					dateGroupsB = workerData.dateGroupsB || {};
					console.log(`✅ Worker completado en ${duration}ms - ${workerData.stats.totalPeriodsA} períodos procesados`);

					// Trigger chart creation
					if (canvas) {
						createChart();
					}
				}
			};

			worker.onerror = function(error) {
				console.error('❌ Error en Worker:', error);
				isProcessing = false;
			};
		}

		// Procesar datos si ya están disponibles
		if (data.length > 0 && !isHeatmap) {
			processDataWithWorker();
		}
	});

	onDestroy(() => {
		if (worker) {
			worker.terminate();
		}
		if (chartInstance) {
			chartInstance.destroy();
		}
	});
</script>

<div class="timeline-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">📊</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
		</div>
	{:else if isHeatmap}
		<HeatmapCalendarChart {data} metric={heatmapMetric} />
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Procesando línea de tiempo...</h3>
			<p>{processingProgress}% completado</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {processingProgress}%"></div>
			</div>
		</div>
	{:else}
		<canvas bind:this={canvas} class="chart-canvas"></canvas>
	{/if}
</div>

<PostDetailsModal
	bind:isOpen={showModal}
	posts={selectedPosts}
	date={selectedDate}
	on:close={() => showModal = false}
/>

<style>
	.timeline-container {
		position: relative;
		cursor: pointer;
	}

	.chart-canvas {
		width: 100% !important;
		height: 400px !important;
		max-height: 400px;
		cursor: pointer;
	}

	.no-data-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: #666;
		text-align: center;
	}

	.no-data-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
		opacity: 0.3;
	}

	.no-data-message h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.no-data-message p {
		margin: 0;
		font-size: 1rem;
		color: #999;
	}

	.processing-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: #666;
		text-align: center;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid rgba(52, 152, 219, 0.2);
		border-top-color: #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.processing-message h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.processing-message p {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #999;
	}

	.progress-bar {
		width: 300px;
		height: 8px;
		background-color: rgba(52, 152, 219, 0.2);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: #3498db;
		transition: width 0.3s ease;
	}
</style>