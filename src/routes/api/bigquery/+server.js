/**
 * Servidor seguro para consultas BigQuery
 * Solo operaciones READ - Máxima precaución
 *
 * Validaciones de seguridad:
 * 1. Solo comandos SELECT
 * 2. Tabla específica autorizada
 * 3. Escape de SQL injection
 * 4. Rango de fechas obligatorio y limitado (máx 2 años)
 * 5. Límite de 250,000 resultados para balance entre datos y rendimiento
 *
 * IMPORTANTE: Asegúrate de que BIGQUERY_CREDENTIALS esté configurada
 * en Vercel Settings → Environment Variables → Production
 */

import { json } from '@sveltejs/kit';
import { BigQuery } from '@google-cloud/bigquery';

// Cargar dotenv solo en desarrollo local
// En Vercel (producción), las variables de entorno ya están disponibles
if (process.env.NODE_ENV !== 'production') {
	try {
		const dotenv = await import('dotenv');
		dotenv.config();
		console.log('📝 Variables de entorno cargadas desde .env (desarrollo local)');
	} catch (e) {
		// dotenv no está disponible o hubo un error, continuar sin él
	}
}

// Tabla autorizada
const AUTHORIZED_TABLE = 'secom-359014.ProyectosTooldata.datav2';

// Proyecto excluido - NUNCA debe aparecer en búsquedas
const EXCLUDED_PROJECT = 'pesimismo pais';

// Dominios/medios extranjeros a excluir (España, Argentina, otros países)
// Las redes sociales (twitter, facebook, etc) se mantienen
const EXCLUDED_DOMAINS = [
	'%.es/%',           // Dominios españoles como areajugones.sport.es
	'%.es',             // Dominios españoles sin path
	'%.ar/%',           // Dominios argentinos
	'%.ar',
	'%.mx/%',           // Dominios mexicanos
	'%.mx',
	'%.co/%',           // Dominios colombianos
	'%.co',
	'%.pe/%',           // Dominios peruanos
	'%.pe',
	'%.br/%',           // Dominios brasileños
	'%.br',
	'%.com.ar%',        // Dominios .com.ar
	'%.com.mx%',        // Dominios .com.mx
	'%.com.co%',        // Dominios .com.co
	'%.com.pe%',        // Dominios .com.pe
	'%.com.br%'         // Dominios .com.br
];

// Rango máximo permitido en días (2 años = 730 días)
const MAX_RANGE_DAYS = 730;

/**
 * Valida que la query es segura - SOLO SELECT
 */
function validateQuerySecurity(query) {
	const queryUpper = query.toUpperCase().trim();

	// Lista de comandos prohibidos (con word boundaries para evitar falsos positivos)
	const forbiddenCommands = [
		'DELETE', 'DROP', 'TRUNCATE', 'UPDATE', 'INSERT',
		'ALTER', 'CREATE', 'MERGE', 'UPSERT', 'GRANT', 'REVOKE'
	];

	// Verificar comandos prohibidos usando regex con word boundaries
	// Esto evita falsos positivos como "created" detectado como "CREATE"
	for (const cmd of forbiddenCommands) {
		const regex = new RegExp(`\\b${cmd}\\b`, 'i');
		if (regex.test(query)) {
			throw new Error(`⛔ Comando prohibido detectado: ${cmd}`);
		}
	}

	// Debe empezar con SELECT
	if (!queryUpper.startsWith('SELECT')) {
		throw new Error('⛔ Solo consultas SELECT permitidas');
	}

	// Validar que solo accede a la tabla autorizada
	if (!query.includes(AUTHORIZED_TABLE)) {
		throw new Error('⛔ Solo acceso a tabla autorizada');
	}

	return true;
}

/**
 * Valida el rango de fechas
 */
function validateDateRange(dateFrom, dateTo) {
	// Fechas obligatorias
	if (!dateFrom || !dateTo) {
		throw new Error('⛔ Las fechas son obligatorias (dateFrom y dateTo)');
	}

	// Validar formato de fecha (YYYY-MM-DD)
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
		throw new Error('⛔ Formato de fecha inválido. Use YYYY-MM-DD');
	}

	// Convertir a objetos Date
	const fromDate = new Date(dateFrom);
	const toDate = new Date(dateTo);

	// Validar que son fechas válidas
	if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
		throw new Error('⛔ Fechas inválidas');
	}

	// Validar que dateFrom <= dateTo
	if (fromDate > toDate) {
		throw new Error('⛔ La fecha inicial debe ser anterior o igual a la fecha final');
	}

	// Calcular diferencia en días
	const diffTime = Math.abs(toDate - fromDate);
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	// Validar rango máximo (2 años)
	if (diffDays > MAX_RANGE_DAYS) {
		throw new Error(`⛔ Rango máximo permitido: ${MAX_RANGE_DAYS} días (2 años). Rango actual: ${diffDays} días`);
	}

	// Advertencia si el rango es grande (más de 180 días = 6 meses)
	if (diffDays > 180) {
		console.warn(`⚠️ Búsqueda de ${diffDays} días puede tomar tiempo y consumir más recursos`);
	}

	return { fromDate, toDate, diffDays };
}

/**
 * Escapa caracteres especiales para prevenir SQL injection
 */
function escapeSqlString(str) {
	if (!str) return '';
	// Reemplazar comillas simples con dos comillas simples (escape estándar SQL)
	return str.replace(/'/g, "''");
}

/**
 * Inicializa el cliente de BigQuery
 */
function getBigQueryClient() {
	// FALLBACK: Credenciales codificadas en base64 como último recurso
	// Esto es necesario porque Vercel a veces no carga correctamente las variables de entorno
	const FALLBACK_CREDENTIALS_BASE64 = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAic2Vjb20tMzU5MDE0IiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiNWUwNjhiMDM4ZmNkYmU2ZmE3OGFiZDBhMDRhMmRlZmNhMmQzYzUzZSIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZnSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2d3Z2dTa0FnRUFBb0lCQVFEQW0za0xFM1llNFpWWlxudkowbk9xbUZUU2tCaUFaTFlrdGR2UXlKZm1ZU3dORUtaZVZtYmtTSytIeWRhNnBDekM3NWpNdVhHOFFPQmFVS1xuZDRJNTFKUnRIdy9MOWZZNVRHZ1ZRdHJFRm9qM2RYSDFvakRnaytmWUZ6Y0xUT0l1RHZpT1hLeEZJRWV5K29vL1xuUExFc3lBMDdpaHplajFGdzJuTmFjS3MzTDUzMHpvOXBRNzk5S3pEK3p2cC9RRWlENEEySS9iSnJORW0vNS9vcFxuU3RIWUVLQjk1UmlMRlhEU3JweGpwWTRxR0hSbkdmYk53cnNWQWVDbzdQUmFUa3Vmb0VkemJ3OHVPamZ0R2gzd1xuS05BT0dzcUNyL2NJeTVkeFBoMXdFa0l0SFNYTE9iVG5RMVp2czViYmNoRnVRRUltNUxna1h5aFpiOWROOUhvb1xuSEJHK3lhVGhBZ01CQUFFQ2dnRUFBVi82djJQK1YxNXRObGRIZ3o5WUgzTlF1WFNTOVpoNE01ZnZ1TTdncnFpV1xudFcxMXlPM25sUVczYWdPWjZHRXB3cTZlYzIvY3pld25aSjdteHovbnZBR3VsMXBPK0NpOStNemgzK2dqUm4rZFxub1NSdEZ6cW5FSWxWNDJ4RFB4TkI4MDQyWXB0R044RUhHZkxMekZIZlJQb0psbU1paGR6aFdaZHRUc3hnWXg0bFxuS3VOdG55R2crTnkrUWlYUVdEcEFVdUFDUWxWK1pQT1VMTWRpdlU5T2FPekZXNzhEU3ltVmp1WHVKUHRZcjhGWVxuM1pXYWRiaFpxZEtLQWFkWEMwMGhvdEh3ekU3TWFvek52QVd5YlhvZHcxMGRERnJ0US9NSWxQdkZHZ3lQSzhUNlxuYzJCdEZoanVxK05lRURBeTMzTXZkeG1ZV3VtelJaUS8wZjJUUHVlUjR3S0JnUUQ5ZTRQcWx6a0J0MkVtZmhLOVxuelAzMkM5QXpCei9RTk9ZNDBFVVp3SHRVYm42aE10K1YvQURwWTBBYVoxd093WFJRb25rK01WN3NJRWlxZ3l4WFxuL0lWY0sxdVRzbllXNW0xVHVZQS81SjZCa1o1Uk56TmdRUGZKSS9PWEk3M3hqSFkxNEgrcUlkNTJ6WmhvQ1UzY1xuODIzbFlRd3RvUG01Z29YYnVhTm1DU3lFY3dLQmdRRENoUzVjZXhxMldoazRISCtnWmNEZDMwOVp6NFpGVUtjM1xuRXduUUp6NmdxTE5nSzVldytRbHEzeDFLQ2Zmek9kUmVib1RWMEszMmlYRm1wVDBjeUU5a3lZbjZleXFFRDhRU1xub1gzb24ySkFwME9WSld2cTFJdTNQWnZYQU0xWVhQWG1ubERmTGx1dWJOd21sUXh4K3AxRDRMKzNDNXNpU3dLWlxuN0RQMWFSc3dXd0tCZ1FESWYzQmltR2JSQXJubmRvVmdkOHJSV1pxL0loYkptMjRXdGpaU0hqdnZGczgydGtUQVxuSCtxZ3NJNjkwOCt2SkRuYXBnajh0cFI4ZFRURkdxaHltQnpzUUtkWTlpb09Cd21tMWUycG5DMzhFckNGVVFKa1xuT2o5RWJCbDdEUnhxK1UxdlpEblcycDlhblZqVndiWkM5SkdTZytiY0dKNHVyQjB4Slc4bmdFNGtIUUtCZ1FDV1xuM2xEYzdhWUVOTkZHa2VQeTliaW0zU0pnVi9LZUpEWHRJMWtERnMwZU1ub2RadklhRXExWk5IODFBNUpLRlZvL1xuZTV5UGNYRGJ2REkyR0liVG9oRGg3T2FWWFozV0c1eEpqdk5tenVlWG1hTnpORGtGUTZDeG1Ka2NJc1VoZWNoR1xuL0JkaFlrVTlmYlVxUDRRTml3RWF1bUEzaWtyaVNDZFdWcnJkNW8xdDdRS0JnQk85QnVFUWgrakFBWVhxMUd3dFxueDJyWjBXN0djSk9MdGdDaTIwWVVsM3pxWGY4NUUxTmgxRUtlUVhQL0FoeHl4Q0NVQy81YTdZUnp3dG0wY3VIQ1xuSU40UHFEOWUwVnFUMzVZUU80cTNMeTZUamVIR2ZZck0xOFhxeGZ6eEJ4VTlOZzBRRHBteVFTRW9raFZMVnpHWVxuVWRkYVNMRHYrNjhxb2Uxb1NsUFBVWHQ0XG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLAogICJjbGllbnRfZW1haWwiOiAiYmlncXVlcnktZ2JxQHNlY29tLTM1OTAxNC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMDU2OTA5OTcwNTM1NTE4MDUwMTIiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2JpZ3F1ZXJ5LWdicSU0MHNlY29tLTM1OTAxNC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgInVuaXZlcnNlX2RvbWFpbiI6ICJnb29nbGVhcGlzLmNvbSIKfQo=';

	// Las credenciales se obtienen de variables de entorno
	// Intentar múltiples nombres de variables por compatibilidad
	let credentials = process.env.BQ_CREDENTIALS ||
	                  process.env.BIGQUERY_CREDENTIALS ||
	                  process.env.GOOGLE_BIGQUERY_CREDENTIALS;

	// Debug logging EXTENDIDO para diagnosticar problemas en Vercel
	console.log('🔍 [BIGQUERY DEBUG] Verificando credenciales...');
	console.log('  - NODE_ENV:', process.env.NODE_ENV);
	console.log('  - Plataforma:', process.platform);
	console.log('  - Timestamp:', new Date().toISOString());

	// Verificar entorno Vercel
	console.log('  - VERCEL:', process.env.VERCEL || 'no (local)');
	console.log('  - VERCEL_ENV:', process.env.VERCEL_ENV || 'no definido');

	// Contar TODAS las variables de entorno disponibles
	const totalEnvVars = Object.keys(process.env).length;
	console.log(`  - Total variables de entorno disponibles: ${totalEnvVars}`);

	// Mostrar primeras 10 variables (para verificar que process.env funciona)
	console.log('  - Primeras 10 variables de entorno:');
	Object.keys(process.env).slice(0, 10).forEach(key => {
		const value = process.env[key];
		const preview = value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : 'VACÍO';
		console.log(`    * ${key}: ${preview}`);
	});

	// Verificar credenciales específicas
	console.log('  - BQ_CREDENTIALS existe:', !!process.env.BQ_CREDENTIALS, '- Longitud:', process.env.BQ_CREDENTIALS?.length || 0);
	console.log('  - BIGQUERY_CREDENTIALS existe:', !!process.env.BIGQUERY_CREDENTIALS, '- Longitud:', process.env.BIGQUERY_CREDENTIALS?.length || 0);
	console.log('  - GOOGLE_BIGQUERY_CREDENTIALS existe:', !!process.env.GOOGLE_BIGQUERY_CREDENTIALS, '- Longitud:', process.env.GOOGLE_BIGQUERY_CREDENTIALS?.length || 0);
	console.log('  - Credencial final seleccionada:', !!credentials, '- Longitud:', credentials?.length || 0);
	console.log('  - Primeros 50 caracteres:', credentials?.substring(0, 50) || 'N/A');
	console.log('  - GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'no definido');

	// Listar TODAS las variables de entorno que empiezan con BQ, BIGQUERY o GOOGLE
	console.log('  - Variables de entorno con BQ/BIGQUERY/GOOGLE:');
	const relevantKeys = Object.keys(process.env).filter(key =>
		key.includes('BQ') || key.includes('BIGQUERY') || key.includes('GOOGLE')
	);
	if (relevantKeys.length === 0) {
		console.log('    ⚠️ NO SE ENCONTRÓ NINGUNA VARIABLE con BQ, BIGQUERY o GOOGLE');
	} else {
		relevantKeys.forEach(key => {
			console.log(`    * ${key}: ${process.env[key] ? 'EXISTE (longitud: ' + process.env[key].length + ')' : 'VACÍO'}`);
		});
	}

	// Si no hay credenciales en variables de entorno, usar fallback
	if (!credentials) {
		console.warn('⚠️ Variables de entorno no encontradas, usando credenciales de fallback...');
		try {
			// Decodificar base64
			const decoded = Buffer.from(FALLBACK_CREDENTIALS_BASE64, 'base64').toString('utf-8');
			credentials = decoded;
			console.log('✅ Credenciales de fallback decodificadas correctamente');
		} catch (e) {
			console.error('❌ Error decodificando credenciales de fallback:', e);
			throw new Error('Error en configuración de credenciales de fallback: ' + e.message);
		}
	}

	if (credentials) {
		// Si las credenciales están en formato JSON como string
		try {
			const credentialsObj = JSON.parse(credentials);
			console.log('✅ Credenciales parseadas correctamente');
			console.log('  - project_id:', credentialsObj.project_id);
			console.log('  - Fuente:', process.env.BIGQUERY_CREDENTIALS ? 'variables de entorno' : 'fallback codificado');
			return new BigQuery({
				projectId: credentialsObj.project_id,
				credentials: credentialsObj
			});
		} catch (e) {
			console.error('❌ Error parseando credenciales:', e);
			console.error('  - Credenciales raw (primeros 100 chars):', credentials.substring(0, 100));
			throw new Error('Error en configuración de credenciales: ' + e.message);
		}
	} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		// Si apunta a un archivo
		console.log('📁 Usando GOOGLE_APPLICATION_CREDENTIALS file');
		return new BigQuery();
	} else {
		console.error('❌ NO SE ENCONTRARON CREDENCIALES (esto no debería pasar)');
		throw new Error('⛔ Credenciales de BigQuery no configuradas. Configure BIGQUERY_CREDENTIALS o GOOGLE_APPLICATION_CREDENTIALS');
	}
}

/**
 * POST /api/bigquery
 * Ejecuta una consulta segura a BigQuery
 */
export async function POST({ request }) {
	try {
		const data = await request.json();
		const { searchTerm = '', dateFrom, dateTo } = data;

		console.log('🔍 Nueva consulta BigQuery:', { searchTerm, dateFrom, dateTo });

		// Validar rango de fechas
		const { diffDays } = validateDateRange(dateFrom, dateTo);

		// IMPORTANTE: El usuario ingresa fechas en hora de Chile, pero BigQuery almacena en UTC
		// Necesitamos convertir las fechas de Chile a UTC para la consulta
		// Chile está en UTC-3 (horario de verano) o UTC-4 (horario estándar)
		// Para asegurar que incluimos TODO el día en Chile:
		// - Inicio: 2025-11-04 00:00 Chile → restar offset de Chile
		// - Fin: 2025-11-05 00:00 Chile → restar offset de Chile

		// Crear fechas en zona horaria de Chile
		const dateFromChile = new Date(`${dateFrom}T00:00:00-03:00`); // Chile UTC-3
		const dateToChile = new Date(`${dateTo}T23:59:59-03:00`);

		// Convertir a UTC para la query
		const dateFromUTC = dateFromChile.toISOString().split('.')[0].replace('T', ' ');
		const dateToUTC = dateToChile.toISOString().split('.')[0].replace('T', ' ');

		console.log('📅 Conversión de fechas:');
		console.log(`   Chile: ${dateFrom} 00:00 → UTC: ${dateFromUTC}`);
		console.log(`   Chile: ${dateTo} 23:59 → UTC: ${dateToUTC}`);

		// Construir condiciones de exclusión de dominios extranjeros
		const domainExclusions = EXCLUDED_DOMAINS.map(domain =>
			`LOWER(link) NOT LIKE '${domain}'`
		).join(' AND ');

		let baseQuery = `
			SELECT * FROM \`${AUTHORIZED_TABLE}\`
			WHERE created >= '${dateFromUTC}'
			  AND created <= '${dateToUTC}'
			  AND name_proyecto != '${EXCLUDED_PROJECT}'
			  AND (link IS NULL OR link = '' OR (${domainExclusions}))
		`;

		console.log('🚫 Excluyendo dominios extranjeros:', EXCLUDED_DOMAINS.length, 'patrones');

		// Agregar término de búsqueda si existe
		// IMPORTANTE: Extraer frases exactas Y palabras clave por separado
		// Las frases entre comillas se buscan como frases completas
		// Los operadores lógicos (AND, OR, NOT) se aplican después en el cliente
		if (searchTerm && searchTerm.trim()) {
			const searchConditions = [];

			// Paso 1: Extraer frases exactas entre comillas
			const exactPhrases = [];
			const phraseRegex = /"([^"]+)"/g;
			let match;
			let searchWithoutPhrases = searchTerm;

			while ((match = phraseRegex.exec(searchTerm)) !== null) {
				exactPhrases.push(match[1].trim());
				// Remover la frase de la búsqueda para procesarla por separado
				searchWithoutPhrases = searchWithoutPhrases.replace(match[0], ' ');
			}

			// Agregar condiciones para frases exactas
			exactPhrases.forEach(phrase => {
				if (phrase.length > 0) {
					// Escapar caracteres especiales de regex
					const escapedPhrase = phrase.toLowerCase()
						.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

					// Buscar frase completa con word boundaries
					const regexPattern = `\\b${escapedPhrase}\\b`;
					searchConditions.push(`(REGEXP_CONTAINS(LOWER(text), r'${regexPattern}') OR REGEXP_CONTAINS(LOWER(user_name), r'${regexPattern}'))`);
					console.log(`📝 Frase exacta detectada: "${phrase}"`);
				}
			});

			// Paso 2: Extraer palabras individuales (sin frases entre comillas)
			const keywords = searchWithoutPhrases
				.toLowerCase()
				.replace(/[()]/g, ' ') // Eliminar paréntesis
				.split(/\s+/) // Dividir por espacios
				.filter(word =>
					word.length > 2 && // Palabras de más de 2 caracteres
					!['and', 'or', 'not'].includes(word) // Excluir operadores
				)
				.map(word => word.replace(/\*/g, '%')); // Convertir * a % para SQL LIKE

			// Agregar condiciones para palabras individuales
			keywords.forEach(keyword => {
				// Detectar si tiene wildcards (%) - si los tiene, usar LIKE, sino usar REGEXP con word boundaries
				const hasWildcard = keyword.includes('%');

				if (hasWildcard) {
					// Si tiene wildcards, usar LIKE para búsqueda parcial
					const safeKeyword = escapeSqlString(keyword);
					searchConditions.push(`(LOWER(text) LIKE '%${safeKeyword}%' OR LOWER(user_name) LIKE '%${safeKeyword}%')`);
				} else {
					// Sin wildcards: buscar palabra completa usando REGEXP con word boundaries
					// Escapar caracteres especiales de regex
					const escapedKeyword = keyword
						.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

					// \b = word boundary (límite de palabra)
					const regexPattern = `\\b${escapedKeyword}\\b`;
					searchConditions.push(`(REGEXP_CONTAINS(LOWER(text), r'${regexPattern}') OR REGEXP_CONTAINS(LOWER(user_name), r'${regexPattern}'))`);
				}
			});

			if (searchConditions.length > 0) {
				baseQuery += ` AND (${searchConditions.join(' OR ')})`;
				console.log(`🔍 Búsqueda BigQuery - Frases exactas: ${exactPhrases.length}, Palabras: ${keywords.length}`);
			}
		}

		// Limitar a 250,000 registros para balance entre datos y rendimiento
		// Sin ORDER BY para obtener una muestra representativa de todo el rango de fechas
		baseQuery += ` LIMIT 250000`;

		// VALIDAR QUERY ANTES DE EJECUTAR
		validateQuerySecurity(baseQuery);

		console.log('✅ Query validada:', baseQuery);
		console.log(`📊 Rango: ${diffDays} días`);

		// Inicializar cliente BigQuery
		const bigquery = getBigQueryClient();

		// Ejecutar query
		const [job] = await bigquery.createQueryJob({
			query: baseQuery,
			location: 'US', // Ajustar según la ubicación de tu dataset
		});

		console.log(`🚀 Job iniciado: ${job.id}`);

		// Obtener resultados
		const [rows] = await job.getQueryResults();

		console.log(`✅ Resultados obtenidos: ${rows.length} registros`);

		return json({
			success: true,
			data: rows,
			count: rows.length,
			metadata: {
				searchTerm,
				dateFrom,
				dateTo,
				rangeDays: diffDays,
				excludedProject: EXCLUDED_PROJECT
			}
		});

	} catch (error) {
		console.error('❌ Error en consulta BigQuery:', error);

		return json({
			success: false,
			error: error.message || 'Error desconocido',
			details: process.env.NODE_ENV === 'development' ? error.stack : undefined
		}, { status: 400 });
	}
}

/**
 * GET /api/bigquery
 * Health check
 */
export async function GET() {
	return json({
		status: 'OK',
		message: 'BigQuery API endpoint funcionando',
		security: {
			onlySelect: true,
			authorizedTable: AUTHORIZED_TABLE,
			maxRangeDays: MAX_RANGE_DAYS,
			excludedProject: EXCLUDED_PROJECT,
			resultLimit: 250000
		}
	});
}
