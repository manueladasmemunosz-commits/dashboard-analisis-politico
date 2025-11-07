<script>
	import { filters, updateFilters } from '$lib/stores/dashboard.js';
	import { createEventDispatcher } from 'svelte';
	import './header-styles.css';

	const dispatch = createEventDispatcher();

	let searchTerm = '';
	let activeTab = 'main';

	// Calcular fechas dinámicamente - Por defecto solo el día actual
	const today = new Date();
	let dateFrom = today.toISOString().split('T')[0];
	let dateTo = today.toISOString().split('T')[0];
	let showHelpModal = false;

	// Sincronizar fechas locales con el store global
	// Esto asegura que los inputs muestren las fechas actuales del filtro global
	// IMPORTANTE: Solo actualizar si los valores realmente cambiaron (prevenir loop)
	$: if ($filters.dateFrom && $filters.dateTo &&
	       (dateFrom !== $filters.dateFrom || dateTo !== $filters.dateTo)) {
		dateFrom = $filters.dateFrom;
		dateTo = $filters.dateTo;
	}

	function handleSearch() {
		updateFilters({ searchTerm, dateFrom, dateTo });
		dispatch('search', { searchTerm, dateFrom, dateTo });
	}

	function handleCsvUpload(event) {
		const file = event.target.files[0];
		if (file) {
			console.log('📁 Archivo seleccionado:', file.name, 'Tamaño:', (file.size / 1024 / 1024).toFixed(2), 'MB');
			dispatch('csvUpload', { file });
		} else {
			console.log('❌ No se seleccionó ningún archivo');
		}
	}

	function handleTabClick(tab) {
		activeTab = tab;
		console.log('🔀 Cambiando a pestaña:', tab);
		dispatch('tabChange', { tab });

		// Scroll suave a la sección correspondiente
		const sectionMap = {
			'main': 'main-section',
			'proyectos': 'proyectos-section',
			'comparacion': 'project-comparison-section'
		};

		const sectionId = sectionMap[tab];
		if (sectionId) {
			const element = document.getElementById(sectionId);
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	}
</script>

<header class="unified-header">
	<div class="header-main">
		<div class="header-controls">
			<div class="search-group">
				<div class="input-group">
					<div class="search-input-wrapper">
						<input
							type="text"
							class="search-input"
							placeholder='Buscar: kast AND jara, "frase exacta", gobierno*...'
							title="Click en 💡 para ver ejemplos de búsqueda avanzada"
							bind:value={searchTerm}
							on:keydown={(e) => e.key === 'Enter' && handleSearch()}
						>
						<button class="help-btn" on:click={() => showHelpModal = true} title="Ver ayuda de búsqueda">
							💡
						</button>
					</div>
				</div>

				<div class="date-group">
					<input
						type="date"
						class="date-input"
						bind:value={dateFrom}
						title="Fecha desde"
					>
					<input
						type="date"
						class="date-input"
						bind:value={dateTo}
						title="Fecha hasta"
					>
				</div>

				<button class="search-btn" on:click={handleSearch}>
					Buscar
				</button>
			</div>

			<div class="upload-group">
				<input
					type="file"
					accept=".csv"
					class="file-input"
					id="csv-upload"
					on:change={handleCsvUpload}
				>
				<label for="csv-upload" class="upload-btn">
					📄 Cargar CSV Local
				</label>
			</div>
		</div>
	</div>

	<div class="header-stats">
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon">📊</div>
				<div class="stat-content">
					<span class="stat-value" id="total-posts">0</span>
					<span class="stat-label">Posts Totales</span>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon">🔍</div>
				<div class="stat-content">
					<span class="stat-value" id="filtered-posts">0</span>
					<span class="stat-label">Filtrados</span>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon">💬</div>
				<div class="stat-content">
					<span class="stat-value" id="total-engagement">0</span>
					<span class="stat-label">Engagement</span>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon">📈</div>
				<div class="stat-content">
					<span class="stat-value" id="avg-engagement">0</span>
					<span class="stat-label">Promedio</span>
				</div>
			</div>
		</div>
	</div>

	<div class="header-tabs">
		<nav class="nav-tabs">
			<button
				class="nav-tab {activeTab === 'main' ? 'active' : ''}"
				on:click={() => handleTabClick('main')}
			>
				<span class="tab-icon">📊</span>
				Principal
			</button>
			<button
				class="nav-tab {activeTab === 'proyectos' ? 'active' : ''}"
				on:click={() => handleTabClick('proyectos')}
			>
				<span class="tab-icon">📁</span>
				Proyectos
			</button>
			<button
				class="nav-tab {activeTab === 'comparacion' ? 'active' : ''}"
				on:click={() => handleTabClick('comparacion')}
			>
				<span class="tab-icon">🔄</span>
				Comparación
			</button>
		</nav>
	</div>
</header>

<!-- Modal de ayuda de búsqueda -->
{#if showHelpModal}
	<div class="modal-overlay" on:click={() => showHelpModal = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>💡 Guía de Búsqueda Avanzada</h2>
				<button class="modal-close" on:click={() => showHelpModal = false}>✕</button>
			</div>
			<div class="modal-body">
				<!-- Operadores Básicos -->
				<div class="help-section">
					<h3>🔤 Operadores Básicos</h3>
					<div class="help-items">
						<div class="help-item">
							<code>AND</code>
							<span>Busca posts que contengan TODAS las palabras</span>
							<div class="example">Ejemplo: <code>kast AND jara</code></div>
						</div>
						<div class="help-item">
							<code>OR</code>
							<span>Busca posts que contengan AL MENOS UNA palabra</span>
							<div class="example">Ejemplo: <code>kast OR boric</code></div>
						</div>
						<div class="help-item">
							<code>NOT</code>
							<span>Excluye posts que contengan la palabra</span>
							<div class="example">Ejemplo: <code>kast NOT gobierno</code></div>
						</div>
					</div>
				</div>

				<!-- Operadores Avanzados -->
				<div class="help-section">
					<h3>🚀 Operadores Avanzados</h3>
					<div class="help-items">
						<div class="help-item">
							<code>"frase exacta"</code>
							<span>Busca la frase exacta entre comillas</span>
							<div class="example">Ejemplo: <code>"josé antonio kast"</code></div>
						</div>
						<div class="help-item">
							<code>*</code>
							<span>Comodín que reemplaza cualquier carácter</span>
							<div class="example">Ejemplo: <code>gobi* AND chile</code> → gobierno, gobiernan...</div>
						</div>
						<div class="help-item">
							<code>( )</code>
							<span>Agrupa expresiones para controlar prioridad</span>
							<div class="example">Ejemplo: <code>(kast OR boric) AND chile</code></div>
						</div>
					</div>
				</div>

				<!-- Ejemplos Combinados -->
				<div class="help-section">
					<h3>🎯 Ejemplos Combinados</h3>
					<div class="help-items">
						<div class="help-item">
							<code>chile AND (kast OR boric) NOT piñera</code>
							<span>Posts sobre Chile con Kast o Boric, pero sin Piñera</span>
						</div>
						<div class="help-item">
							<code>"presidente kast" OR "candidato kast"</code>
							<span>Posts con cualquiera de las frases exactas</span>
						</div>
						<div class="help-item">
							<code>gobi* AND reforma NOT impuesto</code>
							<span>Posts sobre gobierno y reforma, sin mencionar impuesto</span>
						</div>
						<div class="help-item">
							<code>@usuario* AND debate</code>
							<span>Posts de usuarios que empiezan con @usuario y mencionan debate</span>
						</div>
					</div>
				</div>

				<!-- Notas -->
				<div class="help-section help-notes">
					<h3>📝 Notas Importantes</h3>
					<ul>
						<li>Los operadores NO distinguen mayúsculas/minúsculas</li>
						<li>Busca tanto en el texto del post como en el nombre de usuario</li>
						<li>Orden de prioridad: <code>( )</code> → <code>NOT</code> → <code>AND</code> → <code>OR</code></li>
						<li>Los espacios son importantes: usa <code> AND </code>, no <code>AND</code></li>
					</ul>
				</div>
			</div>
		</div>
	</div>
{/if}