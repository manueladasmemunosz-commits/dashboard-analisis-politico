// Test de extracción dual (text + user_username)
import fs from 'fs';
import Papa from 'papaparse';

function extractMentions(text) {
	if (!text) return [];
	const mentionRegex = /@[\wáéíóúüñÁÉÍÓÚÜÑ][\wáéíóúüñÁÉÍÓÚÜÑ._-]*/gi;
	const matches = text.match(mentionRegex);
	return matches ? matches.map(mention => mention.toLowerCase()) : [];
}

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

const csvPath = '../kast.csv';
console.log('📄 Leyendo CSV:', csvPath);

const csvData = fs.readFileSync(csvPath, 'utf8');
const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

console.log(`📊 Total de posts: ${parsed.data.length.toLocaleString()}\n`);

const mentionGroups = {};
let fromText = 0;
let fromUsername = 0;

parsed.data.forEach((post, index) => {
	if (index % 20000 === 0) {
		process.stdout.write(`\r⏳ ${index.toLocaleString()}/${parsed.data.length.toLocaleString()}`);
	}

	// Menciones del texto
	const textMentions = extractMentions(post.text);
	textMentions.forEach(mention => {
		if (!mentionGroups[mention]) mentionGroups[mention] = 0;
		mentionGroups[mention]++;
		fromText++;
	});

	// Username
	const username = extractUsername(post.user_username);
	if (username) {
		const isReply = post.user_name && post.user_username &&
			post.user_name.toLowerCase() !== post.user_username.toLowerCase();
		if (isReply) {
			if (!mentionGroups[username]) mentionGroups[username] = 0;
			mentionGroups[username]++;
			fromUsername++;
		}
	}
});

const sorted = Object.entries(mentionGroups)
	.map(([m, c]) => ({ mention: m, count: c }))
	.sort((a, b) => b.count - a.count);

console.log('\n\n✅ Resultados:');
console.log(`- Menciones únicas: ${sorted.length.toLocaleString()}`);
console.log(`- Extraídas del texto: ${fromText.toLocaleString()}`);
console.log(`- Extraídas de user_username: ${fromUsername.toLocaleString()}`);
console.log(`- Total menciones: ${(fromText + fromUsername).toLocaleString()}`);
console.log(`\n🔝 Top 30:\n`);

sorted.slice(0, 30).forEach((item, i) => {
	console.log(`${(i + 1).toString().padStart(3)}. ${item.mention.padEnd(25)} → ${item.count.toLocaleString().padStart(8)}`);
});
