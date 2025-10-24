# Guía de Trabajo con Claude Code

## 📋 Información del Proyecto

**Proyecto:** Dashboard de Análisis PolíticO
**Framework:** SvelteKit con integración BigQuery
**Deployment:** Vercel
**Última actualización:** Enero 2025

---

## 🎯 Contexto del Proyecto

Este es un dashboard interactivo para análisis político que permite:
- Búsqueda y filtrado de posts de redes sociales y noticias
- Visualización de líneas de tiempo de actividad
- Análisis de engagement (likes, comentarios, shares)
- Nube de palabras para análisis de contenido
- Integración con Google BigQuery para consultas masivas de datos

### Datos Importantes
- **Tabla BigQuery:** `secom-359014.ProyectosTooldata.datav2`
- **Proyecto excluido:** "pesimismo pais" (nunca debe aparecer en búsquedas)
- **Límite de rango:** Máximo 730 días (2 años) por consulta
- **Fuentes de datos:** Twitter, Instagram, noticias web

---

## 🔧 Arquitectura Técnica

### Frontend (SvelteKit)
```
src/
├── routes/
│   ├── +page.svelte          # Dashboard principal
│   └── api/
│       └── bigquery/
│           └── +server.js     # API endpoint seguro para BigQuery
├── lib/
│   ├── components/
│   │   ├── charts/
│   │   │   └── TimelineChart.svelte  # Gráfico de línea de tiempo
│   │   ├── PostDetailsModal.svelte   # Modal de detalles de posts
│   │   └── WordCloudComponent.svelte # Nube de palabras
│   └── stores/
│       └── dashboard.js       # Store principal con filtros y datos
└── workers/
    ├── timeline.worker.js     # Procesamiento de timeline
    ├── wordcloud.worker.js    # Procesamiento de nube de palabras
    └── topposts.worker.js     # Procesamiento de top posts
```

### Backend (API Routes)
- **`/api/bigquery/+server.js`**: Endpoint seguro con validaciones
  - Solo queries SELECT
  - Escape de SQL injection
  - Validación de rango de fechas
  - Tabla autorizada únicamente

---

## 🚀 Funcionalidades Implementadas

### ✅ 1. Integración BigQuery
- Consultas seguras a tabla de producción
- Validaciones de seguridad (solo SELECT, tabla autorizada)
- Búsqueda case-insensitive con `LOWER()`
- Rango de fechas obligatorio (máx 730 días)
- Eliminación automática de duplicados por campo `link`

**Archivo principal:** `/src/routes/api/bigquery/+server.js`

### ✅ 2. Búsqueda con Operadores Lógicos
Arquitectura de dos etapas:
1. **BigQuery:** Extrae keywords y busca con OR (superconjunto)
2. **Cliente:** Aplica operadores lógicos exactos (AND, OR, NOT, paréntesis)

**Ejemplo:**
```
Búsqueda: "procultura OR secom OR paredes"
→ BigQuery: SELECT * WHERE (text LIKE '%procultura%' OR text LIKE '%secom%' OR text LIKE '%paredes%')
→ Cliente: Aplica lógica OR exacta a los resultados
```

**Archivos:**
- Backend: `/src/routes/api/bigquery/+server.js:173-196`
- Frontend: `/src/lib/stores/dashboard.js` (función de filtrado)

### ✅ 3. Visualización de Timeline
- Gráfico interactivo con Chart.js
- Granularidad: hora, día, semana, mes
- Click en puntos abre modal con posts del período
- Manejo correcto de zonas horarias (UTC)

**Archivo:** `/src/lib/components/charts/TimelineChart.svelte`

**Fix importante:** Variables en scope de componente para onClick
```javascript
// Líneas 31-34: Variables en scope de componente
let sortedKeys = [];
let sortedKeysB = [];
let currentDateGroups = {};
let currentDateGroupsB = {};
```

### ✅ 4. Manejo de Duplicados
Eliminación automática usando Map con campo `link`:
```javascript
// dashboard.js:352-367
const uniqueData = Array.from(
  new Map(validData.map(item => [item.link, item])).values()
);
```

### ✅ 5. Manejo de Timezone (UTC)
Todos los posts se parsean y muestran en UTC para evitar desplazamientos de fecha:
```javascript
// TimelineChart.svelte:128-132
const [year, month, day] = groupKey.split('-');
const dateObj = new Date(Date.UTC(year, month - 1, day));
return dateObj.toLocaleDateString('es-CL', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});
```

### ✅ 6. Optimización de Performance
- Word Cloud procesamiento manual (no automático)
- Cálculo de engagement optimizado con derivado reactivo
- Web Workers para procesamiento pesado
- Sin límite de resultados en BigQuery (trae todos los datos del rango)

---

## 🔍 Comandos Útiles

### Desarrollo
```bash
# Iniciar servidor de desarrollo
npm run dev

# Con exposición de red
npm run dev -- --host 0.0.0.0

# Build para producción
npm run build

# Preview del build
npm run preview
```

### Deployment (Vercel)
```bash
# Deploy automático al push a main
git push origin main

# El proyecto usa adapter-vercel (NO adapter-auto)
# Configurado en svelte.config.js
```

### Testing Local de BigQuery
```bash
# Verificar credenciales
echo $BIGQUERY_CREDENTIALS

# Ver variables de entorno
cat .env
```

---

## 🛠️ Tareas Comunes

### 1. Modificar Query de BigQuery
**Archivo:** `/src/routes/api/bigquery/+server.js`

Puntos importantes:
- Siempre usar `LOWER()` para búsquedas case-insensitive
- Validar que la query pase `validateQuerySecurity()`
- Incluir filtro de proyecto excluido: `name_proyecto != '${EXCLUDED_PROJECT}'`
- No usar `DATE(created)` (causa falsos positivos en validación de seguridad)

### 2. Agregar Nuevos Filtros
**Archivo:** `/src/lib/stores/dashboard.js`

1. Agregar el filtro al store:
```javascript
export const filters = writable({
  searchTerm: '',
  dateFrom: '',
  dateTo: '',
  // Agregar nuevo filtro aquí
  nuevoFiltro: ''
});
```

2. Actualizar el derivado `filteredData`:
```javascript
$: filteredData = derived([rawData, filters], ([$data, $filters]) => {
  return $data.filter(item => {
    // Agregar lógica de filtrado aquí
    if ($filters.nuevoFiltro && ...) return false;
    return true;
  });
});
```

### 3. Agregar Nuevos Charts
**Pasos:**
1. Crear componente en `/src/lib/components/charts/`
2. Usar Web Worker si el procesamiento es pesado
3. Conectar con el store `filteredData`
4. Incluir en el dashboard principal

**Ejemplo:**
```svelte
<script>
  import { filteredData } from '$lib/stores/dashboard';

  $: processedData = $filteredData.map(...);
</script>

<div class="chart-container">
  <!-- Tu gráfico aquí -->
</div>
```

### 4. Debugging de Búsquedas
Usar los console.log incluidos:
```javascript
// En BigQuery API
console.log('🔍 Nueva consulta BigQuery:', { searchTerm, dateFrom, dateTo });
console.log('✅ Query validada:', baseQuery);
console.log(`✅ Resultados obtenidos: ${rows.length} registros`);

// En dashboard.js
console.log(`🔄 Eliminación de duplicados: ${duplicatesRemoved} duplicados`);
console.log(`✅ Filtrado: ${filtered.length}/${total.length} posts`);
```

---

## ⚠️ Problemas Conocidos y Soluciones

### 1. "Comando prohibido detectado: CREATE"
**Causa:** Uso de `DATE(created)` en query
**Solución:** Usar `created >= 'YYYY-MM-DD'` directamente sin DATE()

### 2. Fechas mostrando un día menos
**Causa:** Conversión de UTC a zona horaria local
**Solución:** Usar `Date.UTC()` y `timeZone: 'UTC'`

### 3. Click en timeline no abre modal
**Causa:** Variables en scope incorrecto
**Solución:** Mover variables a scope de componente (líneas 31-34 de TimelineChart.svelte)

### 4. Búsqueda con OR no funciona
**Causa:** BigQuery buscaba string literal "procultura OR secom"
**Solución:** Arquitectura de dos etapas (extracción de keywords + filtro cliente)

### 5. Filtros no se aplican después de BigQuery
**Causa:** No se actualiza el store de filters con searchTerm
**Solución:** Llamar `updateFilters()` después de `loadCsvData()`

### 6. Word Cloud no se muestra
**Causa:** Procesamiento automático en cada cambio de datos
**Solución:** Cambiar a procesamiento manual con botón

### 7. Rango de fechas no incluye día completo final (NUEVO - Oct 23, 2025)
**Causa:** `created <= '2025-10-23'` interpreta como 00:00:00
**Solución:** Usar `created < '2025-10-24'` para incluir hasta 23:59:59
**Archivo:** `/src/routes/api/bigquery/+server.js:162-175`

### 8. Filtrado duplicado elimina todos los posts (NUEVO - Oct 23, 2025)
**Causa:** Cliente vuelve a aplicar searchTerm después de que BigQuery ya filtró
**Solución:** NO pasar searchTerm a `updateFilters()` después de BigQuery
**Archivo:** `/src/routes/+page.svelte:305-309`
**Detalle:** BigQuery filtra por keywords, cliente no debe volver a filtrar

### 9. Noticias muestran hora del scraper (NUEVO - Oct 23, 2025)
**Causa:** Medios no publican hora exacta, scraper usa 03:00 AM
**Solución:** Sumar +9 horas visual para aproximar hora real (~12:00)
**Archivo:** `/src/lib/components/PostDetailsModal.svelte:21-35`
**Nota:** Usuario debe agregar disclaimer explicando ajuste

---

## 📊 Métricas de Rendimiento

### Datos Actuales del Sistema
- **Dataset completo:** ~36,044 registros
- **Búsqueda típica:** 200-500 posts
- **Duplicados promedio:** 15-20% de posts
- **Tiempo de query BigQuery:** 3-5 segundos
- **Procesamiento cliente:** <1 segundo

### Optimizaciones Implementadas
1. ✅ Eliminación de duplicados en servidor
2. ✅ Web Workers para procesamiento pesado
3. ✅ Cálculo reactivo de engagement solo cuando es necesario
4. ✅ Word Cloud procesamiento manual
5. ✅ Sin límite artificial de resultados

---

## 🔐 Seguridad

### Validaciones Implementadas
1. **Solo queries SELECT** - Bloqueados: DELETE, DROP, UPDATE, INSERT, etc.
2. **Tabla autorizada** - Solo acceso a `secom-359014.ProyectosTooldata.datav2`
3. **SQL injection** - Escape de comillas con `''`
4. **Rango de fechas** - Obligatorio y limitado a 730 días
5. **Proyecto excluido** - Filtro automático de "pesimismo pais"

### Credenciales
- Variable de entorno: `BIGQUERY_CREDENTIALS`
- Formato: JSON string con credenciales de servicio
- **NUNCA** commitear credenciales al repositorio
- Configuradas en Vercel como variables de entorno

---

## 📝 Notas para Claude

### Al trabajar en este proyecto:
1. **Siempre leer archivos antes de editar** - Usar Read tool
2. **Mantener validaciones de seguridad** - No remover validaciones en BigQuery API
3. **Preservar manejo de timezone** - Mantener UTC en todo el flujo
4. **Respetar arquitectura de dos etapas** - BigQuery OR + filtro cliente
5. **Usar console.log existentes** - Ya están estratégicamente ubicados
6. **No eliminar duplicados dos veces** - Solo en una capa (actualmente en cliente)
7. **NO volver a filtrar searchTerm después de BigQuery** - BigQuery ya filtró (NUEVO)
8. **Rangos de fechas deben ser inclusivos** - Usar `<` día siguiente, no `<=` día final (NUEVO)
9. **Hora de noticias es aproximada** - Scraper usa 03:00, ajustar +9h visual (NUEVO)

### Al hacer cambios:
1. Verificar que las validaciones de seguridad siguen funcionando
2. Probar búsquedas con operadores lógicos (AND, OR, NOT)
3. Verificar que las fechas se muestran correctamente (UTC)
4. Comprobar que los duplicados se eliminan
5. Testear clicks en timeline que abran el modal

### Comandos frecuentes:
```bash
# Ver estructura del proyecto
tree -I 'node_modules|.git' -L 3

# Buscar en código
grep -r "searchTerm" src/

# Ver logs en tiempo real
npm run dev # y revisar consola del navegador
```

---

## 🔗 Referencias

### Documentación Externa
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Google BigQuery Docs](https://cloud.google.com/bigquery/docs)
- [Chart.js Docs](https://www.chartjs.org/docs/)
- [Vercel Adapter](https://kit.svelte.dev/docs/adapter-vercel)

### Archivos Clave del Proyecto
- `/src/routes/api/bigquery/+server.js` - API BigQuery
- `/src/lib/stores/dashboard.js` - Store principal
- `/src/routes/+page.svelte` - Dashboard principal
- `/src/lib/components/charts/TimelineChart.svelte` - Timeline
- `svelte.config.js` - Configuración de SvelteKit

---

## ✅ Checklist de Verificación

Antes de cada deploy:
- [ ] Búsqueda simple funciona (ej: "simce")
- [ ] Búsqueda con OR funciona (ej: "procultura OR secom")
- [ ] Búsqueda con AND funciona (ej: "procultura AND paredes")
- [ ] Fechas se muestran correctamente (no un día menos)
- [ ] Clicks en timeline abren modal
- [ ] Duplicados se eliminan correctamente
- [ ] Word Cloud funciona (modo manual)
- [ ] Top posts se calculan correctamente
- [ ] No hay errores en consola del navegador
- [ ] Variables de entorno configuradas en Vercel

---

## 📞 Contacto y Soporte

Para problemas o mejoras:
1. Revisar este documento primero
2. Revisar SESSION_NOTES.md para historial detallado
3. Revisar TESTING.md para casos de prueba
4. Consultar BACKLOG.md para tareas pendientes
