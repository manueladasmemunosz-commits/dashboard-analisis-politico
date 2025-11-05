# Dashboard de Análisis Político

Dashboard interactivo para análisis de redes sociales y noticias políticas, con integración a Google BigQuery para consultas masivas de datos.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=white)
![Status](https://img.shields.io/badge/status-production-success)

---

## 📋 Descripción

Sistema de análisis en tiempo real de contenido político en redes sociales (Twitter, Instagram) y medios de comunicación. Permite búsquedas avanzadas con operadores lógicos, visualización de líneas de tiempo de actividad, análisis de engagement, y generación de nubes de palabras.

---

## 📸 Screenshots

### Dashboard Principal
![Dashboard Principal](docs/screenshots/main-dashboard.png)
*Vista principal con gráficos interactivos de timeline, top posts y análisis de engagement*

### Búsqueda Avanzada
![Búsqueda Avanzada](docs/screenshots/advanced-search.png)
*Modal de ayuda mostrando operadores lógicos y ejemplos de búsqueda*

### Comparación de Proyectos
![Comparación de Proyectos](docs/screenshots/project-comparison.png)
*Vista de comparación de múltiples proyectos con métricas lado a lado*

### Estado de Carga
![Estado de Carga](docs/screenshots/loading-state.png)
*Indicador de progreso mejorado mostrando pasos del proceso*

> **Nota**: Para agregar tus propios screenshots, guarda las imágenes en la carpeta `docs/screenshots/` y reemplaza los nombres de archivo arriba.

### Características Principales

- 🔍 **Búsqueda Avanzada**: Operadores lógicos (AND, OR, NOT), búsqueda de frases exactas, wildcards
- 📊 **Visualizaciones Interactivas**: Timeline de actividad, Top Posts, Word Cloud
- 🚀 **BigQuery Integration**: Consultas eficientes a millones de registros
- 🔒 **Seguridad**: Validaciones estrictas, solo queries SELECT, protección contra SQL injection
- ⚡ **Performance**: Web Workers para procesamiento pesado, optimizaciones de renderizado
- 🌐 **UTC Timezone**: Manejo consistente de fechas y horas
- 🔄 **Deduplicación**: Eliminación automática de posts duplicados

---

## 🚀 Quick Start

### Prerequisitos

- Node.js 18+ y npm
- Credenciales de Google BigQuery
- Acceso a tabla `secom-359014.ProyectosTooldata.datav2`

### Instalación

```bash
# Clonar repositorio
git clone [repo-url]
cd dashboard-svelte

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de BigQuery

# Iniciar servidor de desarrollo
npm run dev

# Abrir en navegador
# http://localhost:5173
```

### Variables de Entorno

```bash
# .env
BIGQUERY_CREDENTIALS='{"type": "service_account", "project_id": "...", ...}'
# O alternativamente:
GOOGLE_APPLICATION_CREDENTIALS='/path/to/credentials.json'
```

---

## 📖 Uso

### Búsqueda Básica

```
1. Seleccionar rango de fechas (máximo 2 años)
2. Ingresar término de búsqueda
3. Click en "Buscar"
```

### Búsqueda Avanzada

**Operadores Lógicos:**
```
procultura OR secom              # Posts con cualquiera de las palabras
procultura AND paredes           # Posts con ambas palabras
procultura NOT simce             # Posts con "procultura" pero sin "simce"
(procultura OR secom) AND kast   # Combinación con paréntesis
```

**Frases Exactas:**
```
"ministerio de educación"        # Busca la frase exacta
```

**Wildcards:**
```
educ*                            # educación, educativo, educar...
```

### Visualizaciones

- **Timeline Chart**: Click en puntos para ver posts del período
- **Word Cloud**: Click en "Generar Word Cloud" para análisis de palabras
- **Top Posts**: Posts ordenados por engagement (likes + comments + shares)

---

## 🏗️ Arquitectura

### Stack Tecnológico

- **Frontend**: SvelteKit, Chart.js, D3.js
- **Backend**: SvelteKit API Routes
- **Database**: Google BigQuery
- **Deployment**: Vercel (serverless)
- **Workers**: Web Workers para procesamiento paralelo

### Estructura del Proyecto

```
dashboard-svelte/
├── src/
│   ├── routes/
│   │   ├── +page.svelte                 # Dashboard principal
│   │   └── api/
│   │       └── bigquery/
│   │           └── +server.js           # API endpoint seguro
│   ├── lib/
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   │   └── TimelineChart.svelte # Gráfico de timeline
│   │   │   ├── PostDetailsModal.svelte  # Modal de detalles
│   │   │   └── WordCloudComponent.svelte # Nube de palabras
│   │   └── stores/
│   │       └── dashboard.js             # Store principal (filtros, datos)
│   └── workers/
│       ├── timeline.worker.js           # Procesamiento de timeline
│       ├── wordcloud.worker.js          # Procesamiento de word cloud
│       └── topposts.worker.js           # Cálculo de top posts
├── docs/
│   ├── CLAUDE.md                        # Guía para desarrollo con Claude Code
│   ├── BACKLOG.md                       # Roadmap y features pendientes
│   ├── TESTING.md                       # Casos de prueba y QA
│   └── SESSION_NOTES.md                 # Notas detalladas de desarrollo
├── static/                              # Assets estáticos
├── svelte.config.js                     # Configuración de SvelteKit
├── package.json
└── README.md
```

### Arquitectura de Búsqueda

**Two-Stage Search:**

1. **Backend (BigQuery)**: Extrae keywords, retorna superconjunto con SQL OR
2. **Frontend (Cliente)**: Aplica operadores lógicos exactos (AND, OR, NOT, paréntesis)

**Ventajas:**
- Menos queries a BigQuery → Menos costo
- Filtrado rápido en cliente
- Soporte completo de operadores complejos

---

## 🔒 Seguridad

### Validaciones Implementadas

1. **Solo queries SELECT** - Bloqueados: DELETE, DROP, UPDATE, INSERT, ALTER, CREATE, etc.
2. **Tabla autorizada** - Solo acceso a tabla específica de BigQuery
3. **SQL Injection** - Escape de caracteres especiales
4. **Rango de fechas** - Obligatorio y limitado (máx 730 días)
5. **Proyecto excluido** - Filtro automático de proyecto específico

### Ejemplo de Validación

```javascript
// validateQuerySecurity() en /src/routes/api/bigquery/+server.js
const forbiddenCommands = ['DELETE', 'DROP', 'TRUNCATE', 'UPDATE', 'INSERT', ...];

for (const cmd of forbiddenCommands) {
  const regex = new RegExp(`\\b${cmd}\\b`, 'i');
  if (regex.test(query)) {
    throw new Error(`⛔ Comando prohibido: ${cmd}`);
  }
}
```

---

## 📊 Performance

### Métricas Actuales

- **Dataset completo**: ~36,000 registros
- **Búsqueda típica**: 200-500 posts
- **Tiempo de query BigQuery**: 3-5 segundos
- **Procesamiento cliente**: <1 segundo
- **Duplicados promedio**: 15-20%

### Optimizaciones

- ✅ Web Workers para procesamiento pesado
- ✅ Cálculo reactivo de engagement (derivados Svelte)
- ✅ Word Cloud manual (no automático)
- ✅ Eliminación eficiente de duplicados (Map)
- ✅ Sin límite artificial de resultados

---

## 🧪 Testing

### Testing Manual

Ver [`docs/TESTING.md`](docs/TESTING.md) para checklist completo de QA.

**Pre-Deploy Checklist:**
- [ ] Búsqueda simple funciona
- [ ] Operadores lógicos (OR, AND, NOT) funcionan
- [ ] Clicks en timeline abren modal
- [ ] Fechas se muestran correctamente (UTC)
- [ ] Duplicados se eliminan
- [ ] Validaciones de seguridad activas

### Testing Automatizado (Próximamente)

```bash
# Unit tests (Vitest)
npm run test

# E2E tests (Playwright)
npm run test:e2e
```

---

## 📦 Deployment

### Vercel (Producción)

```bash
# Deploy automático al push a main
git push origin main

# Deploy manual
vercel --prod
```

**Configuración Importante:**
- Usar `@sveltejs/adapter-vercel` (NO adapter-auto)
- Configurar variables de entorno en Vercel Dashboard
- BigQuery credentials como `BIGQUERY_CREDENTIALS`

### Local Build

```bash
# Build para producción
npm run build

# Preview del build
npm run preview
```

---

## 📚 Documentación

### Documentos Disponibles

- **[CLAUDE.md](docs/CLAUDE.md)** - Guía completa para desarrollo con Claude Code
- **[BACKLOG.md](docs/BACKLOG.md)** - Roadmap, features pendientes, y prioridades
- **[TESTING.md](docs/TESTING.md)** - Casos de prueba, QA checklist, y debugging
- **[SESSION_NOTES.md](docs/SESSION_NOTES.md)** - Historial detallado de desarrollo

### Recursos Externos

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [Chart.js Documentation](https://www.chartjs.org/docs/)

---

## 🛠️ Comandos Útiles

```bash
# Desarrollo
npm run dev                    # Iniciar dev server
npm run dev -- --host 0.0.0.0  # Dev server con network access

# Build
npm run build                  # Build para producción
npm run preview                # Preview del build

# Linting/Formatting
npm run check                  # Svelte check
npm run check:watch            # Check en modo watch

# Deployment
vercel                         # Deploy a Vercel
vercel --prod                  # Deploy a producción
```

---

## 🐛 Troubleshooting

### Problema: Query retorna 0 resultados

**Posibles causas:**
1. Rango de fechas sin datos
2. Término de búsqueda muy específico
3. Error en credenciales de BigQuery

**Solución:**
- Revisar console del navegador (F12)
- Verificar logs de Vercel: `vercel logs`
- Comprobar formato de fechas (YYYY-MM-DD)

### Problema: Fechas mostrando un día menos

**Causa:** Conversión de timezone

**Solución:** Ya implementado - todas las fechas usan UTC

### Problema: Timeline clicks no abren modal

**Solución:** Ya implementado - variables en scope de componente

Ver [`docs/TESTING.md`](docs/TESTING.md) para más problemas comunes y soluciones.

---

## 🚀 Roadmap

### v1.0.0 - Actual ✅
- Integración BigQuery
- Búsqueda con operadores lógicos
- Timeline interactivo
- Word Cloud
- Top posts por engagement

### v1.1.0 - Próximo (Febrero 2025)
- Exportación de datos (CSV, Excel, PDF)
- Caché de búsquedas frecuentes
- Filtros avanzados de engagement
- Indicador de progreso en búsquedas largas

### v2.0.0 - Futuro (Q2 2025)
- Análisis de sentimiento
- Comparación de períodos
- Sistema de alertas
- Gráfico de red de usuarios

Ver [`docs/BACKLOG.md`](docs/BACKLOG.md) para roadmap completo.

---

## 👥 Contribución

### Agregar Nueva Feature

1. Revisar [`docs/BACKLOG.md`](docs/BACKLOG.md) para ver si ya está planificada
2. Crear branch: `git checkout -b feature/nueva-feature`
3. Implementar cambios
4. Ejecutar checklist de QA (ver [`docs/TESTING.md`](docs/TESTING.md))
5. Crear Pull Request con descripción detallada

### Reportar Bug

Ver template en [`docs/TESTING.md`](docs/TESTING.md#-template-de-bug-report)

---

## 📝 Changelog

### v1.0.1 - Octubre 23, 2025

**Fixed:**
- ✅ **Rango de fechas inclusivo**: Ahora incluye el día completo final (hasta 23:59:59)
- ✅ **Filtrado duplicado**: BigQuery filtra una vez, cliente no vuelve a filtrar searchTerm
- ✅ **Hora de noticias ajustada**: +9 horas para aproximar hora real (~12:00)

**Added:**
- ✅ **Logging detallado**: Muestra cuántos posts elimina cada filtro (debug)

**Details:**
- Rango de fechas: Cambio de `created <= dateTo` a `created < dateTo+1`
- Filtrado: De 1,350 posts → 0 posts (bug) → 1,350 posts conservados (fix)
- Hora noticias: Scraper corre a 03:00, ajuste visual a 12:00 aprox

---

### v1.0.0 - Enero 2025

**Added:**
- ✅ Integración BigQuery segura
- ✅ Búsqueda case-insensitive
- ✅ Operadores lógicos (AND, OR, NOT, paréntesis)
- ✅ Eliminación automática de duplicados
- ✅ Timeline interactivo con clicks
- ✅ Word Cloud manual
- ✅ Manejo correcto de timezone (UTC)

**Fixed:**
- ✅ Timeline clicks no abrían modal
- ✅ Fechas mostrando un día menos
- ✅ Crashes en granularidad horaria
- ✅ OR queries retornando 0 resultados
- ✅ Filtros no aplicándose correctamente
- ✅ Discrepancia de datos con Colab

**Performance:**
- ✅ Carga inicial optimizada
- ✅ Web Workers para procesamiento pesado
- ✅ Eliminación de re-renders innecesarios

Ver [`docs/SESSION_NOTES.md`](docs/SESSION_NOTES.md) para historial detallado.

---

## 📄 Licencia

[Especificar licencia aquí]

---

## 📞 Contacto

[Información de contacto del equipo]

---

## 🙏 Agradecimientos

- SvelteKit por el excelente framework
- Google BigQuery por la infraestructura de datos
- Chart.js y D3.js por las visualizaciones
- Vercel por el hosting serverless

---

**Última actualización:** Octubre 23, 2025
**Versión:** 1.0.1
**Status:** ✅ Production Ready
