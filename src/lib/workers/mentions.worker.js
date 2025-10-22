// Web Worker para procesamiento de Mentions Chart
// Extrae y agrupa menciones de posts

// Función para extraer menciones del texto
function extractMentions(text) {
	if (!text) return [];
	// Regex mejorado que captura:
	// - Letras, números, guiones, guiones bajos, puntos
	// - Caracteres especiales en español (áéíóúüñ)
	// Ejemplos: @usuario, @nombre_apellido, @nombre-apellido, @user123, @nombre.apellido
	const mentionRegex = /@[\wáéíóúüñÁÉÍÓÚÜÑ][\wáéíóúüñÁÉÍÓÚÜÑ._-]*/gi;
	const matches = text.match(mentionRegex);
	return matches ? matches.map(mention => mention.toLowerCase()) : [];
}

// Función para extraer username (agregar @ si no lo tiene)
function extractUsername(username) {
	if (!username) return null;

	// Limpiar el username de caracteres extraños y espacios
	let cleaned = username.trim();

	// Si ya tiene @, usarlo tal cual
	if (cleaned.startsWith('@')) {
		return cleaned.toLowerCase();
	}

	// Si no tiene @, agregarlo
	// Solo procesar si parece un username válido (letras, números, _, -, .)
	if (/^[\wáéíóúüñÁÉÍÓÚÜÑ._-]+$/i.test(cleaned)) {
		return '@' + cleaned.toLowerCase();
	}

	return null;
}

self.onmessage = function(e) {
	const { posts, chunkSize = 10000 } = e.data;

	console.log(`🔧 Mentions Worker: Procesando ${posts.length} posts...`);
	const startTime = performance.now();

	const mentionGroups = {};
	const totalChunks = Math.ceil(posts.length / chunkSize);

	// Procesar en chunks para reportar progreso
	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		// Procesar este chunk
		chunk.forEach(post => {
			// Extraer menciones del texto del post
			const textMentions = extractMentions(post.text);
			textMentions.forEach(mention => {
				if (!mentionGroups[mention]) {
					mentionGroups[mention] = [];
				}
				mentionGroups[mention].push(post);
			});

			// Extraer username (usuario mencionado/citado en posts tipo respuesta)
			const username = extractUsername(post.user_username);
			if (username && !mentionGroups[username]) {
				// Solo agregar si NO es el mismo usuario que publicó (evitar auto-menciones)
				const isReply = post.user_name && post.user_username &&
					            post.user_name.toLowerCase() !== post.user_username.toLowerCase();

				if (isReply) {
					if (!mentionGroups[username]) {
						mentionGroups[username] = [];
					}
					mentionGroups[username].push(post);
				}
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

	// Calcular engagement y preparar resultado
	const mentionData = Object.entries(mentionGroups).map(([mention, posts]) => ({
		mention,
		posts,
		count: posts.length,
		totalEngagement: posts.reduce((sum, p) =>
			sum + parseInt(p.likes || 0) + parseInt(p.replies || 0) + parseInt(p.shared || 0), 0
		)
	}));

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Mentions Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Mentions Worker: ${mentionData.length} menciones únicas encontradas`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: {
			mentionData,
			stats: {
				totalMentions: mentionData.length,
				totalPosts: posts.length
			}
		},
		duration
	});
};
