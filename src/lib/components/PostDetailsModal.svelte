<script>
	import { createEventDispatcher } from 'svelte';

	export let posts = [];
	export let date = '';
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	function closeModal() {
		isOpen = false;
		dispatch('close');
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	// Formatear fecha según el tipo de fuente
	function formatPostDate(post) {
		if (!post.created) return 'Sin fecha';

		// IMPORTANTE: BigQuery devuelve fechas en UTC como string sin zona horaria
		// Ejemplo: "2025-11-04 17:14:26" es UTC, no hora local
		// Necesitamos parsear explícitamente como UTC para evitar conversiones incorrectas

		let dateString = post.created;

		// Reemplazar espacio con 'T' y agregar 'Z' para indicar UTC
		// "2025-11-04 17:14:26" → "2025-11-04T17:14:26Z"
		if (!dateString.includes('T')) {
			dateString = dateString.replace(' ', 'T') + 'Z';
		}

		let date = new Date(dateString);

		// Mostrar fecha + hora en zona horaria de Chile (America/Santiago)
		// NOTA: Las noticias muestran la hora del scraper (generalmente ~00:00 Chile)
		// ya que la mayoría de medios no publican la hora exacta de la noticia
		return date.toLocaleString('es-CL', {
			timeZone: 'America/Santiago',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	// Agrupar posts por usuario
	$: userGroups = posts.reduce((groups, post) => {
		const userName = post.user_name || 'Usuario desconocido';
		if (!groups[userName]) {
			groups[userName] = [];
		}
		groups[userName].push(post);
		return groups;
	}, {});

	$: sortedUsers = Object.entries(userGroups)
		.map(([userName, userPosts]) => ({
			userName,
			posts: userPosts,
			totalEngagement: userPosts.reduce((sum, p) =>
				sum + parseInt(p.likes || 0) + parseInt(p.replies || 0), 0
			)
		}))
		.sort((a, b) => b.totalEngagement - a.totalEngagement);
</script>

{#if isOpen}
	<div class="modal-backdrop" on:click={handleBackdropClick}>
		<div class="modal-content">
			<div class="modal-header">
				<div>
					<h2>📅 Posts del {date}</h2>
					<p class="modal-subtitle">
						{posts.length} {posts.length === 1 ? 'post' : 'posts'}
						• {sortedUsers.length} {sortedUsers.length === 1 ? 'usuario' : 'usuarios'}
					</p>
				</div>
				<button class="close-btn" on:click={closeModal}>✕</button>
			</div>

			<div class="modal-body">
				{#each sortedUsers as { userName, posts: userPosts, totalEngagement }}
					<div class="user-section">
						<div class="user-header">
							<h3 class="user-name">{userName}</h3>
							<div class="user-stats">
								<span class="stat">
									📊 {userPosts.length} {userPosts.length === 1 ? 'post' : 'posts'}
								</span>
								<span class="stat">
									💬 {totalEngagement.toLocaleString()} engagement
								</span>
							</div>
						</div>

						<div class="posts-list">
							{#each userPosts as post}
								<div class="post-card">
									<div class="post-header">
										<span class="post-source">
											{post.source === 'twitter' ? '🐦 Twitter' :
											 post.source === 'news' ? '📰 Noticias' :
											 post.source === 'tiktok' ? '🎵 TikTok' :
											 post.source === 'instagram' ? '📷 Instagram' :
											 post.source === 'facebook' ? '👥 Facebook' :
											 '🌐 ' + (post.source || 'Desconocido')}
										</span>
										<span class="post-time">
											{formatPostDate(post)}
										</span>
									</div>

									<p class="post-text">{post.text || 'Sin texto'}</p>

									<div class="post-engagement">
										<span class="engagement-item">
											❤️ {parseInt(post.likes || 0).toLocaleString()} likes
										</span>
										<span class="engagement-item">
											💬 {parseInt(post.replies || 0).toLocaleString()} replies
										</span>
									</div>

									{#if post.link}
										<a
											href={post.link}
											target="_blank"
											rel="noopener noreferrer"
											class="post-link"
										>
											🔗 Ver original
										</a>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 20px;
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		max-width: 900px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 24px;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #333;
	}

	.modal-subtitle {
		margin: 0.5rem 0 0 0;
		font-size: 0.9rem;
		color: #666;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #999;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: #f0f0f0;
		color: #333;
	}

	.modal-body {
		overflow-y: auto;
		padding: 24px;
		flex: 1;
	}

	.user-section {
		margin-bottom: 2rem;
	}

	.user-section:last-child {
		margin-bottom: 0;
	}

	.user-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid #e0e0e0;
	}

	.user-name {
		margin: 0;
		font-size: 1.2rem;
		color: #333;
	}

	.user-stats {
		display: flex;
		gap: 1rem;
	}

	.stat {
		font-size: 0.85rem;
		color: #666;
		background: #f5f5f5;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
	}

	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.post-card {
		background: #f9f9f9;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1rem;
		transition: all 0.2s;
	}

	.post-card:hover {
		border-color: #3498db;
		box-shadow: 0 2px 8px rgba(52, 152, 219, 0.1);
	}

	.post-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
	}

	.post-source {
		font-weight: 600;
		color: #3498db;
	}

	.post-time {
		color: #999;
	}

	.post-text {
		margin: 0 0 0.75rem 0;
		line-height: 1.5;
		color: #333;
	}

	.post-engagement {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.engagement-item {
		font-size: 0.85rem;
		color: #666;
	}

	.post-link {
		display: inline-block;
		color: #3498db;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		transition: color 0.2s;
	}

	.post-link:hover {
		color: #2980b9;
		text-decoration: underline;
	}

	/* Scrollbar styling */
	.modal-body::-webkit-scrollbar {
		width: 8px;
	}

	.modal-body::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 4px;
	}

	.modal-body::-webkit-scrollbar-thumb {
		background: #888;
		border-radius: 4px;
	}

	.modal-body::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>