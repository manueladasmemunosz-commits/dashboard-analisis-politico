import { json } from '@sveltejs/kit';

// Esta API ahora solo sirve para desarrollo local
// En producción (Vercel), los proyectos se guardan en localStorage del navegador

// GET: Intentar obtener proyectos del archivo estático, o devolver vacío
export async function GET() {
	try {
		// Intentar leer el archivo solo en desarrollo local
		if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
			const fs = await import('fs');
			const path = await import('path');
			const proyectosPath = path.resolve('src/data/proyectos.json');

			if (fs.existsSync(proyectosPath)) {
				const data = fs.readFileSync(proyectosPath, 'utf-8');
				const proyectos = JSON.parse(data);
				console.log('✅ Proyectos cargados desde archivo:', proyectos.length);
				return json(proyectos);
			}
		}

		// En producción o si no existe el archivo, devolver los proyectos por defecto
		const proyectosDefault = [
			{
				"id": "presidenciales",
				"nombre": "Presidenciales",
				"descripcion": "",
				"creador": "Equipo Análisis",
				"query": {
					"searchTerm": "Jara OR Kast OR Parisi OR Kaiser",
					"dateFrom": "2025-08-01",
					"dateTo": "2025-12-31",
					"redes": ["twitter", "news"]
				},
				"color": "#3498db",
				"createdAt": "2025-10-31T16:14:47.569Z"
			},
			{
				"id": "seguridad",
				"nombre": "Seguridad",
				"descripcion": "",
				"creador": "Equipo Análisis",
				"query": {
					"searchTerm": "delictuales OR delictivos OR balazos OR seguridad",
					"dateFrom": "2025-11-01",
					"dateTo": "2025-12-31",
					"redes": ["twitter", "news"]
				},
				"color": "#3498db",
				"createdAt": "2025-11-04T12:48:26.878Z",
				"updatedAt": "2025-11-05T18:37:04.052Z"
			}
		];

		console.log('ℹ️ Devolviendo proyectos por defecto (localStorage es la fuente principal)');
		return json(proyectosDefault);

	} catch (error) {
		console.log('⚠️ API en modo serverless - devolviendo array vacío');
		// Devolver array vacío para que el frontend use localStorage
		return json([]);
	}
}

// POST: En producción usa localStorage, este endpoint solo confirma recepción
export async function POST({ request }) {
	try {
		const nuevoProyecto = await request.json();
		console.log('ℹ️ Proyecto recibido (localStorage maneja persistencia):', nuevoProyecto.nombre);

		// En producción, el frontend maneja todo con localStorage
		// Solo devolvemos el proyecto para confirmar
		return json(nuevoProyecto, { status: 201 });

	} catch (error) {
		console.error('❌ Error en POST:', error);
		return json({ error: 'Error al procesar proyecto' }, { status: 500 });
	}
}

// PUT: En producción usa localStorage
export async function PUT({ request }) {
	try {
		const proyectoActualizado = await request.json();
		console.log('ℹ️ Proyecto actualizado (localStorage maneja persistencia):', proyectoActualizado.nombre);

		return json(proyectoActualizado);

	} catch (error) {
		console.error('❌ Error en PUT:', error);
		return json({ error: 'Error al actualizar proyecto' }, { status: 500 });
	}
}

// DELETE: En producción usa localStorage
export async function DELETE({ request }) {
	try {
		const { id } = await request.json();
		console.log('ℹ️ Proyecto eliminado (localStorage maneja persistencia):', id);

		return json({ success: true, id });

	} catch (error) {
		console.error('❌ Error en DELETE:', error);
		return json({ error: 'Error al eliminar proyecto' }, { status: 500 });
	}
}
