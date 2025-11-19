<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';
	import HeatmapCalendarChart from './HeatmapCalendarChart.svelte';

	export let data = [];
	export let chartType = 'line';
	export let granularity = 'day'; // 'hour', 'day', 'week', 'month'
	export let heatmapMetric = 'posts'; // 'posts' o 'engagement' para heatmap
	export let comparativeEnabled = false;
	export let dataB = []; // Datos del período B para comparación

	// Comparación de proyectos
	export let projectComparisonEnabled = false;
	export let projectsData = {}; // { projectId: [posts...] }
	export let projects = []; // Lista de proyectos para obtener nombres y colores

	let canvas;
	let chartInstance;
	let mounted = false;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedDate = '';

	// Web Worker state
	let worker = null;
	let isProcessing = false;
	let processingProgress = 0;
	let dateGroupsA = {};
	let dateGroupsB = {};

	// State para comparación de proyectos
	let projectsDateGroups = {}; // { projectId: { date: [posts...] } }

	// Variables para onClick handler (necesitan estar en component scope)
	let sortedKeys = [];
	let sortedKeysB = [];
	let currentDateGroups = {};
	let currentDateGroupsB = {};

	// Verificar si es heatmap
	$: isHeatmap = chartType === 'heatmap';

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	// Re-procesar datos cuando cambien las dependencias críticas
	$: if (mounted && !isHeatmap) {
		// Observar cambios en: data, granularity, projectsData, comparativeEnabled, dataB
		const shouldProcess = data || granularity || projectsData || comparativeEnabled || dataB;

		if (shouldProcess && (data.length > 0 || projectComparisonEnabled)) {
			console.log('🔄 Reactive: Re-procesando datos (granularity:', granularity, ')');
			processDataWithWorker();
		}
	}

	$: if (mounted && canvas && !isHeatmap && (chartType || granularity || heatmapMetric || projectsDateGroups)) {
		// Re-renderizar cuando cambien datos de proyectos o datos normales
		if (projectComparisonEnabled && Object.keys(projectsDateGroups).length > 0) {
			console.log('🔄 Reactive: Renderizando comparación de proyectos...', Object.keys(projectsDateGroups));
			createChart();
		} else if (Object.keys(dateGroupsA).length > 0) {
			createChart();
		}
	}

	async function processDataWithWorker() {
		if (!worker) return;

		// Modo comparación de proyectos
		if (projectComparisonEnabled && Object.keys(projectsData).length > 0) {
			console.log(`🔧 Procesando ${Object.keys(projectsData).length} proyectos con Worker...`);
			isProcessing = true;
			processingProgress = 0;

			// Procesar cada proyecto por separado
			const newProjectsDateGroups = {};

			for (const [projectId, projectPosts] of Object.entries(projectsData)) {
				if (!projectPosts || projectPosts.length === 0) continue;

				console.log(`🔧 Procesando proyecto ${projectId}: ${projectPosts.length} posts`);

				// Crear promesa para esperar resultado del worker
				const result = await new Promise((resolve) => {
					const handler = (e) => {
						if (e.data.type === 'complete') {
							worker.removeEventListener('message', handler);
							resolve(e.data.data.dateGroupsA);
						}
					};
					worker.addEventListener('message', handler);

					worker.postMessage({
						posts: projectPosts,
						granularity: granularity,
						comparativeEnabled: false,
						dataB: [],
						chunkSize: 10000
					});
				});

				newProjectsDateGroups[projectId] = result;

				// Debug: Verificar datos del proyecto recién procesado
				const sampleDates = Object.keys(result).slice(0, 3);
				console.log(`   ✓ Proyecto ${projectId} procesado:`, {
					totalDates: Object.keys(result).length,
					sampleDates,
					sampleCounts: sampleDates.map(date => result[date] ? result[date].length : 0)
				});
			}

			// Debug: Verificar que newProjectsDateGroups tiene datos diferentes
			console.log('🔍 Verificando newProjectsDateGroups antes de asignación:');
			for (const [projectId, dateGroups] of Object.entries(newProjectsDateGroups)) {
				const allDates = Object.keys(dateGroups);
				const totalPosts = allDates.reduce((sum, date) => sum + (dateGroups[date] ? dateGroups[date].length : 0), 0);
				console.log(`   ${projectId}: ${allDates.length} fechas, ${totalPosts} posts totales`);
			}

			projectsDateGroups = newProjectsDateGroups;
			isProcessing = false;
			processingProgress = 100;

			console.log('✅ ProjectsDateGroups actualizado:', Object.keys(projectsDateGroups));
			console.log('🎨 Canvas existe?', !!canvas);
			console.log('📊 projectComparisonEnabled?', projectComparisonEnabled);

			// Trigger chart creation
			if (canvas) {
				console.log('🚀 Llamando a createChart() directamente...');
				createChart();
			} else {
				console.warn('⚠️ Canvas no existe, esperando reactive statement');
			}
			return;
		}

		// Modo normal o comparativo A/B
		if (!data || data.length === 0) return;

		console.log(`🔧 Iniciando procesamiento de ${data.length} posts con Worker...`);
		isProcessing = true;
		processingProgress = 0;

		worker.postMessage({
			posts: data,
			granularity: granularity,
			comparativeEnabled: comparativeEnabled,
			dataB: dataB,
			chunkSize: 10000
		});
	}

	// Función para obtener clave de agrupación según granularidad
	function getGroupKey(dateStr, timeStr, gran) {
		if (gran === 'hour') {
			// Para hora: agrupar por fecha Y hora específica (YYYY-MM-DD HH)
			if (!timeStr) return null;
			const hour = parseInt(timeStr.split(':')[0]);
			if (isNaN(hour) || hour < 0 || hour > 23) return null;
			return `${dateStr} ${hour.toString().padStart(2, '0')}`;
		}

		const date = new Date(dateStr);

		if (gran === 'day') {
			// Formato: YYYY-MM-DD
			return dateStr;
		} else if (gran === 'week') {
			// Formato: YYYY-WW (año-semana)
			const oneJan = new Date(date.getFullYear(), 0, 1);
			const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
			const weekNum = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
			return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
		} else if (gran === 'month') {
			// Formato: YYYY-MM
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			return `${date.getFullYear()}-${month}`;
		}
		return dateStr; // fallback
	}

	// Función para formatear label según granularidad
	function formatLabel(groupKey, gran, previousKey = null) {
		if (gran === 'hour') {
			// Para hora: formato "YYYY-MM-DD HH"
			const [dateStr, hourStr] = groupKey.split(' ');

			// Validación defensiva: si no hay hourStr, usar '00'
			if (!hourStr) {
				console.warn('⚠️ groupKey sin hora:', groupKey);
				return groupKey;
			}

			// Parsear fecha como UTC para evitar conversión de zona horaria
			const [year, month, day] = dateStr.split('-');
			const dateObj = new Date(Date.UTC(year, month - 1, day));
			const hour = hourStr.padStart(2, '0');

			// Determinar si debemos mostrar la fecha (cuando cambia el día o es el primero)
			let showDate = !previousKey; // Mostrar siempre en el primer elemento

			if (previousKey) {
				const [prevDateStr] = previousKey.split(' ');
				showDate = dateStr !== prevDateStr; // Mostrar cuando cambia la fecha
			}

			if (showDate) {
				const dayMonth = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
				return `${dayMonth} ${hour}:00`;
			} else {
				return `${hour}:00`;
			}
		} else if (gran === 'day') {
			// Parsear fecha como UTC para evitar conversión de zona horaria
			const [year, month, day] = groupKey.split('-');
			const dateObj = new Date(Date.UTC(year, month - 1, day));
			return dateObj.toLocaleDateString('es-CL', { month: 'short', day: 'numeric', timeZone: 'UTC' });
		} else if (gran === 'week') {
			const [year, week] = groupKey.split('-W');
			const yearNum = parseInt(year);
			const weekNum = parseInt(week);

			// Calcular la fecha del primer día de la semana usando el mismo algoritmo que el worker
			const oneJan = new Date(Date.UTC(yearNum, 0, 1));
			const dayOfWeek = oneJan.getUTCDay();

			// El worker calcula: Math.ceil((numberOfDays + oneJan.getUTCDay() + 1) / 7)
			// Para obtener el primer día de la semana N, necesitamos invertir esta fórmula
			// La semana 1 incluye días desde el inicio del año
			// Necesitamos encontrar el primer día donde ceil((días + dayOfWeek + 1) / 7) = weekNum

			// El primer día de la semana N es cuando (días + dayOfWeek + 1) / 7 >= weekNum
			// Resolviendo: días >= weekNum * 7 - dayOfWeek - 1
			const firstDayOffset = (weekNum - 1) * 7 - dayOfWeek;

			// Crear fecha sumando los días al 1 de enero
			const weekStartDate = new Date(Date.UTC(yearNum, 0, 1 + firstDayOffset));

			// Formatear como "24 jun"
			return weekStartDate.toLocaleDateString('es-CL', {
				day: 'numeric',
				month: 'short',
				timeZone: 'UTC'
			});
		} else if (gran === 'month') {
			const [year, month] = groupKey.split('-');
			const dateObj = new Date(Date.UTC(year, month - 1, 1));
			return dateObj.toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
		}
		return groupKey;
	}

	// Función auxiliar para procesar un conjunto de datos
	function processDataset(dataset, label) {
		const dateGroups = {};
		let invalidDates = 0;

		dataset.forEach((post, index) => {
			if (!post.created) {
				invalidDates++;
				return;
			}

			const parts = post.created.split(' ');
			const rawDate = parts[0];
			const timeStr = parts[1] || null;

			if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate)) {
				if (invalidDates < 5) {
					console.warn(`📅 Fecha inválida en post ${index}:`, post.created);
				}
				invalidDates++;
				return;
			}

			const date = rawDate.replace(/\//g, '-');
			const groupKey = getGroupKey(date, timeStr, granularity);

			if (groupKey === null) {
				invalidDates++;
				return;
			}

			if (!dateGroups[groupKey]) dateGroups[groupKey] = [];
			dateGroups[groupKey].push(post);
		});

		console.log(`📊 ${label}: ${dataset.length - invalidDates} posts válidos, ${invalidDates} inválidos`);
		return { dateGroups, invalidDates };
	}

	// Función para alinear períodos comparativos
	function alignComparativePeriods(groupsA, groupsB) {
		const keysA = Object.keys(groupsA).sort();
		const keysB = Object.keys(groupsB).sort();

		// Determinar la longitud del período más corto
		const minLength = Math.min(keysA.length, keysB.length);

		// Función auxiliar para calcular métrica
		function calculateMetric(posts) {
			if (heatmapMetric === 'engagement') {
				return posts.reduce((sum, post) => {
					return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
				}, 0);
			}
			return posts.length; // 'posts' por defecto
		}

		// Crear labels relativos (Día 1, Día 2, etc.)
		const alignedLabels = [];
		const alignedDataA = [];
		const alignedDataB = [];
		const originalKeysA = [];
		const originalKeysB = [];

		for (let i = 0; i < minLength; i++) {
			const keyA = keysA[i];
			const keyB = keysB[i];

			// Etiqueta relativa
			let label;
			if (granularity === 'hour') {
				label = `Hora ${i + 1}`;
			} else if (granularity === 'day') {
				label = `Día ${i + 1}`;
			} else if (granularity === 'week') {
				label = `Sem ${i + 1}`;
			} else if (granularity === 'month') {
				label = `Mes ${i + 1}`;
			}

			alignedLabels.push(label);
			alignedDataA.push(calculateMetric(groupsA[keyA]));
			alignedDataB.push(calculateMetric(groupsB[keyB]));
			originalKeysA.push(keyA);
			originalKeysB.push(keyB);
		}

		return {
			labels: alignedLabels,
			dataA: alignedDataA,
			dataB: alignedDataB,
			keysA: originalKeysA,
			keysB: originalKeysB,
			groupsA,
			groupsB
		};
	}

	function createChart() {
		if (!canvas) return;

		// Validaciones según modo
		if (projectComparisonEnabled) {
			// Modo comparación de proyectos
			if (Object.keys(projectsDateGroups).length === 0) return;
		} else if (comparativeEnabled) {
			// Modo comparativo A/B
			if (Object.keys(dateGroupsA).length === 0 || Object.keys(dateGroupsB).length === 0) return;
		} else {
			// Modo normal
			if (Object.keys(dateGroupsA).length === 0) return;
		}

		// Destruir gráfico existente
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		console.log(`📊 Renderizando timeline (granularidad: ${granularity}, métrica: ${heatmapMetric}, comparativo: ${comparativeEnabled})...`);

		// Función auxiliar para calcular métrica de un grupo de posts
		function calculateMetric(posts) {
			if (heatmapMetric === 'engagement') {
				return posts.reduce((sum, post) => {
					return sum + parseInt(post.likes || 0) + parseInt(post.replies || 0) + parseInt(post.shared || 0);
				}, 0);
			}
			return posts.length; // 'posts' por defecto
		}

		let labels, chartData;
		let chartDataB;
		let projectsChartData = {}; // { projectId: [values...] }

		if (projectComparisonEnabled) {
			// Modo comparación de proyectos: crear series para cada proyecto
			console.log(`📊 Renderizando ${Object.keys(projectsDateGroups).length} proyectos...`);

			// Obtener todas las fechas únicas de todos los proyectos
			const allDates = new Set();
			Object.values(projectsDateGroups).forEach(dateGroups => {
				Object.keys(dateGroups).forEach(date => allDates.add(date));
			});

			// Ordenar fechas
			sortedKeys = Array.from(allDates).sort();
			console.log(`🔍 sortedKeys generadas: ${sortedKeys.length} fechas únicas`, sortedKeys.slice(0, 5));

			// Crear labels
			labels = sortedKeys.map((key, index) => {
				const previousKey = index > 0 ? sortedKeys[index - 1] : null;
				return formatLabel(key, granularity, previousKey);
			});

			// Crear datos para cada proyecto
			for (const [projectId, dateGroups] of Object.entries(projectsDateGroups)) {
				console.log(`🔍 Mapping data for project: ${projectId}`);
				console.log(`   Available dates:`, Object.keys(dateGroups).length);
				console.log(`   First 3 dates:`, Object.keys(dateGroups).slice(0, 3));
				console.log(`   Sample counts:`, Object.keys(dateGroups).slice(0, 3).map(key =>
					dateGroups[key] ? dateGroups[key].length : 0
				));

				projectsChartData[projectId] = sortedKeys.map(key => {
					if (dateGroups[key]) {
						return calculateMetric(dateGroups[key]);
					}
					return 0; // Si no hay datos para esa fecha, poner 0
				});

				console.log(`   Result array sample:`, projectsChartData[projectId].slice(0, 5));
				console.log(`   Result total:`, projectsChartData[projectId].reduce((sum, val) => sum + val, 0));
			}

			console.log(`📊 ${sortedKeys.length} puntos temporales para ${Object.keys(projectsChartData).length} proyectos`);
		} else if (comparativeEnabled) {
			// Modo comparativo: usar datos procesados por el worker
			const aligned = alignComparativePeriods(dateGroupsA, dateGroupsB);

			labels = aligned.labels;
			chartData = aligned.dataA;
			chartDataB = aligned.dataB;

			// Asignar a variables de componente para onClick
			sortedKeys = aligned.keysA;
			sortedKeysB = aligned.keysB;
			currentDateGroups = aligned.groupsA;
			currentDateGroupsB = aligned.groupsB;

			console.log(`📊 Períodos alineados: ${labels.length} puntos de comparación`);
		} else {
			// Modo normal: usar datos procesados por el worker
			currentDateGroups = dateGroupsA;

			sortedKeys = Object.keys(currentDateGroups).sort();
			console.log('📊 Grupos procesados:', sortedKeys.slice(0, 5), '... total:', sortedKeys.length);

			// Crear etiquetas según granularidad
			labels = sortedKeys.map((key, index) => {
				const previousKey = index > 0 ? sortedKeys[index - 1] : null;
				return formatLabel(key, granularity, previousKey);
			});

			// Calcular métrica según heatmapMetric
			chartData = sortedKeys.map(key => calculateMetric(currentDateGroups[key]));
		}

		// Convertir 'area' y 'areaSmooth' a configuración 'line' correcta
		const actualChartType = (chartType === 'area' || chartType === 'areaSmooth') ? 'line' : chartType;
		const isAreaChart = chartType === 'area' || chartType === 'areaSmooth';
		const isAreaSmooth = chartType === 'areaSmooth';

		if (isAreaChart) {
			console.log(`🌊 Creando gráfico de área (line + fill)${isAreaSmooth ? ' - Área Suave' : ''}`);
		}

		// Obtener label de granularidad para UI
		const granularityLabels = {
			'hour': 'por hora',
			'day': 'por día',
			'week': 'por semana',
			'month': 'por mes'
		};

		// Crear datasets
		const datasets = [];

		// Colores tema chileno
		const chileColors = [
			{ bg: '#3b82f6', border: '#1e40af' },  // Azul Chile
			{ bg: '#ef4444', border: '#dc2626' }   // Rojo Chile
		];

		if (projectComparisonEnabled) {
			// Modo comparación de proyectos: crear un dataset por proyecto
			console.log('🔍 DEBUG projectsChartData:', projectsChartData);

			Object.entries(projectsChartData).forEach(([projectId, data], index) => {
				const proyecto = projects.find(p => p.id === projectId);

				console.log(`📊 Dataset ${index + 1}:`, {
					projectId,
					proyectoEncontrado: !!proyecto,
					nombreProyecto: proyecto?.nombre,
					color: proyecto?.color,
					dataLength: data.length,
					dataSample: data.slice(0, 3),
					dataTotal: data.reduce((sum, val) => sum + val, 0)
				});

				if (!proyecto) {
					console.warn(`⚠️ Proyecto ${projectId} no encontrado en la lista`);
					return;
				}

				const projectColor = proyecto.color || '#3498db';

				const dataset = {
					label: proyecto.nombre,
					data: data,
					borderColor: projectColor,
					borderWidth: 2,
					backgroundColor: chartType === 'bar' ? projectColor : `${projectColor}33`, // 33 = 20% opacity
					fill: isAreaChart,
					tension: 0.4,
					pointBackgroundColor: projectColor,
					pointBorderColor: projectColor,
					pointRadius: isAreaChart ? 0 : 3,
					pointHoverRadius: 6,
				};

				datasets.push(dataset);
				console.log(`✅ Dataset creado:`, dataset.label, 'con color', projectColor);
			});

			console.log(`✅ ${datasets.length} datasets creados para proyectos`);
		} else if (comparativeEnabled) {
			// Para areaSmooth: ordenar por volumen (menor abajo, mayor arriba)
			const series = [
				{ label: 'Período A', data: chartData, totalVolume: chartData.reduce((sum, val) => sum + val, 0), colorIndex: 0 },
				{ label: 'Período B', data: chartDataB, totalVolume: chartDataB.reduce((sum, val) => sum + val, 0), colorIndex: 1 }
			];

			if (isAreaSmooth) {
				series.sort((a, b) => a.totalVolume - b.totalVolume);
			}

			series.forEach((serie, index) => {
				const colorIdx = isAreaSmooth ? index : serie.colorIndex;

				datasets.push({
					label: serie.label,
					data: serie.data,
					borderColor: isAreaSmooth ? chileColors[colorIdx].border :
								(colorIdx === 0 ? '#3498db' : '#e74c3c'),
					borderWidth: isAreaSmooth ? 0 : 2,
					backgroundColor: isAreaSmooth ? chileColors[colorIdx].bg :
								   isAreaChart ? (colorIdx === 0 ? 'rgba(52, 152, 219, 0.3)' : 'rgba(231, 76, 60, 0.3)') :
								   (chartType === 'bar' ? (colorIdx === 0 ? '#3498db' : '#e74c3c') :
								   (colorIdx === 0 ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)')),
					fill: isAreaChart ? (isAreaSmooth ? 'origin' : true) : false,
					tension: 0.4,
					pointBackgroundColor: colorIdx === 0 ? '#3498db' : '#e74c3c',
					pointBorderColor: colorIdx === 0 ? '#2980b9' : '#c0392b',
					pointRadius: isAreaSmooth ? 0 : (isAreaChart ? 4 : 3),
					pointHoverRadius: isAreaSmooth ? 0 : 6,
					stack: isAreaSmooth ? 'stacked' : undefined
				});
			});
		} else {
			// Dataset normal (un solo período)
			const metricLabel = heatmapMetric === 'engagement' ? 'Engagement' : 'Posts';
			datasets.push({
				label: `${metricLabel} ${granularityLabels[granularity]}`,
				data: chartData,
				borderColor: isAreaSmooth ? chileColors[0].border : '#3498db',
				borderWidth: isAreaSmooth ? 0 : 2,
				backgroundColor: isAreaSmooth ? chileColors[0].bg :
							   isAreaChart ? 'rgba(52, 152, 219, 0.3)' :
							   (chartType === 'bar' ? '#3498db' : 'rgba(52, 152, 219, 0.1)'),
				fill: isAreaChart,
				tension: 0.4,
				pointBackgroundColor: '#3498db',
				pointBorderColor: '#2980b9',
				pointRadius: isAreaSmooth ? 0 : (isAreaChart ? 4 : 3),
				pointHoverRadius: isAreaSmooth ? 0 : 6,
				stack: isAreaSmooth ? 'stacked' : undefined
			});
		}

		chartInstance = new Chart(ctx, {
			type: actualChartType,
			data: {
				labels: labels,
				datasets: datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const datasetIndex = elements[0].datasetIndex;
						const index = elements[0].index;

						let clickedKey, postsForGroup, period;

						if (comparativeEnabled) {
							// En modo comparativo, determinar qué período fue clickeado
							if (datasetIndex === 0) {
								clickedKey = sortedKeys[index];
								postsForGroup = currentDateGroups[clickedKey] || [];
								period = 'A';
							} else {
								clickedKey = sortedKeysB[index];
								postsForGroup = currentDateGroupsB[clickedKey] || [];
								period = 'B';
							}

							if (postsForGroup.length > 0) {
								selectedDate = `Período ${period} - ${formatLabel(clickedKey, granularity)}`;
								selectedPosts = postsForGroup;
								showModal = true;

								console.log(`📊 Click en Período ${period}:`, clickedKey, '- Posts:', postsForGroup.length);
							}
						} else {
							// Modo normal
							clickedKey = sortedKeys[index];
							postsForGroup = currentDateGroups[clickedKey] || [];

							if (postsForGroup.length > 0) {
								if (granularity === 'hour') {
									const [dateStr, hourStr] = clickedKey.split(' ');
									if (hourStr) {
										const [year, month, day] = dateStr.split('-');
										const dateObj = new Date(Date.UTC(year, month - 1, day));
										const dayMonth = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
										selectedDate = `Posts publicados el ${dayMonth} a las ${hourStr}:00`;
									} else {
										selectedDate = formatLabel(clickedKey, granularity);
									}
								} else {
									selectedDate = formatLabel(clickedKey, granularity);
								}
								selectedPosts = postsForGroup;
								showModal = true;

								console.log('📊 Click en grupo:', clickedKey, '- Posts:', postsForGroup.length);
							}
						}
					}
				},
				plugins: {
					title: {
						display: true,
						text: projectComparisonEnabled ?
							`Comparación de Proyectos - ${heatmapMetric === 'engagement' ? 'Engagement' : 'Posts'} ${granularityLabels[granularity]}${isAreaChart ? ' (Área)' : ''}` :
							comparativeEnabled ?
							`Comparación A/B - ${heatmapMetric === 'engagement' ? 'Engagement' : 'Posts'} ${granularityLabels[granularity]}${isAreaChart ? ' (Área)' : ''}` :
							`Evolución temporal de ${heatmapMetric === 'engagement' ? 'engagement' : 'posts'} ${granularityLabels[granularity]}${isAreaChart ? ' (Área)' : ''}`
					},
					tooltip: {
						callbacks: {
							title: function(context) {
								const index = context[0].dataIndex;
								const key = sortedKeys[index];
								// Para tooltip siempre mostrar fecha completa en granularidad hora
								if (granularity === 'hour') {
									const [dateStr, hourStr] = key.split(' ');
									if (!hourStr) return key; // Validación defensiva
									const [year, month, day] = dateStr.split('-');
									const dateObj = new Date(Date.UTC(year, month - 1, day));
									const dayMonth = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
									return `${dayMonth} ${hourStr}:00`;
								}
								return formatLabel(key, granularity);
							},
							label: function(context) {
								const count = context.parsed.y;
								const metricLabel = heatmapMetric === 'engagement' ? 'Engagement' : 'Posts';
								return `${metricLabel}: ${count.toLocaleString()} (Click para ver detalles)`;
							}
						}
					}
				},
				scales: {
					x: {
						stacked: isAreaSmooth,
						title: {
							display: true,
							text: granularity === 'hour' ? 'Hora del día' : 'Fecha'
						},
						ticks: {
							padding: 10,
							maxRotation: 45,
							minRotation: 0
						}
					},
					y: {
						beginAtZero: true,
						stacked: isAreaSmooth,
						title: {
							display: true,
							text: heatmapMetric === 'engagement' ? 'Engagement Total' : 'Cantidad de Posts'
						}
					}
				},
				elements: {
					line: {
						fill: isAreaChart
					}
				},
				interaction: {
					mode: 'nearest',
					intersect: true
				}
			}
		});

		console.log('📊 Timeline chart created with type:', chartType);
	}

	onMount(() => {
		mounted = true;
		console.log('📊 TimelineChart montado, datos:', data.length);

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/timeline.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					dateGroupsA = workerData.dateGroupsA;
					dateGroupsB = workerData.dateGroupsB || {};
					console.log(`✅ Worker completado en ${duration}ms - ${workerData.stats.totalPeriodsA} períodos procesados`);

					// Trigger chart creation
					if (canvas) {
						createChart();
					}
				}
			};

			worker.onerror = function(error) {
				console.error('❌ Error en Worker:', error);
				isProcessing = false;
			};
		}

		// Procesar datos si ya están disponibles
		if (data.length > 0 && !isHeatmap) {
			processDataWithWorker();
		}
	});

	onDestroy(() => {
		if (worker) {
			worker.terminate();
		}
		if (chartInstance) {
			chartInstance.destroy();
		}
	});
</script>

<div class="timeline-container">
	{#if data.length === 0 && !projectComparisonEnabled}
		<div class="no-data-message">
			<div class="no-data-icon">📊</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron posts con los filtros seleccionados</p>
		</div>
	{:else if isHeatmap}
		<HeatmapCalendarChart {data} metric={heatmapMetric} />
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Procesando línea de tiempo...</h3>
			<p>{processingProgress}% completado</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {processingProgress}%"></div>
			</div>
		</div>
	{:else}
		<canvas bind:this={canvas} class="chart-canvas"></canvas>
	{/if}
</div>

<PostDetailsModal
	bind:isOpen={showModal}
	posts={selectedPosts}
	date={selectedDate}
	on:close={() => showModal = false}
/>

<style>
	.timeline-container {
		position: relative;
		cursor: pointer;
	}

	.chart-canvas {
		width: 100% !important;
		height: 400px !important;
		max-height: 400px;
		cursor: pointer;
	}

	.no-data-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: #666;
		text-align: center;
	}

	.no-data-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
		opacity: 0.3;
	}

	.no-data-message h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.no-data-message p {
		margin: 0;
		font-size: 1rem;
		color: #999;
	}

	.processing-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: #666;
		text-align: center;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid rgba(52, 152, 219, 0.2);
		border-top-color: #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.processing-message h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.processing-message p {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #999;
	}

	.progress-bar {
		width: 300px;
		height: 8px;
		background-color: rgba(52, 152, 219, 0.2);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: #3498db;
		transition: width 0.3s ease;
	}
</style>