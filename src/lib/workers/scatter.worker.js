// Web Worker para procesamiento de Scatter Plot (Engagement Distribution)
// Procesa grandes volúmenes de posts para visualización de engagement

self.onmessage = function(e) {
	const { posts, chunkSize = 10000 } = e.data;

	console.log(`🔧 Scatter Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	const scatterData = [];
	const totalChunks = Math.ceil(posts.length / chunkSize);

	// Procesar en chunks para reportar progreso
	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		// Procesar este chunk
		chunk.forEach((post, idx) => {
			const likes = parseInt(post.likes || 0);
			const replies = parseInt(post.replies || 0);
			const shared = parseInt(post.shared || 0);
			const engagement = likes + replies + shared;

			scatterData.push({
				x: likes,
				y: replies,
				engagement: engagement,
				postId: post.id || (i + idx), // Guardar ID para referencia
				user: post.user_name,
				text: post.text?.substring(0, 100) // Preview del texto
			});
		});

		// Reportar progreso
		const progress = (chunkNumber / totalChunks) * 100;
		self.postMessage({
			type: 'progress',
			progress: Math.round(progress),
			message: `Procesando chunk ${chunkNumber}/${totalChunks}...`
		});
	}

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Scatter Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Scatter Worker: ${scatterData.length} puntos generados`);

	// Calcular estadísticas (evitar spread operator con arrays grandes)
	let maxEngagement = 0;
	let totalEngagement = 0;
	for (let i = 0; i < scatterData.length; i++) {
		const eng = scatterData[i].engagement;
		if (eng > maxEngagement) maxEngagement = eng;
		totalEngagement += eng;
	}
	const avgEngagement = totalEngagement / scatterData.length;

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			scatterData,
			stats: {
				maxEngagement,
				avgEngagement: Math.round(avgEngagement),
				totalPoints: scatterData.length
			}
		},
		duration,
		totalPoints: scatterData.length
	});
};
