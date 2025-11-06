<script>
	export let title = '';
	export let chartName = '';
	export let chartType = 'line';
	export let dateFrom = '2025-01-01';
	export let dateTo = '2025-12-12';
	export let socialNetwork = 'all';
	export let selectedNetworks = ['all'];
	export let limit = 10;
	export let granularity = 'day';
	export let heatmapMetric = 'posts';
	export let colorPalette = 'chilean';
	export let visualizationMode = 'likes-vs-replies';
	export let showDateControls = true;
	export let showSocialControls = true;
	export let showLimitControls = false;
	export let showChartTypeControls = true;
	export let showGranularityControls = false;
	export let showComparativeMode = false;
	export let showColorPaletteControls = false;
	export let showVisualizationModeControls = false;
	export let chartTypes = ['line', 'bar', 'area'];
	export let comparativeEnabled = false;
	export let dateFromB = '2025-01-01';
	export let dateToB = '2025-12-12';

	import { createEventDispatcher } from 'svelte';
	import ChartControls from './ChartControls.svelte';
	import { filters, updateChartConfig, updateFilters } from '$lib/stores/dashboard.js';
	import './widget-styles.css';

	const dispatch = createEventDispatcher();

	// Sincronizar fechas locales con el store global de filtros
	// Esto asegura que los widgets de gráficos reflejen las fechas globales
	$: if ($filters.dateFrom && $filters.dateTo) {
		dateFrom = $filters.dateFrom;
		dateTo = $filters.dateTo;
	}

	function handleDateChange(event) {
		const { dateFrom: newDateFrom, dateTo: newDateTo } = event.detail;
		dateFrom = newDateFrom;
		dateTo = newDateTo;
		updateChartConfig(chartName, { dateFrom, dateTo });

		// NUEVO: Disparar evento para que el padre (page.svelte) consulte BigQuery con las nuevas fechas
		// Esto permite que al cambiar fechas en los controles del gráfico se traigan nuevos datos
		dispatch('dateRangeChanged', {
			dateFrom: newDateFrom,
			dateTo: newDateTo,
			chartName
		});

		console.log(`📅 ${chartName}: Fechas cambiadas a ${newDateFrom} - ${newDateTo}, solicitando nuevos datos de BigQuery`);
	}

	function handleTypeChange(event) {
		const { chartType: newChartType } = event.detail;
		chartType = newChartType;
		updateChartConfig(chartName, { type: chartType });
	}

	function handleSocialChange(event) {
		const { socialNetwork: newSocialNetwork, selectedNetworks: newSelectedNetworks } = event.detail;
		socialNetwork = newSocialNetwork;
		selectedNetworks = newSelectedNetworks;
		updateChartConfig(chartName, { socialNetwork, selectedNetworks });

		// IMPORTANTE: Actualizar filtros globales para que filteredData se recalcule
		updateFilters({ socialNetwork: newSocialNetwork, selectedNetworks: newSelectedNetworks });
	}

	function handleLimitChange(event) {
		const { limit: newLimit } = event.detail;
		limit = newLimit;
		updateChartConfig(chartName, { limit });
	}

	function handleGranularityChange(event) {
		const { granularity: newGranularity } = event.detail;
		granularity = newGranularity;
		updateChartConfig(chartName, { granularity });
	}

	function handleHeatmapMetricChange(event) {
		const { heatmapMetric: newHeatmapMetric } = event.detail;
		heatmapMetric = newHeatmapMetric;
		updateChartConfig(chartName, { heatmapMetric });
	}

	function handleComparativeToggle(event) {
		comparativeEnabled = event.detail.comparativeEnabled;
		updateChartConfig(chartName, { comparativeEnabled });
	}

	function handleComparativeDatesChange(event) {
		const { dateFromB: newDateFromB, dateToB: newDateToB } = event.detail;
		dateFromB = newDateFromB;
		dateToB = newDateToB;
		updateChartConfig(chartName, { dateFromB, dateToB });
	}

	function handleColorPaletteChange(event) {
		const { colorPalette: newColorPalette } = event.detail;
		colorPalette = newColorPalette;
		updateChartConfig(chartName, { colorPalette });
	}

	function handleVisualizationModeChange(event) {
		const { visualizationMode: newVisualizationMode } = event.detail;
		visualizationMode = newVisualizationMode;
		updateChartConfig(chartName, { visualizationMode });
	}

	function handleProyectoApplied(event) {
		const { proyecto } = event.detail;
		console.log(`📁 Proyecto aplicado a ${chartName}:`, proyecto.nombre);
		console.log(`📅 Fechas del gráfico ${chartName} ANTES:`, { dateFrom, dateTo });
		console.log(`📅 Fechas del proyecto:`, {
			dateFrom: proyecto.query.dateFrom,
			dateTo: proyecto.query.dateTo
		});

		// IMPORTANTE: Mantener las fechas actuales del gráfico, solo aplicar el searchTerm del proyecto
		// Esto permite que cada gráfico mantenga su propio rango de fechas personalizado
		dispatch('proyectoApplied', {
			proyecto,
			// Pasar las fechas actuales del gráfico para que el padre las use en la búsqueda
			currentDateFrom: dateFrom,
			currentDateTo: dateTo
		});

		console.log(`📅 Despachando evento con fechas del gráfico:`, {
			currentDateFrom: dateFrom,
			currentDateTo: dateTo
		});
	}

	function handleRefresh(event) {
		const config = event.detail;
		console.log('🔄 Actualizando gráfico con configuración:', config);

		// Activar estado de carga
		isChartLoading = true;

		// Simular procesamiento de datos
		setTimeout(() => {
			// Actualizar todas las variables locales
			chartType = config.chartType;
			dateFrom = config.dateFrom;
			dateTo = config.dateTo;
			socialNetwork = config.socialNetwork;
			selectedNetworks = config.selectedNetworks;
			limit = config.limit;
			if (config.granularity !== undefined) {
				granularity = config.granularity;
			}

			// Actualizar configuración del gráfico específico
			const chartConfig = {
				type: config.chartType,
				limit: config.limit
			};
			if (config.granularity !== undefined) {
				chartConfig.granularity = config.granularity;
			}
			updateChartConfig(chartName, chartConfig);

			// Aplicar filtros globales (esto afecta todos los gráficos)
			updateFilters({
				dateFrom: config.dateFrom,
				dateTo: config.dateTo,
				socialNetwork: config.socialNetwork,
				selectedNetworks: config.selectedNetworks
			});

			console.log(`📊 Filtros aplicados globalmente:`, {
				dateFrom: config.dateFrom,
				dateTo: config.dateTo,
				selectedNetworks: config.selectedNetworks,
				chartSpecific: chartConfig
			});

			// Desactivar estado de carga
			isChartLoading = false;
		}, 600);
	}

	// Estados para funcionalidades del módulo 1
	let isFullscreen = false;
	let chartContainer;
	let isChartLoading = false;

	function toggleFullscreen() {
		if (!isFullscreen) {
			// Entrar en pantalla completa
			if (chartContainer.requestFullscreen) {
				chartContainer.requestFullscreen();
			} else if (chartContainer.webkitRequestFullscreen) {
				chartContainer.webkitRequestFullscreen();
			} else if (chartContainer.mozRequestFullScreen) {
				chartContainer.mozRequestFullScreen();
			}
		} else {
			// Salir de pantalla completa
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			}
		}
	}

	function exportChart() {
		// Implementaremos la funcionalidad de exportar
		const canvas = chartContainer.querySelector('canvas');
		if (canvas) {
			const link = document.createElement('a');
			link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chart.png`;
			link.href = canvas.toDataURL();
			link.click();
		}
	}

	// Escuchar eventos de fullscreen
	function handleFullscreenChange() {
		isFullscreen = !!(document.fullscreenElement ||
						 document.webkitFullscreenElement ||
						 document.mozFullScreenElement);
	}

	import { onMount } from 'svelte';

	onMount(() => {
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
		};
	});
</script>

<div class="chart-widget" bind:this={chartContainer}>
	<div class="widget-header">
		<h3 class="widget-title">{title}</h3>
		<div class="widget-actions">
			<button
				class="action-btn export-btn"
				on:click={exportChart}
				title="Exportar gráfico como imagen"
			>
				📸
			</button>
			<button
				class="action-btn fullscreen-btn"
				on:click={toggleFullscreen}
				title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
			>
				{isFullscreen ? '🗗' : '⛶'}
			</button>
		</div>
	</div>
	<div class="widget-content">
		<div class="widget-controls-sidebar">
			<ChartControls
				{chartName}
				bind:chartType
				bind:dateFrom
				bind:dateTo
				bind:socialNetwork
				bind:selectedNetworks
				bind:limit
				bind:granularity
				bind:heatmapMetric
				bind:colorPalette
				bind:visualizationMode
				bind:comparativeEnabled
				bind:dateFromB
				bind:dateToB
				{showDateControls}
				{showSocialControls}
				{showLimitControls}
				{showChartTypeControls}
				{showGranularityControls}
				{showComparativeMode}
				{showColorPaletteControls}
				{showVisualizationModeControls}
				{chartTypes}
				on:dateChange={handleDateChange}
				on:typeChange={handleTypeChange}
				on:socialChange={handleSocialChange}
				on:limitChange={handleLimitChange}
				on:granularityChange={handleGranularityChange}
				on:heatmapMetricChange={handleHeatmapMetricChange}
				on:colorPaletteChange={handleColorPaletteChange}
				on:visualizationModeChange={handleVisualizationModeChange}
				on:comparativeToggle={handleComparativeToggle}
				on:comparativeDatesChange={handleComparativeDatesChange}
				on:proyectoApplied={handleProyectoApplied}
				on:refresh={handleRefresh}
			/>
		</div>
		<div class="chart-container">
			{#if isChartLoading}
				<div class="chart-loading-overlay">
					<div class="loading-spinner"></div>
					<div class="loading-text">Actualizando gráfico...</div>
				</div>
			{/if}
			<div class="chart-content" class:loading={isChartLoading}>
				<slot />
			</div>
		</div>
	</div>
</div>