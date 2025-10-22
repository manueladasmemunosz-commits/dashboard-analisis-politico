<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let data = [];
	export let chartType = 'doughnut';

	let canvas;
	let chartInstance;
	let mounted = false;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Web Worker state
	let worker = null;
	let isProcessing = false;
	let processingProgress = 0;
	let sentimentGroups = null;

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	$: if (mounted && data.length > 0) {
		processDataWithWorker();
	}

	$: if (mounted && canvas && sentimentGroups && chartType) {
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
		if (!canvas || !sentimentGroups) return;

		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		console.log('📊 Renderizando distribución de sentimientos:', {
			positive: sentimentGroups.positive.length,
			neutral: sentimentGroups.neutral.length,
			negative: sentimentGroups.negative.length,
			unknown: sentimentGroups.unknown.length
		});

		const labels = [];
		const chartData = [];
		const postGroups = [];
		const backgroundColors = [];
		const borderColors = [];

		if (sentimentGroups.positive.length > 0) {
			labels.push('Positivo');
			chartData.push(sentimentGroups.positive.length);
			postGroups.push(sentimentGroups.positive);
			backgroundColors.push('rgba(46, 204, 113, 0.8)');
			borderColors.push('#2ecc71');
		}
		if (sentimentGroups.neutral.length > 0) {
			labels.push('Neutral');
			chartData.push(sentimentGroups.neutral.length);
			postGroups.push(sentimentGroups.neutral);
			backgroundColors.push('rgba(149, 165, 166, 0.8)');
			borderColors.push('#95a5a6');
		}
		if (sentimentGroups.negative.length > 0) {
			labels.push('Negativo');
			chartData.push(sentimentGroups.negative.length);
			postGroups.push(sentimentGroups.negative);
			backgroundColors.push('rgba(231, 76, 60, 0.8)');
			borderColors.push('#e74c3c');
		}
		if (sentimentGroups.unknown.length > 0) {
			labels.push('Sin clasificar');
			chartData.push(sentimentGroups.unknown.length);
			postGroups.push(sentimentGroups.unknown);
			backgroundColors.push('rgba(52, 73, 94, 0.8)');
			borderColors.push('#34495e');
		}

		if (labels.length === 0) {
			console.log('⚠️ No hay datos de sentimiento disponibles');
			return;
		}

		const isDoughnutOrPie = chartType === 'doughnut' || chartType === 'pie';

		chartInstance = new Chart(ctx, {
			type: chartType === 'horizontalBar' ? 'bar' : chartType,
			data: {
				labels: labels,
				datasets: [{
					label: 'Posts',
					data: chartData,
					backgroundColor: backgroundColors,
					borderColor: borderColors,
					borderWidth: 1
				}]
			},
			options: {
				indexAxis: chartType === 'horizontalBar' ? 'y' : 'x',
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						const sentiment = labels[index];
						const posts = postGroups[index];

						selectedTitle = `Posts con sentimiento ${sentiment}`;
						selectedPosts = posts;
						showModal = true;

						console.log('📊 Click en sentimiento:', sentiment, '-', posts.length, 'posts');
					}
				},
				plugins: {
					title: {
						display: true,
						text: 'Análisis de Sentimientos'
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const total = chartData.reduce((a, b) => a + b, 0);
								const value = context.parsed || context.parsed.y;
								const percentage = ((value / total) * 100).toFixed(1);
								return [
									`${context.label}: ${value} posts (${percentage}%)`,
									'(Click para ver posts)'
								];
							}
						}
					},
					legend: {
						display: isDoughnutOrPie,
						position: 'right'
					}
				},
				scales: chartType === 'doughnut' || chartType === 'pie' ? {} : {
					x: {
						beginAtZero: true,
						title: {
							display: chartType !== 'horizontalBar',
							text: 'Sentimiento'
						}
					},
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: 'Cantidad de Posts'
						}
					}
				}
			}
		});

		console.log('📊 Sentiment chart created');
	}

	onMount(() => {
		mounted = true;
		console.log('📊 SentimentChart montado, datos:', data.length);

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/sentiment.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					sentimentGroups = workerData.sentimentGroups;
					console.log(`✅ Worker completado en ${duration}ms`);

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

<div class="sentiment-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">😊</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
		</div>
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Analizando sentimientos...</h3>
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
	date={selectedTitle}
	on:close={() => showModal = false}
/>

<style>
	.sentiment-container {
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
		border: 4px solid rgba(46, 204, 113, 0.2);
		border-top-color: #2ecc71;
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
		background-color: rgba(46, 204, 113, 0.2);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: #2ecc71;
		transition: width 0.3s ease;
	}
</style>