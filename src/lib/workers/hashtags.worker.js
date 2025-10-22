// Web Worker para procesamiento de Hashtags Chart
// Extrae y agrupa hashtags de posts

// Función para extraer hashtags del texto O de la columna tags
function extractHashtags(post) {
	let tags = [];

	// Opción 1: Leer de la columna 'tags' (formato array)
	if (post.tags) {
		try {
			// Si viene como string "[tag1, tag2]" o "['tag1', 'tag2']", parsearlo
			if (typeof post.tags === 'string') {
				// Limpiar y parsear el string
				const cleanTags = post.tags
					.replace(/^\[|\]$/g, '') // Eliminar [ ]
					.replace(/['"]/g, '')     // Eliminar comillas
					.split(',')               // Separar por comas
					.map(t => t.trim())       // Limpiar espacios
					.filter(t => t.length > 0); // Eliminar vacíos
				tags = cleanTags;
			} else if (Array.isArray(post.tags)) {
				tags = post.tags;
			}
		} catch (e) {
			console.warn('Error parseando tags:', post.tags);
		}
	}

	// Opción 2: Buscar hashtags con # en el texto (fallback)
	if (tags.length === 0 && post.text) {
		const hashtagRegex = /#[\wáéíóúüñÁÉÍÓÚÜÑ]+/gi;
		const matches = post.text.match(hashtagRegex);
		tags = matches ? matches : [];
	}

	return tags.map(tag => tag.toLowerCase());
}

self.onmessage = function(e) {
	const { posts, chunkSize = 10000 } = e.data;

	console.log(`🔧 Hashtags Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	const hashtagGroups = {};
	const totalChunks = Math.ceil(posts.length / chunkSize);

	// Procesar en chunks para reportar progreso
	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		// Procesar este chunk
		chunk.forEach(post => {
			const hashtags = extractHashtags(post);
			hashtags.forEach(tag => {
				if (!hashtagGroups[tag]) {
					hashtagGroups[tag] = [];
				}
				hashtagGroups[tag].push(post);
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

	// Calcular engagement y preparar resultado
	const hashtagData = Object.entries(hashtagGroups).map(([tag, posts]) => ({
		tag,
		posts,
		count: posts.length,
		totalEngagement: posts.reduce((sum, p) =>
			sum + parseInt(p.likes || 0) + parseInt(p.replies || 0) + parseInt(p.shared || 0), 0
		)
	}));

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Hashtags Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Hashtags Worker: ${hashtagData.length} hashtags únicos encontrados`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			hashtagData,
			stats: {
				totalHashtags: hashtagData.length,
				totalPosts: posts.length
			}
		},
		duration
	});
};
