import { writable, derived } from 'svelte/store';

// Estado de datos raw
export const rawData = writable([]);

// Stopwords para Word Cloud (mismo conjunto que en WordCloudChart)
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

// Función para aplicar búsqueda con operadores lógicos avanzados
function applySearchFilter(post, searchTerm) {
	const text = (post.text || '').toLowerCase();
	const userName = (post.user_name || '').toLowerCase();
	let searchLower = searchTerm;

	// Paso 1: Procesar frases exactas (comillas)
	const exactPhrases = [];
	const phraseRegex = /"([^"]+)"/g;
	let match;

	while ((match = phraseRegex.exec(searchTerm)) !== null) {
		exactPhrases.push(match[1].toLowerCase());
		searchLower = searchLower.replace(match[0], ''); // Eliminar de la expresión
	}

	// Verificar frases exactas
	for (let phrase of exactPhrases) {
		if (!text.includes(phrase) && !userName.includes(phrase)) {
			return false;
		}
	}

	searchLower = searchLower.toLowerCase().trim();

	// Si solo había frases exactas, ya validamos
	if (!searchLower) {
		return exactPhrases.length > 0;
	}

	// Paso 2: Procesar comodines (*)
	function matchWithWildcard(str, pattern) {
		if (!pattern.includes('*')) {
			return str.includes(pattern);
		}

		// Convertir patrón con * a regex
		const regexPattern = pattern
			.replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escapar caracteres especiales
			.replace(/\*/g, '.*'); // * = cualquier carácter

		const regex = new RegExp(regexPattern);
		return regex.test(str);
	}

	// Paso 3: Detectar operadores lógicos
	const hasAND = searchLower.includes(' and ');
	const hasOR = searchLower.includes(' or ');
	const hasNOT = searchLower.includes(' not ');
	const hasParentheses = searchLower.includes('(') && searchLower.includes(')');

	// Si no hay operadores, búsqueda simple (puede tener comodines)
	if (!hasAND && !hasOR && !hasNOT && !hasParentheses) {
		return matchWithWildcard(text, searchLower) || matchWithWildcard(userName, searchLower);
	}

	// Paso 4: Procesar paréntesis (evaluar expresiones anidadas)
	function evaluateExpression(expr) {
		expr = expr.trim();

		// Procesar paréntesis primero
		while (expr.includes('(')) {
			const parenRegex = /\(([^()]+)\)/;
			const parenMatch = expr.match(parenRegex);

			if (!parenMatch) break;

			const innerExpr = parenMatch[1];
			const innerResult = evaluateExpression(innerExpr);

			// Reemplazar paréntesis con resultado temporal
			expr = expr.replace(parenRegex, innerResult ? '__TRUE__' : '__FALSE__');
		}

		// Procesar NOT
		let notTerms = [];
		if (expr.includes(' not ')) {
			const notParts = expr.split(' not ');
			expr = notParts[0];

			for (let i = 1; i < notParts.length; i++) {
				let notTerm = notParts[i].split(' and ')[0].split(' or ')[0].trim();
				notTerms.push(notTerm);
			}

			// Verificar términos NOT
			for (let notTerm of notTerms) {
				if (notTerm === '__TRUE__' ||
					matchWithWildcard(text, notTerm) ||
					matchWithWildcard(userName, notTerm)) {
					return false;
				}
			}
		}

		// Procesar OR
		if (expr.includes(' or ')) {
			const orParts = expr.split(' or ').map(p => p.trim());

			for (let orPart of orParts) {
				if (orPart === '__TRUE__') return true;
				if (orPart === '__FALSE__') continue;

				// Procesar AND dentro de OR
				if (orPart.includes(' and ')) {
					const andTerms = orPart.split(' and ').map(t => t.trim()).filter(t => t.length > 0);
					const allMatch = andTerms.every(term =>
						term === '__TRUE__' ||
						matchWithWildcard(text, term) ||
						matchWithWildcard(userName, term)
					);
					if (allMatch) return true;
				} else {
					if (matchWithWildcard(text, orPart) || matchWithWildcard(userName, orPart)) {
						return true;
					}
				}
			}
			return false;
		}

		// Procesar AND
		if (expr.includes(' and ')) {
			const andTerms = expr.split(' and ').map(t => t.trim()).filter(t => t.length > 0);
			return andTerms.every(term =>
				term === '__TRUE__' ||
				matchWithWildcard(text, term) ||
				matchWithWildcard(userName, term)
			);
		}

		// Término simple
		if (expr === '__TRUE__') return true;
		if (expr === '__FALSE__') return false;
		return matchWithWildcard(text, expr) || matchWithWildcard(userName, expr);
	}

	return evaluateExpression(searchLower);
}

// Estado de filtros
export const filters = writable({
	searchTerm: '',
	dateFrom: '', // Sin filtro por defecto
	dateTo: '',   // Sin filtro por defecto
	socialNetwork: 'all',
	selectedNetworks: ['all']
});

// Estado de configuración de gráficos
export const chartConfigs = writable({
	timeline: { type: 'line', limit: 10 },
	topPosts: { type: 'bar', limit: 10 },
	engagement: { type: 'scatter', limit: 10 },
	activeUsers: { type: 'doughnut', limit: 10 },
	performance: { type: 'line', limit: 10 },
	sentimentMain: { type: 'doughnut', limit: 10 },
	hashtagsMain: { type: 'bar', limit: 20 },
	topUsersMain: { type: 'bar', limit: 10 }
});

// Datos filtrados derivados
export const filteredData = derived(
	[rawData, filters],
	([$rawData, $filters]) => {
		// Reducir logging para evitar problemas de performance
		// Solo log si hay cambios significativos

		let filtered = [...$rawData];
		let originalCount = filtered.length;
		let afterSearchTerm = originalCount;
		let afterDates = originalCount;
		let afterNetworks = originalCount;

		// Filtro por término de búsqueda con operadores lógicos
		if ($filters.searchTerm) {
			filtered = filtered.filter(post => applySearchFilter(post, $filters.searchTerm));
			afterSearchTerm = filtered.length;
		}

		// Filtro por fechas (mejorado para manejar datos corruptos)
		if ($filters.dateFrom && $filters.dateTo) {
			filtered = filtered.filter(post => {
				const rawDate = post.created ? post.created.split(' ')[0] : null;

				// Verificar si es una fecha válida (formato YYYY-MM-DD o YYYY/MM/DD)
				const isValidDate = rawDate && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate);

				if (!isValidDate) {
					// Si no es una fecha válida, incluir el post (no filtrar por fecha corrompida)
					return true;
				}

				// Normalizar formato de fecha (convertir / a -)
				const postDate = rawDate.replace(/\//g, '-');
				return postDate >= $filters.dateFrom && postDate <= $filters.dateTo;
			});
			afterDates = filtered.length;
		}

		// Filtro por red social (múltiples redes)
		if ($filters.selectedNetworks && !$filters.selectedNetworks.includes('all')) {
			filtered = filtered.filter(post => {
				// Campos principales para identificar la red social
				const source = (post.source || '').toLowerCase();
				const link = (post.link || '').toLowerCase();

				return $filters.selectedNetworks.some(network => {
					const networkName = network.toLowerCase();

					// Mapear nombres de fuentes a patrones de identificación
					const patterns = {
						'twitter': {
							source: ['twitter'],
							link: ['twitter.com', 't.co', 'x.com']
						},
						'news': {
							source: ['news'],
							link: ['news.google.com']
						},
						'tiktok': {
							source: ['tiktok'],
							link: ['tiktok.com']
						},
						'instagram': {
							source: ['instagram'],
							link: ['instagram.com']
						},
						'facebook': {
							source: ['facebook'],
							link: ['facebook.com', 'fb.com', 'fb.watch']
						},
						'other': {
							source: ['other', 'corporate'],
							link: []
						},
						'undefined': {
							source: ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
							link: []
						}
					};

					const networkPatterns = patterns[networkName];
					if (!networkPatterns) return false;

					// Verificar en source (campo principal) - debe coincidir exactamente
					if (networkPatterns.source.some(pattern => {
						// Coincidencia exacta o source comienza con el pattern
						return source === pattern || source.startsWith(pattern + ' ');
					})) {
						return true;
					}

					// Verificar en link/URL solo si source no está definido claramente
					if (networkPatterns.link.length > 0 && networkPatterns.link.some(pattern => link.includes(pattern))) {
						return true;
					}

					// Caso especial: "Sin fuente" buscar valores vacíos o numéricos
					if (networkName === 'undefined') {
						return !source || source.trim() === '' || /^\d+$/.test(source.trim());
					}

					return false;
				});
			});
			afterNetworks = filtered.length;
		}

		// Log detallado para debugging del filtrado
		if (originalCount > 0 && filtered.length !== originalCount) {
			const searchRemoved = originalCount - afterSearchTerm;
			const datesRemoved = afterSearchTerm - afterDates;
			const networksRemoved = afterDates - afterNetworks;

			console.log(`🔍 DEBUG FILTRADO DETALLADO:`);
			console.log(`  📊 Original: ${originalCount} posts`);
			if ($filters.searchTerm) {
				console.log(`  🔤 Después searchTerm "${$filters.searchTerm}": ${afterSearchTerm} (eliminados: ${searchRemoved})`);
			}
			if ($filters.dateFrom && $filters.dateTo) {
				console.log(`  📅 Después fechas (${$filters.dateFrom} a ${$filters.dateTo}): ${afterDates} (eliminados: ${datesRemoved})`);
			}
			if ($filters.selectedNetworks && !$filters.selectedNetworks.includes('all')) {
				console.log(`  🌐 Después redes ${JSON.stringify($filters.selectedNetworks)}: ${afterNetworks} (eliminados: ${networksRemoved})`);
			}
			console.log(`  ✅ Final: ${filtered.length}/${originalCount} posts`);
		}

		return filtered;
	}
);

// Funciones utilitarias
export function loadCsvData(data) {
	console.log('📄 Cargando datos CSV:', data.length, 'registros totales');

	// VALIDACIÓN INTELIGENTE: Solo filtrar registros completamente inútiles
	let stats = {
		withText: 0,
		withUser: 0,
		withDate: 0,
		withSource: 0,
		totallyEmpty: 0,
		valid: 0
	};

	const validData = data.filter(post => {
		const hasText = post.text && post.text.trim().length > 0;
		const hasUser = post.user_name && post.user_name.trim().length > 0;
		const hasDate = post.created && post.created.trim().length > 0;
		const hasSource = post.source && post.source.trim().length > 0;

		// Contadores
		if (hasText) stats.withText++;
		if (hasUser) stats.withUser++;
		if (hasDate) stats.withDate++;
		if (hasSource) stats.withSource++;

		// Solo filtrar registros COMPLETAMENTE vacíos
		const isCompletelyEmpty = !hasText && !hasUser && !hasDate && !hasSource;

		if (isCompletelyEmpty) {
			stats.totallyEmpty++;
			return false; // Filtrar solo los completamente vacíos
		} else {
			stats.valid++;
			return true; // Mantener todos los que tengan ALGO de información
		}
	});

	console.log(`📊 NUEVA VALIDACIÓN INTELIGENTE:
		- Total registros CSV: ${data.length}
		- Con texto: ${stats.withText}
		- Con usuario: ${stats.withUser}
		- Con fecha: ${stats.withDate}
		- Con source: ${stats.withSource}
		- Completamente vacíos (filtrados): ${stats.totallyEmpty}
		- Registros válidos (conservados): ${stats.valid}
		- Porcentaje conservado: ${((stats.valid / data.length) * 100).toFixed(1)}%
	`);

	// ELIMINAR DUPLICADOS por campo 'link' (igual que Colab)
	// Usa Map para mantener solo el primer post con cada link único
	const beforeDedup = validData.length;
	const uniqueData = Array.from(
		new Map(validData.map(item => [item.link, item])).values()
	);
	const duplicatesRemoved = beforeDedup - uniqueData.length;

	console.log(`🔄 Eliminación de duplicados:
		- Antes: ${beforeDedup} posts
		- Duplicados eliminados: ${duplicatesRemoved}
		- Únicos: ${uniqueData.length}
	`);

	console.log(`✅ Cargando ${uniqueData.length} registros únicos`);
	rawData.set(uniqueData);
}

// Función para procesar texto y extraer palabras (para Word Cloud)
function processText(text) {
	if (!text) return [];

	// Convertir a minúsculas y eliminar caracteres especiales
	let cleaned = text.toLowerCase()
		.replace(/https?:\/\/[^\s]+/g, '') // Eliminar URLs
		.replace(/@[\w]+/g, '') // Eliminar menciones
		.replace(/#/g, '') // Eliminar # pero mantener la palabra
		.replace(/[^\wáéíóúüñ\s]/g, ' ') // Eliminar puntuación
		.replace(/\s+/g, ' ') // Normalizar espacios
		.trim();

	// Dividir en palabras y filtrar
	let words = cleaned.split(' ').filter(word => {
		return word.length > 3 && // Palabras de más de 3 caracteres
			   !spanishStopwords.has(word) && // No es stopword
			   !/^\d+$/.test(word); // No es solo números
	});

	return words;
}

// Store para datos de Word Cloud (procesado por Worker)
export const wordCloudData = writable({ words: [], wordPosts: {}, isProcessing: false, progress: 0 });

// Worker para procesar Word Cloud
let wordCloudWorker = null;

// Función para inicializar el worker
function initWordCloudWorker() {
	if (typeof window === 'undefined') return null;

	try {
		wordCloudWorker = new Worker(
			new URL('../workers/wordcloud.worker.js', import.meta.url),
			{ type: 'module' }
		);

		wordCloudWorker.onmessage = (e) => {
			const { type, data, progress, message, duration, totalWords } = e.data;

			if (type === 'progress') {
				wordCloudData.update(state => ({ ...state, progress, isProcessing: true }));
				console.log(`⏳ ${message} (${progress}%)`);
			} else if (type === 'complete') {
				wordCloudData.set({ ...data, isProcessing: false, progress: 100 });
				console.log(`✅ Word Cloud procesado en ${duration}ms - ${totalWords} palabras únicas`);
			}
		};

		wordCloudWorker.onerror = (error) => {
			console.error('❌ Error en Word Cloud Worker:', error);
			wordCloudData.update(state => ({ ...state, isProcessing: false, progress: 0 }));
		};

		return wordCloudWorker;
	} catch (error) {
		console.error('❌ No se pudo iniciar Word Cloud Worker:', error);
		return null;
	}
}

// Función para procesar Word Cloud con Worker
export function processWordCloudData(posts) {
	console.log('🔧 processWordCloudData llamado con:', posts?.length, 'posts');

	if (!posts || posts.length === 0) {
		console.log('⚠️ Sin posts para procesar Word Cloud');
		wordCloudData.set({ words: [], wordPosts: {}, isProcessing: false, progress: 0 });
		return;
	}

	if (!wordCloudWorker) {
		console.log('🔧 Inicializando Word Cloud Worker...');
		wordCloudWorker = initWordCloudWorker();
	}

	if (!wordCloudWorker) {
		console.warn('⚠️ Worker no disponible, procesando de forma síncrona...');
		// Fallback a procesamiento síncrono (código anterior)
		return;
	}

	console.log(`☁️ Iniciando procesamiento con Worker: ${posts.length} posts`);
	wordCloudData.update(state => ({ ...state, isProcessing: true, progress: 0 }));

	// Enviar datos al worker
	wordCloudWorker.postMessage({
		posts,
		chunkSize: 10000
	});
}

// ELIMINADO: Pre-cálculo automático del Word Cloud
// Anteriormente este derived procesaba automáticamente el word cloud en cada cambio de datos,
// causando problemas de rendimiento con datasets grandes (36k+ posts).
// Ahora el Word Cloud solo se procesa cuando el usuario hace click en "Cargar Word Cloud".

export function updateFilters(newFilters) {
	filters.update(current => ({ ...current, ...newFilters }));
}

export function updateChartConfig(chartName, config) {
	chartConfigs.update(current => ({
		...current,
		[chartName]: { ...current[chartName], ...config }
	}));
}