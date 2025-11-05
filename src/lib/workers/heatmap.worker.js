// Web Worker para procesamiento de Heatmap Calendar Chart
// Agrupa posts por fecha (y hora si el rango es ≤ 7 días)

self.onmessage = function(e) {
	const { posts, metric = 'posts', chunkSize = 10000 } = e.data;

	console.log(`🔧 Heatmap Worker: Procesando ${posts.length} posts con métrica ${metric}...`);
	const startTime = performance.now();

	// PASO 1: Agrupar por fecha
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

			const dateStr = post.created.split(' ')[0];

			if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(dateStr)) {
				invalidDates++;
				return;
			}

			const date = dateStr.replace(/\//g, '-');

			if (!dateGroups[date]) {
				dateGroups[date] = [];
			}
			dateGroups[date].push(post);
		});

		// Reportar progreso de agrupación
		const progress = (chunkNumber / totalChunks) * 50; // 50% para agrupación
		self.postMessage({
			type: 'progress',
			progress: Math.round(progress),
			message: `Agrupando datos ${chunkNumber}/${totalChunks}...`
		});
	}

	// PASO 2: Encontrar rango de fechas
	const dates = Object.keys(dateGroups).sort();
	if (dates.length === 0) {
		self.postMessage({
			type: 'complete',
			data: {
				heatmapData: [],
				minDate: null,
				maxDate: null,
				stats: {
					totalDates: 0,
					totalPosts: posts.length,
					invalidDates
				}
			},
			duration: (performance.now() - startTime).toFixed(2)
		});
		return;
	}

	const minDate = new Date(dates[0]);
	const maxDate = new Date(dates[dates.length - 1]);
	const daysDiff = Math.ceil((maxDate - minDate) / (24 * 60 * 60 * 1000)) + 1;
	const useHourly = daysDiff <= 7;

	console.log(`🔧 Heatmap Worker: Rango de ${daysDiff} días. Usando granularidad: ${useHourly ? 'HORA' : 'DÍA'}`);

	// PASO 3: Procesar datos
	const processedData = [];

	if (useHourly) {
		// Agrupar por fecha Y hora
		// IMPORTANTE: BigQuery devuelve timestamps en UTC, necesitamos convertir a hora de Chile
		const hourGroups = {};

		posts.forEach(post => {
			if (!post.created) return;

			const parts = post.created.split(' ');
			const dateStr = parts[0];
			const timeStr = parts[1];

			if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(dateStr)) return;
			if (!timeStr) return;

			// Parsear como UTC agregando 'Z' al final
			const utcDateTimeStr = `${dateStr}T${timeStr}Z`;
			const date = new Date(utcDateTimeStr);

			if (isNaN(date.getTime())) return;

			// Convertir a hora de Chile (America/Santiago)
			const chileTimeStr = date.toLocaleString('en-CA', {
				timeZone: 'America/Santiago',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				hour12: false
			});

			// Extraer fecha y hora en formato "YYYY-MM-DD-HH"
			const match = chileTimeStr.match(/(\d{4}-\d{2}-\d{2}),?\s*(\d{2})/);
			if (!match) return;

			const key = `${match[1]}-${match[2]}`;

			if (!hourGroups[key]) {
				hourGroups[key] = [];
			}
			hourGroups[key].push(post);
		});

		self.postMessage({
			type: 'progress',
			progress: 60,
			message: `Procesando ${Object.keys(hourGroups).length} horas únicas...`
		});

		// Generar datos para cada hora de cada día
		let currentDate = new Date(minDate);

		while (currentDate <= maxDate) {
			const dateStr = currentDate.toISOString().split('T')[0];

			for (let hour = 0; hour < 24; hour++) {
				const key = `${dateStr}-${hour.toString().padStart(2, '0')}`;
				const posts = hourGroups[key] || [];

				let value = 0;
				if (metric === 'posts') {
					value = posts.length;
				} else if (metric === 'engagement') {
					value = posts.reduce((sum, post) => {
						return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
					}, 0);
				}

				// Crear fecha con hora específica
				const dateWithHour = new Date(currentDate);
				dateWithHour.setHours(hour, 0, 0, 0);

				processedData.push({
					date: dateWithHour.toISOString(),
					dateStr: `${dateStr} ${hour.toString().padStart(2, '0')}:00`,
					value: value,
					posts: posts,
					hour: hour,
					dayDate: dateStr
				});
			}

			currentDate.setDate(currentDate.getDate() + 1);
		}
	} else {
		// Calcular métrica por día
		let currentDate = new Date(minDate);
		let processedDays = 0;

		while (currentDate <= maxDate) {
			const dateStr = currentDate.toISOString().split('T')[0];
			const posts = dateGroups[dateStr] || [];

			let value = 0;
			if (metric === 'posts') {
				value = posts.length;
			} else if (metric === 'engagement') {
				value = posts.reduce((sum, post) => {
					return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
				}, 0);
			}

			processedData.push({
				date: new Date(currentDate).toISOString(),
				dateStr: dateStr,
				value: value,
				posts: posts
			});

			processedDays++;
			if (processedDays % 30 === 0) {
				const progress = 50 + ((processedDays / daysDiff) * 50);
				self.postMessage({
					type: 'progress',
					progress: Math.round(progress),
					message: `Procesando día ${processedDays}/${daysDiff}...`
				});
			}

			currentDate.setDate(currentDate.getDate() + 1);
		}
	}

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Heatmap Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Heatmap Worker: ${processedData.length} puntos de datos generados`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			heatmapData: processedData,
			minDate: minDate.toISOString(),
			maxDate: maxDate.toISOString(),
			stats: {
				totalDates: dates.length,
				totalDataPoints: processedData.length,
				totalPosts: posts.length,
				invalidDates,
				useHourly
			}
		},
		duration
	});
};
