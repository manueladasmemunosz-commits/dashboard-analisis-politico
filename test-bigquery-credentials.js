/**
 * Script de prueba para verificar que las credenciales de BigQuery
 * se pueden parsear correctamente
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verificando credenciales de BigQuery...\n');

try {
	// Leer las credenciales del archivo
	const credsPath = join(__dirname, '..', 'bigquery-credentials.json');
	const credsContent = readFileSync(credsPath, 'utf-8');

	console.log('✅ Archivo leído correctamente');
	console.log('📏 Tamaño:', credsContent.length, 'caracteres\n');

	// Intentar parsear el JSON
	const creds = JSON.parse(credsContent);

	console.log('✅ JSON parseado correctamente');
	console.log('📋 Campos encontrados:');
	console.log('  - type:', creds.type);
	console.log('  - project_id:', creds.project_id);
	console.log('  - private_key_id:', creds.private_key_id);
	console.log('  - client_email:', creds.client_email);
	console.log('  - private_key contiene \\n:', creds.private_key.includes('\n'));
	console.log('  - private_key longitud:', creds.private_key.length);

	// Crear versión de una línea (como debe ir en Vercel)
	const oneLineCreds = JSON.stringify(creds);
	console.log('\n✅ Credenciales en una línea:');
	console.log('📏 Longitud:', oneLineCreds.length, 'caracteres');
	console.log('📝 Primeros 100 caracteres:', oneLineCreds.substring(0, 100) + '...');

	// Verificar que se puede volver a parsear
	const reParsed = JSON.parse(oneLineCreds);
	console.log('\n✅ Re-parseado correctamente');
	console.log('✅ private_key sigue teniendo \\n:', reParsed.private_key.includes('\n'));

	console.log('\n✨ Todo OK! Las credenciales están en formato correcto.');
	console.log('\n📋 IMPORTANTE: Para Vercel, usa esta versión (ya guardada en bigquery-credentials-oneline.txt):');
	console.log('━'.repeat(80));
	console.log(oneLineCreds);
	console.log('━'.repeat(80));

} catch (error) {
	console.error('❌ Error:', error.message);
	process.exit(1);
}
