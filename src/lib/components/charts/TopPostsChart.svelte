<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let data = [];
	export let chartType = 'bar';
	export let limit = 10;

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
	let topPosts = [];

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	$: if (mounted && data.length > 0) {
		processDataWithWorker();
	}

	$: if (mounted && canvas && topPosts.length > 0 && (chartType || limit)) {
		createChart();
	}

	function processDataWithWorker() {
		if (!worker || !data || data.length === 0) return;

		console.log(`🔧 Iniciando procesamiento de ${data.length} posts con Worker...`);
		isProcessing = true;
		processingProgress = 0;

		worker.postMessage({
			posts: data,
			limit: limit,
			chunkSize: 10000
		});
	}

	function createChart() {
		if (!canvas || topPosts.length === 0) return;

		// Destruir gráfico existente
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		console.log('📊 Renderizando', topPosts.length, 'top posts...');

		// Preparar datos para el gráfico
		const labels = topPosts.map((post, index) => {
			const text = post.text || 'Sin texto';
			return text.length > 40 ? text.substring(0, 37) + '...' : text;
		});

		const chartData = topPosts.map(post => post.engagement);
		const likesData = topPosts.map(post => parseInt(post.likes || 0));
		const repliesData = topPosts.map(post => parseInt(post.replies || 0));

		// Convertir tipo de gráfico
		const actualChartType = chartType === 'horizontalBar' ? 'bar' : chartType;
		const isHorizontal = chartType === 'horizontalBar';

		chartInstance = new Chart(ctx, {
			type: actualChartType,
			data: {
				labels: labels,
				datasets: [{
					label: 'Engagement Total',
					data: chartData,
					backgroundColor: 'rgba(52, 152, 219, 0.8)',
					borderColor: '#3498db',
					borderWidth: 1
				}]
			},
			options: {
				indexAxis: isHorizontal ? 'y' : 'x',
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						const clickedPost = topPosts[index];

						selectedTitle = `Post de ${clickedPost.user_name || 'Usuario desconocido'}`;
						selectedPosts = [clickedPost];
						showModal = true;

						console.log('📊 Click en post:', clickedPost.text?.substring(0, 50));
					}
				},
				plugins: {
					title: {
						display: true,
						text: `Top ${limit} Posts por Engagement`
					},
					tooltip: {
						callbacks: {
							title: function(context) {
								const index = context[0].dataIndex;
								return topPosts[index].text?.substring(0, 100) || 'Sin texto';
							},
							label: function(context) {
								const index = context.dataIndex;
								const post = topPosts[index];
								return [
									`Engagement: ${post.engagement}`,
									`Likes: ${post.likes || 0}`,
									`Replies: ${post.replies || 0}`,
									'(Click para ver detalles)'
								];
							}
						}
					},
					legend: {
						display: false
					}
				},
				scales: {
					x: {
						beginAtZero: true,
						title: {
							display: !isHorizontal,
							text: 'Engagement'
						}
					},
					y: {
						beginAtZero: true,
						title: {
							display: isHorizontal,
							text: 'Posts'
						}
					}
				}
			}
		});

		console.log('📊 Top Posts chart created');
	}

	onMount(() => {
		mounted = true;
		console.log('📊 TopPostsChart montado, datos:', data.length);

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/topposts.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					topPosts = workerData.topPosts;
					console.log(`✅ Worker completado en ${duration}ms - Top ${workerData.stats.topPostsCount} posts`);

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

<div class="top-posts-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">📊</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
		</div>
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Procesando top posts...</h3>
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
	.top-posts-container {
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