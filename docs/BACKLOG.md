# Product Backlog - Dashboard Político

## 📅 Última actualización: Enero 2025

---

## 🎯 Estado Actual del Proyecto

### ✅ Completado (Enero 2025)
- [x] Integración con BigQuery
- [x] Búsqueda case-insensitive
- [x] Operadores lógicos (AND, OR, NOT, paréntesis)
- [x] Eliminación de duplicados por link
- [x] Manejo correcto de timezone (UTC)
- [x] Timeline interactivo con clicks
- [x] Modal de detalles de posts
- [x] Word Cloud manual
- [x] Top posts por engagement
- [x] Optimización de performance
- [x] Validaciones de seguridad en API
- [x] Deploy en Vercel con adapter-vercel

---

## 🚀 Prioridad Alta (Próximas 2 semanas)

### 1. Exportación de Datos
**Descripción:** Permitir exportar los resultados filtrados a diferentes formatos

**Tareas:**
- [ ] Botón de exportación en dashboard
- [ ] Exportar a CSV con todos los campos
- [ ] Exportar a Excel (XLSX) con formato
- [ ] Exportar a PDF con resumen visual (gráficos incluidos)
- [ ] Incluir metadatos (fecha de exportación, filtros aplicados, total de registros)

**Estimación:** 1-2 días
**Valor:** Alto - Los usuarios necesitan llevar los datos fuera del dashboard

**Archivos afectados:**
- `/src/routes/+page.svelte` - Agregar botones de exportación
- `/src/lib/utils/export.js` - Nueva funcionalidad de exportación

---

### 2. Caché de Búsquedas Frecuentes
**Descripción:** Cachear búsquedas comunes para mejorar performance

**Tareas:**
- [ ] Implementar caché en memoria con TTL (Time To Live)
- [ ] Cachear últimas 10 búsquedas por 15 minutos
- [ ] Mostrar indicador cuando se usa caché
- [ ] Botón para forzar refresh (invalidar caché)
- [ ] Logs de hit/miss de caché

**Estimación:** 1 día
**Valor:** Alto - Reduce carga en BigQuery y mejora UX

**Archivos afectados:**
- `/src/routes/api/bigquery/+server.js` - Implementar caché
- `/src/routes/+page.svelte` - Indicador de caché

**Consideraciones:**
- Usar `node-cache` o similar
- TTL de 15 minutos es razonable para datos políticos
- Invalidar caché si se detectan nuevos datos

---

### 3. Filtros Avanzados de Engagement
**Descripción:** Filtrar posts por nivel de engagement

**Tareas:**
- [ ] Slider de rango de likes
- [ ] Slider de rango de comentarios
- [ ] Slider de rango de shares
- [ ] Filtro de engagement total mínimo
- [ ] Presets ("Alto engagement", "Medio", "Bajo")

**Estimación:** 1 día
**Valor:** Medio-Alto - Permite enfocarse en posts más relevantes

**Archivos afectados:**
- `/src/lib/stores/dashboard.js` - Agregar filtros de engagement
- `/src/routes/+page.svelte` - UI de sliders

---

### 4. Indicador de Progreso en Búsquedas
**Descripción:** Mostrar progreso detallado durante búsquedas largas

**Tareas:**
- [ ] Barra de progreso con porcentaje
- [ ] Mensajes de estado ("Consultando BigQuery...", "Procesando datos...", etc.)
- [ ] Estimación de tiempo restante
- [ ] Mostrar cantidad de registros parciales

**Estimación:** 4-6 horas
**Valor:** Medio - Mejora UX en búsquedas largas

**Archivos afectados:**
- `/src/routes/+page.svelte` - UI de progreso
- `/src/routes/api/bigquery/+server.js` - Streaming de progreso

---

## 📊 Prioridad Media (Próximas 4 semanas)

### 5. Análisis de Sentimiento
**Descripción:** Detectar sentimiento de los posts (positivo, negativo, neutral)

**Tareas:**
- [ ] Investigar APIs de análisis de sentimiento en español
- [ ] Integrar con servicio (OpenAI, Google NLP, o local con transformers)
- [ ] Agregar campo de sentimiento a cada post
- [ ] Filtrar por sentimiento
- [ ] Gráfico de distribución de sentimientos
- [ ] Timeline de sentimientos en el tiempo

**Estimación:** 3-5 días
**Valor:** Alto - Insight valioso para análisis político

**Consideraciones:**
- Evaluar costos de APIs externas
- Considerar cache de sentimientos ya calculados
- Posible integración con BigQuery ML

---

### 6. Comparación de Períodos
**Descripción:** Comparar dos períodos de tiempo diferentes

**Tareas:**
- [ ] Selector de dos rangos de fechas (A vs B)
- [ ] Timeline con dos líneas superpuestas
- [ ] Métricas comparativas (% de cambio)
- [ ] Tabla de diferencias
- [ ] Palabras que subieron/bajaron en frecuencia

**Estimación:** 2-3 días
**Valor:** Medio-Alto - Permite ver evolución temporal

**Archivos afectados:**
- `/src/lib/stores/dashboard.js` - Soporte para dos datasets
- `/src/lib/components/charts/TimelineChart.svelte` - Líneas comparativas
- `/src/routes/+page.svelte` - UI de comparación

---

### 7. Alertas y Notificaciones
**Descripción:** Sistema de alertas para keywords importantes

**Tareas:**
- [ ] Configurar keywords a monitorear
- [ ] Umbral de alertas (ej: más de 10 posts por hora)
- [ ] Notificaciones por email
- [ ] Dashboard de alertas activas
- [ ] Historial de alertas

**Estimación:** 2-3 días
**Valor:** Medio - Útil para monitoreo en tiempo real

**Consideraciones:**
- Requiere backend adicional (cron jobs)
- Posible uso de Vercel Cron Jobs
- Integración con servicio de email (SendGrid, etc.)

---

### 8. Gráfico de Red de Usuarios
**Descripción:** Visualizar red de interacciones entre usuarios

**Tareas:**
- [ ] Detectar menciones y respuestas entre usuarios
- [ ] Gráfico de red con D3.js o similar
- [ ] Tamaño de nodos según influencia
- [ ] Filtrar por tipo de relación (menciona, responde, cita)
- [ ] Zoom e interacción con red

**Estimación:** 4-5 días
**Valor:** Medio - Insight de redes de influencia

**Archivos afectados:**
- `/src/lib/components/charts/NetworkGraph.svelte` - Nuevo componente
- `/src/workers/network.worker.js` - Procesamiento de red

---

### 9. Historial de Búsquedas
**Descripción:** Guardar y acceder a búsquedas previas

**Tareas:**
- [ ] LocalStorage para guardar búsquedas
- [ ] Dropdown de búsquedas recientes
- [ ] Guardar filtros completos (no solo searchTerm)
- [ ] Botón para borrar historial
- [ ] Límite de 20 búsquedas más recientes

**Estimación:** 1 día
**Valor:** Medio - Mejora UX

**Archivos afectados:**
- `/src/lib/stores/searchHistory.js` - Nuevo store
- `/src/routes/+page.svelte` - UI de historial

---

### 10. Filtro por Fuente (Twitter/Instagram/News)
**Descripción:** Filtrar posts según su origen

**Tareas:**
- [ ] Detectar fuente basándose en campos del post
- [ ] Checkboxes para cada fuente
- [ ] Indicador visual de fuente en cada post
- [ ] Estadísticas por fuente
- [ ] Gráfico de distribución por fuente

**Estimación:** 1 día
**Valor:** Medio - Permite análisis específico por plataforma

**Archivos afectados:**
- `/src/lib/stores/dashboard.js` - Agregar filtro de fuente
- `/src/routes/+page.svelte` - UI de filtro

---

## 🔮 Prioridad Baja (Backlog futuro)

### 11. Modo Oscuro
**Descripción:** Tema oscuro para el dashboard

**Tareas:**
- [ ] Toggle de tema claro/oscuro
- [ ] Colores oscuros para todos los componentes
- [ ] Adaptar gráficos a modo oscuro
- [ ] Guardar preferencia en localStorage

**Estimación:** 1-2 días
**Valor:** Bajo - Nice to have

---

### 12. Multi-idioma (i18n)
**Descripción:** Soporte para inglés y español

**Tareas:**
- [ ] Configurar i18n (svelte-i18n)
- [ ] Traducir todas las strings
- [ ] Selector de idioma
- [ ] Guardar preferencia

**Estimación:** 2-3 días
**Valor:** Bajo - Solo si hay usuarios internacionales

---

### 13. Dashboard Móvil Optimizado
**Descripción:** Mejorar experiencia en dispositivos móviles

**Tareas:**
- [ ] Diseño responsive mejorado
- [ ] Gráficos adaptados a pantallas pequeñas
- [ ] Menú hamburguesa
- [ ] Touch gestures en gráficos

**Estimación:** 2-3 días
**Valor:** Bajo-Medio - Depende de usuarios móviles

---

### 14. Integración con Otras Fuentes de Datos
**Descripción:** Agregar más fuentes (Facebook, TikTok, etc.)

**Tareas:**
- [ ] Investigar APIs disponibles
- [ ] Unificar formato de datos
- [ ] Actualizar tabla de BigQuery
- [ ] Filtros específicos por fuente

**Estimación:** 5-10 días
**Valor:** Bajo-Medio - Depende de necesidades del negocio

---

### 15. Usuarios y Autenticación
**Descripción:** Sistema de usuarios con diferentes permisos

**Tareas:**
- [ ] Autenticación (Auth0, Clerk, o similar)
- [ ] Roles (admin, analyst, viewer)
- [ ] Búsquedas guardadas por usuario
- [ ] Dashboards personalizados
- [ ] Límites de uso por usuario

**Estimación:** 5-7 días
**Valor:** Bajo - Solo si es multi-usuario

---

## 🐛 Bugs Conocidos y Mejoras Técnicas

### Bugs Corregidos (Oct 23, 2025)
- [x] **Rango de fechas no inclusivo:** Fixed - Ahora incluye día completo final (hasta 23:59:59)
- [x] **Filtrado duplicado de searchTerm:** Fixed - BigQuery filtra, cliente no vuelve a filtrar
- [x] **Hora de noticias incorrecta:** Fixed - Ajuste +9h para aproximar hora real

### Bugs Menores
- [ ] **Formato de números grandes:** Números de engagement muy altos se muestran sin separadores (ej: 123456 → 123,456)
- [x] **Timezone en hover del timeline:** Fixed - Tooltips usan UTC correctamente
- [ ] **Loading state del Word Cloud:** Mejorar indicador de carga
- [ ] **Disclaimer de hora de noticias:** Agregar aviso sobre ajuste de +9h (pendiente usuario)

### Deuda Técnica
- [ ] **Tests unitarios:** Agregar tests para componentes críticos
- [ ] **Tests E2E:** Tests de flujos completos con Playwright
- [ ] **TypeScript:** Migrar a TypeScript para mejor type safety
- [ ] **Error boundaries:** Agregar error boundaries en componentes
- [ ] **Logs estructurados:** Usar librería de logging (pino, winston)
- [ ] **Monitoring:** Agregar Sentry o similar para error tracking
- [ ] **Performance monitoring:** Agregar métricas de Web Vitals

---

## 📈 Mejoras de Performance

### Optimizaciones Futuras
- [ ] **Server-side rendering (SSR):** Considerar SSR para primera carga
- [ ] **Paginación:** Implementar paginación si datasets crecen mucho (>5000 posts)
- [ ] **Virtual scrolling:** Para listas largas de posts
- [ ] **Image lazy loading:** Cargar imágenes de posts bajo demanda
- [ ] **Code splitting:** Dividir bundle por rutas
- [ ] **CDN para assets estáticos:** Usar CDN para imágenes, fonts, etc.

---

## 🔒 Mejoras de Seguridad

### Hardening
- [ ] **Rate limiting:** Limitar requests a API de BigQuery por IP
- [ ] **CORS más restrictivo:** Configurar CORS para dominios específicos
- [ ] **Input sanitization:** Librería de sanitización de inputs
- [ ] **CSP headers:** Content Security Policy headers
- [ ] **Audit de dependencias:** Auditoría regular de npm packages
- [ ] **Secrets rotation:** Política de rotación de credenciales

---

## 📊 Métricas de Éxito

### KPIs a Trackear
- [ ] Tiempo promedio de búsqueda
- [ ] Cantidad de búsquedas por día
- [ ] Usuarios activos diarios/semanales
- [ ] Errores de BigQuery
- [ ] Cache hit rate
- [ ] Tiempo de carga de página
- [ ] Uso de diferentes filtros

---

## 💡 Ideas Exploratorias

### Para Investigar
- [ ] **Machine Learning:** Predicción de tendencias con ML
- [ ] **Análisis de imágenes:** OCR y análisis de imágenes en posts
- [ ] **Video analysis:** Análisis de videos de Instagram/TikTok
- [ ] **Detección de fake news:** Integración con fact-checkers
- [ ] **Influencer scoring:** Sistema de scoring de influencers
- [ ] **Topic modeling:** Detección automática de temas con LDA
- [ ] **Anomaly detection:** Detección de spikes anormales de actividad

---

## 🎯 Roadmap Visual

```
Enero 2025 [✅ COMPLETADO]
├─ Integración BigQuery
├─ Búsqueda con operadores lógicos
└─ Performance optimization

Febrero 2025 [EN PROGRESO]
├─ Exportación de datos
├─ Caché de búsquedas
├─ Filtros de engagement
└─ Indicador de progreso

Marzo 2025 [PLANIFICADO]
├─ Análisis de sentimiento
├─ Comparación de períodos
└─ Sistema de alertas

Q2 2025 [BACKLOG]
├─ Gráfico de red
├─ Historial de búsquedas
└─ Filtros por fuente

Q3 2025+ [FUTURO]
├─ Multi-idioma
├─ Modo oscuro
└─ Nuevas fuentes de datos
```

---

## 🤝 Cómo Contribuir al Backlog

### Agregar Nueva Tarea
1. Definir descripción clara
2. Listar tareas específicas
3. Estimar tiempo
4. Evaluar valor (Alto/Medio/Bajo)
5. Identificar archivos afectados
6. Agregar a la sección de prioridad correspondiente

### Priorización
Criterios de priorización:
1. **Valor para el usuario** (¿Resuelve un pain point?)
2. **Impacto técnico** (¿Mejora performance/seguridad?)
3. **Esfuerzo requerido** (¿Cuánto tiempo toma?)
4. **Dependencias** (¿Depende de otras tareas?)
5. **Urgencia** (¿Es crítico o puede esperar?)

---

## 📝 Notas de Versiones

### v1.0.0 - Enero 2025 (Actual)
- Lanzamiento inicial con BigQuery
- Búsqueda completa con operadores lógicos
- Timeline interactivo
- Word Cloud
- Top posts

### v1.1.0 - Febrero 2025 (Próximo)
- Exportación de datos
- Caché de búsquedas
- Filtros avanzados de engagement

### v2.0.0 - Q2 2025 (Futuro)
- Análisis de sentimiento
- Comparación de períodos
- Sistema de alertas

---

## 📞 Feedback y Sugerencias

Para proponer nuevas funcionalidades:
1. Verificar que no esté ya en este backlog
2. Describir el problema que resuelve
3. Proponer solución técnica
4. Estimar valor y esfuerzo
5. Agregar como issue o comentar en sesión con Claude
