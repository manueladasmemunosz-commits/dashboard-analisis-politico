// Script de diagnóstico para menciones (DUAL: text + user_username)
import fs from 'fs';
import Papa from 'papaparse';

// Función mejorada de extracción del texto
function extractMentions(text) {
	if (!text) return [];
	const mentionRegex = /@[\wáéíóúüñÁÉÍÓÚÜÑ][\wáéíóúüñÁÉÍÓÚÜÑ._-]*/gi;
	const matches = text.match(mentionRegex);
	return matches ? matches.map(mention => mention.toLowerCase()) : [];
}

// Función para extraer username
function extractUsername(username) {
	if (!username) return null;
	let cleaned = username.trim();
	if (cleaned.startsWith('@')) {
		return cleaned.toLowerCase();
	}
	if (/^[\wáéíóúüñÁÉÍÓÚÜÑ._-]+$/i.test(cleaned)) {
		return '@' + cleaned.toLowerCase();
	}
	return null;
}

// Leer CSV
const csvPath = '../kast.csv';
console.log('📄 Leyendo CSV:', csvPath);

const csvData = fs.readFileSync(csvPath, 'utf8');
const parsed = Papa.parse(csvData, {
	header: true,
	skipEmptyLines: true
});

console.log(`📊 Total de posts: ${parsed.data.length}`);

// Extraer menciones
const mentionGroups = {};
let fromText = 0;
let fromUsername = 0;

parsed.data.forEach((post, index) => {
	if (index % 20000 === 0) {
		console.log(`⏳ Procesando: ${index}/${parsed.data.length}`);
	}

	// Menciones del texto
	const textMentions = extractMentions(post.text);
	textMentions.forEach(mention => {
		if (!mentionGroups[mention]) {
			mentionGroups[mention] = 0;
		}
		mentionGroups[mention]++;
		fromText++;
	});

	// Username (solo si es respuesta/mención)
	const username = extractUsername(post.user_username);
	if (username) {
		const isReply = post.user_name && post.user_username &&
			post.user_name.toLowerCase() !== post.user_username.toLowerCase();
		if (isReply) {
			if (!mentionGroups[username]) {
				mentionGroups[username] = 0;
			}
			mentionGroups[username]++;
			fromUsername++;
		}
	}
});

// Ordenar por frecuencia
const sortedMentions = Object.entries(mentionGroups)
	.map(([mention, count]) => ({ mention, count }))
	.sort((a, b) => b.count - a.count);

console.log(`\n📊 Resultados:`);
console.log(`- Menciones únicas: ${sortedMentions.length}`);
console.log(`- Extraídas del texto: ${fromText}`);
console.log(`- Extraídas de user_username: ${fromUsername}`);
console.log(`- Total menciones: ${fromText + fromUsername}`);
console.log(`\n🔝 Top 30 menciones más frecuentes:\n`);

sortedMentions.slice(0, 30).forEach((item, index) => {
	console.log(`${(index + 1).toString().padStart(3, ' ')}. ${item.mention.padEnd(25, ' ')} → ${item.count.toString().padStart(6, ' ')} veces`);
});
