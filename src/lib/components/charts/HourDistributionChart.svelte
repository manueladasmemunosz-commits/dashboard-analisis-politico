<script>
	import { onMount, afterUpdate } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let data = [];
	export let chartType = 'bar';

	let canvas;
	let chartInstance;
	let mounted = false;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	$: if (mounted && canvas) {
		if (data.length > 0) {
			updateChart();
		} else {
			if (chartInstance) {
				chartInstance.destroy();
				chartInstance = null;
			}
		}
	}

	$: if (mounted && chartInstance && chartType && data.length > 0) {
		updateChart();
	}

	function createChart() {
		if (!canvas || !data.length) return;

		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		// Agrupar por hora del día (0-23)
		const hourGroups = {};
		for (let i = 0; i < 24; i++) {
			hourGroups[i] = [];
		}

		let invalidTimes = 0;

		data.forEach(post => {
			if (!post.created) {
				invalidTimes++;
				return;
			}

			// Extraer hora del formato "YYYY-MM-DD HH:MM:SS"
			const timePart = post.created.split(' ')[1];
			if (!timePart) {
				invalidTimes++;
				return;
			}

			const hour = parseInt(timePart.split(':')[0]);
			if (isNaN(hour) || hour < 0 || hour > 23) {
				invalidTimes++;
				return;
			}

			hourGroups[hour].push(post);
		});

		console.log('📊 Procesando distribución horaria:', data.length - invalidTimes, 'posts válidos');
		if (invalidTimes > 0) {
			console.log('⚠️ Posts sin hora válida:', invalidTimes);
		}

		// Preparar datos del gráfico
		const labels = [];
		const chartData = [];
		const postsByHour = [];

		for (let hour = 0; hour < 24; hour++) {
			labels.push(`${hour.toString().padStart(2, '0')}:00`);
			chartData.push(hourGroups[hour].length);
			postsByHour.push(hourGroups[hour]);
		}

		// Calcular estadísticas
		const totalPosts = chartData.reduce((sum, count) => sum + count, 0);
		const avgPerHour = (totalPosts / 24).toFixed(1);
		const maxHour = chartData.indexOf(Math.max(...chartData));
		const minHour = chartData.indexOf(Math.min(...chartData));

		console.log('📊 Estadísticas horarias:');
		console.log(`  - Total posts: ${totalPosts}`);
		console.log(`  - Promedio por hora: ${avgPerHour}`);
		console.log(`  - Hora más activa: ${labels[maxHour]} (${chartData[maxHour]} posts)`);
		console.log(`  - Hora menos activa: ${labels[minHour]} (${chartData[minHour]} posts)`);

		const isPolar = chartType === 'polarArea';
		const isLine = chartType === 'line' || chartType === 'area' || chartType === 'areaSmooth';
		const isArea = chartType === 'area' || chartType === 'areaSmooth';
		const isAreaSmooth = chartType === 'areaSmooth';
		const actualChartType = isArea ? 'line' : chartType;

		// Colores tema chileno
		const chileColors = {
			bg: '#3b82f6',       // Azul Chile
			border: '#1e40af'    // Azul Chile oscuro
		};

		chartInstance = new Chart(ctx, {
			type: actualChartType,
			data: {
				labels: labels,
				datasets: [{
					label: 'Posts por hora',
					data: chartData,
					backgroundColor: isPolar
						? labels.map((_, i) => {
							const hue = (i / 24) * 360;
							return `hsla(${hue}, 70%, 60%, 0.7)`;
						})
						: isAreaSmooth
							? chileColors.bg
							: isArea
								? 'rgba(46, 204, 113, 0.3)'
								: 'rgba(46, 204, 113, 0.8)',
					borderColor: isAreaSmooth ? chileColors.border : '#2ecc71',
					borderWidth: isAreaSmooth ? 0 : 1,
					fill: isArea,
					tension: isLine ? 0.4 : 0,
					pointRadius: isAreaSmooth ? 0 : (isLine ? 3 : 0),
					pointHoverRadius: isAreaSmooth ? 0 : (isLine ? 5 : 0),
					stack: isAreaSmooth ? 'stacked' : undefined
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						const hour = labels[index];
						const posts = postsByHour[index];

						if (posts.length > 0) {
							selectedTitle = `Posts publicados a las ${hour}`;
							selectedPosts = posts;
							showModal = true;

							console.log('📊 Click en hora:', hour, '-', posts.length, 'posts');
						}
					}
				},
				plugins: {
					title: {
						display: true,
						text: 'Distribución de Posts por Hora del Día'
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const count = context.parsed.y || context.parsed.r || context.parsed;
								const percentage = ((count / totalPosts) * 100).toFixed(1);
								return [
									`Posts: ${count} (${percentage}%)`,
									'(Click para ver posts)'
								];
							}
						}
					},
					legend: {
						display: false
					}
				},
				scales: isPolar ? {} : {
					x: {
						stacked: isAreaSmooth,
						title: {
							display: true,
							text: 'Hora del día'
						}
					},
					y: {
						beginAtZero: true,
						stacked: isAreaSmooth,
						title: {
							display: true,
							text: 'Cantidad de Posts'
						}
					}
				}
			}
		});

		console.log('📊 Hour Distribution chart created');
	}

	function updateChart() {
		createChart();
	}

	onMount(() => {
		mounted = true;
		console.log('📊 HourDistributionChart montado, datos:', data.length);
		if (data.length > 0) {
			createChart();
		}
	});

	afterUpdate(() => {
		if (mounted && canvas && data.length > 0 && !chartInstance) {
			createChart();
		}
	});
</script>

<div class="hour-distribution-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">🕐</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
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
	.hour-distribution-container {
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
</style>