// Web Worker para procesamiento de Top Posts Chart
// Calcula engagement y ordena posts

self.onmessage = function(e) {
	const { posts, limit = 10, chunkSize = 10000 } = e.data;

	console.log(`🔧 Top Posts Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	// Calcular engagement para cada post en chunks
	const postsWithEngagement = [];
	const totalChunks = Math.ceil(posts.length / chunkSize);

	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		chunk.forEach(post => {
			const engagement = parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
			postsWithEngagement.push({
				...post,
				engagement
			});
		});

		// Reportar progreso
		const progress = (chunkNumber / totalChunks) * 80; // 80% para procesamiento
		self.postMessage({
			type: 'progress',
			progress: Math.round(progress),
			message: `Procesando chunk ${chunkNumber}/${totalChunks}...`
		});
	}

	self.postMessage({
		type: 'progress',
		progress: 90,
		message: 'Ordenando posts...'
	});

	// Ordenar por engagement y tomar top N
	const topPosts = postsWithEngagement
		.sort((a, b) => b.engagement - a.engagement)
		.slice(0, limit);

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Top Posts Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Top Posts Worker: Top ${topPosts.length} posts seleccionados`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			topPosts,
			stats: {
				totalPosts: posts.length,
				topPostsCount: topPosts.length,
				maxEngagement: topPosts.length > 0 ? topPosts[0].engagement : 0,
				minEngagement: topPosts.length > 0 ? topPosts[topPosts.length - 1].engagement : 0
			}
		},
		duration
	});
};
