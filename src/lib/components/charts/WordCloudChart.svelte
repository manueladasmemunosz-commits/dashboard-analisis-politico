<script>
	import { onMount, tick } from 'svelte';
	import cloud from 'd3-cloud';
	import { select, scaleOrdinal, scalePow, min, max } from 'd3';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';
	import { wordCloudData } from '$lib/stores/dashboard.js';

	export let limit = 80; // Default 80 palabras para nube densa

	let container;
	let mounted = false;
	let viewMode = 'cloud'; // 'cloud' o 'table'
	let isRendering = false;
	let renderProgress = 0;
	let colorPalette = 'chileno'; // 'chileno', 'azules', 'calidos', 'multicolor'

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Datos procesados para la tabla
	let processedWords = [];

	// Sistema de exclusión de palabras (solo para word cloud, no afecta otros gráficos)
	let excludedWords = new Set();

	// Estado de ordenamiento de tabla
	let sortBy = 'frequency'; // 'frequency', 'avgEngagement', 'totalEngagement'
	let sortOrder = 'desc'; // 'asc', 'desc'

	// Búsqueda en tabla
	let searchTerm = '';

	console.log('☁️ WordCloudChart component loaded');

	// Definir paletas de colores
	const paletas = {
		chileno: {
			nombre: '🇨🇱 Chileno',
			colores: ["#0039A6", "#3b82f6", "#D52B1E", "#ef4444", "#60a5fa"],
			descripcion: 'Colores de la bandera chilena'
		},
		azules: {
			nombre: '💙 Azules',
			colores: ["#1e3a8a", "#1e40af", "#3b82f6", "#60a5fa", "#93c5fd"],
			descripcion: 'Tonos azules profesionales'
		},
		calidos: {
			nombre: '🔥 Cálidos',
			colores: ["#dc2626", "#ef4444", "#f97316", "#fb923c", "#fbbf24"],
			descripcion: 'Rojos, naranjas y amarillos'
		},
		multicolor: {
			nombre: '🌈 Multicolor',
			colores: ["#dc2626", "#f97316", "#eab308", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"],
			descripcion: 'Arcoíris de colores vibrantes'
		}
	};

	// Función para obtener colores según paleta seleccionada
	function getColorPalette() {
		return paletas[colorPalette].colores;
	}

	// Reactive: actualizar cuando cambien los datos, el límite o la paleta
	$: if (mounted && container && $wordCloudData.words && $wordCloudData.words.length > 0 && !$wordCloudData.isProcessing) {
		renderWordCloudAsync();
	}

	$: if (mounted && colorPalette && $wordCloudData.words && $wordCloudData.words.length > 0 && !$wordCloudData.isProcessing) {
		renderWordCloudAsync();
	}

	$: if (mounted && limit && $wordCloudData.words && $wordCloudData.words.length > 0 && !$wordCloudData.isProcessing) {
		renderWordCloudAsync();
	}

	// Renderizar Word Cloud de forma asíncrona con loading
	async function renderWordCloudAsync() {
		if (isRendering) return;

		isRendering = true;
		renderProgress = 0;

		// Pequeño delay para mostrar el loading spinner
		await new Promise(resolve => setTimeout(resolve, 100));

		try {
			await createWordCloud();
		} catch (error) {
			console.error('❌ Error renderizando Word Cloud:', error);
		} finally {
			isRendering = false;
			renderProgress = 100;
		}
	}

	function createWordCloud() {
		return new Promise((resolve, reject) => {
			console.log('🔍 Debug - wordCloudData:', {
				hasWords: !!$wordCloudData.words,
				wordsLength: $wordCloudData.words?.length || 0,
				isProcessing: $wordCloudData.isProcessing,
				hasContainer: !!container
			});

			if (!container || !$wordCloudData.words || $wordCloudData.words.length === 0) {
				console.warn('⚠️ No se puede renderizar Word Cloud:', {
					container: !!container,
					words: $wordCloudData.words?.length || 0
				});
				resolve();
				return;
			}

			console.log('☁️ Renderizando Word Cloud con d3-cloud (rectangular)...');

			// Limpiar contenedor
			container.innerHTML = '';

			// Filtrar palabras excluidas y tomar top N
			const availableWords = $wordCloudData.words.filter(w => !excludedWords.has(w.text));
			const topWords = availableWords.slice(0, limit);

			console.log(`☁️ Renderizando ${topWords.length} palabras (${excludedWords.size} excluidas)`);

			if (topWords.length === 0) {
				console.log('⚠️ No hay palabras para renderizar');
				resolve();
				return;
			}

			// Preparar datos con información completa para click handlers
			const wordData = topWords.map(wordInfo => ({
				text: wordInfo.text,
				count: wordInfo.value,
				frequency: wordInfo.value,
				posts: $wordCloudData.wordPosts[wordInfo.text] || [],
				totalEngagement: wordInfo.engagement,
				avgEngagement: wordInfo.avgEngagement
			}));

			// Guardar para la vista de tabla
			processedWords = wordData.map(w => ({
				text: w.text,
				size: w.count, // Temporary, se calculará después
				frequency: w.frequency,
				posts: w.posts,
				totalEngagement: w.totalEngagement,
				avgEngagement: w.avgEngagement
			}));

			// Dimensiones
			const width = container.clientWidth || 900;
			const height = 500;

			console.log(`☁️ Canvas dimensions: ${width}x${height}`);

			// Escala de tamaños usando escala potencial para mayor diferenciación visual
			const minCount = min(wordData, d => d.count);
			const maxCount = max(wordData, d => d.count);
			const fontSizeScale = scalePow()
				.exponent(0.6) // Entre raíz cuadrada y lineal - balance entre diferenciación y legibilidad
				.domain([minCount, maxCount])
				.range([14, 85]) // Mayor rango para más contraste visual (71px de diferencia)
				.clamp(true);

			// Obtener paleta de colores seleccionada
			const coloresSeleccionados = getColorPalette();
			const fillColor = scaleOrdinal(coloresSeleccionados);

			// Timeout para prevenir loops infinitos
			const timeoutId = setTimeout(() => {
				console.warn('⚠️ Timeout: d3-cloud tardó demasiado');
				resolve();
			}, 10000);

			// Crear layout RECTANGULAR como nubecita.png
			const layout = cloud()
				.size([width, height])
				.words(wordData.map(d => ({
					text: d.text,
					size: fontSizeScale(d.count),
					count: d.count,
					frequency: d.frequency,
					posts: d.posts,
					totalEngagement: d.totalEngagement,
					avgEngagement: d.avgEngagement
				})))
				.padding(1) // Padding balanceado
				.rotate(() => {
					// Rotación condicional según cantidad de palabras
					if (limit < 50) {
						// Menos de 50 palabras: solo horizontales para mejor legibilidad
						return 0;
					} else {
						// 50+ palabras: rotaciones variadas para mejor aprovechamiento del espacio
						const r = Math.random();
						if (r < 0.8) return 0;        // 80% horizontales
						else if (r < 0.85) return -15; // 5% inclinadas izquierda
						else if (r < 0.9) return 15;   // 5% inclinadas derecha
						else return 90;                // 10% verticales
					}
				})
				.spiral("rectangular") // Layout rectangular
				.font("Impact") // Fuente compacta
				.fontSize(d => d.size)
				.on("end", draw);

			layout.start();

			function draw(words) {
				clearTimeout(timeoutId);
				console.log(`✅ d3-cloud terminó: ${words.length}/${wordData.length} palabras renderizadas`);

				// Crear SVG
				const svg = select(container)
					.append('svg')
					.attr('width', width)
					.attr('height', height)
					.attr('class', 'wordcloud-svg');

				const g = svg.append('g')
					.attr('transform', `translate(${width / 2},${height / 2})`);

				// Crear palabras con colores seleccionados
				const text = g.selectAll('text')
					.data(words)
					.enter()
					.append('text')
					.style('font-size', d => `${d.size}px`)
					.style('font-family', 'Impact, Arial Black, sans-serif')
					.style('font-weight', (d, i) => i < 10 ? '900' : '700')
					.style('fill', (d, i) => fillColor(i))
					.style('cursor', 'pointer')
					.attr('text-anchor', 'middle')
					.attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
					.text(d => d.text)
					.on('click', function(event, d) {
						// Mostrar modal con posts
						selectedTitle = `Posts con la palabra "${d.text}" (${d.frequency} veces)`;
						selectedPosts = d.posts;
						showModal = true;
						console.log('☁️ Click en palabra:', d.text, '-', d.frequency, 'posts');
					})
					.on('mouseover', function(event, d) {
						select(this)
							.style('fill', '#dc2626')
							.style('text-decoration', 'underline');
					})
					.on('mouseout', function(event, d) {
						const index = words.indexOf(d);
						select(this)
							.style('fill', fillColor(index))
							.style('text-decoration', 'none');
					});

				// Tooltips
				text.append('title')
					.text(d => `${d.text}\nFrecuencia: ${d.frequency} posts\nEngagement promedio: ${d.avgEngagement}\nEngagement total: ${d.totalEngagement.toLocaleString()}\n\n(Click para ver posts)`);

				console.log('☁️ Word Cloud creado con d3-cloud rectangular');
				resolve();
			}
		});
	}

	// Funciones de gestión de palabras
	function excludeWord(word) {
		excludedWords.add(word);
		excludedWords = excludedWords; // Trigger reactivity
		renderWordCloudAsync(); // Re-renderizar
	}

	function includeWord(word) {
		excludedWords.delete(word);
		excludedWords = excludedWords; // Trigger reactivity
		renderWordCloudAsync(); // Re-renderizar
	}

	function resetExcludedWords() {
		excludedWords.clear();
		excludedWords = excludedWords; // Trigger reactivity
		renderWordCloudAsync(); // Re-renderizar
	}

	// Funciones de tabla
	function sortTable(column) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
		} else {
			sortBy = column;
			sortOrder = 'desc';
		}
	}

	// Computed: palabras filtradas y ordenadas para tabla
	$: filteredTableWords = processedWords
		.filter(w => {
			if (searchTerm) {
				return w.text.toLowerCase().includes(searchTerm.toLowerCase());
			}
			return true;
		})
		.sort((a, b) => {
			let aVal, bVal;
			if (sortBy === 'frequency') {
				aVal = a.frequency;
				bVal = b.frequency;
			} else if (sortBy === 'avgEngagement') {
				aVal = a.avgEngagement;
				bVal = b.avgEngagement;
			} else {
				aVal = a.totalEngagement;
				bVal = b.totalEngagement;
			}
			return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
		});

	onMount(async () => {
		mounted = true;
		console.log('☁️ WordCloudChart montado');

		// Esperar a que Svelte complete el renderizado del DOM
		await tick();
		console.log('☁️ Tick completado, DOM actualizado');

		// Si ya hay datos cuando se monta, renderizar inmediatamente
		if ($wordCloudData.words && $wordCloudData.words.length > 0 && !$wordCloudData.isProcessing) {
			console.log(`☁️ Datos ya disponibles al montar: ${$wordCloudData.words.length} palabras`);

			// Esperar un frame adicional para asegurar que bind:this se ejecutó
			await tick();

			if (container) {
				console.log('✅ Container disponible, iniciando renderizado...');
				renderWordCloudAsync();
			} else {
				console.error('❌ Container aún no disponible después de tick()');
				console.log('viewMode:', viewMode);
				console.log('isRendering:', isRendering);
				console.log('$wordCloudData.words.length:', $wordCloudData.words.length);
			}
		}
	});
</script>

<div class="wordcloud-wrapper">
	<!-- Indicador de procesamiento del Worker -->
	{#if $wordCloudData.isProcessing}
		<div class="worker-processing">
			<div class="processing-content">
				<div class="spinner"></div>
				<h3>🔧 Procesando Word Cloud...</h3>
				<p>Analizando {$wordCloudData.progress}% de los posts</p>
				<div class="progress-bar">
					<div class="progress-fill" style="width: {$wordCloudData.progress}%"></div>
				</div>
				<p class="processing-hint">La UI sigue funcional mientras procesamos en segundo plano</p>
			</div>
		</div>
	{/if}

	<!-- Toggle de vistas y controles -->
	<div class="view-toggle">
		<div class="toggle-buttons">
			<button
				class="toggle-btn {viewMode === 'cloud' ? 'active' : ''}"
				on:click={() => viewMode = 'cloud'}
			>
				☁️ Nube Visual
			</button>
			<button
				class="toggle-btn {viewMode === 'table' ? 'active' : ''}"
				on:click={() => viewMode = 'table'}
			>
				📊 Vista Tabla
			</button>
		</div>

		<!-- Controles de nube -->
		{#if viewMode === 'cloud'}
			<div class="cloud-controls">
				<!-- Slider de límite de palabras -->
				<div class="slider-control">
					<label for="word-limit" class="slider-label">
						☁️ Palabras: <strong>{limit}</strong>
					</label>
					<input
						id="word-limit"
						type="range"
						min="10"
						max="150"
						step="5"
						bind:value={limit}
						class="word-slider"
					/>
					<div class="slider-values">
						<span class="slider-min">10</span>
						<span class="slider-max">150</span>
					</div>
				</div>

				<!-- Selector de paleta de colores -->
				<div class="palette-selector">
					<label for="palette-select" class="palette-label">🎨 Paleta:</label>
					<select id="palette-select" bind:value={colorPalette} class="palette-select">
						{#each Object.entries(paletas) as [key, palette]}
							<option value={key}>{palette.nombre}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

		{#if excludedWords.size > 0}
			<button class="reset-btn" on:click={resetExcludedWords}>
				🔄 Restaurar {excludedWords.size} palabra{excludedWords.size > 1 ? 's' : ''}
			</button>
		{/if}
	</div>

	<!-- Leyenda de colores dinámica -->
	{#if viewMode === 'cloud' && $wordCloudData.words.length > 0}
		<div class="color-legend">
			<span class="legend-title">{paletas[colorPalette].descripcion}:</span>
			{#each getColorPalette() as color, i}
				<span class="legend-item">
					<span class="dot" style="background: {color}"></span>
				</span>
			{/each}
			<span class="legend-hint">
				Layout rectangular • Fuente Impact (14-85px) • Escala potencial •
				{limit < 50 ? 'Solo horizontales' : 'Rotaciones mixtas'}
			</span>
		</div>
	{/if}

	<div class="wordcloud-container">
		{#if $wordCloudData.words.length === 0}
			<div class="no-data-message">
				<div class="no-data-icon">☁️</div>
				<h3>No hay datos disponibles</h3>
				<p>No se encontraron posts con los filtros seleccionados</p>
			</div>
		{:else if viewMode === 'cloud'}
			<!-- Canvas siempre presente cuando viewMode es 'cloud' -->
			<div bind:this={container} class="wordcloud-canvas" style="display: {isRendering ? 'none' : 'flex'}"></div>

			{#if isRendering}
				<div class="loading-container">
					<div class="spinner"></div>
					<p class="loading-text">☁️ Renderizando nube de palabras...</p>
					<p class="loading-subtext">Procesando {$wordCloudData.words.length} palabras únicas</p>
				</div>
			{/if}
		{:else}
			<!-- Vista de tabla -->
			<div class="table-view">
				<!-- Búsqueda en tabla -->
				<div class="table-controls">
					<input
						type="text"
						class="search-input"
						placeholder="🔍 Buscar palabra..."
						bind:value={searchTerm}
					/>
					{#if searchTerm}
						<span class="search-results">{filteredTableWords.length} resultado{filteredTableWords.length !== 1 ? 's' : ''}</span>
					{/if}
				</div>

				<table class="words-table">
					<thead>
						<tr>
							<th>#</th>
							<th>Palabra</th>
							<th class="sortable" on:click={() => sortTable('frequency')}>
								Frecuencia {sortBy === 'frequency' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
							</th>
							<th class="sortable" on:click={() => sortTable('avgEngagement')}>
								Eng. Prom. {sortBy === 'avgEngagement' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
							</th>
							<th class="sortable" on:click={() => sortTable('totalEngagement')}>
								Eng. Total {sortBy === 'totalEngagement' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
							</th>
							<th>Acciones</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredTableWords.slice(0, 100) as word, i}
							{@const isExcluded = excludedWords.has(word.text)}
							{@const originalIndex = processedWords.indexOf(word)}
							<tr class="table-row {originalIndex < 5 ? 'critical' : originalIndex < 15 ? 'important' : originalIndex < 30 ? 'relevant' : ''} {isExcluded ? 'excluded' : ''}">
								<td class="rank">#{originalIndex + 1}</td>
								<td class="word-cell">
									<span class="word-text" style="opacity: {isExcluded ? 0.4 : 1}">{word.text}</span>
									{#if isExcluded}
										<span class="excluded-badge">Excluida</span>
									{/if}
								</td>
								<td class="freq">{word.frequency}</td>
								<td class="avg-eng">{word.avgEngagement}</td>
								<td class="total-eng">{word.totalEngagement.toLocaleString()}</td>
								<td class="action">
									<div class="action-buttons">
										{#if isExcluded}
											<button
												class="include-btn"
												on:click={() => includeWord(word.text)}
												title="Restaurar palabra en la nube"
											>
												✓ Incluir
											</button>
										{:else}
											<button
												class="exclude-btn"
												on:click={() => excludeWord(word.text)}
												title="Ocultar palabra de la nube"
											>
												✕ Excluir
											</button>
										{/if}
										<button
											class="view-btn-small"
											on:click={() => {
												selectedTitle = `Posts con la palabra "${word.text}" (${word.frequency} veces)`;
												selectedPosts = word.posts;
												showModal = true;
											}}
											title="Ver posts con esta palabra"
										>
											👁️
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<PostDetailsModal
	bind:isOpen={showModal}
	posts={selectedPosts}
	date={selectedTitle}
	on:close={() => showModal = false}
/>

<style>
	.wordcloud-wrapper {
		width: 100%;
		position: relative;
		min-height: 500px;
	}

	.worker-processing {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.98);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		border-radius: 8px;
	}

	.processing-content {
		text-align: center;
		padding: 2rem;
		max-width: 500px;
	}

	.spinner {
		width: 60px;
		height: 60px;
		border: 4px solid #e2e8f0;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1.5rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.processing-content h3 {
		color: #1e40af;
		margin-bottom: 0.5rem;
		font-size: 1.2rem;
	}

	.processing-content p {
		color: #64748b;
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: #e2e8f0;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #2563eb);
		transition: width 0.3s ease;
	}

	.processing-hint {
		font-size: 0.85rem;
		color: #94a3b8;
		font-style: italic;
	}

	.view-toggle {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
	}

	.toggle-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.toggle-btn {
		padding: 0.5rem 1.5rem;
		border: 2px solid #cbd5e1;
		background: white;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 600;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.toggle-btn:hover {
		border-color: #1e40af;
		background: #dbeafe;
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(30, 64, 175, 0.1);
	}

	.toggle-btn.active {
		background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
		color: white;
		border-color: #1e40af;
		box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
	}

	/* Controles de nube */
	.cloud-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	/* Slider de palabras */
	.slider-control {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.5rem 1rem;
		background: white;
		border-radius: 8px;
		border: 2px solid #cbd5e1;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		min-width: 200px;
	}

	.slider-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: #475569;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.slider-label strong {
		color: #1e40af;
		font-size: 1.1rem;
		min-width: 35px;
		text-align: right;
	}

	.word-slider {
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(90deg, #3b82f6 0%, #1e40af 50%, #dc2626 100%);
		outline: none;
		-webkit-appearance: none;
		cursor: pointer;
	}

	.word-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		border: 3px solid #1e40af;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(30, 64, 175, 0.3);
		transition: all 0.3s;
	}

	.word-slider::-webkit-slider-thumb:hover {
		transform: scale(1.2);
		box-shadow: 0 4px 12px rgba(30, 64, 175, 0.5);
	}

	.word-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		border: 3px solid #1e40af;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(30, 64, 175, 0.3);
		transition: all 0.3s;
	}

	.word-slider::-moz-range-thumb:hover {
		transform: scale(1.2);
		box-shadow: 0 4px 12px rgba(30, 64, 175, 0.5);
	}

	.slider-values {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 600;
		margin-top: -2px;
	}

	/* Selector de paleta */
	.palette-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: white;
		border-radius: 8px;
		border: 2px solid #cbd5e1;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.palette-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: #475569;
		white-space: nowrap;
	}

	.palette-select {
		padding: 0.4rem 0.8rem;
		border: 2px solid #cbd5e1;
		border-radius: 6px;
		background: white;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s;
		color: #1e40af;
	}

	.palette-select:hover {
		border-color: #1e40af;
		background: #f1f5f9;
	}

	.palette-select:focus {
		outline: none;
		border-color: #1e40af;
		box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
	}

	.color-legend {
		display: flex;
		gap: 1rem;
		justify-content: center;
		align-items: center;
		margin-bottom: 1rem;
		padding: 1rem 1.5rem;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(219, 234, 254, 0.4) 100%);
		border-radius: 12px;
		font-size: 0.9rem;
		font-weight: 500;
		border: 1px solid #e2e8f0;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		flex-wrap: wrap;
	}

	.legend-title {
		font-weight: 700;
		color: #1e40af;
		font-size: 0.95rem;
		margin-right: 0.5rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: inline-block;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
		border: 2px solid rgba(255, 255, 255, 0.8);
		transition: transform 0.2s;
	}

	.dot:hover {
		transform: scale(1.2);
	}

	.legend-hint {
		font-size: 0.85rem;
		color: #64748b;
		font-style: italic;
		margin-left: 1rem;
		border-left: 2px solid #cbd5e1;
		padding-left: 1rem;
	}

	.wordcloud-container {
		position: relative;
		width: 100%;
		min-height: 500px;
	}

	.wordcloud-canvas {
		width: 100%;
		height: 500px;
		display: flex;
		justify-content: center;
		align-items: center;
		background: #ffffff;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid #e5e7eb;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
	}

	:global(.wordcloud-svg) {
		background: transparent;
		width: 100%;
		height: 100%;
	}

	/* Vista de Tabla */
	.table-view {
		width: 100%;
		max-height: 600px;
		overflow-y: auto;
		background: white;
		border-radius: 12px;
		border: 2px solid #e2e8f0;
		box-shadow: 0 4px 12px rgba(30, 64, 175, 0.08);
	}

	.words-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.words-table thead {
		position: sticky;
		top: 0;
		background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
		color: white;
		z-index: 10;
		box-shadow: 0 2px 8px rgba(30, 64, 175, 0.2);
	}

	.words-table th {
		padding: 0.875rem 1rem;
		text-align: left;
		font-weight: 700;
		border-bottom: 3px solid #dc2626;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.words-table th:first-child {
		width: 60px;
		text-align: center;
	}

	.words-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #ecf0f1;
	}

	.table-row {
		transition: all 0.2s;
	}

	.table-row:hover {
		background: linear-gradient(90deg, #dbeafe 0%, #ffffff 100%);
		transform: translateX(4px);
	}

	.table-row.critical {
		border-left: 5px solid #dc2626;
		background: linear-gradient(90deg, rgba(220, 38, 38, 0.03) 0%, transparent 100%);
	}

	.table-row.important {
		border-left: 5px solid #ef4444;
		background: linear-gradient(90deg, rgba(239, 68, 68, 0.02) 0%, transparent 100%);
	}

	.table-row.relevant {
		border-left: 5px solid #1e40af;
		background: linear-gradient(90deg, rgba(30, 64, 175, 0.02) 0%, transparent 100%);
	}

	.rank {
		text-align: center;
		font-weight: 700;
		color: #64748b;
		font-size: 0.85rem;
	}

	.word-cell {
		font-weight: 700;
		color: #0f172a;
		font-size: 1rem;
	}

	.word-text {
		font-size: 1rem;
		background: linear-gradient(135deg, #1e40af, #dc2626);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.freq, .avg-eng, .total-eng {
		text-align: right;
		font-family: 'Monaco', 'Courier New', monospace;
		font-weight: 600;
	}

	.freq {
		color: #1e40af;
		font-weight: 700;
	}

	.avg-eng {
		color: #059669;
	}

	.total-eng {
		color: #dc2626;
	}

	.action {
		text-align: center;
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

	/* Loading spinner */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 500px;
		background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #dbeafe 100%);
		border-radius: 12px;
		border: 2px solid #e2e8f0;
	}

	.spinner {
		width: 60px;
		height: 60px;
		border: 6px solid rgba(30, 64, 175, 0.1);
		border-top-color: #1e40af;
		border-right-color: #dc2626;
		border-radius: 50%;
		animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
		margin-bottom: 1.5rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.loading-text {
		font-size: 1.2rem;
		font-weight: 600;
		color: #1e40af;
		margin: 0.5rem 0;
	}

	.loading-subtext {
		font-size: 0.9rem;
		color: #64748b;
		margin: 0;
	}

	/* Botón de reset */
	.reset-btn {
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		transition: all 0.3s;
		box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
	}

	.reset-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
	}

	/* Controles de tabla */
	.table-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 1rem;
		background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
		border-radius: 12px 12px 0 0;
		border: 2px solid #e2e8f0;
		border-bottom: none;
	}

	.search-input {
		flex: 1;
		padding: 0.6rem 1rem;
		border: 2px solid #cbd5e1;
		border-radius: 8px;
		font-size: 0.95rem;
		transition: all 0.3s;
	}

	.search-input:focus {
		outline: none;
		border-color: #1e40af;
		box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
	}

	.search-results {
		font-size: 0.9rem;
		color: #64748b;
		font-weight: 600;
	}

	/* Headers ordenables */
	.sortable {
		cursor: pointer;
		user-select: none;
		transition: background 0.2s;
	}

	.sortable:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	/* Botones de acción */
	.action-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	.exclude-btn, .include-btn {
		padding: 0.4rem 0.8rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
		transition: all 0.3s;
	}

	.exclude-btn {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		color: white;
		box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
	}

	.exclude-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
	}

	.include-btn {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
		box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
	}

	.include-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
	}

	.view-btn-small {
		padding: 0.4rem 0.6rem;
		background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.3s;
		box-shadow: 0 2px 4px rgba(30, 64, 175, 0.2);
	}

	.view-btn-small:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(30, 64, 175, 0.3);
	}

	/* Badge de excluida */
	.excluded-badge {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.2rem 0.5rem;
		background: #fee2e2;
		color: #dc2626;
		font-size: 0.7rem;
		font-weight: 700;
		border-radius: 4px;
		text-transform: uppercase;
	}

	/* Fila excluida */
	.table-row.excluded {
		background: rgba(239, 68, 68, 0.05);
	}
</style>