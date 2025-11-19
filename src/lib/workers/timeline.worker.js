// Web Worker para procesamiento de Timeline Chart
// Agrupa posts por período temporal según granularidad

// Función para obtener clave de agrupación según granularidad
function getGroupKey(dateStr, timeStr, granularity) {
	if (granularity === 'hour') {
		// Para hora: agrupar por fecha Y hora específica (YYYY-MM-DD HH)
		// IMPORTANTE: BigQuery devuelve timestamps en UTC, necesitamos convertir a hora de Chile
		if (!timeStr) return null;

		// Parsear como UTC agregando 'Z' al final
		const utcDateTimeStr = `${dateStr}T${timeStr}Z`;
		const date = new Date(utcDateTimeStr);

		if (isNaN(date.getTime())) return null;

		// Convertir a hora de Chile (America/Santiago)
		const chileTimeStr = date.toLocaleString('en-CA', {
			timeZone: 'America/Santiago',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			hour12: false
		});

		// Extraer fecha y hora en formato "YYYY-MM-DD HH"
		// El formato es: "2025-11-04, 14" o similar
		const match = chileTimeStr.match(/(\d{4}-\d{2}-\d{2}),?\s*(\d{2})/);
		if (!match) return null;

		return `${match[1]} ${match[2]}`;
	}

	// Parsear fecha como UTC para evitar problemas de zona horaria
	const parts = dateStr.split('-');
	if (parts.length !== 3) {
		console.warn('⚠️ Formato de fecha inválido:', dateStr);
		return null;
	}

	const [year, month, day] = parts.map(x => parseInt(x));

	// Validar que sean números válidos
	if (isNaN(year) || isNaN(month) || isNaN(day)) {
		console.warn('⚠️ Partes de fecha no numéricas:', dateStr, { year, month, day });
		return null;
	}

	const date = new Date(Date.UTC(year, month - 1, day));

	if (isNaN(date.getTime())) {
		console.warn('⚠️ Fecha inválida después de parsear:', dateStr);
		return null;
	}

	let result;
	if (granularity === 'day') {
		// Formato: YYYY-MM-DD
		result = dateStr;
	} else if (granularity === 'week') {
		// Formato: YYYY-WW (año-semana) usando UTC
		const oneJan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
		const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
		const weekNum = Math.ceil((numberOfDays + oneJan.getUTCDay() + 1) / 7);
		result = `${date.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
	} else if (granularity === 'month') {
		// Formato: YYYY-MM usando UTC
		const monthNum = (date.getUTCMonth() + 1).toString().padStart(2, '0');
		result = `${date.getUTCFullYear()}-${monthNum}`;
	} else {
		console.warn('⚠️ Granularidad desconocida:', granularity);
		result = dateStr; // fallback
	}

	// Log solo para las primeras 3 fechas para debug
	if (Math.random() < 0.001) {
		console.log(`🔍 getGroupKey: "${dateStr}" + granularity="${granularity}" → "${result}"`);
	}

	return result;
}

// Función para procesar un dataset
function processDataset(dataset, granularity, label, chunkSize) {
	const dateGroups = {};
	let invalidDates = 0;
	const totalChunks = Math.ceil(dataset.length / chunkSize);

	for (let i = 0; i < dataset.length; i += chunkSize) {
		const chunk = dataset.slice(i, i + chunkSize);

		chunk.forEach(post => {
			if (!post.created) {
				invalidDates++;
				return;
			}

			const parts = post.created.split(' ');
			const rawDate = parts[0];
			const timeStr = parts[1] || null;

			if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate)) {
				invalidDates++;
				return;
			}

			const date = rawDate.replace(/\//g, '-');
			const groupKey = getGroupKey(date, timeStr, granularity);

			if (groupKey === null) {
				invalidDates++;
				return;
			}

			if (!dateGroups[groupKey]) dateGroups[groupKey] = [];
			dateGroups[groupKey].push(post);
		});
	}

	return { dateGroups, invalidDates };
}

self.onmessage = function(e) {
	const { posts, granularity = 'day', comparativeEnabled = false, dataB = [], chunkSize = 10000 } = e.data;

	console.log(`🔧 Timeline Worker START`);
	console.log(`   📊 Posts: ${posts.length}`);
	console.log(`   📅 Granularidad recibida: "${granularity}" (tipo: ${typeof granularity})`);
	console.log(`   🔄 Comparativo: ${comparativeEnabled}`);
	const startTime = performance.now();

	// Procesar dataset principal
	self.postMessage({
		type: 'progress',
		progress: 10,
		message: 'Procesando datos principales...'
	});

	const resultA = processDataset(posts, granularity, 'Dataset A', chunkSize);

	self.postMessage({
		type: 'progress',
		progress: 50,
		message: 'Datos principales procesados...'
	});

	let resultB = null;
	if (comparativeEnabled && dataB && dataB.length > 0) {
		self.postMessage({
			type: 'progress',
			progress: 60,
			message: 'Procesando datos comparativos...'
		});

		resultB = processDataset(dataB, granularity, 'Dataset B', chunkSize);

		self.postMessage({
			type: 'progress',
			progress: 90,
			message: 'Datos comparativos procesados...'
		});
	}

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	const keysA = Object.keys(resultA.dateGroups).sort();
	console.log(`✅ Timeline Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Timeline Worker: ${keysA.length} períodos encontrados`);
	console.log(`📝 Primeras 5 claves generadas:`, keysA.slice(0, 5));
	console.log(`📝 Últimas 5 claves generadas:`, keysA.slice(-5));

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			dateGroupsA: resultA.dateGroups,
			invalidDatesA: resultA.invalidDates,
			dateGroupsB: resultB ? resultB.dateGroups : null,
			invalidDatesB: resultB ? resultB.invalidDates : null,
			stats: {
				totalPeriodsA: Object.keys(resultA.dateGroups).length,
				totalPeriodsB: resultB ? Object.keys(resultB.dateGroups).length : 0,
				totalPostsA: posts.length,
				totalPostsB: dataB.length,
				granularity
			}
		},
		duration
	});
};
