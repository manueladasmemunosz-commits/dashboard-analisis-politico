<script>
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	export let allProyectos = []; // Recibir desde el padre
	export let selectedProyectoIds = []; // Recibir desde el padre

	let selectedProyectos = [];
	let showModal = false;
	let editingProyecto = null;
	let loading = false;
	let aplicandoProyecto = false;

	// Formulario
	let formData = {
		id: '',
		nombre: '',
		descripcion: '',
		creador: '',
		query: {
			searchTerm: '',
			dateFrom: '2024-01-01',
			dateTo: '2024-12-31',
			redes: ['twitter', 'news']
		},
		color: '#3498db'
	};

	// Cargar proyectos al montar
	onMount(async () => {
		await loadProyectos();
	});

	async function loadProyectos() {
		try {
			loading = true;

			// Intentar cargar desde localStorage primero (para Vercel)
			if (typeof window !== 'undefined') {
				const stored = localStorage.getItem('proyectos');
				if (stored) {
					allProyectos = JSON.parse(stored);
					console.log('✅ Proyectos cargados desde localStorage:', allProyectos.length);
					dispatch('proyectosUpdated', { proyectos: allProyectos });
					loading = false;
					return;
				}
			}

			// Fallback: intentar API (para desarrollo local)
			const response = await fetch('/api/proyectos');
			if (response.ok) {
				allProyectos = await response.json();
				console.log('✅ Proyectos cargados desde API:', allProyectos.length);
				// Guardar en localStorage
				if (typeof window !== 'undefined') {
					localStorage.setItem('proyectos', JSON.stringify(allProyectos));
				}
				dispatch('proyectosUpdated', { proyectos: allProyectos });
			} else {
				console.log('⚠️ API no disponible, usando localStorage vacío');
				allProyectos = [];
			}
		} catch (error) {
			console.log('⚠️ API no disponible:', error.message);
			allProyectos = [];
		} finally {
			loading = false;
		}
	}

	function toggleProyecto(proyectoId) {
		if (selectedProyectos.includes(proyectoId)) {
			selectedProyectos = selectedProyectos.filter(id => id !== proyectoId);
		} else {
			selectedProyectos = [...selectedProyectos, proyectoId];
		}
	}

	function aplicarProyecto(proyecto) {
		// Evitar clicks múltiples
		if (aplicandoProyecto) return;

		aplicandoProyecto = true;
		dispatch('aplicarProyecto', { proyecto });

		// Resetear después de 2 segundos
		setTimeout(() => {
			aplicandoProyecto = false;
		}, 2000);
	}

	function compararProyectos() {
		const proyectosSeleccionados = allProyectos.filter(p => selectedProyectos.includes(p.id));
		dispatch('compararProyectos', { proyectos: proyectosSeleccionados });
	}

	// Abrir modal para crear
	function abrirModalCrear() {
		editingProyecto = null;
		formData = {
			id: '',
			nombre: '',
			descripcion: '',
			creador: '',
			query: {
				searchTerm: '',
				dateFrom: '2024-01-01',
				dateTo: '2024-12-31',
				redes: ['twitter', 'news']
			},
			color: '#3498db'
		};
		showModal = true;
	}

	// Abrir modal para editar
	function abrirModalEditar(proyecto) {
		editingProyecto = proyecto;
		formData = JSON.parse(JSON.stringify(proyecto)); // Deep copy
		showModal = true;
	}

	// Guardar proyecto (crear o editar)
	async function guardarProyecto() {
		try {
			loading = true;

			// Validar campos requeridos
			if (!formData.nombre || !formData.query.searchTerm) {
				alert('⚠️ Nombre y query son obligatorios');
				loading = false;
				return;
			}

			// Generar ID si no existe
			if (!formData.id) {
				formData.id = formData.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
			}

			if (editingProyecto) {
				// Actualizar proyecto existente
				const index = allProyectos.findIndex(p => p.id === formData.id);
				if (index !== -1) {
					formData.updatedAt = new Date().toISOString();
					allProyectos[index] = { ...formData };
				}
			} else {
				// Crear nuevo proyecto
				formData.createdAt = new Date().toISOString();

				// Verificar que no exista
				if (allProyectos.find(p => p.id === formData.id)) {
					alert('❌ Ya existe un proyecto con ese nombre');
					loading = false;
					return;
				}

				allProyectos = [...allProyectos, { ...formData }];
			}

			// Guardar en localStorage
			if (typeof window !== 'undefined') {
				localStorage.setItem('proyectos', JSON.stringify(allProyectos));
			}

			console.log('✅ Proyecto guardado en localStorage');
			dispatch('proyectosUpdated', { proyectos: allProyectos });
			showModal = false;
		} catch (error) {
			console.error('❌ Error guardando proyecto:', error);
			alert('❌ Error al guardar proyecto');
		} finally {
			loading = false;
		}
	}

	// Eliminar proyecto
	async function eliminarProyecto(proyecto) {
		if (!confirm(`¿Seguro que quieres eliminar "${proyecto.nombre}"?`)) {
			return;
		}

		try {
			loading = true;

			// Eliminar del array
			allProyectos = allProyectos.filter(p => p.id !== proyecto.id);

			// Guardar en localStorage
			if (typeof window !== 'undefined') {
				localStorage.setItem('proyectos', JSON.stringify(allProyectos));
			}

			console.log('✅ Proyecto eliminado de localStorage');
			dispatch('proyectosUpdated', { proyectos: allProyectos });
		} catch (error) {
			console.error('❌ Error eliminando proyecto:', error);
			alert('❌ Error al eliminar proyecto');
		} finally {
			loading = false;
		}
	}
</script>

<div class="proyectos-container">
	<div class="proyectos-header">
		<div>
			<h2>📁 Proyectos del Equipo</h2>
			<p class="proyectos-subtitle">Queries predeterminadas para análisis rápido y comparaciones</p>
		</div>
		<button class="btn btn-crear" on:click={abrirModalCrear}>
			➕ Crear Nuevo Proyecto
		</button>
	</div>

	{#if loading}
		<div class="loading">⏳ Cargando proyectos...</div>
	{:else if allProyectos.length === 0}
		<div class="empty-state">
			<p>📭 No hay proyectos creados aún</p>
			<button class="btn btn-primary" on:click={abrirModalCrear}>
				Crear tu primer proyecto
			</button>
		</div>
	{:else}
		<div class="proyectos-grid">
			{#each allProyectos as proyecto}
				<div class="proyecto-card" style="border-left-color: {proyecto.color}">
					<div class="proyecto-header">
						<label class="proyecto-checkbox">
							<input
								type="checkbox"
								checked={selectedProyectos.includes(proyecto.id)}
								on:change={() => toggleProyecto(proyecto.id)}
							/>
							<span class="proyecto-color" style="background-color: {proyecto.color}"></span>
							<h3>{proyecto.nombre}</h3>
						</label>
					</div>

					<p class="proyecto-descripcion">{proyecto.descripcion}</p>

					<div class="proyecto-query">
						<div class="query-label">🔍 Query:</div>
						<code>{proyecto.query.searchTerm}</code>
					</div>

					<div class="proyecto-meta">
						<span class="meta-item">
							📅 {proyecto.query.dateFrom} → {proyecto.query.dateTo}
						</span>
						<span class="meta-item">
							👤 {proyecto.creador}
						</span>
					</div>

					<div class="proyecto-actions">
						<button
							class="btn btn-primary"
							on:click={() => aplicarProyecto(proyecto)}
						>
							📊 Aplicar
						</button>
						<button
							class="btn btn-edit"
							on:click={() => abrirModalEditar(proyecto)}
						>
							✏️ Editar
						</button>
						<button
							class="btn btn-delete"
							on:click={() => eliminarProyecto(proyecto)}
						>
							🗑️
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if selectedProyectos.length > 1}
		<div class="comparar-banner">
			<p>
				<strong>{selectedProyectos.length} proyectos seleccionados</strong>
			</p>
			<button class="btn btn-compare" on:click={compararProyectos}>
				🔄 Comparar Proyectos Seleccionados
			</button>
		</div>
	{/if}
</div>

<!-- Modal de Crear/Editar -->
{#if showModal}
	<div class="modal-overlay" on:click={() => showModal = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>{editingProyecto ? '✏️ Editar Proyecto' : '➕ Crear Proyecto'}</h2>
				<button class="modal-close" on:click={() => showModal = false}>✕</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="nombre">Nombre del Proyecto *</label>
					<input
						id="nombre"
						type="text"
						bind:value={formData.nombre}
						placeholder="ej: Reforma Educacional"
					/>
				</div>

				<div class="form-group">
					<label for="descripcion">Descripción</label>
					<textarea
						id="descripcion"
						bind:value={formData.descripcion}
						placeholder="Describe el objetivo del proyecto..."
						rows="3"
					></textarea>
				</div>

				<div class="form-group">
					<label for="creador">Creador</label>
					<input
						id="creador"
						type="text"
						bind:value={formData.creador}
						placeholder="Tu nombre"
					/>
				</div>

				<div class="form-group">
					<label for="searchTerm">Query de Búsqueda *</label>
					<input
						id="searchTerm"
						type="text"
						bind:value={formData.query.searchTerm}
						placeholder='ej: reforma educacional OR simce OR mineduc'
					/>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="dateFrom">Fecha Desde</label>
						<input
							id="dateFrom"
							type="date"
							bind:value={formData.query.dateFrom}
						/>
					</div>

					<div class="form-group">
						<label for="dateTo">Fecha Hasta</label>
						<input
							id="dateTo"
							type="date"
							bind:value={formData.query.dateTo}
						/>
					</div>
				</div>

				<div class="form-group">
					<label for="color">Color</label>
					<input
						id="color"
						type="color"
						bind:value={formData.color}
					/>
				</div>

				<div class="modal-actions">
					<button class="btn btn-secondary" on:click={() => showModal = false}>
						Cancelar
					</button>
					<button class="btn btn-primary" on:click={guardarProyecto} disabled={loading}>
						{loading ? '⏳ Guardando...' : (editingProyecto ? '💾 Guardar Cambios' : '✅ Crear Proyecto')}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.proyectos-container {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.proyectos-header {
		margin-bottom: 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.proyectos-header h2 {
		font-size: 2rem;
		color: #2c3e50;
		margin: 0 0 0.5rem 0;
	}

	.proyectos-subtitle {
		color: #7f8c8d;
		font-size: 1rem;
		margin: 0;
	}

	.loading, .empty-state {
		text-align: center;
		padding: 3rem;
		color: #7f8c8d;
		font-size: 1.1rem;
	}

	.empty-state p {
		margin-bottom: 1.5rem;
		font-size: 1.3rem;
	}

	.proyectos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.proyecto-card {
		background: white;
		border: 1px solid #e0e0e0;
		border-left: 4px solid;
		border-radius: 8px;
		padding: 1.5rem;
		transition: all 0.3s ease;
		box-shadow: 0 2px 4px rgba(0,0,0,0.05);
	}

	.proyecto-card:hover {
		box-shadow: 0 4px 12px rgba(0,0,0,0.1);
		transform: translateY(-2px);
	}

	.proyecto-header {
		margin-bottom: 1rem;
	}

	.proyecto-checkbox {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.proyecto-checkbox input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.proyecto-color {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		display: inline-block;
	}

	.proyecto-checkbox h3 {
		font-size: 1.25rem;
		color: #2c3e50;
		margin: 0;
		flex: 1;
	}

	.proyecto-descripcion {
		color: #555;
		font-size: 0.95rem;
		line-height: 1.5;
		margin-bottom: 1rem;
	}

	.proyecto-query {
		background: #f8f9fa;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 1rem;
	}

	.query-label {
		font-size: 0.85rem;
		color: #666;
		margin-bottom: 0.5rem;
	}

	.proyecto-query code {
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		color: #2c3e50;
		display: block;
		word-break: break-word;
	}

	.proyecto-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1rem;
		font-size: 0.85rem;
		color: #666;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.proyecto-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.65rem 1.25rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.btn-primary {
		background: #3498db;
		color: white;
		flex: 1;
	}

	.btn-primary:hover {
		background: #2980b9;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(52, 152, 219, 0.3);
	}

	.btn-crear {
		background: #27ae60;
		color: white;
		padding: 0.75rem 1.5rem;
		white-space: nowrap;
	}

	.btn-crear:hover {
		background: #229954;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
	}

	.btn-edit {
		background: #f39c12;
		color: white;
	}

	.btn-edit:hover {
		background: #e67e22;
		transform: translateY(-1px);
	}

	.btn-delete {
		background: #e74c3c;
		color: white;
		padding: 0.65rem 0.85rem;
	}

	.btn-delete:hover {
		background: #c0392b;
		transform: translateY(-1px);
	}

	.btn-secondary {
		background: #95a5a6;
		color: white;
	}

	.btn-secondary:hover {
		background: #7f8c8d;
	}

	.comparar-banner {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: white;
		padding: 1.25rem 2rem;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0,0,0,0.15);
		display: flex;
		align-items: center;
		gap: 1.5rem;
		z-index: 1000;
		border: 2px solid #3498db;
	}

	.comparar-banner p {
		margin: 0;
		color: #2c3e50;
	}

	.btn-compare {
		background: #27ae60;
		color: white;
		padding: 0.75rem 1.5rem;
		white-space: nowrap;
	}

	.btn-compare:hover {
		background: #229954;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		padding: 1rem;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-content {
		background: white;
		border-radius: 1rem;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
		border-radius: 1rem 1rem 0 0;
		color: white;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.modal-close {
		background: rgba(255, 255, 255, 0.2);
		border: none;
		color: white;
		font-size: 1.5rem;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-close:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: rotate(90deg);
	}

	.modal-body {
		padding: 2rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: #2c3e50;
	}

	.form-group input[type="text"],
	.form-group input[type="date"],
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	.form-group input[type="text"]:focus,
	.form-group input[type="date"]:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #3498db;
	}

	.form-group input[type="color"] {
		width: 80px;
		height: 40px;
		border: 1px solid #ddd;
		border-radius: 6px;
		cursor: pointer;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
	}

	.modal-actions .btn {
		flex: 1;
		padding: 0.85rem 1.5rem;
	}

	@media (max-width: 768px) {
		.proyectos-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.proyectos-grid {
			grid-template-columns: 1fr;
		}

		.comparar-banner {
			flex-direction: column;
			gap: 1rem;
			width: 90%;
			text-align: center;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.modal-actions {
			flex-direction: column;
		}
	}
</style>
