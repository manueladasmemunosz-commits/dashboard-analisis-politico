<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let data = [];
	export let chartType = 'line';

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
	let performanceData = [];

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	$: if (mounted && data.length > 0) {
		processDataWithWorker();
	}

	$: if (mounted && canvas && performanceData.length > 0 && chartType) {
		createChart();
	}

	function processDataWithWorker() {
		if (!worker || !data || data.length === 0) return;

		console.log(`🔧 Iniciando procesamiento de ${data.length} posts con Worker...`);
		isProcessing = true;
		processingProgress = 0;

		worker.postMessage({
			posts: data,
			chunkSize: 10000
		});
	}

	function createChart() {
		if (!canvas || performanceData.length === 0) return;

		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		console.log('📊 Renderizando performance de', performanceData.length, 'fechas...');

		// Preparar datos para el gráfico
		const labels = performanceData.map(item => {
			const dateObj = new Date(item.date);
			return dateObj.toLocaleDateString('es-CL', {
				month: 'short',
				day: 'numeric'
			});
		});

		const avgEngagementData = performanceData.map(item => item.avgEngagement);
		const totalPostsData = performanceData.map(item => item.totalPosts);

		const isAreaChart = chartType === 'area' || chartType === 'areaSmooth';
		const isAreaSmooth = chartType === 'areaSmooth';
		const actualChartType = isAreaChart ? 'line' : chartType;

		// Colores tema chileno
		const chileColors = [
			{ bg: '#3b82f6', border: '#1e40af' },  // Azul Chile
			{ bg: '#ef4444', border: '#dc2626' }   // Rojo Chile
		];

		// Para areaSmooth: ordenar datasets por volumen (menor abajo, mayor arriba)
		const datasets = [
			{
				label: 'Engagement Promedio',
				data: avgEngagementData,
				totalVolume: avgEngagementData.reduce((sum, val) => sum + parseFloat(val), 0),
				yAxisID: 'y',
				colorIndex: 1
			},
			{
				label: 'Cantidad de Posts',
				data: totalPostsData,
				totalVolume: totalPostsData.reduce((sum, val) => sum + val, 0),
				yAxisID: isAreaSmooth ? 'y' : 'y1',
				colorIndex: 0
			}
		];

		if (isAreaSmooth) {
			datasets.sort((a, b) => a.totalVolume - b.totalVolume);
		}

		const chartDatasets = datasets.map((ds, index) => {
			const colorIdx = isAreaSmooth ? index : ds.colorIndex;

			return {
				label: ds.label,
				data: ds.data,
				borderColor: isAreaSmooth ? chileColors[colorIdx].border :
							(ds.colorIndex === 0 ? '#3498db' : '#e74c3c'),
				borderWidth: isAreaSmooth ? 0 : 2,
				backgroundColor: isAreaSmooth ? chileColors[colorIdx].bg :
							   isAreaChart ? (ds.colorIndex === 0 ? 'rgba(52, 152, 219, 0.3)' : 'rgba(231, 76, 60, 0.3)') :
							   (ds.colorIndex === 0 ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)'),
				fill: isAreaChart ? (isAreaSmooth ? 'origin' : true) : false,
				tension: 0.4,
				yAxisID: ds.yAxisID,
				pointRadius: isAreaSmooth ? 0 : (ds.colorIndex === 0 ? 3 : 4),
				pointHoverRadius: isAreaSmooth ? 0 : (ds.colorIndex === 0 ? 5 : 6),
				stack: isAreaSmooth ? 'stacked' : undefined
			};
		});

		chartInstance = new Chart(ctx, {
			type: actualChartType,
			data: {
				labels: labels,
				datasets: chartDatasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						const clickedData = performanceData[index];

						selectedDate = new Date(clickedData.date).toLocaleDateString('es-CL', {
							weekday: 'long',
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						});
						selectedPosts = clickedData.posts;
						showModal = true;

						console.log('📊 Click en fecha:', clickedData.date, '- Posts:', clickedData.posts.length);
					}
				},
				plugins: {
					title: {
						display: true,
						text: 'Performance: Engagement Rate en el Tiempo'
					},
					tooltip: {
						callbacks: {
							title: function(context) {
								const index = context[0].dataIndex;
								return performanceData[index].date;
							},
							label: function(context) {
								const index = context.dataIndex;
								const item = performanceData[index];
								if (context.datasetIndex === 0) {
									return `Engagement promedio: ${context.parsed.y}`;
								} else {
									return `Posts: ${context.parsed.y}`;
								}
							},
							afterLabel: function(context) {
								if (context.datasetIndex === 0) {
									return '(Click para ver posts del día)';
								}
								return '';
							}
						}
					}
				},
				scales: (() => {
					if (isAreaSmooth) {
						// En modo areaSmooth: un solo eje Y apilado
						return {
							x: {
								stacked: true,
								title: {
									display: true,
									text: 'Fecha'
								}
							},
							y: {
								stacked: true,
								beginAtZero: true,
								title: {
									display: true,
									text: 'Valor'
								}
							}
						};
					} else {
						// Modo normal: dual Y-axis
						return {
							x: {
								title: {
									display: true,
									text: 'Fecha'
								}
							},
							y: {
								type: 'linear',
								display: true,
								position: 'left',
								beginAtZero: true,
								title: {
									display: true,
									text: 'Engagement Promedio'
								}
							},
							y1: {
								type: 'linear',
								display: true,
								position: 'right',
								beginAtZero: true,
								title: {
									display: true,
									text: 'Cantidad de Posts'
								},
								grid: {
									drawOnChartArea: false
								}
							}
						};
					}
				})()
			}
		});

		console.log('📊 Performance chart created');
	}

	onMount(() => {
		mounted = true;
		console.log('📊 PerformanceChart montado, datos:', data.length);

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/performance.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					performanceData = workerData.performanceData;
					console.log(`✅ Worker completado en ${duration}ms - ${workerData.stats.totalDates} fechas procesadas`);

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

<div class="performance-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">📈</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
		</div>
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Procesando métricas de performance...</h3>
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
	.performance-container {
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