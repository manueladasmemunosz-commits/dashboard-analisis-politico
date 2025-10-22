// Script de diagnóstico para menciones (archivo grande)
import fs from 'fs';
import Papa from 'papaparse';

// Función mejorada de extracción
function extractMentions(text) {
	if (!text) return [];
	const mentionRegex = /@[\wáéíóúüñÁÉÍÓÚÜÑ][\wáéíóúüñÁÉÍÓÚÜÑ._-]*/gi;
	const matches = text.match(mentionRegex);
	return matches ? matches.map(mention => mention.toLowerCase()) : [];
}

// Leer CSV
const csvPath = '../kast.csv';
console.log('📄 Leyendo CSV:', csvPath);
console.log('⏳ Esto puede tomar un momento...\n');

const csvData = fs.readFileSync(csvPath, 'utf8');
const parsed = Papa.parse(csvData, {
	header: true,
	skipEmptyLines: true
});

console.log(`📊 Total de posts: ${parsed.data.length.toLocaleString()}`);

// Extraer menciones
const mentionGroups = {};
let postsWithMentions = 0;

parsed.data.forEach((post, index) => {
	if (index % 10000 === 0) {
		process.stdout.write(`\r⏳ Procesando: ${index.toLocaleString()}/${parsed.data.length.toLocaleString()}`);
	}
	
	const mentions = extractMentions(post.text);
	if (mentions.length > 0) {
		postsWithMentions++;
		mentions.forEach(mention => {
			if (!mentionGroups[mention]) {
				mentionGroups[mention] = 0;
			}
			mentionGroups[mention]++;
		});
	}
});

console.log('\n\n📊 Resultados:');
console.log(`- Posts con menciones: ${postsWithMentions.toLocaleString()} (${(postsWithMentions / parsed.data.length * 100).toFixed(1)}%)`);

// Ordenar por frecuencia
const sortedMentions = Object.entries(mentionGroups)
	.map(([mention, count]) => ({ mention, count }))
	.sort((a, b) => b.count - a.count);

console.log(`- Menciones únicas: ${sortedMentions.length.toLocaleString()}`);
console.log(`\n🔝 Top 30 menciones más frecuentes:\n`);

sortedMentions.slice(0, 30).forEach((item, index) => {
	console.log(`${(index + 1).toString().padStart(3, ' ')}. ${item.mention.padEnd(25, ' ')} → ${item.count.toLocaleString().padStart(8, ' ')} veces`);
});
