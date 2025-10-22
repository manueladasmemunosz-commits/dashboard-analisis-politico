<script>
	import { createEventDispatcher } from 'svelte';

	export let networksA = ['twitter'];
	export let networksB = ['news'];
	export let metric = 'posts';
	export let chartType = 'bar';
	export let timeComparison = false;
	export let granularity = 'day';

	const dispatch = createEventDispatcher();

	const availableNetworks = [
		{ id: 'twitter', label: '🐦 Twitter', color: '#1DA1F2' },
		{ id: 'news', label: '📰 Noticias', color: '#FF6B6B' },
		{ id: 'tiktok', label: '🎵 TikTok', color: '#000000' },
		{ id: 'instagram', label: '📷 Instagram', color: '#E1306C' },
		{ id: 'facebook', label: '👥 Facebook', color: '#1877F2' }
	];

	function handleNetworkToggle(group, networkId, isChecked) {
		if (group === 'A') {
			if (isChecked) {
				networksA = [...networksA, networkId];
			} else {
				networksA = networksA.filter(n => n !== networkId);
			}
			dispatch('networksAChange', { networksA });
		} else {
			if (isChecked) {
				networksB = [...networksB, networkId];
			} else {
				networksB = networksB.filter(n => n !== networkId);
			}
			dispatch('networksBChange', { networksB });
		}
	}

	function handleMetricChange() {
		dispatch('metricChange', { metric });
	}

	function handleChartTypeChange() {
		dispatch('chartTypeChange', { chartType });
	}

	function handleTimeComparisonToggle() {
		dispatch('timeComparisonToggle', { timeComparison });
	}

	function handleGranularityChange() {
		dispatch('granularityChange', { granularity });
	}

	function handleRefresh() {
		dispatch('refresh', {
			networksA,
			networksB,
			metric,
			chartType,
			timeComparison,
			granularity
		});
	}
</script>

<div class="network-comparison-controls">
	<!-- Botón de actualizar -->
	<div class="control-group">
		<button class="refresh-btn" on:click={handleRefresh}>
			🔄 Actualizar Gráfico
		</button>
	</div>

	<!-- Tipo de gráfico -->
	<div class="control-group">
		<span class="control-label">📊 Tipo de Gráfico</span>
		<select class="control-select" bind:value={chartType} on:change={handleChartTypeChange}>
			<option value="bar">Barras</option>
			<option value="horizontalBar">Barras Horizontales</option>
			<option value="line">Línea</option>
			<option value="area">Área</option>
			<option value="areaSmooth">Área Suave</option>
			{#if !timeComparison}
				<option value="doughnut">Donut</option>
				<option value="pie">Pastel</option>
				<option value="polarArea">Área Polar</option>
				<option value="radar">Radar</option>
			{/if}
		</select>
	</div>

	<!-- Métrica -->
	<div class="control-group">
		<span class="control-label">📈 Métrica</span>
		<select class="control-select" bind:value={metric} on:change={handleMetricChange}>
			<option value="posts">Posts</option>
			<option value="engagement">Engagement</option>
			<option value="users">Usuarios únicos</option>
		</select>
	</div>

	<!-- Modo temporal -->
	<div class="control-group">
		<label class="toggle-label">
			<input
				type="checkbox"
				bind:checked={timeComparison}
				on:change={handleTimeComparisonToggle}
			>
			<span>⏱️ Comparación temporal</span>
		</label>
	</div>

	{#if timeComparison}
		<div class="control-group">
			<span class="control-label">⏱️ Granularidad</span>
			<select class="control-select" bind:value={granularity} on:change={handleGranularityChange}>
				<option value="hour">Hora</option>
				<option value="day">Día</option>
				<option value="week">Semana</option>
				<option value="month">Mes</option>
			</select>
		</div>
	{/if}

	<!-- Grupo A -->
	<div class="control-group network-group">
		<span class="control-label group-a">🔵 Grupo A</span>
		<div class="network-checkboxes">
			{#each availableNetworks as network}
				<label class="network-option">
					<input
						type="checkbox"
						checked={networksA.includes(network.id)}
						on:change={(e) => handleNetworkToggle('A', network.id, e.target.checked)}
					>
					<span>{network.label}</span>
				</label>
			{/each}
		</div>
		{#if networksA.length === 0}
			<p class="warning">⚠️ Selecciona al menos una red</p>
		{/if}
	</div>

	<!-- Grupo B -->
	<div class="control-group network-group">
		<span class="control-label group-b">🔴 Grupo B</span>
		<div class="network-checkboxes">
			{#each availableNetworks as network}
				<label class="network-option">
					<input
						type="checkbox"
						checked={networksB.includes(network.id)}
						on:change={(e) => handleNetworkToggle('B', network.id, e.target.checked)}
					>
					<span>{network.label}</span>
				</label>
			{/each}
		</div>
		{#if networksB.length === 0}
			<p class="warning">⚠️ Selecciona al menos una red</p>
		{/if}
	</div>
</div>

<style>
	.network-comparison-controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: white;
		border-radius: 8px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: #333;
	}

	.control-label.group-a {
		color: #3498db;
	}

	.control-label.group-b {
		color: #e74c3c;
	}

	.control-select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
		background: white;
		cursor: pointer;
	}

	.control-select:focus {
		outline: none;
		border-color: #3498db;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.toggle-label:hover {
		background: #f0f0f0;
	}

	.toggle-label input[type="checkbox"] {
		cursor: pointer;
	}

	.network-group {
		padding: 0.75rem;
		border: 2px solid #eee;
		border-radius: 8px;
		background: #fafafa;
	}

	.network-checkboxes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.network-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.network-option:hover {
		background: white;
	}

	.network-option input[type="checkbox"] {
		cursor: pointer;
	}

	.warning {
		margin: 0.5rem 0 0 0;
		font-size: 0.85rem;
		color: #e67e22;
		font-weight: 500;
	}

	.info-hint {
		margin: 0.5rem 0 0 0;
		font-size: 0.8rem;
		color: #3498db;
		font-style: italic;
	}

	.refresh-btn {
		padding: 0.75rem 1rem;
		background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 2px 4px rgba(52, 152, 219, 0.3);
	}

	.refresh-btn:hover {
		background: linear-gradient(135deg, #2980b9 0%, #21618c 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(52, 152, 219, 0.4);
	}

	.refresh-btn:active {
		transform: translateY(0);
	}
</style>
