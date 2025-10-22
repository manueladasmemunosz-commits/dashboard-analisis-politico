<script>
	// Redirigir a la página principal
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/');
	});
</script>

<!-- Mientras redirige -->
<div class="loading">
	<p>Redirigiendo al Dashboard...</p>
</div>

<style>
	.loading {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		font-size: 1.2rem;
		color: var(--chile-blue-600);
	}
</style>