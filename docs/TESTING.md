# Guía de Testing - Dashboard Político

## 📋 Información General

**Última actualización:** Enero 2025
**Estado de tests:** Manual (sin tests automatizados aún)
**Cobertura objetivo:** 80%+ en componentes críticos

---

## 🎯 Estrategia de Testing

### Niveles de Testing

1. **Tests Manuales** ✅ (Actualmente implementado)
   - Verificación manual de funcionalidades
   - Casos de prueba documentados
   - Checklist de QA antes de deploy

2. **Tests Unitarios** 🔜 (Próximo)
   - Vitest para tests de componentes Svelte
   - Tests de funciones puras (filtros, procesamiento)
   - Tests de stores

3. **Tests de Integración** 🔜 (Futuro)
   - Tests de API endpoints
   - Tests de Web Workers
   - Tests de integración con BigQuery (mock)

4. **Tests E2E** 🔜 (Futuro)
   - Playwright para flujos completos
   - Tests de búsqueda end-to-end
   - Tests de interacciones con gráficos

---

## ✅ Checklist de QA Pre-Deploy

### 1. Búsqueda Básica
- [ ] Búsqueda simple funciona (ej: "simce")
- [ ] Búsqueda case-insensitive (ej: "SIMCE", "simce", "Simce" → mismos resultados)
- [ ] Búsqueda con espacios (ej: "educación pública")
- [ ] Búsqueda con tildes (ej: "educación" encuentra posts con y sin tilde)
- [ ] Búsqueda con números (ej: "4% pib")
- [ ] Búsqueda vacía muestra todos los posts del rango de fechas

### 2. Operadores Lógicos
- [ ] **OR:** "procultura OR secom" retorna posts con al menos una palabra
- [ ] **AND:** "procultura AND paredes" retorna solo posts con ambas palabras
- [ ] **NOT:** "procultura NOT paredes" excluye posts con "paredes"
- [ ] **Paréntesis:** "(procultura OR secom) AND paredes" respeta precedencia
- [ ] **Combinados:** "procultura AND (secom OR paredes) NOT simce"
- [ ] **Comillas:** '"ministerio de educación"' busca frase exacta

### 3. Filtros de Fecha
- [ ] Rango de 1 día funciona
- [ ] Rango de 1 semana funciona
- [ ] Rango de 1 mes funciona
- [ ] Rango de 6 meses funciona
- [ ] Rango de 1 año funciona
- [ ] Rango de 2 años funciona (máximo permitido)
- [ ] Rango mayor a 2 años muestra error apropiado
- [ ] dateFrom > dateTo muestra error
- [ ] Fechas inválidas (ej: "2025-13-01") muestran error

### 4. Visualizaciones
- [ ] **Timeline Chart:**
  - [ ] Se muestra correctamente
  - [ ] Granularidad por hora funciona
  - [ ] Granularidad por día funciona
  - [ ] Granularidad por semana funciona
  - [ ] Granularidad por mes funciona
  - [ ] Click en punto abre modal con posts correctos
  - [ ] Fechas se muestran en UTC (no un día menos)
  - [ ] Tooltip muestra información correcta

- [ ] **Word Cloud:**
  - [ ] Botón "Generar Word Cloud" aparece
  - [ ] Al hacer click, genera la nube
  - [ ] Palabras más frecuentes son más grandes
  - [ ] No incluye stopwords (de, la, el, etc.)
  - [ ] Click en palabra filtra por esa palabra

- [ ] **Top Posts:**
  - [ ] Se muestran los posts con mayor engagement
  - [ ] Ordenados correctamente (mayor a menor)
  - [ ] Muestra correctamente likes, comments, shares
  - [ ] Click en post abre modal con detalles

### 5. Modal de Detalles
- [ ] Se abre al hacer click en post
- [ ] Muestra toda la información del post
- [ ] Muestra fecha correcta (UTC)
- [ ] Muestra engagement correcto
- [ ] Muestra fuente (Twitter, Instagram, etc.)
- [ ] Link al post original funciona
- [ ] Botón de cerrar funciona
- [ ] ESC cierra el modal
- [ ] Click fuera del modal lo cierra

### 6. Duplicados
- [ ] Posts duplicados (mismo link) se eliminan
- [ ] Se mantiene el primer post encontrado
- [ ] Console muestra cantidad de duplicados eliminados
- [ ] Estadísticas reflejan posts únicos (no cuentan duplicados)

### 7. Performance
- [ ] Búsqueda con <100 posts: <1 segundo
- [ ] Búsqueda con 100-500 posts: 1-3 segundos
- [ ] Búsqueda con 500-1000 posts: 3-5 segundos
- [ ] Búsqueda con >1000 posts: <10 segundos
- [ ] Word Cloud genera en <3 segundos
- [ ] Timeline renderiza en <2 segundos
- [ ] No hay lag al hacer scroll
- [ ] Navegador no se congela durante procesamiento

### 8. Seguridad
- [ ] Query con DELETE rechazada
- [ ] Query con DROP rechazada
- [ ] Query con UPDATE rechazada
- [ ] Query con INSERT rechazada
- [ ] SQL injection básico bloqueado (ej: `'; DROP TABLE--`)
- [ ] Solo tabla autorizada accesible
- [ ] Proyecto excluido ("pesimismo pais") nunca aparece

### 9. Errores y Edge Cases
- [ ] Sin conexión a BigQuery muestra error apropiado
- [ ] Credenciales inválidas muestran error
- [ ] Timeout de query muestra error
- [ ] Query sin resultados muestra mensaje apropiado
- [ ] Búsqueda con caracteres especiales no rompe la app
- [ ] Búsqueda con emojis funciona correctamente

---

## 🧪 Casos de Prueba Detallados

### Caso 1: Búsqueda Simple
**Objetivo:** Verificar búsqueda básica funciona correctamente

**Pasos:**
1. Abrir dashboard
2. Seleccionar rango de fechas: 2025-10-22 a 2025-10-23
3. Ingresar búsqueda: "simce"
4. Hacer click en "Buscar"

**Resultado Esperado:**
- Console muestra: "🔍 Nueva consulta BigQuery: { searchTerm: 'simce', dateFrom: '2025-10-22', dateTo: '2025-10-23' }"
- BigQuery retorna posts que contienen "simce" (case-insensitive)
- Se eliminan duplicados
- Timeline se actualiza
- Estadísticas se actualizan

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 2: Búsqueda con OR
**Objetivo:** Verificar operador OR funciona correctamente

**Pasos:**
1. Abrir dashboard
2. Seleccionar rango de fechas: 2025-10-22 a 2025-10-23
3. Ingresar búsqueda: "procultura OR secom OR paredes"
4. Hacer click en "Buscar"

**Resultado Esperado:**
- BigQuery extrae keywords: ["procultura", "secom", "paredes"]
- BigQuery retorna posts que contienen CUALQUIERA de las palabras
- Cliente aplica filtro OR exacto
- Total de posts >= max(posts con "procultura", posts con "secom", posts con "paredes")

**Datos de Referencia:**
- "procultura" solo: 164 posts únicos
- "procultura OR secom OR paredes": 191 posts únicos
- Verificación: 191 > 164 ✅

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 3: Búsqueda con AND
**Objetivo:** Verificar operador AND funciona correctamente

**Pasos:**
1. Abrir dashboard
2. Seleccionar rango de fechas: 2025-10-22 a 2025-10-23
3. Ingresar búsqueda: "procultura AND paredes"
4. Hacer click en "Buscar"

**Resultado Esperado:**
- BigQuery extrae keywords y retorna posts con cualquiera
- Cliente filtra posts que contienen AMBAS palabras
- Total de posts <= min(posts con "procultura", posts con "paredes")

**Verificación Manual:**
- Revisar que todos los posts filtrados contienen tanto "procultura" como "paredes"

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 4: Búsqueda con NOT
**Objetivo:** Verificar operador NOT funciona correctamente

**Pasos:**
1. Abrir dashboard
2. Seleccionar rango de fechas: 2025-10-22 a 2025-10-23
3. Ingresar búsqueda: "procultura NOT paredes"
4. Hacer click en "Buscar"

**Resultado Esperado:**
- Retorna posts que contienen "procultura" pero NO "paredes"
- Total < posts solo con "procultura"

**Verificación Manual:**
- Ningún post debe contener la palabra "paredes"

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 5: Click en Timeline
**Objetivo:** Verificar que clicks en timeline abren modal correcto

**Pasos:**
1. Realizar una búsqueda con resultados
2. Esperar a que se genere el timeline
3. Hacer click en un punto del gráfico

**Resultado Esperado:**
- Modal de detalles se abre
- Muestra posts del período correcto (ej: posts de ese día)
- Cantidad de posts coincide con la altura del punto

**Datos de Verificación:**
- Si el punto muestra "5 posts", el modal debe mostrar exactamente 5 posts
- Las fechas de los posts deben estar en el período correcto

**Resultado Actual:** ✅ Funciona correctamente (desde fix de variables en scope)

---

### Caso 6: Fechas en UTC
**Objetivo:** Verificar que las fechas se muestran correctamente (UTC)

**Pasos:**
1. Buscar posts del 2025-10-22
2. Verificar fechas en timeline
3. Verificar fechas en modal de detalles

**Resultado Esperado:**
- Posts creados el 2025-10-22 muestran "22 oct" (no "21 oct")
- Fechas en modal muestran fecha correcta sin desplazamiento

**Bug Anterior:** Mostraba "21 oct" para posts del "22 oct"
**Causa:** Conversión de UTC a zona horaria local (Chile UTC-3)
**Fix:** Usar Date.UTC() y timeZone: 'UTC'

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 7: Eliminación de Duplicados
**Objetivo:** Verificar que duplicados se eliminan correctamente

**Pasos:**
1. Realizar búsqueda que retorne duplicados
2. Revisar console logs

**Resultado Esperado:**
- Console muestra: "🔄 Eliminación de duplicados: X duplicados"
- Posts con mismo `link` se reducen a uno solo
- Estadísticas usan posts únicos (no cuentan duplicados)

**Datos de Referencia:**
- "procultura OR secom OR paredes": 236 posts → 191 únicos (45 duplicados, 19%)

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 8: Rango de Fechas Inválido
**Objetivo:** Verificar validación de rango de fechas

**Pasos:**
1. Seleccionar dateFrom: 2025-10-22
2. Seleccionar dateTo: 2023-10-22 (anterior a dateFrom)
3. Hacer click en "Buscar"

**Resultado Esperado:**
- Error: "⛔ La fecha inicial debe ser anterior o igual a la fecha final"
- No se ejecuta query a BigQuery
- Se muestra mensaje de error al usuario

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 9: Rango Mayor a 2 Años
**Objetivo:** Verificar límite de rango de 730 días

**Pasos:**
1. Seleccionar dateFrom: 2023-01-01
2. Seleccionar dateTo: 2025-12-31 (más de 2 años)
3. Hacer click en "Buscar"

**Resultado Esperado:**
- Error: "⛔ Rango máximo permitido: 730 días (2 años). Rango actual: XXX días"
- No se ejecuta query a BigQuery

**Resultado Actual:** ✅ Funciona correctamente

---

### Caso 10: Proyecto Excluido
**Objetivo:** Verificar que "pesimismo pais" nunca aparece

**Pasos:**
1. Realizar búsqueda amplia (ej: búsqueda vacía en rango grande)
2. Revisar todos los posts retornados

**Resultado Esperado:**
- Ningún post tiene `name_proyecto === "pesimismo pais"`
- Query incluye filtro: `AND name_proyecto != 'pesimismo pais'`

**Resultado Actual:** ✅ Funciona correctamente

---

## 🔧 Debugging y Troubleshooting

### Logs Importantes

#### Backend (BigQuery API)
```javascript
// Al recibir request
console.log('🔍 Nueva consulta BigQuery:', { searchTerm, dateFrom, dateTo });

// Al validar query
console.log('✅ Query validada:', baseQuery);

// Al ejecutar query
console.log(`🚀 Job iniciado: ${job.id}`);

// Al obtener resultados
console.log(`✅ Resultados obtenidos: ${rows.length} registros`);
```

#### Frontend (Dashboard)
```javascript
// Al cargar datos de BigQuery
console.log('✅ Datos obtenidos de BigQuery: X registros');

// Al eliminar duplicados
console.log(`🔄 Eliminación de duplicados:
  - Antes: ${beforeDedup} posts
  - Duplicados eliminados: ${duplicatesRemoved}
  - Únicos: ${uniqueData.length}
`);

// Al filtrar datos
console.log(`✅ Filtrado: ${filtered.length}/${total.length} posts`);
```

### Comandos de Debugging

```bash
# Ver logs en tiempo real del dev server
npm run dev

# Ver logs de Vercel en producción
vercel logs

# Inspeccionar variables de entorno
echo $BIGQUERY_CREDENTIALS | jq .

# Verificar que adapter-vercel está instalado
npm list @sveltejs/adapter-vercel
```

### Console del Navegador

Abrir DevTools (F12) y revisar:
1. **Console:** Ver logs de aplicación
2. **Network:** Ver requests a `/api/bigquery`
3. **Application > Local Storage:** Ver datos guardados
4. **Performance:** Ver bottlenecks de performance

---

## 🚨 Errores Comunes y Soluciones

### Error 1: "Comando prohibido detectado: CREATE"
**Síntoma:** Query retorna 0 resultados y error en console

**Causa:** Uso de `DATE(created)` en query, que contiene "CREATE"

**Solución:** Usar `created >= '2025-10-22'` sin DATE()

**Archivo:** `/src/routes/api/bigquery/+server.js`

---

### Error 2: Fechas mostrando un día menos
**Síntoma:** Posts del 22 oct muestran "21 oct"

**Causa:** Conversión de UTC a zona horaria local (Chile UTC-3)

**Solución:** Usar Date.UTC() y timeZone: 'UTC'

**Archivo:** `/src/lib/components/charts/TimelineChart.svelte:128-132`

---

### Error 3: Click en timeline no abre modal
**Síntoma:** Al hacer click en punto del timeline, no pasa nada

**Causa:** Variables en scope local de función, no accesibles en onClick

**Solución:** Mover variables a scope de componente

**Archivo:** `/src/lib/components/charts/TimelineChart.svelte:31-34`

---

### Error 4: Cannot read properties of undefined (reading 'padStart')
**Síntoma:** Error al cambiar a granularidad hourly

**Causa:** Algunos groupKeys no tienen componente de hora

**Solución:** Agregar validación defensiva

**Archivo:** `/src/lib/components/charts/TimelineChart.svelte:103-107`

```javascript
if (!hourStr) {
  console.warn('⚠️ groupKey sin hora:', groupKey);
  return groupKey;
}
```

---

### Error 5: Búsqueda con OR retorna 0 resultados
**Síntoma:** "procultura OR secom" retorna 0 posts

**Causa:** BigQuery buscaba string literal "procultura or secom"

**Solución:** Extraer keywords y construir query SQL con OR

**Archivo:** `/src/routes/api/bigquery/+server.js:173-196`

---

### Error 6: Filtros no se aplican (0/500 posts)
**Síntoma:** BigQuery retorna 500 posts pero filtro muestra 0/500

**Causa:** Store de filters no se actualiza con searchTerm

**Solución:** Llamar updateFilters() después de loadCsvData()

**Archivo:** `/src/routes/+page.svelte:302-308`

---

## 📊 Métricas de Calidad

### Actualmente Trackeadas (Manual)
- ✅ Cantidad de búsquedas exitosas vs errores
- ✅ Tiempo promedio de búsqueda
- ✅ Cantidad de posts retornados por búsqueda
- ✅ Porcentaje de duplicados eliminados

### Por Implementar (Automatizado)
- 🔜 Test coverage (objetivo: 80%+)
- 🔜 Error rate en producción
- 🔜 Tiempo de respuesta de API (p50, p95, p99)
- 🔜 Tiempo de renderizado de componentes
- 🔜 Cache hit rate

---

## 🔄 Proceso de Testing

### Antes de Cada Deploy

1. **Ejecutar Checklist de QA**
   - Marcar cada item de la checklist
   - Documentar cualquier issue encontrado

2. **Verificar Casos Críticos**
   - Caso 1: Búsqueda simple
   - Caso 2: Búsqueda con OR
   - Caso 5: Click en timeline
   - Caso 6: Fechas en UTC

3. **Smoke Test en Staging**
   - Deploy a branch de staging
   - Ejecutar 3-5 búsquedas diferentes
   - Verificar que todo funciona

4. **Deploy a Producción**
   - Merge a main
   - Verificar deploy exitoso en Vercel
   - Smoke test rápido en producción

5. **Monitoreo Post-Deploy**
   - Revisar logs de Vercel por 15 minutos
   - Verificar que no hay errores
   - Confirmar que métricas son normales

---

## 🎯 Plan de Testing Automatizado

### Fase 1: Tests Unitarios (Próximo)

```bash
# Configurar Vitest
npm install -D vitest @testing-library/svelte

# Crear estructura de tests
mkdir -p src/tests/unit
```

**Tests Prioritarios:**
1. `dashboard.test.js` - Tests de store de dashboard
2. `filters.test.js` - Tests de funciones de filtrado
3. `dateUtils.test.js` - Tests de manejo de fechas
4. `searchParser.test.js` - Tests de parsing de búsqueda

### Fase 2: Tests de Integración

```bash
# Tests de API
mkdir -p src/tests/integration
```

**Tests Prioritarios:**
1. `bigquery.test.js` - Tests de endpoint de BigQuery (mocked)
2. `workers.test.js` - Tests de Web Workers

### Fase 3: Tests E2E

```bash
# Configurar Playwright
npm install -D @playwright/test

# Crear estructura de tests E2E
mkdir -p e2e
```

**Tests Prioritarios:**
1. `search.spec.js` - Flujo completo de búsqueda
2. `timeline.spec.js` - Interacción con timeline
3. `filters.spec.js` - Aplicación de filtros

---

## 📝 Template de Bug Report

```markdown
## 🐛 Bug Report

**Título:** [Descripción breve del bug]

**Severidad:** [Crítico / Alto / Medio / Bajo]

**Pasos para Reproducir:**
1. ...
2. ...
3. ...

**Resultado Esperado:**
[Qué debería pasar]

**Resultado Actual:**
[Qué está pasando]

**Screenshots/Logs:**
[Adjuntar screenshots o logs relevantes]

**Entorno:**
- Browser: [Chrome 120, Firefox 115, etc.]
- OS: [Windows 11, macOS 14, etc.]
- Fecha/hora: [2025-01-22 14:30]

**Información Adicional:**
[Cualquier contexto adicional]
```

---

## 🏆 Definición de Done

Una feature se considera completa cuando:
- [ ] Código implementado y revisado
- [ ] Tests unitarios escritos y pasando (cuando aplique)
- [ ] Tests de integración pasando (cuando aplique)
- [ ] Checklist de QA completado manualmente
- [ ] Documentación actualizada
- [ ] Deploy a staging exitoso
- [ ] Smoke test en staging completado
- [ ] Deploy a producción exitoso
- [ ] Monitoreo post-deploy sin errores

---

## 🆕 Casos de Prueba Nuevos (Oct 23, 2025)

### Test Case 19: Rango de Fechas Inclusivo

**Objetivo:** Verificar que el rango de fechas incluye el día completo final

**Pre-condiciones:**
- Dashboard cargado
- Datos disponibles para el rango de prueba

**Pasos:**
1. Seleccionar fecha desde: `2025-10-22`
2. Seleccionar fecha hasta: `2025-10-23`
3. Buscar con cualquier término (ej: "pardow")
4. Abrir modal de detalles de un post del día 23
5. Verificar hora del post

**Resultado esperado:**
- ✅ Se muestran posts del 22 y 23 completos
- ✅ Posts del 23 incluyen horas hasta 23:59:59
- ✅ No se excluyen posts del final del día 23

**Resultado real:**
- ✅ Funciona correctamente (fixed en v1.0.1)

**Notas:**
- Antes: `created <= '2025-10-23'` solo incluía hasta 00:00:00
- Ahora: `created < '2025-10-24'` incluye todo el día

---

### Test Case 20: Hora de Noticias Ajustada

**Objetivo:** Verificar que la hora de noticias se ajusta correctamente (+9h)

**Pre-condiciones:**
- Dashboard cargado
- Búsqueda con noticias en resultados

**Pasos:**
1. Buscar con término que retorne noticias (ej: "simce")
2. Abrir modal de detalles
3. Verificar hora de posts con `source='news'`
4. Comparar con posts de Twitter/Instagram

**Resultado esperado:**
- ✅ Noticias muestran hora ~12:00 (ajustada +9h desde 03:00)
- ✅ Twitter/Instagram mantienen hora original
- ✅ Formato de fecha correcto para ambos

**Resultado real:**
- ✅ Funciona correctamente (fixed en v1.0.1)

**Notas:**
- Scraper corre a 03:00 AM, hora se ajusta a 12:00 aprox
- Usuario debe agregar disclaimer explicando el ajuste

---

### Test Case 21: Sin Filtrado Duplicado de SearchTerm

**Objetivo:** Verificar que BigQuery no se vuelve a filtrar en cliente

**Pre-condiciones:**
- Dashboard cargado
- Console del navegador abierta (F12)

**Pasos:**
1. Buscar con frases exactas: `pardow OR "ministro pardow" OR "cuentas de luz"`
2. Observar logs en consola
3. Verificar cantidad de posts en cada etapa

**Resultado esperado:**
- ✅ BigQuery retorna N posts (ej: 1,350)
- ✅ Después eliminación duplicados: M posts (ej: 1,200)
- ✅ Log muestra: `🔤 Después searchTerm "": M (eliminados: 0)`
- ✅ Resultado final: M posts (no 0)

**Resultado real:**
- ✅ Funciona correctamente (fixed en v1.0.1)

**Logs esperados:**
```
✅ Datos obtenidos de BigQuery: 1350 registros
🔄 Eliminación de duplicados: 150 duplicados eliminados, 1200 únicos
🔍 DEBUG FILTRADO DETALLADO:
  📊 Original: 1200 posts
  🔤 Después searchTerm "": 1200 (eliminados: 0)  ← Vacío = no volver a filtrar
  📅 Después fechas (...): 1200 (eliminados: 0)
  ✅ Final: 1200/1200 posts
```

**Notas:**
- Antes: 1,350 → 0 posts (todos eliminados por re-filtrado)
- Ahora: 1,350 → 1,200 posts (solo duplicados eliminados)

---

### Test Case 22: Logging Detallado de Filtros

**Objetivo:** Verificar que los logs muestran correctamente qué filtro elimina posts

**Pre-condiciones:**
- Dashboard cargado
- Console del navegador abierta (F12)

**Pasos:**
1. Realizar búsqueda con filtros activos
2. Observar logs de filtrado en consola
3. Verificar que se muestre eliminación por cada filtro

**Resultado esperado:**
```
🔍 DEBUG FILTRADO DETALLADO:
  📊 Original: X posts
  🔤 Después searchTerm "...": Y (eliminados: X-Y)
  📅 Después fechas (...): Z (eliminados: Y-Z)
  🌐 Después redes [...]: W (eliminados: Z-W)
  ✅ Final: W/X posts
```

**Resultado real:**
- ✅ Logs se muestran correctamente (added en v1.0.1)

**Utilidad:**
- Identificar rápidamente qué filtro está eliminando posts
- Debugging de problemas de filtrado
- Validación de comportamiento correcto

---

## 📚 Recursos

### Tools de Testing
- [Vitest](https://vitest.dev/) - Test runner
- [Testing Library](https://testing-library.com/docs/svelte-testing-library/intro/) - Testing de componentes Svelte
- [Playwright](https://playwright.dev/) - Tests E2E
- [MSW](https://mswjs.io/) - Mocking de APIs

### Referencias
- [SvelteKit Testing](https://kit.svelte.dev/docs/testing)
- [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
- [Web Performance Testing](https://web.dev/lighthouse-performance/)
