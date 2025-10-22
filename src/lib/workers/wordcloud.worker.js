// Web Worker para procesamiento de Word Cloud
// Este worker procesa grandes volúmenes de posts sin bloquear la UI

// Stopwords (mismo conjunto que en dashboard.js)
const spanishStopwords = new Set([
	'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber',
	'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo',
	'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese',
	'la', 'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy',
	'sin', 'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo',
	'yo', 'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero',
	'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella',
	'sí', 'día', 'uno', 'bien', 'poco', 'deber', 'entonces', 'poner', 'cosa',
	'tanto', 'hombre', 'parecer', 'nuestro', 'tan', 'donde', 'ahora', 'parte',
	'después', 'vida', 'quedar', 'siempre', 'creer', 'hablar', 'llevar', 'dejar',
	'nada', 'cada', 'seguir', 'menos', 'nuevo', 'encontrar', 'algo', 'solo',
	'decir', 'ciudad', 'cómo', 'allí', 'ellos', 'tú', 'ante', 'fue', 'era',
	'han', 'hay', 'son', 'del', 'al', 'las', 'los', 'una', 'unos', 'unas',
	'estos', 'estas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'cual', 'cuales',
	'cuál', 'cuáles', 'quien', 'quién', 'cuyo', 'cuya', 'cuyos', 'cuyas',
	'rt', 'https', 'http', 'www', 'com', 'co', 'es', 'the', 'and', 'of', 'to',
	'in', 'for', 'is', 'on', 'that', 'by', 'this', 'with', 'from', 'or', 'an',
	'be', 'are', 'as', 'at', 'it', 'was', 'has', 'have', 'been', 'will',
	'e', 'u', 'mas', 'aun', 'sino', 'aunque', 'sea', 'estar', 'estoy', 'esta',
	'están', 'estaba', 'estaban', 'he', 'ha', 'hemos', 'habéis', 'había',
	'te', 'les', 'nos', 'os', 'mí', 'ti', 'sí', 'consigo', 'contigo', 'conmigo'
]);

// Función para procesar texto
function processText(text) {
	if (!text) return [];

	// PRIMERO: Limpiar el encoding corrupto con ° entre caracteres
	let cleaned = text.replace(/°/g, ''); // Eliminar todos los °

	// Luego procesar normalmente
	cleaned = cleaned.toLowerCase()
		.replace(/https?:\/\/[^\s]+/g, '') // Eliminar URLs
		.replace(/@[\wáéíóúüñ]+/gi, '') // Eliminar menciones
		.replace(/#/g, '') // Eliminar # pero mantener la palabra
		.replace(/[^a-záéíóúüñ0-9\s]/gi, ' ') // Solo letras (con acentos), números y espacios
		.replace(/\s+/g, ' ') // Normalizar espacios
		.trim();

	let words = cleaned.split(' ').filter(word => {
		return word.length > 3 &&
			   !spanishStopwords.has(word) &&
			   !/^\d+$/.test(word); // Excluir números puros
	});

	return words;
}

// Escuchar mensajes del thread principal
self.onmessage = function(e) {
	const { posts, chunkSize = 10000 } = e.data;

	console.log(`🔧 Worker: Procesando ${posts.length} posts en chunks de ${chunkSize}...`);
	const startTime = performance.now();

	const wordFrequency = {};
	const wordPosts = {};
	const wordEngagement = {};

	// Procesar en chunks para reportar progreso
	const totalChunks = Math.ceil(posts.length / chunkSize);

	// Debug: ver algunos textos de ejemplo
	if (posts.length > 0) {
		console.log('🔍 Muestra de textos a procesar:');
		for (let i = 0; i < Math.min(3, posts.length); i++) {
			console.log(`  Post ${i + 1}: "${posts[i].text?.substring(0, 100)}..."`);
		}
	}

	for (let i = 0; i < posts.length; i += chunkSize) {
		const chunk = posts.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;

		// Procesar este chunk
		chunk.forEach((post, idx) => {
			const words = processText(post.text);

			// Debug en el primer chunk
			if (chunkNumber === 1 && idx < 3) {
				console.log(`🔍 Post ${idx + 1} procesado: ${words.length} palabras encontradas`);
				if (words.length > 0) {
					console.log(`   Palabras: ${words.slice(0, 10).join(', ')}`);
				}
			}

			const engagement = parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);

			words.forEach(word => {
				// Incrementar frecuencia
				wordFrequency[word] = (wordFrequency[word] || 0) + 1;

				// Agregar post a la lista (límite de 100 posts por palabra para evitar problemas de memoria)
				if (!Array.isArray(wordPosts[word])) {
					wordPosts[word] = [];
				}
				if (wordPosts[word].length < 100) {
					wordPosts[word].push(post);
				}

				// Sumar engagement
				wordEngagement[word] = (wordEngagement[word] || 0) + engagement;
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

	// Convertir a array y ordenar
	const words = Object.entries(wordFrequency)
		.map(([word, frequency]) => ({
			text: word,
			value: frequency,
			engagement: wordEngagement[word],
			avgEngagement: Math.round(wordEngagement[word] / frequency)
		}))
		.sort((a, b) => b.value - a.value);

	const endTime = performance.now();
	const duration = (endTime - startTime).toFixed(2);

	console.log(`✅ Worker: Procesamiento completado en ${duration}ms`);
	console.log(`📊 Worker: ${words.length} palabras únicas encontradas`);

	// Enviar resultado final
	self.postMessage({
		type: 'complete',
		data: { words, wordPosts },
		duration,
		totalWords: words.length
	});
};
