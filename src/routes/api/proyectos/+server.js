import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

// Ruta al archivo JSON de proyectos
const proyectosPath = path.resolve('src/data/proyectos.json');

// GET: Obtener todos los proyectos
export async function GET() {
	try {
		const data = fs.readFileSync(proyectosPath, 'utf-8');
		const proyectos = JSON.parse(data);
		return json(proyectos);
	} catch (error) {
		console.error('❌ Error leyendo proyectos:', error);
		return json({ error: 'Error al leer proyectos' }, { status: 500 });
	}
}

// POST: Crear nuevo proyecto
export async function POST({ request }) {
	try {
		const nuevoProyecto = await request.json();

		// Validar campos requeridos
		if (!nuevoProyecto.nombre || !nuevoProyecto.query || !nuevoProyecto.query.searchTerm) {
			return json({ error: 'Faltan campos requeridos' }, { status: 400 });
		}

		// Generar ID único si no viene
		if (!nuevoProyecto.id) {
			nuevoProyecto.id = nuevoProyecto.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
		}

		// Agregar timestamps
		nuevoProyecto.createdAt = new Date().toISOString();

		// Leer proyectos actuales
		const data = fs.readFileSync(proyectosPath, 'utf-8');
		const proyectos = JSON.parse(data);

		// Verificar que no exista el ID
		if (proyectos.find(p => p.id === nuevoProyecto.id)) {
			return json({ error: 'Ya existe un proyecto con ese ID' }, { status: 400 });
		}

		// Agregar nuevo proyecto
		proyectos.push(nuevoProyecto);

		// Guardar
		fs.writeFileSync(proyectosPath, JSON.stringify(proyectos, null, 2));

		console.log('✅ Proyecto creado:', nuevoProyecto.nombre);
		return json(nuevoProyecto, { status: 201 });

	} catch (error) {
		console.error('❌ Error creando proyecto:', error);
		return json({ error: 'Error al crear proyecto' }, { status: 500 });
	}
}

// PUT: Actualizar proyecto existente
export async function PUT({ request }) {
	try {
		const proyectoActualizado = await request.json();

		if (!proyectoActualizado.id) {
			return json({ error: 'ID de proyecto requerido' }, { status: 400 });
		}

		// Leer proyectos actuales
		const data = fs.readFileSync(proyectosPath, 'utf-8');
		let proyectos = JSON.parse(data);

		// Encontrar índice del proyecto
		const index = proyectos.findIndex(p => p.id === proyectoActualizado.id);

		if (index === -1) {
			return json({ error: 'Proyecto no encontrado' }, { status: 404 });
		}

		// Mantener createdAt original, actualizar updatedAt
		proyectoActualizado.createdAt = proyectos[index].createdAt;
		proyectoActualizado.updatedAt = new Date().toISOString();

		// Actualizar proyecto
		proyectos[index] = proyectoActualizado;

		// Guardar
		fs.writeFileSync(proyectosPath, JSON.stringify(proyectos, null, 2));

		console.log('✅ Proyecto actualizado:', proyectoActualizado.nombre);
		return json(proyectoActualizado);

	} catch (error) {
		console.error('❌ Error actualizando proyecto:', error);
		return json({ error: 'Error al actualizar proyecto' }, { status: 500 });
	}
}

// DELETE: Eliminar proyecto
export async function DELETE({ request }) {
	try {
		const { id } = await request.json();

		if (!id) {
			return json({ error: 'ID de proyecto requerido' }, { status: 400 });
		}

		// Leer proyectos actuales
		const data = fs.readFileSync(proyectosPath, 'utf-8');
		let proyectos = JSON.parse(data);

		// Filtrar proyecto a eliminar
		const proyectosFiltrados = proyectos.filter(p => p.id !== id);

		if (proyectos.length === proyectosFiltrados.length) {
			return json({ error: 'Proyecto no encontrado' }, { status: 404 });
		}

		// Guardar
		fs.writeFileSync(proyectosPath, JSON.stringify(proyectosFiltrados, null, 2));

		console.log('✅ Proyecto eliminado:', id);
		return json({ success: true, id });

	} catch (error) {
		console.error('❌ Error eliminando proyecto:', error);
		return json({ error: 'Error al eliminar proyecto' }, { status: 500 });
	}
}
