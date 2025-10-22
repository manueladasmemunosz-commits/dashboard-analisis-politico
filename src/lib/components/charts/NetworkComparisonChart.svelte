<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	export let data = [];
	export let chartType = 'bar';
	export let metric = 'posts'; // 'posts', 'engagement', 'users'
	export let networksA = ['twitter']; // Grupo A
	export let networksB = ['news']; // Grupo B
	export let timeComparison = false; // false = totales, true = evolución temporal
	export let granularity = 'day'; // Para comparación temporal

	let canvas;
	let chartInstance;
	let mounted = false;

	// Web Worker state
	let worker = null;
	let isProcessing = false;
	let processingProgress = 0;
	let processedData = null;

	// Registrar Chart.js
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	// Reactividad: recrear gráfico cuando cambian los datos o configuración
	$: if (mounted && data.length > 0) {
		// Recrear cuando cambian estas propiedades (listarlas las hace reactivas)
		chartType;
		metric;
		networksA;
		networksB;
		timeComparison;
		granularity;

		processDataWithWorker();
	}

	$: if (mounted && canvas && processedData && (chartType || metric)) {
		createChart();
	}

	function processDataWithWorker() {
		if (!worker || !data || data.length === 0) return;

		console.log(`🔧 Iniciando procesamiento de ${data.length} posts con Worker...`);
		isProcessing = true;
		processingProgress = 0;

		worker.postMessage({
			posts: data,
			networksA: networksA,
			networksB: networksB,
			metric: metric,
			timeComparison: timeComparison,
			granularity: granularity,
			chunkSize: 10000
		});
	}

	// Función para verificar si un post pertenece a una red
	function postBelongsToNetwork(post, networks) {
		const source = (post.source || '').toLowerCase();
		const link = (post.link || '').toLowerCase();

		return networks.some(network => {
			const networkName = network.toLowerCase();

			const patterns = {
				'twitter': { source: ['twitter'], link: ['twitter.com', 't.co', 'x.com'] },
				'news': { source: ['news'], link: ['news.google.com'] },
				'tiktok': { source: ['tiktok'], link: ['tiktok.com'] },
				'instagram': { source: ['instagram'], link: ['instagram.com'] },
				'facebook': { source: ['facebook'], link: ['facebook.com', 'fb.com', 'fb.watch'] }
			};

			const networkPatterns = patterns[networkName];
			if (!networkPatterns) return false;

			if (networkPatterns.source.some(pattern => source === pattern || source.startsWith(pattern + ' '))) {
				return true;
			}

			if (networkPatterns.link.length > 0 && networkPatterns.link.some(pattern => link.includes(pattern))) {
				return true;
			}

			return false;
		});
	}

	// Función para calcular métrica
	function calculateMetric(posts, metricType) {
		if (metricType === 'posts') {
			return posts.length;
		} else if (metricType === 'engagement') {
			return posts.reduce((sum, post) => sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0), 0);
		} else if (metricType === 'users') {
			const uniqueUsers = new Set(posts.map(p => p.user_name).filter(Boolean));
			return uniqueUsers.size;
		}
		return 0;
	}

	// Función para obtener nombre legible de red
	function getNetworkLabel(networks) {
		if (networks.length === 0) return 'Ninguna';
		if (networks.length === 1) {
			const labels = {
				'twitter': 'Twitter',
				'news': 'Noticias',
				'tiktok': 'TikTok',
				'instagram': 'Instagram',
				'facebook': 'Facebook'
			};
			return labels[networks[0]] || networks[0];
		}
		return networks.map(n => {
			const labels = {
				'twitter': 'Twitter',
				'news': 'News',
				'tiktok': 'TikTok',
				'instagram': 'IG',
				'facebook': 'FB'
			};
			return labels[n] || n;
		}).join(' + ');
	}

	// Función para agrupar por fecha
	function getGroupKey(dateStr, timeStr, gran) {
		if (gran === 'hour') {
			if (!timeStr) return null;
			const hour = parseInt(timeStr.split(':')[0]);
			if (isNaN(hour) || hour < 0 || hour > 23) return null;
			return `${dateStr} ${hour.toString().padStart(2, '0')}`;
		}

		const date = new Date(dateStr);

		if (gran === 'day') {
			return dateStr;
		} else if (gran === 'week') {
			const oneJan = new Date(date.getFullYear(), 0, 1);
			const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
			const weekNum = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
			return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
		} else if (gran === 'month') {
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			return `${date.getFullYear()}-${month}`;
		}
		return dateStr;
	}

	// Función para formatear label
	function formatLabel(groupKey) {
		if (granularity === 'hour') {
			const [dateStr, hourStr] = groupKey.split(' ');
			return `${hourStr}:00`;
		} else if (granularity === 'day') {
			const dateObj = new Date(groupKey);
			return dateObj.toLocaleDateString('es-CL', { month: 'short', day: 'numeric' });
		} else if (granularity === 'week') {
			const [year, week] = groupKey.split('-W');
			return `Sem ${week}`;
		} else if (granularity === 'month') {
			const [year, month] = groupKey.split('-');
			const dateObj = new Date(year, parseInt(month) - 1, 1);
			return dateObj.toLocaleDateString('es-CL', { month: 'short' });
		}
		return groupKey;
	}

	function createChart() {
		if (!canvas || !processedData) return;

		// Destruir gráfico existente
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		console.log(`📊 NetworkComparison: Renderizando gráfico, modo: ${timeComparison ? 'temporal' : 'totales'}`);

		let labels, dataA, dataB;

		if (timeComparison) {
			// Modo temporal: usar datos procesados del worker
			const sortedKeys = processedData.sortedKeys;

			labels = sortedKeys.map(key => formatLabel(key));
			dataA = processedData.dataA;
			dataB = processedData.dataB;

			console.log(`📊 Comparación temporal: ${sortedKeys.length} períodos`);
		} else {
			// Modo totales: usar datos procesados del worker
			labels = ['Grupo A', 'Grupo B'];
			dataA = [processedData.valueA];
			dataB = [processedData.valueB];

			console.log(`📊 Totales - Grupo A: ${dataA[0]}, Grupo B: ${dataB[0]}`);
		}

		// Convertir 'area'/'areaSmooth' a 'line' y 'horizontalBar' a 'bar'
		const actualChartType = (chartType === 'area' || chartType === 'areaSmooth') ? 'line' :
		                        chartType === 'horizontalBar' ? 'bar' : chartType;
		const isAreaChart = chartType === 'area' || chartType === 'areaSmooth';
		const isAreaSmooth = chartType === 'areaSmooth';
		const isHorizontalBar = chartType === 'horizontalBar';

		// Labels de métricas
		const metricLabels = {
			'posts': 'Posts',
			'engagement': 'Engagement',
			'users': 'Usuarios únicos'
		};

		// Crear datasets según el modo y tipo de gráfico
		const datasets = [];

		if (timeComparison) {
			// Preparar series para ordenar por volumen (menor a mayor)
			const series = [
				{
					label: getNetworkLabel(networksA),
					data: dataA,
					totalVolume: dataA.reduce((sum, val) => sum + val, 0)
				},
				{
					label: getNetworkLabel(networksB),
					data: dataB,
					totalVolume: dataB.reduce((sum, val) => sum + val, 0)
				}
			];

			// Ordenar de menor a mayor volumen para apilamiento correcto
			if (isAreaSmooth) {
				series.sort((a, b) => a.totalVolume - b.totalVolume);
			}

			// Colores tema chileno para área apilada
			const chileColors = [
				{ bg: '#3b82f6', border: '#1e40af' },  // Azul Chile
				{ bg: '#ef4444', border: '#dc2626' }   // Rojo Chile
			];

			// Crear datasets (ahora ordenados por volumen)
			series.forEach((serie, index) => {
				const colorIndex = isAreaSmooth ? index :
								  (serie.label === getNetworkLabel(networksA) ? 0 : 1);

				datasets.push({
					label: serie.label,
					data: serie.data,
					borderColor: isAreaSmooth ? chileColors[colorIndex].border :
								(colorIndex === 0 ? '#3498db' : '#e74c3c'),
					borderWidth: isAreaSmooth ? 0 : 2,
					backgroundColor: isAreaSmooth ? chileColors[colorIndex].bg :
								   isAreaChart ? (colorIndex === 0 ? 'rgba(52, 152, 219, 0.3)' : 'rgba(231, 76, 60, 0.3)') :
								   (chartType === 'bar' ? (colorIndex === 0 ? '#3498db' : '#e74c3c') :
								   (colorIndex === 0 ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)')),
					fill: isAreaChart ? (isAreaSmooth ? 'origin' : true) : false,
					tension: 0.4,
					pointBackgroundColor: colorIndex === 0 ? '#3498db' : '#e74c3c',
					pointBorderColor: colorIndex === 0 ? '#2980b9' : '#c0392b',
					pointRadius: isAreaSmooth ? 0 : 4,
					pointHoverRadius: isAreaSmooth ? 0 : 6,
					stack: isAreaSmooth ? 'stacked' : undefined
				});
			});
		} else {
			// Modo totales: estructura según tipo de gráfico
			const isCircular = ['doughnut', 'pie', 'polarArea'].includes(chartType);

			if (isCircular) {
				// Gráficos circulares: un dataset con múltiples colores
				datasets.push({
					label: metricLabels[metric],
					data: [...dataA, ...dataB],
					backgroundColor: ['#3498db', '#e74c3c'],
					borderColor: ['#2980b9', '#c0392b'],
					borderWidth: 2
				});
			} else if (chartType === 'radar') {
				// Radar: dos datasets
				datasets.push({
					label: getNetworkLabel(networksA),
					data: dataA,
					borderColor: '#3498db',
					backgroundColor: 'rgba(52, 152, 219, 0.3)',
					pointBackgroundColor: '#3498db',
					pointBorderColor: '#2980b9',
					pointRadius: 4
				});
				datasets.push({
					label: getNetworkLabel(networksB),
					data: dataB,
					borderColor: '#e74c3c',
					backgroundColor: 'rgba(231, 76, 60, 0.3)',
					pointBackgroundColor: '#e74c3c',
					pointBorderColor: '#c0392b',
					pointRadius: 4
				});
			} else {
				// Barras: un dataset con múltiples colores
				datasets.push({
					label: metricLabels[metric],
					data: [...dataA, ...dataB],
					backgroundColor: ['#3498db', '#e74c3c'],
					borderColor: ['#2980b9', '#c0392b'],
					borderWidth: 2
				});
			}
		}

		// Título
		const title = timeComparison ?
			`${metricLabels[metric]} - ${getNetworkLabel(networksA)} vs ${getNetworkLabel(networksB)}` :
			`Comparación de ${metricLabels[metric]}`;

		// Determinar el tipo final del gráfico
		const finalChartType = actualChartType;

		chartInstance = new Chart(ctx, {
			type: finalChartType,
			data: {
				labels: timeComparison ? labels : [getNetworkLabel(networksA), getNetworkLabel(networksB)],
				datasets: datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				// Para Chart.js v3+: barras horizontales usan indexAxis: 'y'
				...(isHorizontalBar && { indexAxis: 'y' }),
				plugins: {
					title: {
						display: true,
						text: title
					},
					legend: {
						display: timeComparison || chartType === 'radar'
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const value = context.parsed.y || context.parsed;
								return `${context.dataset.label}: ${value.toLocaleString()}`;
							}
						}
					}
				},
				scales: (() => {
					// Gráficos circulares y radar no usan scales tradicionales
					const isCircular = ['doughnut', 'pie', 'polarArea', 'radar'].includes(finalChartType);

					if (isCircular) {
						return {};
					}

					return {
						y: {
							beginAtZero: true,
							stacked: isAreaSmooth,
							title: {
								display: true,
								text: metricLabels[metric]
							}
						},
						x: {
							stacked: isAreaSmooth,
							title: {
								display: timeComparison,
								text: granularity === 'hour' ? 'Hora' : 'Fecha'
							}
						}
					};
				})()
			}
		});

		console.log('📊 NetworkComparison chart created');
	}

	onMount(() => {
		mounted = true;
		console.log('📊 NetworkComparisonChart montado');

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/networkcomparison.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					processedData = workerData;
					console.log(`✅ Worker completado en ${duration}ms - Modo: ${workerData.stats.mode}`);

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
		if (data.length > 0) {
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

<div class="comparison-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">📊</div>
			<h3>No hay datos disponibles</h3>
			<p>Carga un archivo CSV para ver la comparación de redes</p>
		</div>
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Comparando redes sociales...</h3>
			<p>{processingProgress}% completado</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {processingProgress}%"></div>
			</div>
		</div>
	{:else}
		<canvas bind:this={canvas} class="chart-canvas"></canvas>
	{/if}
</div>

<style>
	.comparison-container {
		position: relative;
		width: 100%;
		min-height: 400px;
	}

	.chart-canvas {
		width: 100% !important;
		height: 400px !important;
		max-height: 400px;
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
