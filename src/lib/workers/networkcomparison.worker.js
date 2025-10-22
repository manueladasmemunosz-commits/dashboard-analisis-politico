// Web Worker para procesamiento de Network Comparison Chart
// Compara métricas entre grupos de redes sociales

// Función para verificar si un post pertenece a una red
function postBelongsToNetwork(post, networks) {
	const source = (post.source || '').toLowerCase();
	const link = (post.link || '').toLowerCase();

	return networks.some(network => {
		const networkName = network.toLowerCase();

		const patterns = {
			'twitter': { source: ['twitter'], link: ['twitter.com', 't.co', 'x.com'] },
			'news': { source: ['news'], link: ['news.google.com'] },
			'tiktok': { source: ['tiktok'], link: ['tiktok.com'] },
			'instagram': { source: ['instagram'], link: ['instagram.com'] },
			'facebook': { source: ['facebook'], link: ['facebook.com', 'fb.com', 'fb.watch'] }
		};

		const networkPatterns = patterns[networkName];
		if (!networkPatterns) return false;

		if (networkPatterns.source.some(pattern => source === pattern || source.startsWith(pattern + ' '))) {
			return true;
		}

		if (networkPatterns.link.length > 0 && networkPatterns.link.some(pattern => link.includes(pattern))) {
			return true;
		}

		return false;
	});
}

// Función para calcular métrica
function calculateMetric(posts, metricType) {
	if (metricType === 'posts') {
		return posts.length;
	} else if (metricType === 'engagement') {
		return posts.reduce((sum, post) => sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0), 0);
	} else if (metricType === 'users') {
		const uniqueUsers = new Set(posts.map(p => p.user_name).filter(Boolean));
		return uniqueUsers.size;
	}
	return 0;
}

// Función para agrupar por fecha
function getGroupKey(dateStr, timeStr, granularity) {
	if (granularity === 'hour') {
		if (!timeStr) return null;
		const hour = parseInt(timeStr.split(':')[0]);
		if (isNaN(hour) || hour < 0 || hour > 23) return null;
		return `${dateStr} ${hour.toString().padStart(2, '0')}`;
	}

	const date = new Date(dateStr);

	if (granularity === 'day') {
		return dateStr;
	} else if (granularity === 'week') {
		const oneJan = new Date(date.getFullYear(), 0, 1);
		const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
		const weekNum = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
		return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
	} else if (granularity === 'month') {
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		return `${date.getFullYear()}-${month}`;
	}
	return dateStr;
}

self.onmessage = function(e) {
	const {
		posts,
		networksA,
		networksB,
		metric,
		timeComparison = false,
		granularity = 'day',
		chunkSize = 10000
	} = e.data;

	console.log(`🔧 Network Comparison Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	if (timeComparison) {
		// Modo temporal: agrupar por fecha
		const groupsA = {};
		const groupsB = {};
		const totalChunks = Math.ceil(posts.length / chunkSize);

		for (let i = 0; i < posts.length; i += chunkSize) {
			const chunk = posts.slice(i, i + chunkSize);
			const chunkNumber = Math.floor(i / chunkSize) + 1;

			chunk.forEach(post => {
				if (!post.created) return;

				const parts = post.created.split(' ');
				const rawDate = parts[0];
				const timeStr = parts[1] || null;

				if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate)) return;

				const date = rawDate.replace(/\//g, '-');
				const groupKey = getGroupKey(date, timeStr, granularity);

				if (groupKey === null) return;

				// Agregar a grupo A si pertenece
				if (postBelongsToNetwork(post, networksA)) {
					if (!groupsA[groupKey]) groupsA[groupKey] = [];
					groupsA[groupKey].push(post);
				}

				// Agregar a grupo B si pertenece
				if (postBelongsToNetwork(post, networksB)) {
					if (!groupsB[groupKey]) groupsB[groupKey] = [];
					groupsB[groupKey].push(post);
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

		// Obtener todas las fechas únicas
		const allKeys = new Set([...Object.keys(groupsA), ...Object.keys(groupsB)]);
		const sortedKeys = Array.from(allKeys).sort();

		const dataA = sortedKeys.map(key => calculateMetric(groupsA[key] || [], metric));
		const dataB = sortedKeys.map(key => calculateMetric(groupsB[key] || [], metric));

		const endTime = performance.now();
		const duration = (endTime - startTime).toFixed(2);

		console.log(`✅ Network Comparison Worker: Procesamiento completado en ${duration}ms`);
		console.log(`📊 Network Comparison Worker: ${sortedKeys.length} períodos procesados`);

		self.postMessage({
			type: 'complete',
			data: {
				sortedKeys,
				dataA,
				dataB,
				stats: {
					totalPeriods: sortedKeys.length,
					totalPosts: posts.length,
					mode: 'temporal'
				}
			},
			duration
		});
	} else {
		// Modo totales: un solo valor por grupo
		const postsA = [];
		const postsB = [];
		const totalChunks = Math.ceil(posts.length / chunkSize);

		for (let i = 0; i < posts.length; i += chunkSize) {
			const chunk = posts.slice(i, i + chunkSize);
			const chunkNumber = Math.floor(i / chunkSize) + 1;

			chunk.forEach(post => {
				if (postBelongsToNetwork(post, networksA)) {
					postsA.push(post);
				}
				if (postBelongsToNetwork(post, networksB)) {
					postsB.push(post);
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

		const valueA = calculateMetric(postsA, metric);
		const valueB = calculateMetric(postsB, metric);

		const endTime = performance.now();
		const duration = (endTime - startTime).toFixed(2);

		console.log(`✅ Network Comparison Worker: Procesamiento completado en ${duration}ms`);
		console.log(`📊 Network Comparison Worker: Grupo A = ${valueA}, Grupo B = ${valueB}`);

		self.postMessage({
			type: 'complete',
			data: {
				valueA,
				valueB,
				stats: {
					postsA: postsA.length,
					postsB: postsB.length,
					totalPosts: posts.length,
					mode: 'totales'
				}
			},
			duration
		});
	}
};
