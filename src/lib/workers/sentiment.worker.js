// Web Worker para procesamiento de Sentiment Chart
// Agrupa posts por sentimiento

self.onmessage = function(e) {
	const { posts, chunkSize = 10000 } = e.data;

	console.log(`🔧 Sentiment Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	// Agrupar por sentimiento
	const sentimentGroups = {
		positive: [],
		neutral: [],
		negative: [],
		unknown: []
	};

	const totalChunks = Math.ceil(posts.length / chunkSize);

	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		chunk.forEach(post => {
			const sentiment = (post.sentiment || '').toLowerCase().trim();
			if (sentiment === 'positive' || sentiment === 'positivo') {
				sentimentGroups.positive.push(post);
			} else if (sentiment === 'negative' || sentiment === 'negativo') {
				sentimentGroups.negative.push(post);
			} else if (sentiment === 'neutral') {
				sentimentGroups.neutral.push(post);
			} else {
				sentimentGroups.unknown.push(post);
			}
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

	console.log(`✅ Sentiment Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Sentiment Worker: ${sentimentGroups.positive.length} positivos, ${sentimentGroups.neutral.length} neutrales, ${sentimentGroups.negative.length} negativos, ${sentimentGroups.unknown.length} desconocidos`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			sentimentGroups,
			stats: {
				totalPosts: posts.length,
				positive: sentimentGroups.positive.length,
				neutral: sentimentGroups.neutral.length,
				negative: sentimentGroups.negative.length,
				unknown: sentimentGroups.unknown.length
			}
		},
		duration
	});
};
