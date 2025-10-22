<script>
	import { onMount, afterUpdate, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';
	import * as d3 from 'd3';

	export let data = [];
	export let chartType = 'scatter'; // scatter, bubble, violin, 3d
	export let visualizationMode = 'likes-vs-replies'; // Modo de visualización

	let canvas;
	let chartInstance;
	let svgContainer; // Para gráficos D3
	let mounted = false;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Web Worker state
	let scatterWorker = null;
	let scatterData = [];
	let isProcessing = false;
	let progress = 0;
	let originalPosts = [];

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	// Inicializar Worker
	function initScatterWorker() {
		if (typeof window === 'undefined') return null;

		try {
			scatterWorker = new Worker(
				new URL('../../workers/scatter.worker.js', import.meta.url),
				{ type: 'module' }
			);

			scatterWorker.onmessage = (e) => {
				const { type, data: workerData, progress: prog, message } = e.data;

				if (type === 'progress') {
					progress = prog;
					isProcessing = true;
					console.log(`⏳ Scatter: ${message} (${prog}%)`);
				} else if (type === 'complete') {
					scatterData = workerData.scatterData;
					isProcessing = false;
					progress = 100;
					console.log(`✅ Scatter Plot procesado - ${workerData.stats.totalPoints} puntos`);
					createChart();
				}
			};

			scatterWorker.onerror = (error) => {
				console.error('❌ Error en Scatter Worker:', error);
				isProcessing = false;
				progress = 0;
			};

			return scatterWorker;
		} catch (error) {
			console.error('❌ No se pudo iniciar Scatter Worker:', error);
			return null;
		}
	}

	$: if (mounted && data.length > 0) {
		originalPosts = data;
		if (!scatterWorker) {
			scatterWorker = initScatterWorker();
		}

		if (scatterWorker) {
			isProcessing = true;
			progress = 0;
			console.log(`☁️ Iniciando procesamiento Scatter: ${data.length} posts`);
			scatterWorker.postMessage({ posts: data, chunkSize: 10000 });
		} else {
			// Fallback sin worker
			processDataSync();
		}
	}

	// Re-crear el gráfico cuando cambie el modo de visualización o el tipo de gráfico
	$: if (mounted && chartInstance && scatterData.length > 0 && !isProcessing && (chartType || visualizationMode)) {
		console.log(`🔄 Actualizando gráfico - Modo: ${visualizationMode}, Tipo: ${chartType}`);
		updateChart();
	}

	// Trigger explícito para cambios en visualizationMode
	$: if (visualizationMode && mounted && chartInstance) {
		console.log(`📊 Cambio de visualización detectado: ${visualizationMode}`);
		updateChart();
	}

	function processDataSync() {
		scatterData = data.map(post => ({
			x: parseInt(post.likes || 0),
			y: parseInt(post.replies || 0),
			engagement: parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0),
			post: post,
			postId: post.id,
			user: post.user_name,
			text: post.text?.substring(0, 50),
			created: post.created
		}));
		createChart();
	}

	// Procesar datos según el modo de visualización
	function processDataByMode(rawData) {
		switch (visualizationMode) {
			case 'likes-vs-replies':
				return rawData;

			case 'engagement-vs-length':
				return rawData.map(d => {
					// Obtener el texto original del post
					const originalText = d.post?.text || d.text || '';
					// Limpiar: eliminar espacios múltiples, saltos de línea, y limitar a un máximo razonable
					const cleanText = originalText.trim().replace(/\s+/g, ' ');
					// Limitar a 10,000 caracteres máximo (tweets/posts no pueden ser tan largos)
					const textLength = Math.min(cleanText.length, 10000);
					return {
						...d,
						x: textLength,
						y: d.engagement
					};
				});

			case 'likes-replies-ratio':
				return rawData
					.filter(d => (d.x + d.y) > 0) // Solo posts con al menos algún engagement
					.map(d => {
						const likes = d.x || 0;
						const replies = d.y || 0;
						// Ratio: cuántos likes por cada reply
						// Si no hay replies, el ratio es infinito (usamos likes como proxy)
						const ratio = replies > 0 ? (likes / replies) : (likes > 0 ? 100 : 0);
						return {
							...d,
							x: likes,
							y: Math.min(ratio, 100) // Limitar ratio a 100 para mejor visualización
						};
					});

			case 'viral-posts':
				// Identificar outliers: posts con engagement excepcional
				// Usar percentil 95 en lugar de desviación estándar para mejor detección
				const engagements = rawData.map(d => d.engagement).sort((a, b) => a - b);
				const p95Index = Math.floor(engagements.length * 0.95);
				const threshold = engagements[p95Index] || 0;

				const viralPosts = rawData.filter(d => d.engagement > threshold);

				console.log(`🚀 Posts virales: ${viralPosts.length} de ${rawData.length} (threshold: ${threshold})`);

				return viralPosts.map(d => ({
					...d,
					x: d.x, // likes
					y: d.y  // replies
				}));

			default:
				return rawData;
		}
	}

	function createChart() {
		if (scatterData.length === 0) return;

		// Destruir gráfico/visualización existente
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}

		// Limpiar SVG si existe
		if (svgContainer) {
			d3.select(svgContainer).selectAll('*').remove();
		}

		// Decidir qué tipo de gráfico crear
		switch (chartType) {
			case 'scatter':
			case 'bubble':
				createChartJS();
				break;
			case 'violin':
				createViolin();
				break;
			case '3d':
				create3DScatter();
				break;
			default:
				createChartJS();
		}
	}

	function createChartJS() {
		if (!canvas) return;

		const ctx = canvas.getContext('2d');

		// Procesar datos según el modo de visualización
		const processedData = processDataByMode(scatterData);

		// Limitar a 5000 puntos para rendimiento (sampling inteligente)
		let displayData = processedData;
		if (processedData.length > 5000) {
			// Ordenar por engagement y tomar top 2500 + 2500 random
			const sorted = [...processedData].sort((a, b) => b.engagement - a.engagement);
			const topEngagement = sorted.slice(0, 2500);

			// Tomar muestra aleatoria del resto
			const remaining = sorted.slice(2500);
			const randomSample = [];
			const sampleSize = 2500;
			const step = Math.floor(remaining.length / sampleSize);
			for (let i = 0; i < remaining.length && randomSample.length < sampleSize; i += step) {
				randomSample.push(remaining[i]);
			}

			displayData = [...topEngagement, ...randomSample];
			console.log(`📊 Scatter plot (${visualizationMode}): Mostrando ${displayData.length} de ${processedData.length} puntos (top engagement + muestra)`);
		} else {
			console.log(`📊 Creando scatter plot (${visualizationMode}) con ${processedData.length} puntos...`);
		}

		// Calcular maxEngagement sin spread operator
		let maxEngagement = 0;
		for (let i = 0; i < displayData.length; i++) {
			const total = displayData[i].x + displayData[i].y;
			if (total > maxEngagement) maxEngagement = total;
		}

		// Configurar títulos y etiquetas según el modo
		let chartTitle, xAxisLabel, yAxisLabel, datasetLabel;

		switch (visualizationMode) {
			case 'likes-vs-replies':
				chartTitle = 'Engagement: Likes vs Replies';
				xAxisLabel = 'Likes';
				yAxisLabel = 'Replies';
				datasetLabel = 'Posts (Likes vs Replies)';
				break;
			case 'engagement-vs-length':
				chartTitle = 'Engagement vs Longitud del Texto';
				xAxisLabel = 'Longitud del Texto (caracteres)';
				yAxisLabel = 'Engagement Total';
				datasetLabel = 'Posts por Longitud';
				break;
			case 'likes-replies-ratio':
				chartTitle = 'Ratio Likes/Replies (Conversación vs Popularidad)';
				xAxisLabel = 'Likes';
				yAxisLabel = 'Ratio Likes/Replies (likes por reply)';
				datasetLabel = 'Posts - Ratio de Interacción';
				break;
			case 'viral-posts':
				chartTitle = `Posts Virales (Top 5% - ${displayData.length} posts)`;
				xAxisLabel = 'Likes';
				yAxisLabel = 'Replies';
				datasetLabel = 'Posts con Mayor Engagement';
				break;
			default:
				chartTitle = 'Engagement Distribution';
				xAxisLabel = 'X';
				yAxisLabel = 'Y';
				datasetLabel = 'Posts';
		}

		chartInstance = new Chart(ctx, {
			type: chartType === 'bubble' ? 'bubble' : 'scatter',
			data: {
				datasets: [{
					label: datasetLabel,
					data: chartType === 'bubble'
						? displayData.map(d => ({
							x: d.x,
							y: d.y,
							r: Math.min(Math.sqrt((d.x + d.y) / 10), 20) // Radio basado en engagement
						}))
						: displayData,
					backgroundColor: visualizationMode === 'viral-posts'
						? 'rgba(239, 68, 68, 0.7)'
						: 'rgba(52, 152, 219, 0.6)',
					borderColor: visualizationMode === 'viral-posts'
						? '#dc2626'
						: '#3498db',
					borderWidth: 1,
					pointRadius: chartType === 'bubble' ? undefined : 5,
					pointHoverRadius: chartType === 'bubble' ? undefined : 7
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						const clickedData = displayData[index];

						// Buscar el post original por ID
						let clickedPost = originalPosts.find(p => p.id === clickedData.postId);

						if (!clickedPost) {
							clickedPost = originalPosts.find(p =>
								parseInt(p.likes || 0) === clickedData.x &&
								parseInt(p.replies || 0) === clickedData.y &&
								p.user_name === clickedData.user
							);
						}

						if (clickedPost) {
							selectedTitle = `Post de ${clickedPost.user_name || 'Usuario desconocido'}`;
							selectedPosts = [clickedPost];
							showModal = true;
							console.log('📊 Click en post:', clickedPost.text?.substring(0, 50));
						} else {
							console.error('❌ No se encontró el post original para:', clickedData);
						}
					}
				},
				plugins: {
					title: {
						display: true,
						text: chartTitle
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const dataPoint = displayData[context.dataIndex];
								const labels = [];

								// Etiquetas específicas según el modo de visualización
								switch (visualizationMode) {
									case 'engagement-vs-length':
										labels.push(`Longitud: ${dataPoint.x} caracteres`);
										labels.push(`Engagement: ${dataPoint.y}`);
										break;
									case 'likes-replies-ratio':
										labels.push(`Likes: ${dataPoint.x}`);
										labels.push(`Ratio: ${dataPoint.y.toFixed(2)} likes/reply`);
										labels.push(`Engagement: ${dataPoint.engagement}`);
										break;
									default:
										labels.push(`Likes: ${dataPoint.x}`);
										labels.push(`Replies: ${dataPoint.y}`);
										labels.push(`Engagement: ${dataPoint.engagement}`);
								}

								labels.push(`Usuario: ${dataPoint.user || 'Desconocido'}`);
								labels.push(`Texto: ${dataPoint.text || 'Sin texto'}`);
								labels.push('(Click para ver detalles)');

								return labels;
							}
						}
					},
					legend: {
						display: false
					}
				},
				scales: {
					x: {
						type: 'linear',
						position: 'bottom',
						beginAtZero: true,
						title: {
							display: true,
							text: xAxisLabel
						}
					},
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: yAxisLabel
						}
					}
				}
			}
		});

		console.log('📊 Engagement Scatter chart created');
	}

	function updateChart() {
		createChart();
	}

	// ==================== IMPLEMENTACIONES DE GRÁFICOS D3 ====================

	function createHeatmap() {
		if (!svgContainer) return;

		console.log('📊 Creando Heatmap Tradicional Mejorado...');

		const processedData = processDataByMode(scatterData);
		const margin = { top: 80, right: 80, bottom: 80, left: 80 };
		const width = svgContainer.clientWidth - margin.left - margin.right;
		const height = 500 - margin.top - margin.bottom;

		const svg = d3.select(svgContainer)
			.html('')
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom);

		// Fondo blanco limpio
		svg.append('rect')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.attr('fill', '#ffffff');

		const g = svg.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const { xAxisLabel, yAxisLabel, chartTitle } = getLabels();

		// Grid de 20x20 para mayor resolución
		const gridSize = 20;
		const xExtent = d3.extent(processedData, d => d.x);
		const yExtent = d3.extent(processedData, d => d.y);

		const xScale = d3.scaleLinear().domain(xExtent).range([0, width]);
		const yScale = d3.scaleLinear().domain(yExtent).range([height, 0]);

		const cellWidth = width / gridSize;
		const cellHeight = height / gridSize;

		const xStep = (xExtent[1] - xExtent[0]) / gridSize;
		const yStep = (yExtent[1] - yExtent[0]) / gridSize;

		// Crear bins 2D
		const bins = {};
		processedData.forEach(d => {
			const xBin = Math.floor((d.x - xExtent[0]) / xStep);
			const yBin = Math.floor((d.y - yExtent[0]) / yStep);
			const key = `${xBin},${yBin}`;
			if (!bins[key]) {
				bins[key] = {
					x: xBin,
					y: yBin,
					count: 0,
					engagement: 0,
					posts: []
				};
			}
			bins[key].count++;
			bins[key].engagement += d.engagement || 0;
			bins[key].posts.push(d);
		});

		const binArray = Object.values(bins);
		const maxCount = d3.max(binArray, d => d.count);

		// Paleta de colores vibrante y clara (Turbo)
		const colorScale = d3.scaleSequential(d3.interpolateTurbo)
			.domain([0, maxCount]);

		// Dibujar celdas del heatmap
		binArray.forEach(bin => {
			const cellX = bin.x * cellWidth;
			const cellY = height - (bin.y + 1) * cellHeight; // Invertir Y

			g.append('rect')
				.attr('x', cellX)
				.attr('y', cellY)
				.attr('width', cellWidth)
				.attr('height', cellHeight)
				.attr('fill', colorScale(bin.count))
				.attr('stroke', '#ffffff')
				.attr('stroke-width', 1)
				.style('cursor', 'pointer')
				.on('click', () => {
					if (bin.posts.length > 0) {
						showPostsFromBin(bin.posts);
					}
				})
				.on('mouseover', function() {
					d3.select(this)
						.attr('stroke', '#1e293b')
						.attr('stroke-width', 3)
						.attr('opacity', 0.9);
				})
				.on('mouseout', function() {
					d3.select(this)
						.attr('stroke', '#ffffff')
						.attr('stroke-width', 1)
						.attr('opacity', 1);
				})
				.append('title')
				.text(`Posts: ${bin.count}\nEngagement promedio: ${Math.round(bin.engagement / bin.count)}\n(Click para ver posts)`);

			// Texto si hay suficientes posts
			if (bin.count > maxCount * 0.05) {
				g.append('text')
					.attr('x', cellX + cellWidth / 2)
					.attr('y', cellY + cellHeight / 2 + 4)
					.attr('text-anchor', 'middle')
					.attr('font-size', '11px')
					.attr('font-weight', 'bold')
					.attr('fill', bin.count > maxCount * 0.5 ? '#ffffff' : '#1e293b')
					.attr('pointer-events', 'none')
					.text(bin.count);
			}
		});

		// Ejes con estilo limpio
		const xAxis = g.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale).ticks(10));

		xAxis.selectAll('text')
			.attr('fill', '#334155')
			.attr('font-size', '12px');

		xAxis.selectAll('line')
			.attr('stroke', '#cbd5e1');

		xAxis.select('path')
			.attr('stroke', '#64748b')
			.attr('stroke-width', 2);

		g.append('text')
			.attr('x', width / 2)
			.attr('y', height + 55)
			.attr('text-anchor', 'middle')
			.attr('font-size', '15px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text(xAxisLabel);

		const yAxis = g.append('g')
			.call(d3.axisLeft(yScale).ticks(10));

		yAxis.selectAll('text')
			.attr('fill', '#334155')
			.attr('font-size', '12px');

		yAxis.selectAll('line')
			.attr('stroke', '#cbd5e1');

		yAxis.select('path')
			.attr('stroke', '#64748b')
			.attr('stroke-width', 2);

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -60)
			.attr('text-anchor', 'middle')
			.attr('font-size', '15px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text(yAxisLabel);

		// Título
		svg.append('text')
			.attr('x', (width + margin.left + margin.right) / 2)
			.attr('y', 35)
			.attr('text-anchor', 'middle')
			.attr('font-size', '22px')
			.attr('font-weight', 'bold')
			.attr('fill', '#0f172a')
			.text(chartTitle);

		// Subtítulo
		svg.append('text')
			.attr('x', (width + margin.left + margin.right) / 2)
			.attr('y', 58)
			.attr('text-anchor', 'middle')
			.attr('font-size', '13px')
			.attr('fill', '#64748b')
			.text(`Densidad de posts | ${processedData.length.toLocaleString()} posts analizados`);

		// Leyenda vertical moderna en el lado derecho
		const legendHeight = height;
		const legendWidth = 30;
		const legend = svg.append('g')
			.attr('transform', `translate(${width + margin.left + 10}, ${margin.top})`);

		// Crear gradiente vertical
		const defs = svg.append('defs');
		const legendGradient = defs.append('linearGradient')
			.attr('id', 'legend-gradient-vertical')
			.attr('x1', '0%').attr('y1', '100%')
			.attr('x2', '0%').attr('y2', '0%');

		for (let i = 0; i <= 20; i++) {
			const val = (maxCount / 20) * i;
			legendGradient.append('stop')
				.attr('offset', `${i * 5}%`)
				.attr('stop-color', colorScale(val));
		}

		legend.append('rect')
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.attr('rx', 4)
			.style('fill', 'url(#legend-gradient-vertical)')
			.attr('stroke', '#94a3b8')
			.attr('stroke-width', 2);

		// Escala para leyenda
		const legendScale = d3.scaleLinear()
			.domain([maxCount, 0])
			.range([0, legendHeight]);

		legend.append('g')
			.attr('transform', `translate(${legendWidth}, 0)`)
			.call(d3.axisRight(legendScale).ticks(8).tickFormat(d3.format('.0f')))
			.selectAll('text')
			.attr('fill', '#334155')
			.attr('font-size', '11px');

		legend.selectAll('path, line')
			.attr('stroke', '#64748b');

		// Título de leyenda
		legend.append('text')
			.attr('x', legendWidth / 2)
			.attr('y', -12)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text('Posts');

		console.log('✅ Heatmap tradicional mejorado creado');
	}

	function createHexbin() {
		if (!svgContainer) return;

		console.log('📊 Creando Hexbin...');

		const processedData = processDataByMode(scatterData);
		const margin = { top: 60, right: 30, bottom: 60, left: 80 };
		const width = svgContainer.clientWidth - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

		const svg = d3.select(svgContainer)
			.html('')
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const { xAxisLabel, yAxisLabel, chartTitle } = getLabels();

		// Escalas
		const xExtent = d3.extent(processedData, d => d.x);
		const yExtent = d3.extent(processedData, d => d.y);

		const xScale = d3.scaleLinear()
			.domain(xExtent)
			.range([0, width]);

		const yScale = d3.scaleLinear()
			.domain(yExtent)
			.range([height, 0]);

		// Crear hexágonos manualmente (hexbin simplificado)
		const hexRadius = 15;
		const hexWidth = hexRadius * 2;
		const hexHeight = Math.sqrt(3) * hexRadius;

		// Agrupar datos en hexágonos
		const hexBins = {};
		processedData.forEach(d => {
			const x = xScale(d.x);
			const y = yScale(d.y);

			const hexX = Math.floor(x / (hexWidth * 0.75));
			const hexY = Math.floor(y / hexHeight);
			const key = `${hexX},${hexY}`;

			if (!hexBins[key]) {
				hexBins[key] = { hexX, hexY, count: 0, posts: [], engagement: 0 };
			}
			hexBins[key].count++;
			hexBins[key].posts.push(d);
			hexBins[key].engagement += d.engagement || 0;
		});

		const binArray = Object.values(hexBins);
		const maxCount = d3.max(binArray, d => d.count);

		const colorScale = d3.scaleSequential(d3.interpolatePlasma)
			.domain([0, maxCount]);

		// Dibujar hexágonos
		svg.selectAll('circle')
			.data(binArray)
			.enter()
			.append('circle')
			.attr('cx', d => d.hexX * hexWidth * 0.75)
			.attr('cy', d => d.hexY * hexHeight)
			.attr('r', d => Math.sqrt(d.count) * 3 + 5)
			.attr('fill', d => colorScale(d.count))
			.attr('fill-opacity', 0.7)
			.attr('stroke', '#fff')
			.attr('stroke-width', 1)
			.style('cursor', 'pointer')
			.on('click', (event, d) => {
				if (d.posts.length > 0) {
					showPostsFromBin(d.posts);
				}
			})
			.append('title')
			.text(d => `Posts: ${d.count}\nEngagement: ${Math.round(d.engagement / d.count)}`);

		// Ejes
		svg.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale))
			.append('text')
			.attr('x', width / 2)
			.attr('y', 40)
			.attr('fill', '#000')
			.attr('font-size', '12px')
			.attr('text-anchor', 'middle')
			.text(xAxisLabel);

		svg.append('g')
			.call(d3.axisLeft(yScale))
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -60)
			.attr('fill', '#000')
			.attr('font-size', '12px')
			.attr('text-anchor', 'middle')
			.text(yAxisLabel);

		// Título
		svg.append('text')
			.attr('x', width / 2)
			.attr('y', -30)
			.attr('text-anchor', 'middle')
			.attr('font-size', '16px')
			.attr('font-weight', 'bold')
			.text(chartTitle + ' (Hexbin)');

		console.log('✅ Hexbin creado');
	}

	function createContour() {
		if (!svgContainer) return;

		console.log('📊 Creando Contour Plot...');

		const processedData = processDataByMode(scatterData);
		const margin = { top: 60, right: 30, bottom: 60, left: 80 };
		const width = svgContainer.clientWidth - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

		const svg = d3.select(svgContainer)
			.html('')
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const { xAxisLabel, yAxisLabel, chartTitle } = getLabels();

		// CORREGIDO: El problema era que aplicaba las escalas dos veces
		// Los datos deben estar en el rango original, contourDensity maneja la transformación
		const xExtent = d3.extent(processedData, d => d.x);
		const yExtent = d3.extent(processedData, d => d.y);

		const xScale = d3.scaleLinear()
			.domain(xExtent)
			.range([0, width]);

		const yScale = d3.scaleLinear()
			.domain(yExtent)
			.range([height, 0]);

		// Preparar datos SIN escalar - contourDensity necesita datos en pixel space
		// pero ya configurados en el espacio del SVG
		const points = processedData.map(d => [xScale(d.x), yScale(d.y)]);

		// Crear densidad usando contours de D3 con bandwidth ajustado
		const contours = d3.contourDensity()
			.x(d => d[0])
			.y(d => d[1])
			.size([width, height])
			.bandwidth(40) // Aumentado para suavizar más
			.thresholds(20) // Más niveles para mejor detalle
			(points);

		// Escala de color mejorada - Turbo es más visible
		const colorScale = d3.scaleSequential(d3.interpolateTurbo)
			.domain(d3.extent(contours, d => d.value));

		// Dibujar contornos
		svg.selectAll('path')
			.data(contours)
			.enter()
			.append('path')
			.attr('d', d3.geoPath())
			.attr('fill', d => colorScale(d.value))
			.attr('fill-opacity', 0.6)
			.attr('stroke', d => d3.color(colorScale(d.value)).darker(0.5))
			.attr('stroke-width', 1.5)
			.attr('stroke-opacity', 0.8);

		// Ejes
		svg.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale))
			.append('text')
			.attr('x', width / 2)
			.attr('y', 40)
			.attr('fill', '#000')
			.attr('font-size', '12px')
			.attr('text-anchor', 'middle')
			.text(xAxisLabel);

		svg.append('g')
			.call(d3.axisLeft(yScale))
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -60)
			.attr('fill', '#000')
			.attr('font-size', '12px')
			.attr('text-anchor', 'middle')
			.text(yAxisLabel);

		// Título
		svg.append('text')
			.attr('x', width / 2)
			.attr('y', -30)
			.attr('text-anchor', 'middle')
			.attr('font-size', '16px')
			.attr('font-weight', 'bold')
			.text(chartTitle + ' (Contour)');

		console.log('✅ Contour Plot creado');
	}

	function createViolin() {
		if (!svgContainer) return;

		console.log('📊 Creando Violin Plot Mejorado...');

		const processedData = processDataByMode(scatterData);
		const margin = { top: 100, right: 80, bottom: 100, left: 90 };
		const width = svgContainer.clientWidth - margin.left - margin.right;
		const height = 550 - margin.top - margin.bottom;

		const svg = d3.select(svgContainer)
			.html('')
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom);

		// Fondo con gradiente sutil
		const defs = svg.append('defs');
		const bgGradient = defs.append('linearGradient')
			.attr('id', 'violin-bg')
			.attr('x1', '0%').attr('y1', '0%')
			.attr('x2', '0%').attr('y2', '100%');
		bgGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f8fafc');
		bgGradient.append('stop').attr('offset', '100%').attr('stop-color', '#ffffff');

		svg.append('rect')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.attr('fill', 'url(#violin-bg)');

		const g = svg.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const { xAxisLabel, yAxisLabel, chartTitle } = getLabels();

		// Agrupar datos en bins para X (likes)
		const numBins = 8; // Reducido para mejor visualización
		const xExtent = d3.extent(processedData, d => d.x);
		const binWidth = (xExtent[1] - xExtent[0]) / numBins;

		// Crear bins
		const bins = [];
		for (let i = 0; i < numBins; i++) {
			const binStart = xExtent[0] + i * binWidth;
			const binEnd = binStart + binWidth;
			const binData = processedData.filter(d => d.x >= binStart && d.x < binEnd);

			if (binData.length > 0) {
				bins.push({
					x: binStart + binWidth / 2,
					binStart,
					binEnd,
					values: binData.map(d => d.y),
					count: binData.length,
					posts: binData
				});
			}
		}

		// Escalas
		const xScale = d3.scaleLinear()
			.domain(xExtent)
			.range([0, width]);

		const yExtent = d3.extent(processedData, d => d.y);
		const yScale = d3.scaleLinear()
			.domain(yExtent)
			.range([height, 0]);

		const violinWidth = width / (numBins * 1.2);

		// Grid horizontal de referencia
		g.append('g')
			.attr('class', 'grid')
			.call(d3.axisLeft(yScale)
				.ticks(10)
				.tickSize(-width)
				.tickFormat('')
			)
			.selectAll('line')
			.attr('stroke', '#e2e8f0')
			.attr('stroke-dasharray', '2,2')
			.attr('stroke-opacity', 0.7);

		// Dibujar violines con estilo mejorado
		bins.forEach((bin, idx) => {
			// Calcular distribución usando histograma
			const histogram = d3.histogram()
				.domain(yExtent)
				.thresholds(25) // Más suavizado
				(bin.values);

			const maxDensity = d3.max(histogram, d => d.length);
			const densityScale = d3.scaleLinear()
				.domain([0, maxDensity])
				.range([0, violinWidth / 2]);

			// Crear área para el violin
			const area = d3.area()
				.x0(d => xScale(bin.x) - densityScale(d.length))
				.x1(d => xScale(bin.x) + densityScale(d.length))
				.y(d => yScale((d.x0 + d.x1) / 2))
				.curve(d3.curveCatmullRom);

			// Sombra para profundidad
			const shadowFilter = defs.append('filter')
				.attr('id', `violin-shadow-${idx}`)
				.attr('x', '-50%')
				.attr('y', '-50%')
				.attr('width', '200%')
				.attr('height', '200%');

			shadowFilter.append('feGaussianBlur')
				.attr('in', 'SourceAlpha')
				.attr('stdDeviation', 3);

			shadowFilter.append('feOffset')
				.attr('dx', 2)
				.attr('dy', 2)
				.attr('result', 'offsetblur');

			const feMerge = shadowFilter.append('feMerge');
			feMerge.append('feMergeNode');
			feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

			// Dibujar violin con color azul sólido
			g.append('path')
				.datum(histogram)
				.attr('d', area)
				.attr('fill', '#3b82f6')
				.attr('fill-opacity', 0.7)
				.attr('stroke', '#1e40af')
				.attr('stroke-width', 2)
				.attr('filter', `url(#violin-shadow-${idx})`)
				.style('cursor', 'pointer')
				.on('click', () => {
					showPostsFromBin(bin.posts);
				})
				.on('mouseover', function() {
					d3.select(this)
						.attr('fill-opacity', 1)
						.attr('stroke-width', 3);
				})
				.on('mouseout', function() {
					d3.select(this)
						.attr('fill-opacity', 0.8)
						.attr('stroke-width', 2);
				})
				.append('title')
				.text(`Rango: ${Math.round(bin.binStart)}-${Math.round(bin.binEnd)} ${xAxisLabel.toLowerCase()}\nPosts: ${bin.count}\nMediana ${yAxisLabel.toLowerCase()}: ${d3.median(bin.values).toFixed(1)}\n(Click para ver posts)`);

			// Línea central (mediana) más visible
			const median = d3.median(bin.values);
			const q1 = d3.quantile(bin.values.sort(d3.ascending), 0.25);
			const q3 = d3.quantile(bin.values.sort(d3.ascending), 0.75);

			// Box plot interno (cuartiles)
			g.append('rect')
				.attr('x', xScale(bin.x) - 4)
				.attr('y', yScale(q3))
				.attr('width', 8)
				.attr('height', yScale(q1) - yScale(q3))
				.attr('fill', '#ffffff')
				.attr('fill-opacity', 0.9)
				.attr('stroke', '#1e293b')
				.attr('stroke-width', 2)
				.attr('rx', 2);

			// Línea de mediana
			g.append('line')
				.attr('x1', xScale(bin.x) - 4)
				.attr('x2', xScale(bin.x) + 4)
				.attr('y1', yScale(median))
				.attr('y2', yScale(median))
				.attr('stroke', '#dc2626')
				.attr('stroke-width', 3);

			// Punto de mediana
			g.append('circle')
				.attr('cx', xScale(bin.x))
				.attr('cy', yScale(median))
				.attr('r', 4)
				.attr('fill', '#dc2626')
				.attr('stroke', '#ffffff')
				.attr('stroke-width', 2);

			// Label con cantidad de posts
			g.append('text')
				.attr('x', xScale(bin.x))
				.attr('y', height + 25)
				.attr('text-anchor', 'middle')
				.attr('font-size', '11px')
				.attr('font-weight', 'bold')
				.attr('fill', '#3b82f6')
				.text(`n=${bin.count}`);
		});

		// Ejes mejorados
		const xAxis = g.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale).ticks(8));

		xAxis.selectAll('text')
			.attr('fill', '#334155')
			.attr('font-size', '12px');

		xAxis.select('path')
			.attr('stroke', '#64748b')
			.attr('stroke-width', 2);

		g.append('text')
			.attr('x', width / 2)
			.attr('y', height + 60)
			.attr('text-anchor', 'middle')
			.attr('font-size', '15px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text(xAxisLabel);

		const yAxis = g.append('g')
			.call(d3.axisLeft(yScale).ticks(10));

		yAxis.selectAll('text')
			.attr('fill', '#334155')
			.attr('font-size', '12px');

		yAxis.select('path')
			.attr('stroke', '#64748b')
			.attr('stroke-width', 2);

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -65)
			.attr('text-anchor', 'middle')
			.attr('font-size', '15px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text(yAxisLabel + ' (Distribución)');

		// Título
		svg.append('text')
			.attr('x', (width + margin.left + margin.right) / 2)
			.attr('y', 35)
			.attr('text-anchor', 'middle')
			.attr('font-size', '22px')
			.attr('font-weight', 'bold')
			.attr('fill', '#0f172a')
			.text(chartTitle + ' - Violin Plot');

		// Subtítulo explicativo
		svg.append('text')
			.attr('x', (width + margin.left + margin.right) / 2)
			.attr('y', 58)
			.attr('text-anchor', 'middle')
			.attr('font-size', '13px')
			.attr('fill', '#64748b')
			.text(`Distribución de ${yAxisLabel.toLowerCase()} por rangos de ${xAxisLabel.toLowerCase()} | Ancho = densidad`);

		// Leyenda explicativa
		const legend = svg.append('g')
			.attr('transform', `translate(${width + margin.left - 180}, ${margin.top})`);

		legend.append('rect')
			.attr('x', -10)
			.attr('y', -10)
			.attr('width', 190)
			.attr('height', 110)
			.attr('fill', '#ffffff')
			.attr('stroke', '#cbd5e1')
			.attr('stroke-width', 2)
			.attr('rx', 6);

		legend.append('text')
			.attr('x', 85)
			.attr('y', 8)
			.attr('text-anchor', 'middle')
			.attr('font-size', '13px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text('Guía de Lectura');

		// Ejemplo de violin pequeño
		legend.append('path')
			.attr('d', 'M 10,30 L 20,30 L 30,35 L 35,45 L 30,55 L 20,60 L 10,60 L 0,55 L -5,45 L 0,35 Z')
			.attr('fill', '#3b82f6')
			.attr('fill-opacity', 0.7)
			.attr('stroke', '#1e40af')
			.attr('stroke-width', 2);

		legend.append('text')
			.attr('x', 45)
			.attr('y', 48)
			.attr('font-size', '11px')
			.attr('fill', '#334155')
			.text('Ancho = Más posts');

		// Línea de mediana
		legend.append('line')
			.attr('x1', 5)
			.attr('x2', 15)
			.attr('y1', 75)
			.attr('y2', 75)
			.attr('stroke', '#dc2626')
			.attr('stroke-width', 3);

		legend.append('circle')
			.attr('cx', 10)
			.attr('cy', 75)
			.attr('r', 3)
			.attr('fill', '#dc2626')
			.attr('stroke', 'white')
			.attr('stroke-width', 1.5);

		legend.append('text')
			.attr('x', 25)
			.attr('y', 78)
			.attr('font-size', '11px')
			.attr('fill', '#334155')
			.text('Punto rojo = Mediana');

		console.log('✅ Violin Plot mejorado creado');
	}

	function create3DScatter() {
		if (!svgContainer) return;

		console.log('📊 Creando 3D Scatter (Isométrico)...');

		const processedData = processDataByMode(scatterData);
		const width = svgContainer.clientWidth;
		const height = 500; // Aumentado
		const margin = { top: 80, right: 40, bottom: 40, left: 40 };

		const svg = d3.select(svgContainer)
			.html('')
			.append('svg')
			.attr('width', width)
			.attr('height', height);

		const { xAxisLabel, yAxisLabel, chartTitle } = getLabels();

		// Limitar datos para rendimiento
		const limitedData = processedData
			.sort((a, b) => b.engagement - a.engagement)
			.slice(0, 300);

		// Escalas para los tres ejes
		const xExtent = d3.extent(limitedData, d => d.x);
		const yExtent = d3.extent(limitedData, d => d.y);
		const zExtent = d3.extent(limitedData, d => d.engagement);

		const scale3D = 350; // Tamaño del cubo
		const xScale = d3.scaleLinear().domain(xExtent).range([0, scale3D]);
		const yScale = d3.scaleLinear().domain(yExtent).range([0, scale3D]);
		const zScale = d3.scaleLinear().domain(zExtent).range([0, scale3D]);

		// Centro de la visualización
		const centerX = width / 2;
		const centerY = height / 2 + 20;

		// Función de proyección isométrica mejorada
		function project(x, y, z) {
			const angle = Math.PI / 6;
			const scale = 0.6; // Factor de escala
			return {
				x: centerX + (x - y) * Math.cos(angle) * scale,
				y: centerY + (x + y) * Math.sin(angle) * scale - z * 0.5
			};
		}

		// NUEVO: Dibujar grilla 3D en el fondo
		const gridGroup = svg.append('g').attr('class', 'grid');
		const gridSteps = 5;

		// Grilla en el plano XY (piso)
		for (let i = 0; i <= gridSteps; i++) {
			const x = (scale3D / gridSteps) * i;
			const y = (scale3D / gridSteps) * i;

			// Líneas paralelas a X
			const p1 = project(0, y, 0);
			const p2 = project(scale3D, y, 0);
			gridGroup.append('line')
				.attr('x1', p1.x).attr('y1', p1.y)
				.attr('x2', p2.x).attr('y2', p2.y)
				.attr('stroke', '#cbd5e1')
				.attr('stroke-width', 0.5)
				.attr('stroke-dasharray', '2,2');

			// Líneas paralelas a Y
			const p3 = project(x, 0, 0);
			const p4 = project(x, scale3D, 0);
			gridGroup.append('line')
				.attr('x1', p3.x).attr('y1', p3.y)
				.attr('x2', p4.x).attr('y2', p4.y)
				.attr('stroke', '#cbd5e1')
				.attr('stroke-width', 0.5)
				.attr('stroke-dasharray', '2,2');
		}

		// Dibujar cajas 3D para los ejes (frame del cubo)
		const corners = [
			[0, 0, 0], [scale3D, 0, 0], [scale3D, scale3D, 0], [0, scale3D, 0],
			[0, 0, scale3D], [scale3D, 0, scale3D], [scale3D, scale3D, scale3D], [0, scale3D, scale3D]
		];

		const edges = [
			[0,1], [1,2], [2,3], [3,0], // Base
			[4,5], [5,6], [6,7], [7,4], // Top
			[0,4], [1,5], [2,6], [3,7]  // Verticales
		];

		edges.forEach(([i, j]) => {
			const p1 = project(...corners[i]);
			const p2 = project(...corners[j]);
			gridGroup.append('line')
				.attr('x1', p1.x).attr('y1', p1.y)
				.attr('x2', p2.x).attr('y2', p2.y)
				.attr('stroke', '#94a3b8')
				.attr('stroke-width', 2)
				.attr('stroke-opacity', 0.4);
		});

		// Escala de color por engagement (Plasma es más dramático)
		const colorScale = d3.scaleSequential(d3.interpolatePlasma)
			.domain(zExtent);

		// Ordenar puntos por profundidad para correcto rendering
		const sortedData = limitedData
			.map((d, i) => ({
				...d,
				scaledX: xScale(d.x),
				scaledY: yScale(d.y),
				scaledZ: zScale(d.engagement),
				depth: xScale(d.x) + yScale(d.y) - zScale(d.engagement)
			}))
			.sort((a, b) => a.depth - b.depth);

		// NUEVO: Dibujar líneas desde el piso hasta cada punto
		const stems = svg.append('g').attr('class', 'stems');
		sortedData.forEach(d => {
			const base = project(d.scaledX, d.scaledY, 0);
			const top = project(d.scaledX, d.scaledY, d.scaledZ);
			stems.append('line')
				.attr('x1', base.x)
				.attr('y1', base.y)
				.attr('x2', top.x)
				.attr('y2', top.y)
				.attr('stroke', colorScale(d.engagement))
				.attr('stroke-width', 1)
				.attr('stroke-opacity', 0.3)
				.attr('stroke-dasharray', '2,1');
		});

		// Dibujar puntos 3D con tamaño variable
		svg.append('g')
			.selectAll('circle')
			.data(sortedData)
			.enter()
			.append('circle')
			.attr('cx', d => {
				const p = project(d.scaledX, d.scaledY, d.scaledZ);
				return p.x;
			})
			.attr('cy', d => {
				const p = project(d.scaledX, d.scaledY, d.scaledZ);
				return p.y;
			})
			.attr('r', d => Math.min(Math.sqrt(d.engagement) * 0.4 + 2, 10))
			.attr('fill', d => colorScale(d.engagement))
			.attr('fill-opacity', 0.85)
			.attr('stroke', '#fff')
			.attr('stroke-width', 1.5)
			.style('cursor', 'pointer')
			.on('click', (event, d) => {
				showPostsFromBin([d]);
			})
			.on('mouseover', function(event, d) {
				d3.select(this)
					.attr('r', 12)
					.attr('fill-opacity', 1)
					.attr('stroke-width', 3)
					.attr('stroke', '#fbbf24');
			})
			.on('mouseout', function(event, d) {
				d3.select(this)
					.attr('r', Math.min(Math.sqrt(d.engagement) * 0.4 + 2, 10))
					.attr('fill-opacity', 0.85)
					.attr('stroke-width', 1.5)
					.attr('stroke', '#fff');
			})
			.append('title')
			.text(d => `${xAxisLabel}: ${d.x}\n${yAxisLabel}: ${d.y}\nEngagement: ${d.engagement}\n(Click para detalles)`);

		// Etiquetas de ejes mejoradas
		const axisGroup = svg.append('g').attr('class', 'axis-labels');

		// Eje X
		const xEnd = project(scale3D, 0, 0);
		axisGroup.append('text')
			.attr('x', xEnd.x + 15)
			.attr('y', xEnd.y + 5)
			.attr('fill', '#dc2626')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.text(xAxisLabel);

		// Eje Y
		const yEnd = project(0, scale3D, 0);
		axisGroup.append('text')
			.attr('x', yEnd.x - 15)
			.attr('y', yEnd.y + 5)
			.attr('fill', '#16a34a')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.text(yAxisLabel);

		// Eje Z
		const zEnd = project(0, 0, scale3D);
		axisGroup.append('text')
			.attr('x', zEnd.x)
			.attr('y', zEnd.y - 10)
			.attr('fill', '#2563eb')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.attr('text-anchor', 'middle')
			.text('Engagement');

		// Título
		svg.append('text')
			.attr('x', width / 2)
			.attr('y', 30)
			.attr('text-anchor', 'middle')
			.attr('font-size', '18px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text(chartTitle + ' (Vista 3D Isométrica)');

		// Subtítulo con info
		svg.append('text')
			.attr('x', width / 2)
			.attr('y', 50)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', '#64748b')
			.text(`Top ${limitedData.length} posts por engagement | Hover para detalles`);

		// Leyenda de color mejorada
		const legendWidth = 250;
		const legendHeight = 20;
		const legend = svg.append('g')
			.attr('transform', `translate(${width / 2 - legendWidth / 2}, ${height - 30})`);

		const legendScale = d3.scaleLinear()
			.domain(zExtent)
			.range([0, legendWidth]);

		// Gradiente
		const defs = svg.append('defs');
		const gradient = defs.append('linearGradient')
			.attr('id', 'engagement-gradient-3d')
			.attr('x1', '0%')
			.attr('x2', '100%');

		const steps = 20;
		for (let i = 0; i <= steps; i++) {
			const val = zExtent[0] + (zExtent[1] - zExtent[0]) * (i / steps);
			gradient.append('stop')
				.attr('offset', `${(i / steps) * 100}%`)
				.attr('stop-color', colorScale(val));
		}

		legend.append('rect')
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.attr('rx', 4)
			.style('fill', 'url(#engagement-gradient-3d)')
			.attr('stroke', '#64748b')
			.attr('stroke-width', 1);

		legend.append('g')
			.attr('transform', `translate(0,${legendHeight})`)
			.call(d3.axisBottom(legendScale).ticks(5).tickFormat(d3.format('.0f')))
			.selectAll('text')
			.attr('font-size', '11px');

		legend.append('text')
			.attr('x', legendWidth / 2)
			.attr('y', -8)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('font-weight', 'bold')
			.attr('fill', '#334155')
			.text('Engagement Total');

		console.log('✅ 3D Scatter Isométrico mejorado creado');
	}

	function createSunburst() {
		if (!svgContainer) return;

		console.log('📊 Creando Sunburst...');

		const processedData = processDataByMode(scatterData);
		const width = svgContainer.clientWidth;
		const height = 400;
		const radius = Math.min(width, height) / 2 - 40;

		const svg = d3.select(svgContainer)
			.html('')
			.append('svg')
			.attr('width', width)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${width / 2},${height / 2})`);

		const { chartTitle } = getLabels();

		// Categorizar datos por engagement levels
		const engagementLevels = [
			{ name: 'Muy Alto', min: 1000, max: Infinity, color: '#dc2626' },
			{ name: 'Alto', min: 500, max: 1000, color: '#f97316' },
			{ name: 'Medio', min: 100, max: 500, color: '#eab308' },
			{ name: 'Bajo', min: 10, max: 100, color: '#3b82f6' },
			{ name: 'Muy Bajo', min: 0, max: 10, color: '#6b7280' }
		];

		// Agrupar posts por nivel de engagement
		const grouped = engagementLevels.map(level => {
			const posts = processedData.filter(d =>
				d.engagement >= level.min && d.engagement < level.max
			);

			// Sub-dividir por rangos de likes
			const subGroups = [
				{ name: '0-10', min: 0, max: 10 },
				{ name: '10-50', min: 10, max: 50 },
				{ name: '50-200', min: 50, max: 200 },
				{ name: '200+', min: 200, max: Infinity }
			].map(sub => ({
				name: sub.name,
				value: posts.filter(p => p.x >= sub.min && p.x < sub.max).length,
				posts: posts.filter(p => p.x >= sub.min && p.x < sub.max)
			})).filter(s => s.value > 0);

			return {
				name: level.name,
				color: level.color,
				children: subGroups,
				value: posts.length
			};
		}).filter(g => g.value > 0);

		// Crear jerarquía
		const root = d3.hierarchy({ name: 'root', children: grouped })
			.sum(d => d.value)
			.sort((a, b) => b.value - a.value);

		// Crear layout de partición
		const partition = d3.partition()
			.size([2 * Math.PI, radius]);

		partition(root);

		// Escala de color
		const colorScale = d3.scaleOrdinal()
			.domain(engagementLevels.map(l => l.name))
			.range(engagementLevels.map(l => l.color));

		// Arc generator
		const arc = d3.arc()
			.startAngle(d => d.x0)
			.endAngle(d => d.x1)
			.innerRadius(d => d.y0)
			.outerRadius(d => d.y1);

		// Dibujar arcos
		svg.selectAll('path')
			.data(root.descendants().filter(d => d.depth > 0))
			.enter()
			.append('path')
			.attr('d', arc)
			.attr('fill', d => {
				if (d.depth === 1) {
					return colorScale(d.data.name);
				} else {
					const parent = d.parent;
					return d3.color(colorScale(parent.data.name)).brighter(0.5);
				}
			})
			.attr('fill-opacity', d => d.depth === 1 ? 0.8 : 0.6)
			.attr('stroke', 'white')
			.attr('stroke-width', 2)
			.style('cursor', 'pointer')
			.on('click', (event, d) => {
				if (d.data.posts && d.data.posts.length > 0) {
					showPostsFromBin(d.data.posts);
				}
			})
			.on('mouseover', function(event, d) {
				d3.select(this)
					.attr('fill-opacity', 1)
					.attr('stroke-width', 3);
			})
			.on('mouseout', function(event, d) {
				d3.select(this)
					.attr('fill-opacity', d.depth === 1 ? 0.8 : 0.6)
					.attr('stroke-width', 2);
			})
			.append('title')
			.text(d => `${d.data.name}\nPosts: ${d.value}`);

		// Agregar etiquetas para las secciones principales
		svg.selectAll('text')
			.data(root.descendants().filter(d => d.depth === 1 && d.value > 20))
			.enter()
			.append('text')
			.attr('transform', d => {
				const angle = (d.x0 + d.x1) / 2 - Math.PI / 2;
				const radius = (d.y0 + d.y1) / 2;
				return `rotate(${angle * 180 / Math.PI}) translate(${radius},0) rotate(${angle > 0 ? 90 : -90})`;
			})
			.attr('text-anchor', 'middle')
			.attr('font-size', '11px')
			.attr('font-weight', 'bold')
			.attr('fill', 'white')
			.text(d => d.data.name);

		// Título
		svg.append('text')
			.attr('y', -radius - 20)
			.attr('text-anchor', 'middle')
			.attr('font-size', '16px')
			.attr('font-weight', 'bold')
			.text(chartTitle + ' (Sunburst)');

		// Centro con total
		svg.append('circle')
			.attr('r', 50)
			.attr('fill', '#f3f4f6')
			.attr('stroke', '#9ca3af')
			.attr('stroke-width', 2);

		svg.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', '-0.5em')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.text('Total Posts');

		svg.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', '1em')
			.attr('font-size', '18px')
			.attr('font-weight', 'bold')
			.attr('fill', '#3b82f6')
			.text(processedData.length);

		console.log('✅ Sunburst creado');
	}

	function createNetwork() {
		if (!svgContainer) return;

		console.log('📊 Creando Network Graph...');

		const processedData = processDataByMode(scatterData);
		const width = svgContainer.clientWidth;
		const height = 500; // Aumentado para mejor visualización

		const svg = d3.select(svgContainer)
			.html('')
			.append('svg')
			.attr('width', width)
			.attr('height', height);

		const { chartTitle } = getLabels();

		// Limitar a 100 nodos para mejor visualización
		const limitedData = processedData
			.sort((a, b) => b.engagement - a.engagement)
			.slice(0, 100);

		// Agrupar por usuario para crear comunidades
		const userGroups = {};
		limitedData.forEach(d => {
			const user = d.user || 'unknown';
			if (!userGroups[user]) {
				userGroups[user] = [];
			}
			userGroups[user].push(d);
		});

		// Asignar grupos por engagement y usuario
		const engagementThresholds = [0, 20, 100, 500, 2000, Infinity];
		const users = Object.keys(userGroups);
		const userColorMap = {};
		users.forEach((user, i) => {
			userColorMap[user] = i % 10; // Max 10 colores diferentes
		});

		const nodes = limitedData.map((d, i) => {
			// Grupo por engagement
			let engagementGroup = 0;
			for (let j = 0; j < engagementThresholds.length - 1; j++) {
				if (d.engagement >= engagementThresholds[j] && d.engagement < engagementThresholds[j + 1]) {
					engagementGroup = j;
					break;
				}
			}

			return {
				id: i,
				engagement: d.engagement,
				likes: d.x,
				replies: d.y,
				user: d.user || 'unknown',
				group: engagementGroup,
				userGroup: userColorMap[d.user || 'unknown'],
				post: d,
				radius: Math.min(Math.sqrt(d.engagement) * 0.8 + 4, 20)
			};
		});

		// NUEVO: Crear enlaces de manera más inteligente
		const links = [];

		// 1. Conectar posts del mismo usuario (comunidades)
		users.forEach(user => {
			const userNodes = nodes.filter(n => n.user === user);
			for (let i = 0; i < userNodes.length - 1; i++) {
				for (let j = i + 1; j < Math.min(i + 3, userNodes.length); j++) {
					links.push({
						source: userNodes[i].id,
						target: userNodes[j].id,
						value: 0.8,
						type: 'user'
					});
				}
			}
		});

		// 2. Conectar posts con engagement similar
		for (let i = 0; i < nodes.length; i++) {
			// Buscar los 3 nodos más cercanos en engagement
			const similarities = nodes
				.map((n, j) => {
					if (i === j) return null;
					const diff = Math.abs(nodes[i].engagement - n.engagement);
					const maxEng = Math.max(nodes[i].engagement, n.engagement, 1);
					const similarity = 1 - (diff / maxEng);
					return { index: j, similarity };
				})
				.filter(s => s !== null && s.similarity > 0.6)
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, 3);

			similarities.forEach(s => {
				// Evitar duplicados
				const exists = links.some(l =>
					(l.source === i && l.target === s.index) ||
					(l.source === s.index && l.target === i)
				);
				if (!exists) {
					links.push({
						source: i,
						target: s.index,
						value: s.similarity,
						type: 'engagement'
					});
				}
			});
		}

		console.log(`🔗 Creados ${links.length} enlaces entre ${nodes.length} nodos`);

		// Escala de color por grupo de engagement
		const colorScale = d3.scaleOrdinal()
			.domain([0, 1, 2, 3, 4])
			.range(['#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']);

		// Force simulation con parámetros mejorados
		const simulation = d3.forceSimulation(nodes)
			.force('link', d3.forceLink(links)
				.id(d => d.id)
				.distance(d => d.type === 'user' ? 30 : 60)
				.strength(d => d.type === 'user' ? 0.8 : 0.3)
			)
			.force('charge', d3.forceManyBody()
				.strength(-200)
				.distanceMax(250)
			)
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide()
				.radius(d => d.radius + 3)
			)
			.force('x', d3.forceX(width / 2).strength(0.05))
			.force('y', d3.forceY(height / 2).strength(0.05));

		// Dibujar enlaces
		const linkGroup = svg.append('g').attr('class', 'links');

		const link = linkGroup.selectAll('line')
			.data(links)
			.enter()
			.append('line')
			.attr('stroke', d => d.type === 'user' ? '#3b82f6' : '#cbd5e1')
			.attr('stroke-opacity', d => d.type === 'user' ? 0.6 : 0.3)
			.attr('stroke-width', d => d.type === 'user' ? 2 : 1);

		// Dibujar nodos con etiquetas
		const nodeGroup = svg.append('g').attr('class', 'nodes');

		const node = nodeGroup.selectAll('g')
			.data(nodes)
			.enter()
			.append('g')
			.style('cursor', 'pointer')
			.call(d3.drag()
				.on('start', dragstarted)
				.on('drag', dragged)
				.on('end', dragended));

		// Círculos de los nodos
		node.append('circle')
			.attr('r', d => d.radius)
			.attr('fill', d => colorScale(d.group))
			.attr('stroke', '#fff')
			.attr('stroke-width', 2)
			.on('click', (event, d) => {
				showPostsFromBin([d.post]);
			})
			.on('mouseover', function(event, d) {
				// Resaltar nodo
				d3.select(this)
					.attr('r', d.radius * 1.5)
					.attr('stroke-width', 4)
					.attr('stroke', '#fbbf24');

				// Resaltar conexiones
				link
					.attr('stroke-opacity', l => {
						const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
						const targetId = typeof l.target === 'object' ? l.target.id : l.target;
						return (sourceId === d.id || targetId === d.id) ? 1 : 0.1;
					})
					.attr('stroke-width', l => {
						const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
						const targetId = typeof l.target === 'object' ? l.target.id : l.target;
						return (sourceId === d.id || targetId === d.id) ? 3 : 1;
					});

				// Resaltar nodos conectados
				node.selectAll('circle')
					.attr('fill-opacity', n => {
						if (n.id === d.id) return 1;
						const isConnected = links.some(l => {
							const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
							const targetId = typeof l.target === 'object' ? l.target.id : l.target;
							return (sourceId === d.id && targetId === n.id) ||
							       (targetId === d.id && sourceId === n.id);
						});
						return isConnected ? 1 : 0.3;
					});
			})
			.on('mouseout', function(event, d) {
				// Restaurar nodo
				d3.select(this)
					.attr('r', d.radius)
					.attr('stroke-width', 2)
					.attr('stroke', '#fff');

				// Restaurar enlaces
				link
					.attr('stroke-opacity', l => l.type === 'user' ? 0.6 : 0.3)
					.attr('stroke-width', l => l.type === 'user' ? 2 : 1);

				// Restaurar nodos
				node.selectAll('circle')
					.attr('fill-opacity', 1);
			});

		// Tooltip
		node.append('title')
			.text(d => `Usuario: ${d.user}\nEngagement: ${d.engagement}\nLikes: ${d.likes} | Replies: ${d.replies}\n(Click para ver post)`);

		// Etiquetas para nodos importantes (top 10% engagement)
		const topEngagementThreshold = d3.quantile(nodes.map(n => n.engagement).sort((a, b) => b - a), 0.1);
		node.filter(d => d.engagement >= topEngagementThreshold)
			.append('text')
			.attr('dx', d => d.radius + 4)
			.attr('dy', 4)
			.attr('font-size', '10px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text(d => d.engagement);

		// Título
		svg.append('text')
			.attr('x', width / 2)
			.attr('y', 25)
			.attr('text-anchor', 'middle')
			.attr('font-size', '18px')
			.attr('font-weight', 'bold')
			.attr('fill', '#1e293b')
			.text(chartTitle + ' (Red de Posts)');

		// Subtítulo con estadísticas
		svg.append('text')
			.attr('x', width / 2)
			.attr('y', 45)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', '#64748b')
			.text(`${nodes.length} posts | ${links.length} conexiones | ${users.length} usuarios`);

		// Leyenda mejorada
		const legend = svg.append('g')
			.attr('transform', `translate(${width - 180}, 70)`);

		legend.append('rect')
			.attr('x', -10)
			.attr('y', -10)
			.attr('width', 170)
			.attr('height', 130)
			.attr('fill', 'white')
			.attr('stroke', '#e2e8f0')
			.attr('stroke-width', 1)
			.attr('rx', 4);

		const legendData = [
			{ label: 'Muy Bajo (<20)', group: 0 },
			{ label: 'Bajo (20-100)', group: 1 },
			{ label: 'Medio (100-500)', group: 2 },
			{ label: 'Alto (500-2k)', group: 3 },
			{ label: 'Muy Alto (2k+)', group: 4 }
		];

		legendData.forEach((item, i) => {
			const g = legend.append('g')
				.attr('transform', `translate(0, ${i * 22})`);

			g.append('circle')
				.attr('r', 6)
				.attr('fill', colorScale(item.group))
				.attr('stroke', '#fff')
				.attr('stroke-width', 1.5);

			g.append('text')
				.attr('x', 15)
				.attr('y', 5)
				.attr('font-size', '11px')
				.attr('fill', '#334155')
				.text(item.label);
		});

		// Update positions en cada tick
		simulation.on('tick', () => {
			link
				.attr('x1', d => d.source.x)
				.attr('y1', d => d.source.y)
				.attr('x2', d => d.target.x)
				.attr('y2', d => d.target.y);

			node
				.attr('transform', d => {
					// Mantener nodos dentro del canvas
					d.x = Math.max(d.radius + 10, Math.min(width - d.radius - 10, d.x));
					d.y = Math.max(d.radius + 60, Math.min(height - d.radius - 10, d.y));
					return `translate(${d.x},${d.y})`;
				});
		});

		// Drag functions
		function dragstarted(event, d) {
			if (!event.active) simulation.alphaTarget(0.3).restart();
			d.fx = d.x;
			d.fy = d.y;
		}

		function dragged(event, d) {
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragended(event, d) {
			if (!event.active) simulation.alphaTarget(0);
			d.fx = null;
			d.fy = null;
		}

		console.log(`✅ Network Graph creado con ${nodes.length} nodos y ${links.length} enlaces`);
	}

	// Función auxiliar para obtener etiquetas
	function getLabels() {
		let chartTitle, xAxisLabel, yAxisLabel, datasetLabel;

		switch (visualizationMode) {
			case 'likes-vs-replies':
				chartTitle = 'Engagement: Likes vs Replies';
				xAxisLabel = 'Likes';
				yAxisLabel = 'Replies';
				datasetLabel = 'Posts (Likes vs Replies)';
				break;
			case 'engagement-vs-length':
				chartTitle = 'Engagement vs Longitud del Texto';
				xAxisLabel = 'Longitud del Texto (caracteres)';
				yAxisLabel = 'Engagement Total';
				datasetLabel = 'Posts por Longitud';
				break;
			case 'likes-replies-ratio':
				chartTitle = 'Ratio Likes/Replies';
				xAxisLabel = 'Likes';
				yAxisLabel = 'Ratio Likes/Replies';
				datasetLabel = 'Posts - Ratio de Interacción';
				break;
			case 'viral-posts':
				chartTitle = 'Posts Virales (Top 5%)';
				xAxisLabel = 'Likes';
				yAxisLabel = 'Replies';
				datasetLabel = 'Posts con Mayor Engagement';
				break;
			default:
				chartTitle = 'Engagement Distribution';
				xAxisLabel = 'X';
				yAxisLabel = 'Y';
				datasetLabel = 'Posts';
		}

		return { chartTitle, xAxisLabel, yAxisLabel, datasetLabel };
	}

	// Función auxiliar para mostrar posts desde un bin
	function showPostsFromBin(posts) {
		console.log('🔍 showPostsFromBin llamado con', posts.length, 'posts');
		console.log('🔍 Primer post:', posts[0]);

		// Mapear posts procesados a posts originales
		const mappedPosts = posts.map(p => {
			// Si ya es un post original (tiene todas las propiedades)
			if (p.text && p.user_name) {
				return p;
			}
			// Si es un post procesado con postId
			if (p.postId) {
				return originalPosts.find(op => op.id === p.postId);
			}
			// Si tiene la referencia al post
			if (p.post) {
				return p.post;
			}
			// Buscar por likes y replies
			return originalPosts.find(op =>
				parseInt(op.likes || 0) === (p.x || 0) &&
				parseInt(op.replies || 0) === (p.y || 0)
			);
		}).filter(Boolean);

		console.log('✅ Posts mapeados:', mappedPosts.length);

		if (mappedPosts.length > 0) {
			selectedTitle = `${mappedPosts.length} posts en esta área`;
			selectedPosts = mappedPosts;
			showModal = true;
		} else {
			console.error('❌ No se pudieron mapear los posts');
		}
	}

	onMount(() => {
		mounted = true;
		console.log('📊 EngagementScatterChart montado, datos:', data.length);
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

<div class="engagement-scatter-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">💬</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
		</div>
	{:else if isProcessing}
		<div class="worker-processing">
			<div class="spinner"></div>
			<h3>🔧 Procesando Scatter Plot...</h3>
			<p>Analizando {progress}% de los posts</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progress}%"></div>
			</div>
		</div>
	{:else}
		<!-- Canvas para gráficos Chart.js -->
		<canvas bind:this={canvas} class="chart-canvas" class:hidden={chartType !== 'scatter' && chartType !== 'bubble'}></canvas>

		<!-- Contenedor SVG para gráficos D3 -->
		<div bind:this={svgContainer} class="svg-container" class:hidden={chartType === 'scatter' || chartType === 'bubble'}></div>
	{/if}
</div>

<PostDetailsModal
	bind:isOpen={showModal}
	posts={selectedPosts}
	date={selectedTitle}
	on:close={() => showModal = false}
/>

<style>
	.engagement-scatter-container {
		position: relative;
		cursor: pointer;
	}

	.chart-canvas {
		width: 100% !important;
		height: 400px !important;
		max-height: 400px;
		cursor: pointer;
	}

	.svg-container {
		width: 100%;
		height: 400px;
		overflow: visible;
	}

	.hidden {
		display: none;
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

	.worker-processing {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: #666;
		text-align: center;
	}

	.spinner {
		border: 4px solid rgba(52, 152, 219, 0.1);
		border-left: 4px solid #3498db;
		border-radius: 50%;
		width: 50px;
		height: 50px;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.worker-processing h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.worker-processing p {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #999;
	}

	.progress-bar {
		width: 300px;
		height: 8px;
		background-color: #e0e0e0;
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3498db, #2ecc71);
		transition: width 0.3s ease;
	}
</style>