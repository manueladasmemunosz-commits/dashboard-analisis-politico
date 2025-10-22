// Web Worker para procesamiento de Performance Chart
// Agrupa posts por fecha y calcula engagement rate

self.onmessage = function(e) {
	const { posts, chunkSize = 10000 } = e.data;

	console.log(`🔧 Performance Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	// Agrupar por fecha y calcular engagement rate
	const dateGroups = {};
	let invalidDates = 0;
	const totalChunks = Math.ceil(posts.length / chunkSize);

	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		chunk.forEach(post => {
			if (!post.created) {
				invalidDates++;
				return;
			}

			const rawDate = post.created.split(' ')[0];
			if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate)) {
				invalidDates++;
				return;
			}

			const date = rawDate.replace(/\//g, '-');
			if (!dateGroups[date]) {
				dateGroups[date] = {
					posts: [],
					totalEngagement: 0,
					count: 0
				};
			}

			const engagement = parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
			dateGroups[date].posts.push(post);
			dateGroups[date].totalEngagement += engagement;
			dateGroups[date].count++;
		});

		// Reportar progreso
		const progress = (chunkNumber / totalChunks) * 100;
		self.postMessage({
			type: 'progress',
			progress: Math.round(progress),
			message: `Procesando chunk ${chunkNumber}/${totalChunks}...`
		});
	}

	const sortedDates = Object.keys(dateGroups).sort();

	// Preparar resultado
	const performanceData = sortedDates.map(date => {
		const group = dateGroups[date];
		return {
			date,
			avgEngagement: group.count > 0 ? parseFloat((group.totalEngagement / group.count).toFixed(2)) : 0,
			totalPosts: group.count,
			totalEngagement: group.totalEngagement,
			posts: group.posts
		};
	});

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Performance Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Performance Worker: ${performanceData.length} fechas procesadas`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			performanceData,
			stats: {
				totalDates: performanceData.length,
				totalPosts: posts.length,
				invalidDates
			}
		},
		duration
	});
};
