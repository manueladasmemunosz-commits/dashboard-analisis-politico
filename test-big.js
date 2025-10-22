// Script de diagnóstico para menciones
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

const csvData = fs.readFileSync(csvPath, 'utf8');
const parsed = Papa.parse(csvData, {
	header: true,
	skipEmptyLines: true
});

console.log(`📊 Total de posts: ${parsed.data.length}`);

// Extraer menciones
const mentionGroups = {};
let postsWithMentions = 0;

parsed.data.forEach(post => {
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

// Ordenar por frecuencia
const sortedMentions = Object.entries(mentionGroups)
	.map(([mention, count]) => ({ mention, count }))
	.sort((a, b) => b.count - a.count);

console.log(`\n📊 Resultados:`);
console.log(`- Posts con menciones: ${postsWithMentions} (${(postsWithMentions / parsed.data.length * 100).toFixed(1)}%)`);
console.log(`- Menciones únicas: ${sortedMentions.length}`);
console.log(`\n🔝 Top 20 menciones más frecuentes:\n`);

sortedMentions.slice(0, 20).forEach((item, index) => {
	console.log(`${index + 1}. ${item.mention} → ${item.count} veces`);
});
