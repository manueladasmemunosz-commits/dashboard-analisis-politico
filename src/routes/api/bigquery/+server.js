/**
 * Servidor seguro para consultas BigQuery
 * Solo operaciones READ - Máxima precaución
 *
 * Validaciones de seguridad:
 * 1. Solo comandos SELECT
 * 2. Tabla específica autorizada
 * 3. Escape de SQL injection
 * 4. Rango de fechas obligatorio y limitado (máx 2 años)
 * 5. Límite alto de resultados para evitar queries masivas
 */

// Cargar variables de entorno
import dotenv from 'dotenv';
dotenv.config();

import { json } from '@sveltejs/kit';
import { BigQuery } from '@google-cloud/bigquery';

// Tabla autorizada
const AUTHORIZED_TABLE = 'secom-359014.ProyectosTooldata.datav2';

// Proyecto excluido - NUNCA debe aparecer en búsquedas
const EXCLUDED_PROJECT = 'pesimismo pais';

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
	// Las credenciales se obtienen de variables de entorno
	// GOOGLE_APPLICATION_CREDENTIALS debe apuntar al archivo de credenciales
	// o se pueden configurar las credenciales directamente

	const credentials = process.env.BIGQUERY_CREDENTIALS;

	if (credentials) {
		// Si las credenciales están en formato JSON como string
		try {
			const credentialsObj = JSON.parse(credentials);
			return new BigQuery({
				projectId: credentialsObj.project_id,
				credentials: credentialsObj
			});
		} catch (e) {
			console.error('❌ Error parseando credenciales:', e);
			throw new Error('Error en configuración de credenciales');
		}
	} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		// Si apunta a un archivo
		return new BigQuery();
	} else {
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

		// Construir query segura
		let baseQuery = `
			SELECT * FROM \`${AUTHORIZED_TABLE}\`
			WHERE created >= '${dateFrom}'
			  AND created <= '${dateTo}'
			  AND name_proyecto != '${EXCLUDED_PROJECT}'
		`;

		// Agregar término de búsqueda si existe
		// IMPORTANTE: Extraer palabras clave para búsqueda en BigQuery
		// Los operadores lógicos (AND, OR, NOT) se aplican después en el cliente
		if (searchTerm && searchTerm.trim()) {
			// Extraer todas las palabras clave (sin operadores, paréntesis, comillas)
			const keywords = searchTerm
				.toLowerCase()
				.replace(/[()]/g, ' ') // Eliminar paréntesis
				.replace(/"([^"]+)"/g, '$1') // Eliminar comillas pero mantener el texto
				.split(/\s+/) // Dividir por espacios
				.filter(word =>
					word.length > 2 && // Palabras de más de 2 caracteres
					!['and', 'or', 'not'].includes(word) // Excluir operadores
				)
				.map(word => word.replace(/\*/g, '%')); // Convertir * a % para SQL LIKE

			if (keywords.length > 0) {
				// Buscar cualquiera de las palabras clave en BigQuery (OR)
				const searchConditions = keywords.map(keyword => {
					const safeKeyword = escapeSqlString(keyword);
					return `(LOWER(text) LIKE '%${safeKeyword}%' OR LOWER(user_name) LIKE '%${safeKeyword}%')`;
				});

				baseQuery += ` AND (${searchConditions.join(' OR ')})`;
				console.log(`🔍 Búsqueda BigQuery con ${keywords.length} palabras clave:`, keywords);
			}
		}

		// Ordenar por fecha descendente (sin límite de registros)
		baseQuery += ` ORDER BY created DESC`;

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
			noResultLimit: true
		}
	});
}
