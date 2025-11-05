<script>
	import NetworkComparisonChart from './charts/NetworkComparisonChart.svelte';
	import NetworkComparisonControls from './NetworkComparisonControls.svelte';

	export let data = [];

	let networksA = ['twitter'];
	let networksB = ['news'];
	let metric = 'posts';
	let chartType = 'bar';
	let timeComparison = false;
	let granularity = 'day';
	let refreshKey = 0; // Para forzar recreación del gráfico

	function handleNetworksAChange(event) {
		networksA = event.detail.networksA;
	}

	function handleNetworksBChange(event) {
		networksB = event.detail.networksB;
	}

	function handleMetricChange(event) {
		metric = event.detail.metric;
	}

	function handleChartTypeChange(event) {
		chartType = event.detail.chartType;
	}

	function handleTimeComparisonToggle(event) {
		timeComparison = event.detail.timeComparison;

		// Si se desactiva el modo temporal y el tipo es line/area, cambiar a bar
		if (!timeComparison && (chartType === 'line' || chartType === 'area')) {
			chartType = 'bar';
			console.log('📊 Modo temporal desactivado: cambiando a gráfico de barras');
		}

		// Auto-actualizar gráfico
		refreshKey++;
	}

	function handleGranularityChange(event) {
		granularity = event.detail.granularity;
		// Auto-actualizar gráfico
		refreshKey++;
	}

	function handleRefresh(event) {
		console.log('🔄 Actualizando comparación de redes:', event.detail);
		// Forzar recreación del gráfico incrementando la key
		refreshKey++;
	}
</script>

<div class="network-comparison-widget">
	<div class="widget-header">
		<h3 class="widget-title">🔀 Comparación de Redes Sociales</h3>
		<p class="widget-subtitle">Compara el volumen entre diferentes redes o grupos de redes</p>
	</div>
	<div class="widget-content">
		<div class="controls-sidebar">
			<NetworkComparisonControls
				bind:networksA
				bind:networksB
				bind:metric
				bind:chartType
				bind:timeComparison
				bind:granularity
				on:networksAChange={handleNetworksAChange}
				on:networksBChange={handleNetworksBChange}
				on:metricChange={handleMetricChange}
				on:chartTypeChange={handleChartTypeChange}
				on:timeComparisonToggle={handleTimeComparisonToggle}
				on:granularityChange={handleGranularityChange}
				on:refresh={handleRefresh}
			/>
		</div>
		<div class="chart-area">
			{#key refreshKey}
				<NetworkComparisonChart
					{data}
					{chartType}
					{metric}
					{networksA}
					{networksB}
					{timeComparison}
					{granularity}
				/>
			{/key}
		</div>
	</div>
</div>

<style>
	.network-comparison-widget {
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		margin-bottom: 2rem;
	}

	.widget-header {
		padding: 1.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.widget-title {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.widget-subtitle {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.widget-content {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 1.5rem;
		padding: 1.5rem;
	}

	.controls-sidebar {
		border-right: 1px solid #eee;
		padding-right: 1.5rem;
	}

	.chart-area {
		min-height: 400px;
	}

	@media (max-width: 1024px) {
		.widget-content {
			grid-template-columns: 1fr;
		}

		.controls-sidebar {
			border-right: none;
			border-bottom: 1px solid #eee;
			padding-right: 0;
			padding-bottom: 1.5rem;
		}
	}
</style>
