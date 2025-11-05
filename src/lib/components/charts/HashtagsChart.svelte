<script>
	import { onMount, afterUpdate, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let data = [];
	export let chartType = 'bar';
	export let limit = 20;

	let canvas;
	let chartInstance;
	let mounted = false;
	let hasHashtags = true;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Web Worker state
	let worker = null;
	let isProcessing = false;
	let processingProgress = 0;
	let hashtagData = [];

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	$: if (mounted && data.length > 0) {
		processDataWithWorker();
	}

	$: if (mounted && canvas && hashtagData.length > 0 && (chartType || limit)) {
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
		if (!canvas || hashtagData.length === 0) return;

		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		// Ordenar y limitar
		const sortedHashtags = hashtagData
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);

		console.log('📊 Renderizando', sortedHashtags.length, 'hashtags de', hashtagData.length, 'únicos');

		if (sortedHashtags.length === 0) {
			console.log('⚠️ No se encontraron hashtags en los posts');
			hasHashtags = false;
			if (chartInstance) {
				chartInstance.destroy();
				chartInstance = null;
			}
			return;
		}

		hasHashtags = true;

		const labels = sortedHashtags.map(h => h.tag);
		const chartData = sortedHashtags.map(h => h.count);

		const isHorizontal = chartType === 'horizontalBar' || chartType === 'bar';

		// Ajustar altura del canvas dinámicamente para gráficos horizontales
		// Cada barra necesita ~30px de altura para que las etiquetas se vean bien
		if (isHorizontal) {
			const minHeight = Math.max(400, sortedHashtags.length * 30);
			canvas.style.height = `${minHeight}px`;
		} else {
			canvas.style.height = '400px';
		}

		chartInstance = new Chart(ctx, {
			type: chartType === 'horizontalBar' ? 'bar' : chartType,
			data: {
				labels: labels,
				datasets: [{
					label: 'Frecuencia',
					data: chartData,
					backgroundColor: 'rgba(155, 89, 182, 0.8)',
					borderColor: '#9b59b6',
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
						const clickedHashtag = sortedHashtags[index];

						selectedTitle = `Posts con ${clickedHashtag.tag}`;
						selectedPosts = clickedHashtag.posts;
						showModal = true;

						console.log('📊 Click en hashtag:', clickedHashtag.tag, '-', clickedHashtag.count, 'posts');
					}
				},
				plugins: {
					title: {
						display: true,
						text: `Top ${limit} Hashtags Más Usados`
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const index = context.dataIndex;
								const hashtag = sortedHashtags[index];
								return [
									`Frecuencia: ${hashtag.count} posts`,
									`Engagement total: ${hashtag.totalEngagement.toLocaleString()}`,
									'(Click para ver posts)'
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
							display: isHorizontal,
							text: 'Frecuencia'
						},
						ticks: {
							autoSkip: false,
							maxRotation: isHorizontal ? 0 : 45,
							minRotation: isHorizontal ? 0 : 45
						}
					},
					y: {
						beginAtZero: true,
						title: {
							display: !isHorizontal,
							text: 'Frecuencia'
						},
						ticks: {
							autoSkip: false,
							crossAlign: 'far',
							padding: 5
						}
					}
				}
			}
		});

		console.log('📊 Hashtags chart created');
	}

	onMount(() => {
		mounted = true;
		console.log('📊 HashtagsChart montado, datos:', data.length);

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/hashtags.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					hashtagData = workerData.hashtagData;
					console.log(`✅ Worker completado en ${duration}ms - ${workerData.stats.totalHashtags} hashtags únicos`);

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

<div class="hashtags-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">#️⃣</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
		</div>
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Procesando hashtags...</h3>
			<p>{processingProgress}% completado</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {processingProgress}%"></div>
			</div>
		</div>
	{:else if !hasHashtags}
		<div class="no-data-message">
			<div class="no-data-icon">#️⃣</div>
			<h3>No se encontraron hashtags</h3>
			<p>Los posts no contienen hashtags (#)</p>
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
	.hashtags-container {
		position: relative;
		cursor: pointer;
		max-height: 600px;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.chart-canvas {
		width: 100% !important;
		min-height: 400px;
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
		border: 4px solid rgba(155, 89, 182, 0.2);
		border-top-color: #9b59b6;
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
		background-color: rgba(155, 89, 182, 0.2);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: #9b59b6;
		transition: width 0.3s ease;
	}

	/* Scrollbar styling para el contenedor */
	.hashtags-container::-webkit-scrollbar {
		width: 8px;
	}

	.hashtags-container::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 4px;
	}

	.hashtags-container::-webkit-scrollbar-thumb {
		background: #888;
		border-radius: 4px;
	}

	.hashtags-container::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>