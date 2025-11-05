<script>
	export let icon = '🔍';
	export let title = 'No se encontraron resultados';
	export let description = '';
	export let suggestions = [];
	export let actionText = '';
	export let onAction = null;
</script>

<div class="empty-state">
	<div class="empty-icon">{icon}</div>
	<h3 class="empty-title">{title}</h3>

	{#if description}
		<p class="empty-description">{description}</p>
	{/if}

	{#if suggestions.length > 0}
		<div class="empty-suggestions">
			<p class="suggestions-label">Intenta:</p>
			<ul>
				{#each suggestions as suggestion}
					<li>{suggestion}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if actionText && onAction}
		<button class="empty-action" on:click={onAction}>
			{actionText}
		</button>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
		border-radius: 12px;
		margin: 2rem 0;
		min-height: 400px;
	}

	.empty-icon {
		font-size: 5rem;
		margin-bottom: 1.5rem;
		animation: float 3s ease-in-out infinite;
	}

	@keyframes float {
		0%, 100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-20px);
		}
	}

	.empty-title {
		font-size: 1.8rem;
		font-weight: 700;
		color: #2c3e50;
		margin: 0 0 1rem 0;
	}

	.empty-description {
		font-size: 1.1rem;
		color: #5a6c7d;
		margin: 0 0 1.5rem 0;
		max-width: 500px;
		line-height: 1.6;
	}

	.empty-suggestions {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
		max-width: 500px;
		width: 100%;
	}

	.suggestions-label {
		font-weight: 600;
		color: #34495e;
		margin: 0 0 1rem 0;
		font-size: 1rem;
	}

	.empty-suggestions ul {
		list-style: none;
		padding: 0;
		margin: 0;
		text-align: left;
	}

	.empty-suggestions li {
		padding: 0.6rem 0;
		color: #5a6c7d;
		font-size: 0.95rem;
		position: relative;
		padding-left: 1.5rem;
	}

	.empty-suggestions li:before {
		content: '💡';
		position: absolute;
		left: 0;
		top: 0.5rem;
	}

	.empty-action {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		padding: 0.8rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 25px;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
	}

	.empty-action:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
	}

	.empty-action:active {
		transform: translateY(0);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.empty-state {
			padding: 3rem 1.5rem;
			min-height: 350px;
		}

		.empty-icon {
			font-size: 4rem;
		}

		.empty-title {
			font-size: 1.5rem;
		}

		.empty-description {
			font-size: 1rem;
		}
	}
</style>
