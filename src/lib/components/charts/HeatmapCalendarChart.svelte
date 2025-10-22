<script>
	import { onMount, onDestroy } from 'svelte';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let data = [];
	export let metric = 'posts'; // 'posts' o 'engagement'

	let mounted = false;
	let heatmapData = [];
	let maxValue = 0;
	let minDate = null;
	let maxDate = null;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedDate = '';

	// Web Worker state
	let worker = null;
	let isProcessing = false;
	let processingProgress = 0;

	// Configuración del heatmap
	const cellSize = 15;
	const cellGap = 3;
	const monthLabelHeight = 30;
	const dayLabelWidth = 70; // Aumentado para mostrar fechas completas en modo hora

	// Calcular dimensiones dinámicamente según el modo
	$: {
		if (heatmapData.length > 0 && heatmapData[0].hour !== undefined) {
			// Modo por hora: 24 columnas (horas), N filas (días)
			const days = Math.ceil((maxDate - minDate) / (24 * 60 * 60 * 1000)) + 1;
			svgHeight = (cellSize * days) + (cellGap * (days - 1)) + monthLabelHeight + 20;
			svgWidth = dayLabelWidth + (24 * (cellSize + cellGap)) + 20;
		} else {
			// Modo por día: 7 filas (días de la semana), N columnas (semanas)
			svgHeight = (cellSize * 7) + (cellGap * 6) + monthLabelHeight + 20;
			if (minDate && maxDate) {
				const weeks = Math.ceil((maxDate - minDate) / (7 * 24 * 60 * 60 * 1000)) + 1;
				svgWidth = dayLabelWidth + (weeks * (cellSize + cellGap)) + 20;
			} else {
				svgWidth = 800;
			}
		}
	}

	let svgWidth = 800;
	let svgHeight = 173;

	// Re-run processData when mounted, data, or metric changes
	$: if (mounted && data && data.length > 0) {
		// Reference metric to make it a reactive dependency
		const currentMetric = metric;
		console.log('🔥 HEATMAP: Reactive statement triggered - metric:', currentMetric, 'data:', data.length);
		processDataWithWorker();
	}

	function processDataWithWorker() {
		if (!worker || !data || data.length === 0) return;

		console.log(`🔧 Iniciando procesamiento de ${data.length} posts con Worker...`);
		isProcessing = true;
		processingProgress = 0;

		worker.postMessage({
			posts: data,
			metric: metric,
			chunkSize: 10000
		});
	}

	function processData() {
		console.log('🔥 HEATMAP: processData called with', data?.length, 'posts');

		if (!data || data.length === 0) {
			console.log('🔥 HEATMAP: No data available');
			heatmapData = [];
			return;
		}

		// MUESTRA DE FECHAS para debugging
		console.log('🔥 HEATMAP: Muestra de fechas (primeros 10 posts):');
		data.slice(0, 10).forEach((post, i) => {
			console.log(`  Post ${i}: created="${post.created}"`);
		});

		// Agrupar por fecha
		const dateGroups = {};
		let invalidDates = 0;

		data.forEach(post => {
			if (!post.created) {
				invalidDates++;
				return;
			}

			const dateStr = post.created.split(' ')[0];

			if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(dateStr)) {
				invalidDates++;
				return;
			}

			const date = dateStr.replace(/\//g, '-');

			if (!dateGroups[date]) {
				dateGroups[date] = [];
			}
			dateGroups[date].push(post);
		});

		console.log(`🔥 HEATMAP: ${data.length - invalidDates} posts válidos, ${invalidDates} inválidos`);
		console.log('🔥 HEATMAP: Fechas únicas encontradas:', Object.keys(dateGroups).sort());

		// Encontrar rango de fechas
		const dates = Object.keys(dateGroups).sort();
		if (dates.length === 0) {
			heatmapData = [];
			return;
		}

		minDate = new Date(dates[0]);
		maxDate = new Date(dates[dates.length - 1]);

		// Si hay 7 días o menos, cambiar a granularidad por HORA
		const daysDiff = Math.ceil((maxDate - minDate) / (24 * 60 * 60 * 1000)) + 1;
		const useHourly = daysDiff <= 7;

		console.log(`🔥 HEATMAP: Rango de ${daysDiff} días. Usando granularidad: ${useHourly ? 'HORA' : 'DÍA'}`);

		const processedData = [];

		if (useHourly) {
			// Agrupar por fecha Y hora
			const hourGroups = {};

			data.forEach(post => {
				if (!post.created) return;

				const parts = post.created.split(' ');
				const dateStr = parts[0];
				const timeStr = parts[1];

				if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(dateStr)) return;
				if (!timeStr) return;

				const date = dateStr.replace(/\//g, '-');
				const hour = parseInt(timeStr.split(':')[0]);

				if (isNaN(hour) || hour < 0 || hour > 23) return;

				const key = `${date}-${hour.toString().padStart(2, '0')}`;

				if (!hourGroups[key]) {
					hourGroups[key] = [];
				}
				hourGroups[key].push(post);
			});

			console.log('🔥 HEATMAP: Grupos por hora:', Object.keys(hourGroups).length);

			// Generar datos para cada hora de cada día
			let currentDate = new Date(minDate);

			while (currentDate <= maxDate) {
				const dateStr = currentDate.toISOString().split('T')[0];

				for (let hour = 0; hour < 24; hour++) {
					const key = `${dateStr}-${hour.toString().padStart(2, '0')}`;
					const posts = hourGroups[key] || [];

					let value = 0;
					if (metric === 'posts') {
						value = posts.length;
					} else if (metric === 'engagement') {
						value = posts.reduce((sum, post) => {
							return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
						}, 0);
					}

					// Crear fecha con hora específica
					const dateWithHour = new Date(currentDate);
					dateWithHour.setHours(hour, 0, 0, 0);

					processedData.push({
						date: dateWithHour,
						dateStr: `${dateStr} ${hour.toString().padStart(2, '0')}:00`,
						value: value,
						posts: posts,
						hour: hour,
						dayDate: dateStr
					});
				}

				currentDate.setDate(currentDate.getDate() + 1);
			}
		} else {
			// Calcular métrica por día (comportamiento original)
			let currentDate = new Date(minDate);

			while (currentDate <= maxDate) {
				const dateStr = currentDate.toISOString().split('T')[0];
				const posts = dateGroups[dateStr] || [];

				let value = 0;
				if (metric === 'posts') {
					value = posts.length;
				} else if (metric === 'engagement') {
					value = posts.reduce((sum, post) => {
						return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
					}, 0);
				}

				processedData.push({
					date: new Date(currentDate),
					dateStr: dateStr,
					value: value,
					posts: posts
				});

				currentDate.setDate(currentDate.getDate() + 1);
			}
		}

		heatmapData = processedData;
		maxValue = Math.max(...processedData.map(d => d.value));

		console.log('🔥 HEATMAP FINAL:', {
			totalDays: heatmapData.length,
			maxValue,
			minDate,
			maxDate,
			svgWidth,
			svgHeight,
			sampleData: heatmapData.slice(0, 3)
		});
	}

	function getColor(value) {
		if (value === 0) return '#ebedf0';

		const intensity = Math.min(value / maxValue, 1);

		// Colores chilenos: de azul claro a azul oscuro, luego rojo
		if (intensity < 0.25) {
			return '#c6daf7'; // Azul muy claro
		} else if (intensity < 0.5) {
			return '#6ba3d8'; // Azul claro
		} else if (intensity < 0.75) {
			return '#2d5f9f'; // Azul oscuro
		} else {
			return '#d32f2f'; // Rojo chileno
		}
	}

	function getWeekNumber(date) {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
	}

	function handleCellClick(day) {
		if (day.posts.length > 0) {
			selectedDate = day.date.toLocaleDateString('es-CL', {
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});
			selectedPosts = day.posts;
			showModal = true;
		}
	}

	onMount(() => {
		mounted = true;

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/heatmap.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;

					// Convertir fechas de strings a objetos Date
					const processedHeatmapData = workerData.heatmapData.map(item => ({
						...item,
						date: new Date(item.date)
					}));

					heatmapData = processedHeatmapData;
					minDate = new Date(workerData.minDate);
					maxDate = new Date(workerData.maxDate);
					maxValue = Math.max(...processedHeatmapData.map(d => d.value), 0);

					console.log(`✅ Worker completado en ${duration}ms - ${workerData.stats.totalDataPoints} puntos de datos`);
					console.log('🔥 HEATMAP FINAL:', {
						totalDays: heatmapData.length,
						maxValue,
						minDate,
						maxDate,
						svgWidth,
						svgHeight,
						sampleData: heatmapData.slice(0, 3)
					});
				}
			};

			worker.onerror = function(error) {
				console.error('❌ Error en Worker:', error);
				isProcessing = false;
			};
		}

		if (data.length > 0) {
			processDataWithWorker();
		}
	});

	onDestroy(() => {
		if (worker) {
			worker.terminate();
		}
	});
</script>

<div class="heatmap-container">
	<div style="background: #f0f0f0; padding: 0.5rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
		DEBUG: data.length={data?.length}, heatmapData.length={heatmapData.length}, mounted={mounted}
	</div>

	{#if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Procesando calendario de actividad...</h3>
			<p>{processingProgress}% completado</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {processingProgress}%"></div>
			</div>
		</div>
	{:else if heatmapData.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">📅</div>
			<h3>No hay datos disponibles para el heatmap</h3>
			<p>Posts recibidos: {data?.length || 0}</p>
			<p>¿Componente montado? {mounted ? 'Sí' : 'No'}</p>
		</div>
	{:else}
		<div class="heatmap-content">
			<div class="heatmap-header">
				<h4>
					{metric === 'posts' ? 'Posts por día' : 'Engagement por día'}
				</h4>
				<div class="legend">
					<span class="legend-label">Menos</span>
					<div class="legend-cell" style="background-color: #ebedf0;"></div>
					<div class="legend-cell" style="background-color: #c6daf7;"></div>
					<div class="legend-cell" style="background-color: #6ba3d8;"></div>
					<div class="legend-cell" style="background-color: #2d5f9f;"></div>
					<div class="legend-cell" style="background-color: #d32f2f;"></div>
					<span class="legend-label">Más</span>
				</div>
			</div>

			<div class="heatmap-grid">
				<svg width={svgWidth} height={svgHeight}>
					{#if heatmapData.length > 0 && heatmapData[0].hour !== undefined}
						<!-- Labels para modo por hora -->
						<!-- Labels de días (eje Y) -->
						<g transform="translate({dayLabelWidth}, {monthLabelHeight})">
							{#each Array.from({ length: Math.ceil((maxDate - minDate) / (24 * 60 * 60 * 1000)) + 1 }) as _, dayIndex}
								{@const dayDate = new Date(minDate.getTime() + (dayIndex * 24 * 60 * 60 * 1000))}
								{@const y = dayIndex * (cellSize + cellGap)}
								<text x="-5" {y} dy="0.9em" class="day-label">
									{dayDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
								</text>
							{/each}
						</g>

						<!-- Labels de horas (eje X) -->
						<g transform="translate({dayLabelWidth}, 10)">
							{#each [0, 3, 6, 9, 12, 15, 18, 21] as hour}
								{@const x = hour * (cellSize + cellGap)}
								<text {x} y="0" class="month-label" style="font-size: 10px;">
									{hour}h
								</text>
							{/each}
						</g>
					{:else}
						<!-- Labels de días de la semana (modo calendario) -->
						<g transform="translate({dayLabelWidth}, {monthLabelHeight})">
							<text x="-5" y={cellSize * 1 + cellGap} dy="0.5em" class="day-label">Lun</text>
							<text x="-5" y={cellSize * 3 + cellGap * 3} dy="0.5em" class="day-label">Mié</text>
							<text x="-5" y={cellSize * 5 + cellGap * 5} dy="0.5em" class="day-label">Vie</text>
						</g>
					{/if}

					<!-- Celdas del heatmap -->
					<g transform="translate({dayLabelWidth}, {monthLabelHeight})">
						{#each heatmapData as day, i}
							{#if day.hour !== undefined}
								<!-- Modo por hora: cada fila es un día, cada columna una hora -->
								{@const daysDiff = Math.floor((new Date(day.dayDate) - minDate) / (24 * 60 * 60 * 1000))}
								{@const x = day.hour * (cellSize + cellGap)}
								{@const y = daysDiff * (cellSize + cellGap)}

								<rect
									{x}
									{y}
									width={cellSize}
									height={cellSize}
									fill={getColor(day.value)}
									class="heatmap-cell"
									on:click={() => handleCellClick(day)}
									on:keydown={(e) => e.key === 'Enter' && handleCellClick(day)}
									role="button"
									tabindex="0"
									data-date={day.dateStr}
									data-value={day.value}
								>
									<title>
										{day.dateStr}: {day.value} {metric === 'posts' ? 'posts' : 'engagement'}
									</title>
								</rect>
							{:else}
								<!-- Modo por día: calendario estándar -->
								{@const dayOfWeek = (day.date.getDay() + 6) % 7}
								{@const weekNum = Math.floor((day.date - minDate) / (7 * 24 * 60 * 60 * 1000))}
								{@const x = weekNum * (cellSize + cellGap)}
								{@const y = dayOfWeek * (cellSize + cellGap)}

								<rect
									{x}
									{y}
									width={cellSize}
									height={cellSize}
									fill={getColor(day.value)}
									class="heatmap-cell"
									on:click={() => handleCellClick(day)}
									on:keydown={(e) => e.key === 'Enter' && handleCellClick(day)}
									role="button"
									tabindex="0"
									data-date={day.dateStr}
									data-value={day.value}
								>
									<title>
										{day.date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
										: {day.value} {metric === 'posts' ? 'posts' : 'engagement'}
									</title>
								</rect>
							{/if}
						{/each}
					</g>

					<!-- Labels de meses (solo para modo calendario) -->
					{#if heatmapData.length === 0 || heatmapData[0].hour === undefined}
						<g transform="translate({dayLabelWidth}, 10)">
							{#each Array.from({ length: 12 }) as _, monthIndex}
								{@const monthDate = new Date(minDate.getFullYear(), monthIndex, 1)}
								{#if monthDate >= minDate && monthDate <= maxDate}
									{@const weekNum = Math.floor((monthDate - minDate) / (7 * 24 * 60 * 60 * 1000))}
									{@const x = weekNum * (cellSize + cellGap)}
									<text {x} y="0" class="month-label">
										{monthDate.toLocaleDateString('es-CL', { month: 'short' })}
									</text>
								{/if}
							{/each}
						</g>
					{/if}
				</svg>
			</div>

			<div class="stats">
				<p>
					<strong>Total:</strong> {heatmapData.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
					{metric === 'posts' ? 'posts' : 'interactions'}
				</p>
				<p>
					<strong>Promedio por día:</strong> {(heatmapData.reduce((sum, d) => sum + d.value, 0) / heatmapData.length).toFixed(1)}
				</p>
				<p>
					<strong>Días con actividad:</strong> {heatmapData.filter(d => d.value > 0).length} / {heatmapData.length}
				</p>
			</div>
		</div>
	{/if}
</div>

<PostDetailsModal
	bind:isOpen={showModal}
	posts={selectedPosts}
	date={selectedDate}
	on:close={() => showModal = false}
/>

<style>
	.heatmap-container {
		position: relative;
		width: 100%;
		min-height: 300px;
	}

	.heatmap-content {
		padding: 1rem;
	}

	.heatmap-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.heatmap-header h4 {
		margin: 0;
		font-size: 1.1rem;
		color: #333;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.85rem;
		color: #666;
	}

	.legend-label {
		margin: 0 4px;
	}

	.legend-cell {
		width: 12px;
		height: 12px;
		border: 1px solid rgba(27, 31, 35, 0.06);
		border-radius: 2px;
	}

	.heatmap-grid {
		overflow-x: auto;
		overflow-y: hidden;
		padding: 0.5rem 0;
	}

	.heatmap-cell {
		cursor: pointer;
		transition: all 0.2s ease;
		rx: 2px;
		stroke: rgba(27, 31, 35, 0.06);
		stroke-width: 1;
	}

	.heatmap-cell:hover {
		stroke: #333;
		stroke-width: 2;
		transform: scale(1.1);
	}

	.day-label {
		font-size: 10px;
		fill: #666;
		text-anchor: end;
	}

	.month-label {
		font-size: 11px;
		fill: #666;
		font-weight: 500;
	}

	.stats {
		margin-top: 1.5rem;
		display: flex;
		gap: 2rem;
		font-size: 0.9rem;
		color: #555;
		flex-wrap: wrap;
	}

	.stats p {
		margin: 0;
	}

	.stats strong {
		color: #333;
		font-weight: 600;
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
