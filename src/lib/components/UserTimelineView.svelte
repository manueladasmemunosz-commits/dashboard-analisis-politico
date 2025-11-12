<script>
	import { onMount } from 'svelte';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let posts = [];

	let displayedPosts = [];
	let currentPage = 1;
	let itemsPerPage = 50;
	let totalPages = 1;
	let searchFilter = '';
	let timeFilter = '24'; // horas por defecto
	let selectedUsers = new Set();
	let availableUsers = [];
	let watchedUsersList = ''; // Lista de usuarios a seguir (uno por línea)
	let showUserListEditor = false;
	let isLoadingNewPosts = false;
	let lastQueryTime = null;
	let newPostsCount = 0;

	// Lista predeterminada de usuarios importantes (puedes editarla)
	let watchedUsers = [
		// Políticos
		'Gabriel Boric',
		'Evelyn Matthei',
		'José Antonio Kast',
		'Pamela Jiles',
		// Periodistas
		// Medios
		// Agregar más usuarios aquí
	];

	// Modal state
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Cargar lista de usuarios y última consulta desde localStorage
	onMount(() => {
		const saved = localStorage.getItem('watchedUsers');
		if (saved) {
			try {
				watchedUsers = JSON.parse(saved);
			} catch (e) {
				console.error('Error cargando usuarios guardados:', e);
			}
		}
		watchedUsersList = watchedUsers.join('\n');

		// Cargar última fecha de consulta
		const savedLastQuery = localStorage.getItem('lastQueryTime');
		if (savedLastQuery) {
			lastQueryTime = new Date(savedLastQuery);
		}
	});

	// Guardar lista de usuarios
	function saveWatchedUsers() {
		const users = watchedUsersList.split('\n')
			.map(u => u.trim())
			.filter(u => u.length > 0);
		watchedUsers = users;
		localStorage.setItem('watchedUsers', JSON.stringify(users));
		showUserListEditor = false;
	}

	// Consultar nuevas publicaciones desde la última consulta
	async function fetchNewPosts() {
		if (watchedUsers.length === 0) {
			alert('⚠️ Por favor, agrega usuarios a tu lista de seguimiento primero');
			return;
		}

		isLoadingNewPosts = true;
		newPostsCount = 0;

		try {
			// Determinar rango de fechas
			const now = new Date();
			const dateFrom = lastQueryTime || new Date(now.getTime() - (timeFilter * 60 * 60 * 1000));

			// Formatear fechas en formato YYYY-MM-DD
			const dateFromStr = dateFrom.toISOString().split('T')[0];
			const dateToStr = now.toISOString().split('T')[0];

			// Construir query con OR conditions para cada usuario
			// Formato: (user1 OR user2 OR user3)
			const userQueries = watchedUsers.map(user => `"${user}"`).join(' OR ');
			const searchTerm = `(${userQueries})`;

			console.log('🔍 Consultando nuevas publicaciones:', {
				dateFrom: dateFromStr,
				dateTo: dateToStr,
				searchTerm,
				usuarios: watchedUsers.length
			});

			// Llamar al endpoint de BigQuery
			const response = await fetch('/api/bigquery', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					dateFrom: dateFromStr,
					dateTo: dateToStr,
					searchTerm: searchTerm
				})
			});

			if (!response.ok) {
				throw new Error(`Error ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			const newPosts = data.data || [];

			console.log(`✅ Recibidos ${newPosts.length} posts de BigQuery`);

			// Mergear con posts existentes, evitando duplicados
			// Usar un Set con IDs únicos (combinación de created + text + user_name)
			const existingIds = new Set(
				posts.map(p => `${p.created}_${p.user_name}_${p.text?.substring(0, 50)}`)
			);

			const trulyNewPosts = newPosts.filter(p => {
				const id = `${p.created}_${p.user_name}_${p.text?.substring(0, 50)}`;
				return !existingIds.has(id);
			});

			// Agregar nuevos posts al array existente
			posts = [...posts, ...trulyNewPosts];
			newPostsCount = trulyNewPosts.length;

			// Actualizar y guardar lastQueryTime
			lastQueryTime = now;
			localStorage.setItem('lastQueryTime', now.toISOString());

			console.log(`✨ Agregados ${newPostsCount} posts nuevos (${newPosts.length - newPostsCount} duplicados omitidos)`);

			// Mostrar notificación
			if (newPostsCount > 0) {
				alert(`✅ Se encontraron ${newPostsCount} nuevas publicaciones`);
			} else {
				alert('ℹ️ No se encontraron publicaciones nuevas');
			}

		} catch (error) {
			console.error('❌ Error consultando nuevas publicaciones:', error);
			alert(`❌ Error al consultar publicaciones: ${error.message}`);
		} finally {
			isLoadingNewPosts = false;
		}
	}

	// Calcular usuarios únicos con sus estadísticas (solo usuarios en watchlist)
	$: availableUsers = calculateAvailableUsers(posts, timeFilter, watchedUsers);

	function calculateAvailableUsers(allPosts, hours, watchlist) {
		const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
		const watchlistLower = watchlist.map(u => u.toLowerCase());

		const userStats = {};

		allPosts.forEach(post => {
			const postDate = new Date(post.created);
			if (postDate < cutoffTime) return;

			const userName = post.user_name || 'Usuario desconocido';

			// FILTRAR: Solo usuarios en la watchlist
			if (!watchlistLower.some(w => userName.toLowerCase().includes(w))) {
				return;
			}

			if (!userStats[userName]) {
				userStats[userName] = {
					name: userName,
					count: 0,
					totalEngagement: 0,
					sources: new Set()
				};
			}

			userStats[userName].count++;
			userStats[userName].totalEngagement += parseInt(post.engagement || 0);
			userStats[userName].sources.add(post.source || 'unknown');
		});

		return Object.values(userStats)
			.map(user => ({
				...user,
				sources: Array.from(user.sources)
			}))
			.sort((a, b) => b.count - a.count);
	}

	// Preparar lista de publicaciones filtradas
	let processedPosts = [];
	$: {
		const cutoffTime = new Date(Date.now() - (timeFilter * 60 * 60 * 1000));

		const filtered = posts.filter(post => {
			const postDate = new Date(post.created);
			if (postDate < cutoffTime) return false;

			// Si hay usuarios seleccionados, filtrar por ellos
			if (selectedUsers.size > 0) {
				const userName = post.user_name || 'Usuario desconocido';
				if (!selectedUsers.has(userName)) return false;
			}

			// Aplicar filtro de búsqueda
			if (searchFilter.trim()) {
				const filter = searchFilter.toLowerCase();
				const userName = (post.user_name || '').toLowerCase();
				const text = (post.text || '').toLowerCase();
				return userName.includes(filter) || text.includes(filter);
			}

			return true;
		});

		processedPosts = filtered
			.map(post => ({
				...post,
				dateObj: new Date(post.created || 0)
			}))
			.sort((a, b) => b.dateObj - a.dateObj);
	}

	// Calcular paginación
	$: {
		totalPages = Math.ceil(processedPosts.length / itemsPerPage);
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		displayedPosts = processedPosts.slice(start, end);
	}

	function goToPage(page) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
	}

	function toggleUser(userName) {
		if (selectedUsers.has(userName)) {
			selectedUsers.delete(userName);
		} else {
			selectedUsers.add(userName);
		}
		selectedUsers = selectedUsers; // trigger reactivity
		currentPage = 1;
	}

	function clearUserSelection() {
		selectedUsers.clear();
		selectedUsers = selectedUsers;
		currentPage = 1;
	}

	function showPostDetails(post) {
		selectedTitle = `${post.user_name || 'Usuario desconocido'} - ${formatDate(post.created)}`;
		selectedPosts = [post];
		showModal = true;
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString('es-CL', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateStr;
		}
	}

	function getSourceIcon(source) {
		const s = (source || '').toLowerCase();
		if (s === 'twitter' || s === 'x') return '🐦';
		if (s === 'facebook') return '👥';
		if (s === 'instagram') return '📷';
		if (s === 'tiktok') return '🎵';
		if (s === 'news') return '📰';
		return '🌐';
	}
</script>

<div class="user-timeline-container">
	<div class="header">
		<div>
			<h3>👥 Timeline de Usuarios</h3>
			<p class="subtitle">
				Seguimiento de {watchedUsers.length} usuarios específicos
				{#if lastQueryTime}
					• Última consulta: {lastQueryTime.toLocaleString('es-CL')}
				{:else}
					• No se han consultado publicaciones aún
				{/if}
			</p>
		</div>
		<div class="header-buttons">
			<button
				class="fetch-new-btn"
				on:click={fetchNewPosts}
				disabled={isLoadingNewPosts || watchedUsers.length === 0}
			>
				{#if isLoadingNewPosts}
					⏳ Consultando...
				{:else}
					🔄 Consultar nuevas publicaciones
				{/if}
			</button>
			<button class="edit-list-btn" on:click={() => showUserListEditor = true}>
				✏️ Editar lista de usuarios
			</button>
		</div>
	</div>

	<div class="controls-section">
		<!-- Filtro de tiempo -->
		<div class="control-group">
			<label>⏰ Período de tiempo:</label>
			<div class="time-buttons">
				<button
					class="time-btn"
					class:active={timeFilter === '1'}
					on:click={() => { timeFilter = '1'; currentPage = 1; }}
				>
					Última hora
				</button>
				<button
					class="time-btn"
					class:active={timeFilter === '6'}
					on:click={() => { timeFilter = '6'; currentPage = 1; }}
				>
					6 horas
				</button>
				<button
					class="time-btn"
					class:active={timeFilter === '24'}
					on:click={() => { timeFilter = '24'; currentPage = 1; }}
				>
					24 horas
				</button>
				<button
					class="time-btn"
					class:active={timeFilter === '48'}
					on:click={() => { timeFilter = '48'; currentPage = 1; }}
				>
					48 horas
				</button>
				<button
					class="time-btn"
					class:active={timeFilter === '168'}
					on:click={() => { timeFilter = '168'; currentPage = 1; }}
				>
					7 días
				</button>
			</div>
		</div>

		<!-- Búsqueda -->
		<div class="control-group">
			<input
				type="text"
				placeholder="Buscar por usuario o contenido..."
				bind:value={searchFilter}
				class="search-input"
			/>
		</div>

		<!-- Estadísticas -->
		<div class="stats-bar">
			<span class="stat-item">
				👥 {availableUsers.length} usuarios activos
			</span>
			<span class="stat-item">
				📝 {processedPosts.length} publicaciones
			</span>
			{#if selectedUsers.size > 0}
				<button class="clear-btn" on:click={clearUserSelection}>
					✕ Limpiar selección ({selectedUsers.size})
				</button>
			{/if}
		</div>
	</div>

	<div class="content-wrapper">
		<!-- Sidebar con usuarios -->
		<div class="users-sidebar">
			<h4>Usuarios más activos</h4>
			<div class="users-list">
				{#each availableUsers.slice(0, 20) as user}
					<div
						class="user-card"
						class:selected={selectedUsers.has(user.name)}
						on:click={() => toggleUser(user.name)}
					>
						<div class="user-info">
							<span class="user-name">{user.name}</span>
							<div class="user-sources">
								{#each user.sources as source}
									<span class="source-icon">{getSourceIcon(source)}</span>
								{/each}
							</div>
						</div>
						<div class="user-stats-compact">
							<span class="posts-count">{user.count} posts</span>
							{#if user.totalEngagement > 0}
								<span class="engagement-count">💬 {user.totalEngagement}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Posts timeline -->
		<div class="posts-timeline">
			{#if displayedPosts.length === 0}
				<div class="empty-state">
					<p>
						{#if selectedUsers.size > 0}
							No hay publicaciones de los usuarios seleccionados en las últimas {timeFilter} horas
						{:else}
							No hay publicaciones en las últimas {timeFilter} horas
						{/if}
					</p>
				</div>
			{:else}
				{#each displayedPosts as post, index (`${post.link || ''}-${post.created || ''}-${index}`)}
					<div class="post-item">
						<div class="post-header">
							<div class="post-user">
								<span class="source-icon">{getSourceIcon(post.source)}</span>
								<span class="user-name-large">{post.user_name || 'Usuario desconocido'}</span>
							</div>
							<span class="post-time" title={formatDate(post.created)}>
								{new Date(post.created).toLocaleTimeString('es-CL', {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</span>
						</div>
						<div class="post-content">
							{#if post.link}
								<a
									href={post.link}
									target="_blank"
									rel="noopener noreferrer"
									class="post-text"
								>
									{post.text || 'Sin contenido'}
								</a>
							{:else}
								<span class="post-text">{post.text || 'Sin contenido'}</span>
							{/if}
						</div>
						<div class="post-footer">
							<div class="post-meta">
								{#if post.engagement}
									<span class="engagement">💬 {post.engagement}</span>
								{/if}
								{#if post.likes}
									<span class="likes">❤️ {post.likes}</span>
								{/if}
								{#if post.replies}
									<span class="replies">💭 {post.replies}</span>
								{/if}
							</div>
							<button
								class="details-btn-small"
								on:click|stopPropagation={() => showPostDetails(post)}
								title="Ver detalles"
							>
								ℹ️
							</button>
						</div>
					</div>
				{/each}
			{/if}

			{#if totalPages > 1}
				<div class="pagination">
					<button
						on:click={() => goToPage(currentPage - 1)}
						disabled={currentPage === 1}
						class="page-btn"
					>
						← Anterior
					</button>

					<span class="page-info">
						Página {currentPage} de {totalPages}
					</span>

					<button
						on:click={() => goToPage(currentPage + 1)}
						disabled={currentPage === totalPages}
						class="page-btn"
					>
						Siguiente →
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Modal para editar lista de usuarios -->
{#if showUserListEditor}
	<div class="modal-backdrop" on:click={() => showUserListEditor = false}>
		<div class="modal-editor" on:click|stopPropagation>
			<div class="modal-editor-header">
				<h3>✏️ Editar Lista de Usuarios</h3>
				<button class="close-modal-btn" on:click={() => showUserListEditor = false}>✕</button>
			</div>
			<div class="modal-editor-body">
				<p class="editor-instructions">
					Ingresa un nombre de usuario por línea. El sistema buscará coincidencias parciales
					(ej: "Boric" encontrará "Gabriel Boric Font", "@gabrielboric", etc.)
				</p>
				<textarea
					bind:value={watchedUsersList}
					placeholder="Gabriel Boric&#10;Evelyn Matthei&#10;José Antonio Kast&#10;Pamela Jiles&#10;..."
					rows="15"
					class="user-list-textarea"
				></textarea>
				<div class="editor-actions">
					<button class="cancel-btn" on:click={() => showUserListEditor = false}>
						Cancelar
					</button>
					<button class="save-btn" on:click={saveWatchedUsers}>
						💾 Guardar lista
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if showModal}
	<PostDetailsModal
		posts={selectedPosts}
		date={selectedTitle}
		isOpen={showModal}
		on:close={() => showModal = false}
	/>
{/if}

<style>
	.user-timeline-container {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		padding: 20px;
		margin: 20px 0;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		border-bottom: 2px solid #e0e0e0;
		padding-bottom: 15px;
	}

	.header h3 {
		margin: 0 0 5px 0;
		color: #2c3e50;
		font-size: 1.5em;
	}

	.subtitle {
		margin: 0;
		color: #7f8c8d;
		font-size: 0.9em;
	}

	.header-buttons {
		display: flex;
		gap: 10px;
		flex-shrink: 0;
	}

	.fetch-new-btn {
		padding: 10px 20px;
		background: #27ae60;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.fetch-new-btn:hover:not(:disabled) {
		background: #229954;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.fetch-new-btn:disabled {
		background: #95a5a6;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.edit-list-btn {
		padding: 10px 20px;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.edit-list-btn:hover {
		background: #2980b9;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	/* Modal de edición */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 10000;
	}

	.modal-editor {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 2px solid #e0e0e0;
	}

	.modal-editor-header h3 {
		margin: 0;
		color: #2c3e50;
		font-size: 1.3em;
	}

	.close-modal-btn {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: #7f8c8d;
		padding: 0;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s;
	}

	.close-modal-btn:hover {
		color: #e74c3c;
	}

	.modal-editor-body {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 15px;
		overflow-y: auto;
	}

	.editor-instructions {
		margin: 0;
		padding: 15px;
		background: #e3f2fd;
		border-left: 4px solid #3498db;
		border-radius: 4px;
		font-size: 14px;
		color: #2c3e50;
		line-height: 1.5;
	}

	.user-list-textarea {
		width: 100%;
		padding: 15px;
		border: 2px solid #e0e0e0;
		border-radius: 5px;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		font-size: 14px;
		line-height: 1.6;
		resize: vertical;
		transition: border-color 0.3s;
	}

	.user-list-textarea:focus {
		outline: none;
		border-color: #3498db;
	}

	.editor-actions {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}

	.cancel-btn, .save-btn {
		padding: 10px 20px;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.cancel-btn {
		background: #ecf0f1;
		color: #2c3e50;
	}

	.cancel-btn:hover {
		background: #bdc3c7;
	}

	.save-btn {
		background: #27ae60;
		color: white;
	}

	.save-btn:hover {
		background: #229954;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.controls-section {
		display: flex;
		flex-direction: column;
		gap: 15px;
		margin-bottom: 20px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.control-group label {
		font-weight: 600;
		color: #2c3e50;
		font-size: 14px;
	}

	.time-buttons {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.time-btn {
		padding: 8px 16px;
		border: 2px solid #e0e0e0;
		background: white;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.time-btn:hover {
		border-color: #3498db;
		background: #ecf0f1;
	}

	.time-btn.active {
		border-color: #3498db;
		background: #3498db;
		color: white;
		font-weight: 600;
	}

	.search-input {
		padding: 10px 15px;
		border: 2px solid #e0e0e0;
		border-radius: 5px;
		font-size: 14px;
		transition: border-color 0.3s;
	}

	.search-input:focus {
		outline: none;
		border-color: #3498db;
	}

	.stats-bar {
		display: flex;
		gap: 15px;
		align-items: center;
		flex-wrap: wrap;
	}

	.stat-item {
		background: #ecf0f1;
		padding: 8px 15px;
		border-radius: 5px;
		font-size: 14px;
		font-weight: 600;
		color: #2c3e50;
	}

	.clear-btn {
		padding: 8px 15px;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: background 0.2s;
	}

	.clear-btn:hover {
		background: #c0392b;
	}

	.content-wrapper {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 20px;
	}

	.users-sidebar {
		border-right: 2px solid #e0e0e0;
		padding-right: 20px;
	}

	.users-sidebar h4 {
		margin: 0 0 15px 0;
		color: #2c3e50;
		font-size: 1.1em;
	}

	.users-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 600px;
		overflow-y: auto;
	}

	.user-card {
		padding: 12px;
		border: 2px solid #e0e0e0;
		border-radius: 5px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.user-card:hover {
		border-color: #3498db;
		background: #f8f9fa;
	}

	.user-card.selected {
		border-color: #3498db;
		background: #e3f2fd;
	}

	.user-info {
		margin-bottom: 8px;
	}

	.user-name {
		font-weight: 600;
		color: #2c3e50;
		font-size: 14px;
		display: block;
		margin-bottom: 5px;
	}

	.user-sources {
		display: flex;
		gap: 5px;
	}

	.source-icon {
		font-size: 14px;
	}

	.user-stats-compact {
		display: flex;
		gap: 10px;
		font-size: 12px;
		color: #7f8c8d;
	}

	.posts-count, .engagement-count {
		font-weight: 600;
	}

	.posts-timeline {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.post-item {
		padding: 15px;
		border: 1px solid #e0e0e0;
		border-radius: 5px;
		background: #f8f9fa;
		transition: box-shadow 0.2s;
	}

	.post-item:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.post-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.post-user {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.user-name-large {
		font-weight: 700;
		color: #3498db;
		font-size: 14px;
	}

	.post-time {
		font-size: 12px;
		color: #7f8c8d;
		font-style: italic;
	}

	.post-content {
		margin-bottom: 10px;
	}

	.post-text {
		color: #2c3e50;
		font-size: 14px;
		line-height: 1.5;
		display: block;
		text-decoration: none;
	}

	a.post-text:hover {
		color: #3498db;
		text-decoration: underline;
	}

	.post-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.post-meta {
		display: flex;
		gap: 15px;
		font-size: 12px;
		color: #7f8c8d;
	}

	.engagement, .likes, .replies {
		font-weight: 600;
	}

	.details-btn-small {
		padding: 5px 10px;
		background: #ecf0f1;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.details-btn-small:hover {
		background: #3498db;
		transform: scale(1.1);
	}

	.empty-state {
		padding: 60px 20px;
		text-align: center;
		color: #7f8c8d;
		font-size: 16px;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 20px;
		margin-top: 20px;
		padding-top: 15px;
		border-top: 1px solid #e0e0e0;
	}

	.page-btn {
		padding: 8px 16px;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.3s;
	}

	.page-btn:hover:not(:disabled) {
		background: #2980b9;
	}

	.page-btn:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
	}

	.page-info {
		font-weight: 600;
		color: #2c3e50;
	}

	/* Scrollbar styling */
	.users-list::-webkit-scrollbar {
		width: 6px;
	}

	.users-list::-webkit-scrollbar-track {
		background: #f1f1f1;
	}

	.users-list::-webkit-scrollbar-thumb {
		background: #bdc3c7;
		border-radius: 3px;
	}

	.users-list::-webkit-scrollbar-thumb:hover {
		background: #95a5a6;
	}
</style>
