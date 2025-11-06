<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { filters } from '$lib/stores/dashboard.js';

	export const chartName = '';
	export let chartType = 'line';
	export let dateFrom = '2020-01-01';
	export let dateTo = '2030-12-31';
	export let socialNetwork = 'all';
	export let selectedNetworks = ['all'];
	export let limit = 10;
	export let granularity = 'day';
	export let heatmapMetric = 'posts'; // Para heatmap: 'posts' o 'engagement'
	export let colorPalette = 'extended'; // Paleta extendida con 40 colores por defecto
	export let visualizationMode = 'likes-vs-replies'; // Para engagement scatter
	export let showDateControls = true;
	export let showSocialControls = true;
	export let showLimitControls = false;
	export let showChartTypeControls = true;
	export let showGranularityControls = false;
	export let showComparativeMode = false; // Para timeline: modo comparativo A/B
	export let showColorPaletteControls = false;
	export let showVisualizationModeControls = false; // Para engagement scatter
	export let chartTypes = ['line', 'bar', 'area'];

	// Sincronizar fechas locales con el store global de filtros
	// Esto asegura que los inputs de fecha de cada gráfico reflejen las fechas globales
	$: if ($filters.dateFrom && $filters.dateTo) {
		dateFrom = $filters.dateFrom;
		dateTo = $filters.dateTo;
	}

	// Proyectos
	let proyectos = [];
	let selectedProyectoId = '';

	// Cargar proyectos al montar
	onMount(async () => {
		await loadProyectos();
	});

	async function loadProyectos() {
		try {
			const response = await fetch('/api/proyectos');
			if (response.ok) {
				proyectos = await response.json();
			}
		} catch (error) {
			console.error('❌ Error cargando proyectos:', error);
		}
	}

	function handleProyectoChange() {
		if (selectedProyectoId) {
			const proyecto = proyectos.find(p => p.id === selectedProyectoId);
			if (proyecto) {
				// IMPORTANTE: NO sobrescribir las fechas del gráfico
				// El ChartWidget se encargará de pasar las fechas actuales del gráfico al padre
				dispatch('proyectoApplied', { proyecto });
				console.log('📁 Proyecto aplicado desde selector:', proyecto.nombre);
			}
		}
	}

	// Estado de modo comparativo
	export let comparativeEnabled = false;
	export let dateFromB = '2020-01-01';
	export let dateToB = '2030-12-31';

	// Estado de carga
	let isRefreshing = false;
	let autoRefresh = false;
	let autoRefreshInterval = null;
	let autoRefreshTimer = 30; // segundos
	let currentTimer = 0;

	// Estado de filtros aplicados
	let lastAppliedFilters = {
		dateFrom: '2020-01-01',
		dateTo: '2030-12-31',
		selectedNetworks: ['all'],
		limit: 10,
		granularity: 'day'
	};

	// Verificar si hay filtros activos y no aplicados
	$: hasActiveFilters = (dateFrom !== lastAppliedFilters.dateFrom ||
						  dateTo !== lastAppliedFilters.dateTo ||
						  JSON.stringify(selectedNetworks) !== JSON.stringify(lastAppliedFilters.selectedNetworks) ||
						  (showLimitControls && limit !== lastAppliedFilters.limit) ||
						  (showGranularityControls && granularity !== lastAppliedFilters.granularity));

	const dispatch = createEventDispatcher();

	function handleDateChange() {
		dispatch('dateChange', { dateFrom, dateTo });
	}

	function handleTypeChange() {
		dispatch('typeChange', { chartType });
	}

	function handleSocialChange(network, isChecked) {
		if (network === 'all') {
			if (isChecked) {
				selectedNetworks = ['all'];
			} else {
				selectedNetworks = [];
			}
		} else {
			if (isChecked) {
				// Si selecciona una red específica, quita "all"
				selectedNetworks = selectedNetworks.filter(n => n !== 'all');
				selectedNetworks = [...selectedNetworks, network];
			} else {
				selectedNetworks = selectedNetworks.filter(n => n !== network);
			}

			// Si no queda ninguna seleccionada, marca "all"
			if (selectedNetworks.length === 0) {
				selectedNetworks = ['all'];
			}
		}

		// Para compatibilidad con el código existente
		socialNetwork = selectedNetworks.includes('all') ? 'all' : selectedNetworks[0];
		dispatch('socialChange', { socialNetwork, selectedNetworks });
	}

	function handleLimitChange() {
		dispatch('limitChange', { limit: parseInt(limit) });
	}

	function handleGranularityChange() {
		dispatch('granularityChange', { granularity });
	}

	function handleHeatmapMetricChange() {
		dispatch('heatmapMetricChange', { heatmapMetric });
	}

	function handleColorPaletteChange() {
		dispatch('colorPaletteChange', { colorPalette });
	}

	function handleVisualizationModeChange() {
		dispatch('visualizationModeChange', { visualizationMode });
	}

	function handleComparativeToggle() {
		dispatch('comparativeToggle', { comparativeEnabled });
	}

	function handleComparativeDatesChange() {
		dispatch('comparativeDatesChange', { dateFromB, dateToB });
	}

	async function handleRefresh() {
		if (isRefreshing) return;

		isRefreshing = true;

		const refreshData = {
			chartType,
			dateFrom,
			dateTo,
			selectedNetworks,
			socialNetwork,
			limit
		};

		if (showGranularityControls) {
			refreshData.granularity = granularity;
		}

		dispatch('refresh', refreshData);

		// Actualizar filtros aplicados
		lastAppliedFilters = {
			dateFrom,
			dateTo,
			selectedNetworks: [...selectedNetworks],
			limit,
			granularity
		};

		// Simular tiempo de carga más corto para mejor UX
		setTimeout(() => {
			isRefreshing = false;
		}, 800);
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;

		if (autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	}

	function startAutoRefresh() {
		currentTimer = autoRefreshTimer;

		autoRefreshInterval = setInterval(() => {
			currentTimer--;

			if (currentTimer <= 0) {
				// Para auto-refresh, no mostrar "filtros pendientes"
				lastAppliedFilters = {
					dateFrom,
					dateTo,
					selectedNetworks: [...selectedNetworks],
					limit,
					granularity
				};
				handleRefresh();
				currentTimer = autoRefreshTimer;
			}
		}, 1000);
	}

	function stopAutoRefresh() {
		if (autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
			autoRefreshInterval = null;
		}
		currentTimer = 0;
	}

	// Limpiar interval al destruir componente
	import { onDestroy } from 'svelte';

	onDestroy(() => {
		stopAutoRefresh();
	});

</script>

<div class="widget-controls-vertical">
	<!-- Selector de Proyectos -->
	{#if proyectos.length > 0}
		<div class="control-group">
			<span class="control-label">📁 Aplicar Proyecto</span>
			<select
				class="chart-control-select proyecto-select"
				bind:value={selectedProyectoId}
				on:change={handleProyectoChange}
			>
				<option value="">-- Seleccionar proyecto --</option>
				{#each proyectos as proyecto}
					<option value={proyecto.id}>
						{proyecto.nombre}
					</option>
				{/each}
			</select>
			{#if selectedProyectoId}
				{#each proyectos.filter(p => p.id === selectedProyectoId) as proyecto}
					<div class="proyecto-info">
						<div class="proyecto-badge" style="border-left-color: {proyecto.color}">
							<span>🔍 {proyecto.query.searchTerm}</span>
							<span class="proyecto-dates">📅 {proyecto.query.dateFrom} → {proyecto.query.dateTo}</span>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Botón de actualizar al principio -->
	<div class="control-group">
		<button
			class="refresh-btn {isRefreshing ? 'loading' : ''} {hasActiveFilters ? 'has-filters' : ''}"
			on:click={handleRefresh}
			disabled={isRefreshing}
		>
			{#if isRefreshing}
				Actualizando...
			{:else if hasActiveFilters}
				🔄 Aplicar Filtros
			{:else}
				🔄 Actualizar Gráfico
			{/if}
		</button>
		{#if hasActiveFilters && !isRefreshing}
			<div class="filters-indicator">
				⚠️ Filtros pendientes
			</div>
		{/if}
	</div>

	<!-- Auto-refresh controls -->
	<div class="control-group">
		<div class="auto-refresh-container">
			<label class="auto-refresh-toggle">
				<input
					type="checkbox"
					class="auto-refresh-checkbox"
					bind:checked={autoRefresh}
					on:change={toggleAutoRefresh}
				>
				<span class="auto-refresh-label">
					{#if autoRefresh}
						🔄 Auto-actualizar ({currentTimer}s)
					{:else}
						⏸️ Auto-actualizar
					{/if}
				</span>
			</label>
			{#if autoRefresh}
				<div class="auto-refresh-progress">
					<div
						class="auto-refresh-bar"
						style="width: {((autoRefreshTimer - currentTimer) / autoRefreshTimer) * 100}%"
					></div>
				</div>
			{/if}
			<select
				class="timer-select"
				bind:value={autoRefreshTimer}
				on:change={() => {
					if (autoRefresh) {
						stopAutoRefresh();
						startAutoRefresh();
					}
				}}
			>
				<option value={10}>10s</option>
				<option value={30}>30s</option>
				<option value={60}>1min</option>
				<option value={300}>5min</option>
			</select>
		</div>
	</div>

	{#if showChartTypeControls}
		<div class="control-group">
			<span class="control-label">📊 Tipo de Gráfico</span>
			<select
				class="chart-control-select"
				bind:value={chartType}
				on:change={handleTypeChange}
			>
				{#each chartTypes as type}
					<option value={type}>
						{type === 'line' ? 'Línea' :
						 type === 'bar' ? 'Barras' :
						 type === 'area' ? 'Área' :
						 type === 'areaSmooth' ? 'Área Suave' :
						 type === 'scatter' ? '🔵 Dispersión' :
						 type === 'doughnut' ? 'Donut' :
						 type === 'pie' ? 'Pastel' :
						 type === 'horizontalBar' ? 'Barras H.' :
						 type === 'radar' ? 'Radar' :
						 type === 'bubble' ? '⚪ Burbuja' :
						 type === 'polarArea' ? 'Área Polar' :
						 type === 'violin' ? '🎻 Violin' :
						 type === '3d' ? '🎲 3D Scatter' :
						 type.charAt(0).toUpperCase() + type.slice(1)}
					</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if showColorPaletteControls}
		<div class="control-group">
			<span class="control-label">🎨 Paleta de Colores</span>
			<select
				class="chart-control-select"
				bind:value={colorPalette}
				on:change={handleColorPaletteChange}
			>
			<option value="extended">🎨 Extendida (40 colores)</option>
				<option value="chilean">🇨🇱 Chilena</option>
				<option value="vibrant">🌈 Vibrante</option>
				<option value="pastel">🎀 Pastel</option>
				<option value="ocean">🌊 Océano</option>
				<option value="sunset">🌅 Atardecer</option>
				<option value="forest">🌲 Bosque</option>
				<option value="monochrome">⚫ Monocromática</option>
				<option value="neon">💡 Neón</option>
			</select>
		</div>
	{/if}

	{#if showVisualizationModeControls}
		<div class="control-group">
			<span class="control-label">📈 Modo de Visualización</span>
			<select
				class="chart-control-select"
				bind:value={visualizationMode}
				on:change={handleVisualizationModeChange}
			>
				<option value="likes-vs-replies">💬 Likes vs Replies</option>
				<option value="engagement-vs-length">📝 Engagement vs Longitud</option>
				<option value="likes-replies-ratio">🔄 Ratio Likes/Replies</option>
				<option value="viral-posts">🚀 Posts Virales</option>
			</select>
		</div>
	{/if}

	{#if showDateControls}
		<div class="control-group">
			<span class="control-label">📅 Período A</span>
			<div class="date-controls">
				<label class="date-label">Desde</label>
				<input
					type="date"
					class="chart-control-date"
					bind:value={dateFrom}
					on:change={handleDateChange}
				>
				<label class="date-label">Hasta</label>
				<input
					type="date"
					class="chart-control-date"
					bind:value={dateTo}
					on:change={handleDateChange}
				>
			</div>
		</div>
	{/if}

	{#if showComparativeMode}
		<div class="control-group">
			<label class="comparative-toggle">
				<input
					type="checkbox"
					bind:checked={comparativeEnabled}
					on:change={handleComparativeToggle}
				>
				<span class="control-label">🔀 Modo Comparativo A/B</span>
			</label>
		</div>

		{#if comparativeEnabled}
			<div class="control-group comparative-dates">
				<span class="control-label">📅 Período B</span>
				<div class="date-controls">
					<label class="date-label">Desde</label>
					<input
						type="date"
						class="chart-control-date"
						bind:value={dateFromB}
						on:change={handleComparativeDatesChange}
					>
					<label class="date-label">Hasta</label>
					<input
						type="date"
						class="chart-control-date"
						bind:value={dateToB}
						on:change={handleComparativeDatesChange}
					>
				</div>
				<p class="comparative-hint">
					💡 Los períodos se alinearán por duración para comparación directa
				</p>
			</div>
		{/if}
	{/if}

	{#if showLimitControls}
		<div class="control-group">
			<span class="control-label">🔢 Top</span>
			<select
				class="chart-control-select"
				bind:value={limit}
				on:change={handleLimitChange}
			>
				<option value={5}>Top 5</option>
				<option value={10}>Top 10</option>
				<option value={15}>Top 15</option>
				<option value={20}>Top 20</option>
				<option value={30}>Top 30</option>
			</select>
		</div>
	{/if}

	{#if showGranularityControls}
		<div class="control-group">
			<span class="control-label">⏱️ Granularidad</span>
			<select
				class="chart-control-select"
				bind:value={granularity}
				on:change={handleGranularityChange}
			>
				<option value="hour">Hora</option>
				<option value="day">Día</option>
				<option value="week">Semana</option>
				<option value="month">Mes</option>
			</select>
		</div>
	{/if}

	<!-- Selector de métrica -->
	<div class="control-group">
		<span class="control-label">📊 Métrica</span>
		<select
			class="chart-control-select"
			bind:value={heatmapMetric}
			on:change={handleHeatmapMetricChange}
		>
			<option value="posts">Posts</option>
			<option value="engagement">Engagement</option>
		</select>
	</div>

	{#if showSocialControls}
		<div class="control-group">
			<span class="control-label">🌐 Redes Sociales</span>
			<div class="multi-select-wrapper">
				<div class="selected-networks">
					{#if selectedNetworks.includes('all')}
						<span class="network-tag all">📊 Todas</span>
					{:else}
						{#each selectedNetworks as network}
							<span class="network-tag {network}">
								{network === 'twitter' ? '🐦' :
								 network === 'news' ? '📰' :
								 network === 'tiktok' ? '🎵' :
								 network === 'instagram' ? '📷' :
								 network === 'facebook' ? '👥' : '🌐'}
								{network === 'twitter' ? 'Twitter' :
								 network === 'news' ? 'Noticias' :
								 network === 'tiktok' ? 'TikTok' :
								 network === 'instagram' ? 'Instagram' :
								 network === 'facebook' ? 'Facebook' : network}
							</span>
						{/each}
					{/if}
				</div>
				<details class="network-dropdown">
					<summary class="dropdown-toggle">⚙️</summary>
					<div class="dropdown-content">
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('all')}
								on:change={(e) => handleSocialChange('all', e.target.checked)}
							>
							📊 Todas las fuentes
						</label>
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('twitter')}
								on:change={(e) => handleSocialChange('twitter', e.target.checked)}
							>
							🐦 Twitter
						</label>
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('news')}
								on:change={(e) => handleSocialChange('news', e.target.checked)}
							>
							📰 Noticias
						</label>
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('tiktok')}
								on:change={(e) => handleSocialChange('tiktok', e.target.checked)}
							>
							🎵 TikTok
						</label>
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('instagram')}
								on:change={(e) => handleSocialChange('instagram', e.target.checked)}
							>
							📷 Instagram
						</label>
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('facebook')}
								on:change={(e) => handleSocialChange('facebook', e.target.checked)}
							>
							👥 Facebook
						</label>
						<!-- Opciones comentadas: no hay datos con estos valores en el CSV actual
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('other')}
								on:change={(e) => handleSocialChange('other', e.target.checked)}
							>
							🔗 Otros
						</label>
						<label class="network-option">
							<input
								type="checkbox"
								checked={selectedNetworks.includes('undefined')}
								on:change={(e) => handleSocialChange('undefined', e.target.checked)}
							>
							❓ Sin fuente
						</label>
						-->
					</div>
				</details>
			</div>
		</div>
	{/if}
</div>

<style>
	.proyecto-select {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 2px solid #3498db;
		font-weight: 600;
	}

	.proyecto-select:hover {
		border-color: #2980b9;
		box-shadow: 0 2px 8px rgba(52, 152, 219, 0.2);
	}

	.proyecto-info {
		margin-top: 0.75rem;
	}

	.proyecto-badge {
		background: #f8f9fa;
		padding: 0.75rem;
		border-radius: 6px;
		border-left: 4px solid #3498db;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.proyecto-badge span {
		display: block;
		color: #2c3e50;
	}

	.proyecto-dates {
		color: #7f8c8d !important;
		font-size: 0.8rem;
	}
</style>