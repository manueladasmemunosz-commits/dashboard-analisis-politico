// Web Worker para procesamiento de Active Users Chart
// Agrupa posts por usuario y calcula engagement

self.onmessage = function(e) {
	const { posts, chunkSize = 10000 } = e.data;

	console.log(`🔧 Active Users Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	const userGroups = {};
	const totalChunks = Math.ceil(posts.length / chunkSize);

	// Procesar en chunks para reportar progreso
	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		// Procesar este chunk
		chunk.forEach(post => {
			const userName = post.user_name || 'Usuario desconocido';
			if (!userGroups[userName]) {
				userGroups[userName] = [];
			}
			userGroups[userName].push(post);
		});

		// Reportar progreso
		const progress = (chunkNumber / totalChunks) * 100;
		self.postMessage({
			type: 'progress',
			progress: Math.round(progress),
			message: `Procesando chunk ${chunkNumber}/${totalChunks}...`
		});
	}

	// Calcular engagement y preparar resultado
	const userData = Object.entries(userGroups).map(([userName, posts]) => ({
		userName,
		posts,
		count: posts.length,
		totalEngagement: posts.reduce((sum, p) =>
			sum + parseInt(p.likes || 0) + parseInt(p.replies || 0) + parseInt(p.shared || 0), 0
		)
	}));

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Active Users Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Active Users Worker: ${userData.length} usuarios únicos encontrados`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			userData,
			stats: {
				totalUsers: userData.length,
				totalPosts: posts.length
			}
		},
		duration
	});
};
